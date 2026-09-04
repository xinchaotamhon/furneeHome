// Chạy: node --test tools/smoke-room.cjs. Chỉ dùng dữ liệu giả, không gọi AI/DB thật.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const envPath = require.resolve('../server/src/config/env');
const config = {
  roomImageProviderOrder: 'pollinations,cloudflare',
  pollinationsApiKey: 'smoke-not-a-secret',
  pollinationsImageModels: 'gpt-image-2,klein',
  cloudflareAccountId: 'smoke', cloudflareApiToken: 'smoke',
  cloudflareImageModel: '@cf/black-forest-labs/flux-2-klein-4b',
};
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: config };
const service = require('../server/src/services/cloudflareImageService');
const controller = require('../server/src/controllers/roomPreviewController');
const RoomDesign = require('../server/src/models/RoomDesign');
const designs = require('../server/src/controllers/roomDesignController');
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
const input = { mode: 'inspiration', roomImageDataUrl: image, userPrompt: 'Gỗ sáng, dành lối đi tới nhà vệ sinh', imageSize: { width: 1600, height: 900 } };
const placement = { ...input, mode: 'placement', guideImageDataUrl: image, productImageDataUrl: image, productName: 'Interior scene: bàn học, ghế', placement: { x: .3, y: .7, anchor: 'bottom-center' }, editRegion: { x: 0, y: 0, width: 1, height: 1 } };
const success = () => new Response(JSON.stringify({ data: [{ b64_json: image.split(',')[1] }] }), { headers: { 'Content-Type': 'application/json' } });

test('Bàn ngồi bệt giữ công năng, số đo thật và mô tả có cấu trúc trong prompt', async (t) => {
  mockFetch(t, async (url, options) => {
    const prompt = options.body.get('prompt');
    assert.match(prompt, /LOW furniture for FLOOR SEATING/);
    assert.match(prompt, /height 28 cm/);
    assert.match(prompt, /Do not add a chair/);
    assert.match(prompt, /Lối nhà vệ sinh/);
    assert.match(prompt, /chân ngắn màu trắng/);
    return success();
  });
  const response = await callController(controller.create, { ...placement,
    designBrief: { purpose: 'Học ngồi bệt', keepClear: 'Lối nhà vệ sinh' },
    sceneProducts: [{ name: 'Bàn thấp', usageType: 'floor-seating', placementSurface: 'floor', dimensionsCm: { width: 60, depth: 40, height: 28 }, aiDescription: 'chân ngắn màu trắng', target: { x: .5, y: .75 } }],
  });
  assert.equal(response.status, 200);
});

test('Không tự bịa số đo; dữ liệu mô tả/vị trí sai bị chặn trước provider', async (t) => {
  mockFetch(t, async () => assert.fail('Không được gửi request sai tới provider'));
  for (const extra of [
    { designBrief: { purpose: 'x'.repeat(81) } },
    { sceneProducts: [{ name: 'Bàn', target: { x: 2, y: .5 } }] },
    { sceneProducts: [{ name: 'Bàn', target: { x: .5, y: .5 }, dimensionsCm: { height: -1 } }] },
    { sceneProducts: [{ name: 'Bàn', target: { x: .5, y: .5 }, usageType: 'made-up' }] },
  ]) assert.equal((await callController(controller.create, { ...placement, ...extra })).status, 400);
});

test('Lưu collection giữ brief, đặc tính bàn thấp, vị trí 0 và trạng thái ảnh cũ', async (t) => {
  const originalCreate = RoomDesign.create;
  t.after(() => { RoomDesign.create = originalCreate; });
  RoomDesign.create = async (data) => data;
  const productFacts = { usageType: 'floor-seating', placementSurface: 'floor', dimensionsCm: { height: 28 }, aiDescription: 'không thêm ghế' };
  const saved = await callController(designs.create, { name: 'Smoke metadata', resultImage: image, resultMatchesLayout: false,
    designBrief: { purpose: 'Học ngồi bệt' }, placements: [{ productName: 'Bàn thấp', target: { x: 0, y: 0 }, productFacts }],
  }, { user: { _id: '507f1f77bcf86cd799439011' } });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.result.data.placements[0].productFacts, productFacts);
  assert.equal(saved.result.data.placements[0].target.x, 0);
  assert.equal(saved.result.data.designBrief.purpose, 'Học ngồi bệt');
  assert.equal(saved.result.data.resultMatchesLayout, false);
  assert.equal(saved.result.data.resultImage, image);
});

function mockFetch(t, handler) {
  const original = global.fetch;
  global.fetch = handler;
  t.after(() => { global.fetch = original; });
}

async function callController(handler, body, extra = {}) {
  let status = 200, result, failure;
  const res = { status(value) { status = value; return this; }, json(value) { result = value; } };
  await handler({ body, ...extra }, res, (error) => { failure = error; });
  if (failure) return { status: failure.status || 500, result: { message: failure.message } };
  return { status, result };
}

test('Gợi ý cả phòng không yêu cầu sản phẩm, guide, mask hay chấm sàn', async (t) => {
  let calls = 0;
  mockFetch(t, async (url, options) => {
    calls++;
    assert.equal(url, 'https://gen.pollinations.ai/v1/images/edits');
    assert.equal(options.body.getAll('image').length, 1);
    const prompt = options.body.get('prompt');
    assert.match(prompt, /bathroom|toilet/i);
    assert.match(prompt, /furnish/i);
    assert.match(prompt, /Gỗ sáng/);
    assert.doesNotMatch(prompt, /Image 1|placement guide|exact product reference/);
    assert.notEqual(options.body.get('size'), '1024x1024');
    assert.equal(options.body.get('seed'), null);
    return success();
  });
  const response = await callController(controller.create, input);
  assert.equal(response.status, 200);
  assert.equal(response.result.data.mode, 'inspiration');
  assert.equal(response.result.data.imageDataUrl, image);
  assert.equal(calls, 1);
});

test('Gợi ý cả phòng gửi từng ảnh sản phẩm riêng và giữ đúng thứ tự metadata', async (t) => {
  let request;
  mockFetch(t, async (url, options) => {
    request = { url, images: options.body.getAll('image'), prompt: options.body.get('prompt') };
    return success();
  });
  const response = await callController(controller.create, {
    ...input,
    productImageDataUrls: [image, image, image],
    sceneProducts: [
      {
        name: 'Bàn thấp', usageType: 'floor-seating', placementSurface: 'floor',
        dimensionsCm: { width: 60, depth: 40, height: 28 }, aiDescription: 'chân ngắn màu trắng',
        target: { x: .5, y: .75 },
      },
      { name: 'Đèn kẹp bàn', placementSurface: 'tabletop', target: { x: .5, y: .75 } },
      { name: 'Kệ sách nhỏ', placementSurface: 'floor', target: { x: .5, y: .75 } },
    ],
  });
  assert.equal(response.status, 200);
  assert.equal(request.url, 'https://gen.pollinations.ai/v1/images/edits');
  assert.equal(request.images.length, 4);
  assert.equal(request.images[0].name, 'room-original.png');
  assert.equal(request.images[1].name, 'product-1.png');
  assert.equal(request.images[2].name, 'product-2.png');
  assert.equal(request.images[3].name, 'product-3.png');
  assert.match(request.prompt, /subset of the selected FurneeHome catalog products/i);
  assert.match(request.prompt, /Image 0 is the original room/i);
  assert.match(request.prompt, /Image 1 is the exact visual reference for FurneeHome Product 1/i);
  assert.match(request.prompt, /Image 3 is the exact visual reference for FurneeHome Product 3/i);
  assert.match(request.prompt, /Use each referenced product at most once/i);
  assert.match(request.prompt, /FurneeHome Product 1: "Bàn thấp"/);
  assert.match(request.prompt, /height 28 cm/);
  assert.match(request.prompt, /floor seating/i);
  assert.match(request.prompt, /Never turn it into a tall desk or dining table/i);
  assert.match(request.prompt, /walls, doors, windows, stairs, railings, columns, bathroom\/toilet/i);
  assert.match(request.prompt, /Never add a bed, loft, mezzanine/i);
  assert.match(request.prompt, /may already be full, cluttered, occupied, narrow, irregular/i);
  assert.match(request.prompt, /Using fewer products is better/i);
  assert.match(request.prompt, /Preserve existing furniture, appliances, belongings, people and pets/i);
});

test('Cloudflare FLUX.2 nhận ảnh phòng và ba ảnh sản phẩm riêng', async (t) => {
  const previousOrder = config.roomImageProviderOrder;
  const previousPollinationsKey = config.pollinationsApiKey;
  config.roomImageProviderOrder = 'cloudflare';
  config.pollinationsApiKey = '';
  t.after(() => {
    config.roomImageProviderOrder = previousOrder;
    config.pollinationsApiKey = previousPollinationsKey;
  });
  mockFetch(t, async (url, options) => {
    assert.match(url, /api\.cloudflare\.com/);
    assert.equal(options.body.get('input_image_0').name, 'room-original.jpg');
    assert.equal(options.body.get('input_image_1').name, 'product-1.png');
    assert.equal(options.body.get('input_image_2').name, 'product-2.png');
    assert.equal(options.body.get('input_image_3').name, 'product-3.png');
    assert.match(options.body.get('prompt'), /Bàn thấp/);
    assert.match(options.body.get('prompt'), /Image 0 is the original room/i);
    assert.equal(options.body.get('negative_prompt'), null);
    assert.equal(options.body.get('guidance'), '5');
    return new Response(JSON.stringify({ result: { image: image.split(',')[1] } }), { headers: { 'Content-Type': 'application/json' } });
  });
  const result = await service.generateRoomPreview({
    ...input,
    productImageDataUrls: [image, image, image],
    sceneProducts: [
      { name: 'Bàn thấp', target: { x: .5, y: .75 }, usageType: 'floor-seating', placementSurface: 'floor' },
      { name: 'Đèn kẹp bàn', target: { x: .5, y: .75 }, placementSurface: 'tabletop' },
      { name: 'Kệ sách nhỏ', target: { x: .5, y: .75 }, placementSurface: 'floor' },
    ],
  });
  assert.equal(result.provider, 'cloudflare');
});

test('Request sai bị chặn trước khi gọi provider', async (t) => {
  mockFetch(t, async () => { assert.fail('Không được gọi mạng'); });
  for (const body of [
    { ...input, mode: 'unknown' },
    { ...input, userPrompt: 'x'.repeat(301) },
    { ...input, imageSize: { width: 0, height: 900 } },
    { ...input, productImageDataUrls: [image, image], sceneProducts: [{ name: 'Bàn', target: { x: .5, y: .5 } }] },
    { ...input, productImageDataUrls: [image, image, image, image] },
    { mode: 'inspiration' },
    { ...input, mode: 'placement' },
  ]) {
    assert.equal((await callController(controller.create, body)).status, 400);
  }
});

test('Model không tồn tại thì thử model sau, giữ ảnh gốc và guide của nhiều sản phẩm', async (t) => {
  const models = [];
  mockFetch(t, async (url, options) => {
    models.push(options.body.get('model'));
    if (models.length === 1) return new Response('unknown model', { status: 404 });
    assert.equal(options.body.getAll('image').length, 3);
    assert.match(options.body.get('prompt'), /bàn học, ghế/);
    return success();
  });
  const result = await service.generateRoomPreview(placement);
  assert.deepEqual(models, ['gpt-image-2', 'klein']);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.mode, 'placement');
});

test('Provider hết quota thì chuyển provider, không gửi guide giả cho gợi ý', async (t) => {
  let calls = 0;
  mockFetch(t, async (url, options) => {
    calls++;
    if (calls === 1) return new Response('{"error":{"code":"PAYMENT_REQUIRED","message":"Insufficient balance. available balance 0"}}', { status: 402 });
    assert.match(url, /api.cloudflare.com/);
    assert.ok(options.body.get('input_image_0'));
    assert.equal(options.body.get('input_image_1'), null);
    assert.equal(options.body.get('width'), '1024');
    assert.equal(options.body.get('height'), '576');
    return new Response(JSON.stringify({ result: { image: image.split(',')[1] } }), { headers: { 'Content-Type': 'application/json' } });
  });
  const result = await service.generateRoomPreview(input);
  assert.equal(result.provider, 'cloudflare');
  assert.equal(calls, 2);
});

test('Model bị giới hạn quyền vẫn thử model Pollinations tiếp theo', async (t) => {
  const models = [];
  mockFetch(t, async (url, options) => {
    models.push(options.body.get('model'));
    if (models.length === 1) return new Response('model is not available for this key', { status: 403 });
    return success();
  });
  const result = await service.generateRoomPreview(input);
  assert.deepEqual(models, ['gpt-image-2', 'klein']);
  assert.equal(result.provider, 'pollinations');
});

test('Tất cả provider lỗi trả lỗi rõ ràng, không giả báo đã tạo ảnh', async (t) => {
  mockFetch(t, async () => new Response('insufficient balance', { status: 402 }));
  const response = await callController(controller.create, input);
  assert.equal(response.status, 502);
  assert.equal(response.result.success, false);
});

test('Không đổi model/provider để vượt qua từ chối chính sách nội dung', async (t) => {
  let calls = 0;
  mockFetch(t, async () => { calls++; return new Response('{"error":{"code":"content_policy_violation"}}', { status: 422 }); });
  const response = await callController(controller.create, input);
  assert.equal(response.status, 422);
  assert.equal(calls, 1);
});

test('Lưu/dùng lại ý tưởng AI giữ prompt, loại ảnh và không thêm sản phẩm giả', async (t) => {
  const originalCreate = RoomDesign.create, originalFind = RoomDesign.findById, originalUpdate = RoomDesign.updateOne;
  t.after(() => { RoomDesign.create = originalCreate; RoomDesign.findById = originalFind; RoomDesign.updateOne = originalUpdate; });
  RoomDesign.create = async (data) => data;
  const body = { name: 'Ý tưởng phòng nhỏ', designMode: 'inspiration', roomImage: image, resultImage: image, placements: [], markedCorners: [], userPrompt: input.userPrompt, model: 'klein' };
  const created = await callController(designs.create, body, { user: { _id: '507f1f77bcf86cd799439011', name: 'Smoke' } });
  assert.equal(created.status, 201);
  assert.equal(created.result.data.designMode, 'inspiration');
  assert.equal(created.result.data.userPrompt, input.userPrompt);
  RoomDesign.findById = async () => ({ ...created.result.data, _id: '507f1f77bcf86cd799439022', visibility: 'public' });
  RoomDesign.updateOne = async () => ({});
  const reused = await callController(designs.reuse, {}, { params: { id: '507f1f77bcf86cd799439022' }, user: { _id: '507f1f77bcf86cd799439011' } });
  assert.equal(reused.result.data.designMode, 'inspiration');
  assert.equal(reused.result.data.visibility, 'private');
  assert.deepEqual(reused.result.data.placements, []);
  assert.equal(reused.result.data.userPrompt, input.userPrompt);
  assert.equal(reused.result.data.resultImage, image);
});

test('Collection gửi các trường phục hồi lên tài khoản', () => {
  const source = require('node:fs').readFileSync(path.join(__dirname, '../client/src/context/CollectionContext.jsx'), 'utf8');
  const payload = source.slice(source.indexOf('const payload ='), source.indexOf('return roomDesignService.create'));
  for (const field of ['designMode', 'userPrompt', 'model', 'elapsedMs', 'placements', 'markedCorners']) assert.match(payload, new RegExp(`${field}:`));
});

test('Phiên phòng thử dùng session; cache trình duyệt không giữ ảnh base64', () => {
  const fs = require('node:fs');
  const studio = fs.readFileSync(path.join(__dirname, '../client/src/pages/RoomStudioPage.jsx'), 'utf8');
  const collection = fs.readFileSync(path.join(__dirname, '../client/src/context/CollectionContext.jsx'), 'utf8');
  const products = fs.readFileSync(path.join(__dirname, '../client/src/context/ProductContext.jsx'), 'utf8');
  assert.match(studio, /sessionStorage\.setItem\(getStorageKey\(user\)/);
  assert.match(studio, /sessionStorage\.getItem\(HANDOFF_KEY\)/);
  assert.match(collection, /function lightweightCollectionItem/);
  assert.match(collection, /roomImage: nonDataUrl\(item\.roomImage\)/);
  assert.match(collection, /placements: .*\.map\(lightweightPlacement\)/);
  assert.match(products, /function lightweightProducts/);
});

test('Gợi ý AI là nút tạo ngay và dùng ảnh tham chiếu sản phẩm catalog', () => {
  const fs = require('node:fs');
  const studio = fs.readFileSync(path.join(__dirname, '../client/src/pages/RoomStudioPage.jsx'), 'utf8');
  const canvas = fs.readFileSync(path.join(__dirname, '../client/src/utils/roomPreviewCanvas.js'), 'utf8');
  assert.match(studio, /className="studio-ai-trigger"[\s\S]*onClick=\{generateInspiration\}/);
  assert.doesNotMatch(studio, /activeTab === ["']inspiration["']/);
  assert.match(studio, /pickRandomCatalogProducts\([\s\S]*INSPIRATION_CANDIDATE_COUNT/);
  assert.match(studio, /createProductReferenceImages\(suggestedProducts, 3\)/);
  assert.match(studio, /productImageDataUrls: references\.productImageDataUrls/);
  assert.match(studio, /inferProductFacts\(product\)/);
  assert.match(canvas, /export async function createProductReferenceImages/);
  assert.doesNotMatch(canvas, /createProductReferenceSheet/);
  assert.match(canvas, /makeCanvas\(MAX_REFERENCE_EDGE, MAX_REFERENCE_EDGE\)/);
});

test('Tên sản phẩm dài trong dataset vẫn lưu được đầy đủ bố cục', async (t) => {
  const original = RoomDesign.create;
  t.after(() => { RoomDesign.create = original; });
  RoomDesign.create = async (data) => data;
  const product = require('../client/public/data_import/data_import.json').find((item) => item.name.length > 140);
  const response = await callController(designs.create, { name: 'Smoke placement', productName: product.name,
    placements: [{ productId: product._id, productName: product.name, target: { x: .25, y: .75 }, rotation: 15, scale: 1.2, isFlipped: true, zIndex: 2 }] },
  { user: { _id: '507f1f77bcf86cd799439011' } });
  assert.equal(response.status, 201);
  assert.equal(response.result.data.placements[0].productName, product.name);
  assert.equal(response.result.data.placements[0].rotation, 15);
  assert.equal(response.result.data.placements[0].isFlipped, true);
});

test('CSS responsive giữ đúng khối media; spinner không bị tắt trên mọi màn hình', () => {
  const fs = require('node:fs');
  const postcss = require('../client/node_modules/postcss');
  const css = postcss.parse(fs.readFileSync(path.join(__dirname, '../client/src/styles/global.css'), 'utf8'));
  let studioBreakpoint = false;
  css.walkAtRules('media', (rule) => {
    if (rule.params.includes('980px')) rule.walkRules('.studio-workspace', () => { studioBreakpoint = true; });
  });
  assert.ok(studioBreakpoint, 'Grid mobile phải nằm trong media query');
  css.walkRules('.room-spinner', (rule) => {
    rule.walkDecls('animation', (decl) => {
      if (decl.value === 'none') assert.equal(rule.parent.name, 'media', 'Chỉ tắt xoay khi người dùng chọn giảm chuyển động');
    });
  });
});
