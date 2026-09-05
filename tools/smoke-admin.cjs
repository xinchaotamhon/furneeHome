const assert = require('node:assert/strict');
const test = require('node:test');

const {
  hasExpectedImageSignature,
  adminProductImageTarget,
  mergeCanonicalProducts,
  persistAdminProductImage,
  productImageId,
  sourceUrlMetadata,
  toPlainProduct,
  validateAdminProductImage,
  validateProductImageGallery,
} = require('../server/src/services/productCatalogService');
const {
  createAnonymousGenerationQuotaService, getClientAddress, hashAddress,
} = require('../server/src/services/anonymousGenerationQuotaService');
const {
  isLocalRequest,
  localOnlyAccountAllowed,
  localShopeeImportAllowed,
  requireAdmin,
  requireLocalShopeeImport,
} = require('../server/src/middleware/authMiddleware');
const { buildLoginLookup } = require('../server/src/controllers/authController');
const {
  compactProductListItem,
  validateImportedShopeeMetadata,
  buildUrlOnlyShopeeFallback,
} = require('../server/src/controllers/productController');
const { readProductionMode, readTrustProxy } = require('../server/src/config/env');
const { importMetadataFromShopee } = require('../server/src/services/shopeeImportService');

function createQuotaModel() {
  const records = new Map();
  const copy = (record) => (record ? { ...record } : null);
  const isEligible = (record, filter) => record && filter.$or.some((condition) => (
    condition.state === 'available' ? record.state === 'available'
      : record.state === 'reserved' && record.reservedUntil < condition.reservedUntil.$lt
  ));
  return {
    records,
    async findOneAndUpdate(filter, update, options) {
      const record = records.get(filter.ipHash);
      if (record && !isEligible(record, filter)) {
        if (options.upsert) {
          const error = new Error('duplicate ipHash');
          error.code = 11000;
          throw error;
        }
        return null;
      }
      const target = record || { ipHash: update.$setOnInsert.ipHash, state: 'available' };
      Object.assign(target, update.$set);
      records.set(filter.ipHash, target);
      return copy(target);
    },
    findOne(filter) {
      return { select: async () => copy(records.get(filter.ipHash)) };
    },
    async updateOne(filter, update) {
      const record = records.get(filter.ipHash);
      if (!record || record.state !== filter.state || record.reservationId !== filter.reservationId) return { modifiedCount: 0 };
      Object.assign(record, update.$set);
      return { modifiedCount: 1 };
    },
  };
}

function request(address = '203.0.113.7') {
  return { ip: address, socket: { remoteAddress: address }, headers: {} };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function fetchResponse(body, { status = 200, contentType = 'application/json' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get(name) { return name.toLowerCase() === 'content-type' ? contentType : null; } },
    async text() { return body; },
  };
}

test('admin URL prefill accepts a Shopee HTTPS product URL without fetching it', () => {
  const metadata = sourceUrlMetadata('https://shopee.vn/Ban-gap-thap-ngoi-bet-cm-i.691586816.58014018417?extParams=%7B%22foo%22%3A1%7D');
  assert.equal(metadata.sourceUrl, 'https://shopee.vn/Ban-gap-thap-ngoi-bet-cm-i.691586816.58014018417');
  assert.equal(metadata.name, 'Ban gap thap ngoi bet cm');
  assert.equal(metadata.shopeeShopId, '691586816');
  assert.equal(metadata.shopeeItemId, '58014018417');
  assert.equal(metadata.metadataSource, 'url-slug');
  const productRoute = sourceUrlMetadata('https://shopee.vn/product/123/456?tracking=ignored');
  assert.equal(productRoute.shopeeShopId, '123');
  assert.equal(productRoute.shopeeItemId, '456');
});

test('admin URL prefill rejects a non-Shopee or non-HTTPS URL', () => {
  assert.throws(() => sourceUrlMetadata('http://shopee.vn/item-i.1.2'));
  assert.throws(() => sourceUrlMetadata('https://example.com/item-i.1.2'));
  assert.throws(
    () => sourceUrlMetadata('https://shopee.vn/%E0%A4%A'),
    (error) => error.status === 400,
  );
});

test('one-click Shopee import accepts complete official API metadata without inventing fields', async () => {
  const apiFixture = JSON.stringify({
    data: {
      item: {
        shopid: 123,
        itemid: 456,
        name: 'Bàn thấp ngồi bệt',
        description: 'Bàn gấp thấp cho phòng trọ.',
        price: 25900000000,
        images: ['abc_123'],
        shop_name: 'Cửa hàng mẫu',
        rating_star: 4.8,
      },
    },
  });
  const imported = await importMetadataFromShopee('https://shopee.vn/ban-thap-i.123.456?tracking=1', {
    fetchImpl: async (url) => {
      assert.match(url, /\/api\/v4\/item\/get\?itemid=456&shopid=123$/);
      return fetchResponse(apiFixture);
    },
  });
  assert.equal(imported.metadataSource, 'shopee-api');
  assert.equal(imported.name, 'Bàn thấp ngồi bệt');
  assert.equal(imported.price, 259000);
  assert.equal(imported.sellerName, 'Cửa hàng mẫu');
  assert.equal(imported.sourceImages[0], 'https://down-vn.img.susercontent.com/file/abc_123');
});

test('Shopee import reads the embedded MFE JSON format used by product pages', async () => {
  const htmlFixture = `<!doctype html><script type="text/mfe-initial-data">{"data":{"item":{"shopid":123,"itemid":456,"name":"Ghế gấp","price":19900000000,"images":["mfe_image"]}}}</script>`;
  let calls = 0;
  const imported = await importMetadataFromShopee('https://shopee.vn/ghe-gap-i.123.456', {
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? fetchResponse('{"error":90309999}', { status: 403 }) : fetchResponse(htmlFixture, { contentType: 'text/html' });
    },
  });
  assert.equal(calls, 2);
  assert.equal(imported.metadataSource, 'html-mfe-data');
  assert.equal(imported.name, 'Ghế gấp');
  assert.equal(imported.price, 199000);
});

test('Shopee import reads current PDP BFF data split across item, price and image blocks', async () => {
  const initialData = {
    initialState: {
      DOMAIN_PDP: {
        data: {
          PDP_BFF_DATA: {
            cachedMap: {
              '123/456': {
                item: {
                  shop_id: 123,
                  item_id: 456,
                  title: 'Bàn học gấp gọn',
                  description: 'Bàn thấp dùng khi ngồi bệt.',
                  categories: [{ display_name: 'Nội thất' }, { display_name: 'Bàn' }],
                },
                product_price: { price: { single_value: 15900000000 } },
                product_images: {
                  images: ['main_image'],
                  gallery_contents: [{ image: { url: 'second_image' } }],
                },
                product_review: { rating_star: 4.8 },
              },
            },
          },
        },
      },
    },
  };
  const htmlFixture = `<!doctype html><script type="text/mfe-initial-data">${JSON.stringify(initialData)}</script>`;
  let requestCount = 0;
  const imported = await importMetadataFromShopee('https://shopee.vn/ban-hoc-i.123.456', {
    fetchImpl: async () => {
      requestCount += 1;
      return fetchResponse(requestCount === 1 ? '' : htmlFixture, {
        status: requestCount === 1 ? 403 : 200,
        contentType: requestCount === 1 ? 'application/json' : 'text/html',
      });
    },
  });

  assert.equal(imported.name, 'Bàn học gấp gọn');
  assert.equal(imported.price, 159000);
  assert.equal(imported.category, 'Bàn');
  assert.equal(imported.rating, 4.8);
  assert.equal(imported.sourceImages.length, 2);
});

test('Shopee import refuses anti-bot pages instead of creating URL-slug or zero-price data', async () => {
  await assert.rejects(
    importMetadataFromShopee('https://shopee.vn/ban-gap-i.123.456', {
      fetchImpl: async () => fetchResponse('<html><body>blocked</body></html>', { contentType: 'text/html' }),
    }),
    (error) => error.status === 422 && /chưa trả đủ/.test(error.message),
  );
});

test('admin import guard rejects incomplete scraped metadata', () => {
  assert.throws(
    () => validateImportedShopeeMetadata({
      name: 'Bàn gấp', price: 0, sourceImages: [], shopeeShopId: '123', shopeeItemId: '456',
    }),
    (error) => error.status === 422 && /chưa trả đủ/.test(error.message),
  );
  assert.throws(
    () => validateImportedShopeeMetadata({
      name: 'Bàn gấp', price: 0,
      sourceImages: ['https://down-vn.img.susercontent.com/file/image'],
      shopeeShopId: '123', shopeeItemId: '456',
    }),
    (error) => error.status === 422 && /chưa trả đủ/.test(error.message),
  );
  const imported = validateImportedShopeeMetadata({
    name: 'Bàn gấp', price: 259000, sourceImages: ['https://down-vn.img.susercontent.com/file/image'],
    shopeeShopId: '123', shopeeItemId: '456', description: '', sellerName: '', rating: null,
  });
  assert.equal(imported.name, 'Bàn gấp');
});

test('URL-only Shopee fallback keeps only URL identity and never invents product fields', () => {
  const fallback = buildUrlOnlyShopeeFallback('https://shopee.vn/ban-gap-thap-i.691586816.58014018417?tracking=1');
  assert.deepEqual(fallback, {
    sourceUrl: 'https://shopee.vn/ban-gap-thap-i.691586816.58014018417',
    name: 'ban gap thap',
    shopeeShopId: '691586816',
    shopeeItemId: '58014018417',
    metadataSource: 'url-slug',
  });
  assert.equal(Object.hasOwn(fallback, 'price'), false);
  assert.equal(Object.hasOwn(fallback, 'description'), false);
  assert.equal(Object.hasOwn(fallback, 'sellerName'), false);
  assert.equal(Object.hasOwn(fallback, 'rating'), false);
  assert.equal(Object.hasOwn(fallback, 'sourceImages'), false);
  assert.throws(
    () => buildUrlOnlyShopeeFallback('https://shopee.vn/ban-gap-thap'),
    (error) => error.status === 422,
  );
});

test('canonical JSON keeps AI placement attributes and legacy product fields', () => {
  const product = toPlainProduct({
    _id: 'product-1', name: 'Bàn thấp', slug: 'ban-thap', category: { name: 'Bàn học' },
    price: 0, images: ['/images/a.png', '/images/b.png'], image: '/images/a.png',
    transparentImage: '/images/a.png', sourceUrl: 'https://shopee.vn/item-i.1.2',
    dimensionsCm: { width: 80, depth: 40, height: 35 }, usageType: 'floor-seating',
    placementSurface: 'floor', aiDescription: 'Bàn thấp để ngồi bệt.', isActive: true,
  });
  assert.equal(product.category, 'Bàn học');
  assert.deepEqual(product.dimensionsCm, { width: 80, depth: 40, height: 35 });
  assert.equal(product.usageType, 'floor-seating');
  assert.equal(product.placementSurface, 'floor');
  assert.equal(product.aiDescription, 'Bàn thấp để ngồi bệt.');
  assert.deepEqual(product.images, ['/images/a.png', '/images/b.png']);
});

test('downloadable fallback JSON stays light while MongoDB keeps uploaded base64 images', () => {
  const dataImage = `data:image/webp;base64,${Buffer.from('RIFF0000WEBPpayload').toString('base64')}`;
  const product = toPlainProduct({
    _id: 'product-2', name: 'Ghế nhỏ', image: dataImage, transparentImage: dataImage,
    images: [dataImage, '/images/products/chair.webp'], isActive: true,
  }, { includeDataUrls: false });
  assert.equal(product.image, '/images/products/chair.webp');
  assert.equal(product.transparentImage, '/images/products/chair.webp');
  assert.deepEqual(product.images, ['/images/products/chair.webp']);
});

test('public product list does not send the same uploaded image twice', () => {
  const dataImage = `data:image/webp;base64,${Buffer.from('RIFF0000WEBPpayload').toString('base64')}`;
  const product = compactProductListItem({ _id: 'product-3', image: dataImage, transparentImage: dataImage });
  assert.equal(product.image, dataImage);
  assert.equal(product.transparentImage, '');
});

test('canonical JSON merge preserves unknown fields and JSON-only rows, but removes an explicit deletion', () => {
  const merged = mergeCanonicalProducts(
    [
      { _id: 'db-1', name: 'Tên cũ', customLegacyField: 'must-survive' },
      { _id: 'json-only', name: 'Dữ liệu cũ chỉ có trong JSON', customLegacyField: 'also-survives' },
      { _id: 'deleted', name: 'Đã xóa' },
    ],
    [{ _id: 'db-1', name: 'Tên mới', categoryName: 'Bàn học', price: 0, isActive: true }],
    { removedIds: ['deleted'] },
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].name, 'Tên mới');
  assert.equal(merged[0].customLegacyField, 'must-survive');
  assert.equal(merged[1]._id, 'json-only');
  assert.equal(merged.some((item) => item._id === 'deleted'), false);
});

test('anonymous generation quota only derives a deterministic one-way address key', () => {
  const first = hashAddress('127.0.0.1');
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, hashAddress('127.0.0.1'));
  assert.notEqual(first, hashAddress('127.0.0.2'));
  assert.equal(first.includes('127.0.0.1'), false);
});

test('anonymous quota reserves once, releases on failure, then permanently consumes on success', async () => {
  const quotaModel = createQuotaModel();
  const service = createAnonymousGenerationQuotaService({ quotaModel, now: () => new Date('2026-09-04T00:00:00Z') });
  const first = request();
  const firstResponse = response();
  let firstNext = false;
  await service.reserveAnonymousGeneration(first, firstResponse, () => { firstNext = true; });
  assert.equal(firstNext, true);
  assert.equal(quotaModel.records.size, 1);

  const competing = request();
  const competingResponse = response();
  await service.reserveAnonymousGeneration(competing, competingResponse, () => assert.fail('competing request must not continue'));
  assert.equal(competingResponse.statusCode, 401);
  assert.equal(competingResponse.body.code, 'GUEST_GENERATION_PENDING');

  await service.releaseAnonymousGeneration(first);
  const retry = request();
  let retryNext = false;
  await service.reserveAnonymousGeneration(retry, response(), () => { retryNext = true; });
  assert.equal(retryNext, true);
  await service.markAnonymousGenerationSucceeded(retry);

  const afterSuccess = response();
  await service.reserveAnonymousGeneration(request(), afterSuccess, () => assert.fail('used quota must not continue'));
  assert.equal(afterSuccess.statusCode, 401);
  assert.equal(afterSuccess.body.code, 'GUEST_LIMIT_REACHED');
});

test('authenticated users bypass guest quota and untrusted XFF is not used as client IP', async () => {
  const quotaModel = createQuotaModel();
  const service = createAnonymousGenerationQuotaService({ quotaModel });
  const signedIn = request();
  signedIn.user = { _id: 'real-user' };
  let nextCalled = false;
  await service.reserveAnonymousGeneration(signedIn, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(quotaModel.records.size, 0);

  const spoofed = { ip: '198.51.100.10', socket: { remoteAddress: '198.51.100.10' }, headers: { 'x-forwarded-for': '1.2.3.4' } };
  assert.equal(getClientAddress(spoofed), '198.51.100.10');
});

test('local-only accounts are accepted solely from direct loopback outside production', () => {
  assert.equal(isLocalRequest({ socket: { remoteAddress: '::ffff:127.0.0.1' } }), true);
  assert.equal(isLocalRequest({ socket: { remoteAddress: '10.0.0.2' } }), false);
  assert.equal(localOnlyAccountAllowed({ socket: { remoteAddress: '127.0.0.1' } }, { localOnly: true }), true);
  assert.equal(localOnlyAccountAllowed({ socket: { remoteAddress: '10.0.0.2' } }, { localOnly: true }), false);
  assert.equal(localOnlyAccountAllowed({ socket: { remoteAddress: '127.0.0.1' } }, { localOnly: true }, true), false);
});

test('Shopee import is localhost-only in development and disabled in production', () => {
  const local = { socket: { remoteAddress: '127.0.0.1' } };
  const remote = { socket: { remoteAddress: '10.0.0.2' } };
  const spoofedLocal = { socket: { remoteAddress: '10.0.0.2' }, headers: { 'x-forwarded-for': '127.0.0.1' } };
  assert.equal(localShopeeImportAllowed(local, false), true);
  assert.equal(localShopeeImportAllowed(remote, false), false);
  assert.equal(localShopeeImportAllowed(spoofedLocal, false), false);
  assert.equal(localShopeeImportAllowed(local, true), false);

  const deniedRemote = response();
  let nextCalled = false;
  requireLocalShopeeImport(remote, deniedRemote, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(deniedRemote.statusCode, 403);
  assert.equal(deniedRemote.body.message, 'Thao tác này chỉ được phép trên localhost.');

  const allowedLocal = response();
  requireLocalShopeeImport(local, allowedLocal, () => { nextCalled = true; });
  assert.equal(nextCalled, true);

  const productRoutes = require('../server/src/routes/productRoutes');
  const importRoute = productRoutes.stack.find((layer) => layer.route?.path === '/import-shopee');
  assert.deepEqual(importRoute.route.stack.map((layer) => layer.name), [
    'authenticate', 'requireAdmin', 'requireLocalShopeeImport', 'importShopee',
  ]);
  for (const path of ['/metadata', '/export-json', '/:id/images']) {
    const route = productRoutes.stack.find((layer) => layer.route?.path === path);
    assert.equal(route.route.stack.some((layer) => layer.name === 'requireLocalShopeeImport'), false);
  }
});

test('login lookup supports a username and legacy email through the same safe query', () => {
  assert.deepEqual(buildLoginLookup('admin'), {
    isActive: true,
    $or: [{ email: 'admin' }, { username: 'admin' }],
  });
});

test('non-admin users cannot reach protected product import or upload handlers', () => {
  const denied = response();
  let nextCalled = false;
  requireAdmin({ user: { role: 'customer' } }, denied, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.success, false);
});

test('image upload signature must match declared PNG, JPEG, or WebP type', () => {
  assert.equal(hasExpectedImageSignature('image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
  assert.equal(hasExpectedImageSignature('image/png', Buffer.from('not-a-png')), false);
  assert.equal(hasExpectedImageSignature('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(hasExpectedImageSignature('image/webp', Buffer.from('RIFF0000WEBPpayload')), true);
});

test('admin image storage derives a safe local filename from the Shopee item id matching PNG, JPG, or WebP', async () => {
  const writes = [];
  const fakeFs = {
    async mkdir(directory, options) { writes.push({ operation: 'mkdir', directory, options }); },
    async writeFile(filePath, contents) { writes.push({ operation: 'writeFile', filePath, contents }); },
  };
  const product = {
    _id: 'mongo-id',
    sourceUrl: 'https://shopee.vn/ban-cm-i.691586816.58014018417?ext=1',
    shopeeItemId: '',
  };
  assert.equal(productImageId(product), '58014018417');

  // PNG (mặc định cho ảnh tách nền)
  assert.equal(adminProductImageTarget(product).publicPath, '/images/products/58014018417.png');
  assert.equal(adminProductImageTarget(product, 'image/png').publicPath, '/images/products/58014018417.png');
  const pngPayload = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  const pngDataUrl = `data:image/png;base64,${pngPayload.toString('base64')}`;
  const savedPng = await persistAdminProductImage(product, pngDataUrl, { isProduction: false, fsImpl: fakeFs });
  assert.equal(savedPng.value, '/images/products/58014018417.png');
  assert.equal(savedPng.written, true);
  assert.match(writes[writes.length - 1].filePath, /client[\\/]public[\\/]images[\\/]products[\\/]58014018417\.png$/);

  // JPEG
  assert.equal(adminProductImageTarget(product, 'image/jpeg').publicPath, '/images/products/58014018417.jpg');
  const jpgPayload = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);
  const jpgDataUrl = `data:image/jpeg;base64,${jpgPayload.toString('base64')}`;
  const savedJpg = await persistAdminProductImage(product, jpgDataUrl, { isProduction: false, fsImpl: fakeFs });
  assert.equal(savedJpg.value, '/images/products/58014018417.jpg');
  assert.equal(savedJpg.written, true);
  assert.match(writes[writes.length - 1].filePath, /client[\\/]public[\\/]images[\\/]products[\\/]58014018417\.jpg$/);

  // WebP
  assert.equal(adminProductImageTarget(product, 'image/webp').publicPath, '/images/products/58014018417.webp');
  const webpPayload = Buffer.from('RIFF0000WEBPpayload');
  const webpDataUrl = `data:image/webp;base64,${webpPayload.toString('base64')}`;
  const savedWebp = await persistAdminProductImage(product, webpDataUrl, { isProduction: false, fsImpl: fakeFs });
  assert.equal(savedWebp.value, '/images/products/58014018417.webp');
  assert.equal(savedWebp.written, true);
  assert.match(writes[writes.length - 1].filePath, /client[\\/]public[\\/]images[\\/]products[\\/]58014018417\.webp$/);
  assert.equal(writes[writes.length - 1].contents.toString(), 'RIFF0000WEBPpayload');
});

test('admin image storage keeps Mongo data URL when deployed or when local write fails', async () => {
  const dataUrl = `data:image/webp;base64,${Buffer.from('RIFF0000WEBPpayload').toString('base64')}`;
  let writeCalls = 0;
  const fakeFs = {
    async mkdir() { writeCalls += 1; },
    async writeFile() { writeCalls += 1; throw new Error('read-only filesystem'); },
  };
  const product = { _id: 'mongo-id', shopeeItemId: '58014018417' };
  const deployed = await persistAdminProductImage(product, dataUrl, { isProduction: true, fsImpl: fakeFs });
  assert.equal(deployed.value, dataUrl);
  assert.equal(deployed.publicPath, '');
  assert.equal(writeCalls, 0);
  const failed = await persistAdminProductImage(product, dataUrl, { isProduction: false, fsImpl: fakeFs });
  assert.equal(failed.value, dataUrl);
  assert.equal(failed.publicPath, '');
  assert.equal(failed.written, false);
});

test('admin image validation enforces format, per-file size and gallery limits', () => {
  const webp = `data:image/webp;base64,${Buffer.from('RIFF0000WEBPpayload').toString('base64')}`;
  assert.equal(validateAdminProductImage(webp), webp);
  assert.throws(() => validateAdminProductImage('data:image/png;base64,bm90LXBuZw=='));
  assert.throws(() => validateAdminProductImage(`data:image/webp;base64,${Buffer.alloc(513 * 1024).toString('base64')}`));
  assert.throws(() => validateProductImageGallery({}, Array.from({ length: 7 }, (_, index) => `${webp}${index}`)));
});

test('preview and deployed Admin routes keep authentication middleware in front of writes', () => {
  const previewRoutes = require('../server/src/routes/roomPreviewRoutes');
  const preview = previewRoutes.stack.find((layer) => layer.route?.path === '/');
  assert.deepEqual(preview.route.stack.map((layer) => layer.name), [
    'optionalAuthenticate', 'reserveAnonymousGeneration', 'create',
  ]);

  const productRoutes = require('../server/src/routes/productRoutes');
  const protectedRoutes = productRoutes.stack.filter((layer) => (
    layer.route && !(layer.route.path === '/' && layer.route.methods.get)
  ));
  protectedRoutes.forEach((layer) => {
    const names = layer.route.stack.map((handler) => handler.name);
    assert.deepEqual(names.slice(0, 2), ['authenticate', 'requireAdmin']);
  });
  const shopeeImport = productRoutes.stack.find((layer) => layer.route?.path === '/import-shopee');
  assert.deepEqual(shopeeImport.route.stack.map((handler) => handler.name), ['authenticate', 'requireAdmin', 'requireLocalShopeeImport', 'importShopee']);
});

test('trust proxy parser supports local off, one Render hop and explicit allowlists', () => {
  assert.equal(readTrustProxy('false'), false);
  assert.equal(readTrustProxy('1'), 1);
  assert.deepEqual(readTrustProxy('loopback,10.0.0.0/8'), ['loopback', '10.0.0.0/8']);
});

test('Render is always treated as production even when NODE_ENV was omitted', () => {
  assert.equal(readProductionMode(undefined, 'true'), true);
  assert.equal(readProductionMode('production', undefined), true);
  assert.equal(readProductionMode('development', undefined), false);
});

test('production seed explicitly converts a matching local-only admin into a deploy account', () => {
  const source = require('node:fs').readFileSync(require.resolve('../server/src/utils/seedData.js'), 'utf8');
  assert.match(source, /localOnly:\s*false/);
  assert.match(source, /env\.isProduction/);
  assert.match(source, /ADMIN_PASSWORD production phải có tối thiểu 12 ký tự/);
});

test('Admin deployed hides Shopee import form but keeps product management actions', () => {
  const source = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '../client/src/pages/AdminPage.jsx'),
    'utf8',
  );
  assert.match(source, /export function isLocalBrowserHost\(hostname = ''\)/);
  assert.match(source, /host === 'localhost' \|\| host === '127\.0\.0\.1' \|\| host === '::1'/);
  assert.match(source, /isLocalBrowserHost\(window\.location\.hostname\)/);
  assert.match(source, /\{isLocalBrowser && \(/);
  assert.match(source, /admin-layout\$\{isLocalBrowser \? '' : ' single'\}/);
  assert.match(source, /downloadProductJson/);
  assert.match(source, /addProductImage/);
  assert.match(source, /removeProduct/);
  const css = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '../client/src/styles/global.css'),
    'utf8',
  );
  assert.match(css, /\.admin-layout\.single \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});
