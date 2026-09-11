const env = require('../config/env');

const DATA_URL = /^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

function serviceError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readImage(dataUrl, fieldName) {
  const match = String(dataUrl || '').match(DATA_URL);
  if (!match) throw serviceError(`${fieldName} không phải ảnh hợp lệ.`, 400);
  const buffer = Buffer.from(match[3].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw serviceError(`${fieldName} không có dữ liệu.`, 400);
  return { buffer, mimeType: match[1].replace('image/jpg', 'image/jpeg') };
}

function imageDataUrl(buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function outputSize(imageSize = {}) {
  const width = Number(imageSize.width) || 1024;
  const height = Number(imageSize.height) || 1024;
  const ratio = 1024 / Math.max(width, height);
  return {
    width: Math.max(256, Math.round(width * ratio / 16) * 16),
    height: Math.max(256, Math.round(height * ratio / 16) * 16),
  };
}

function cleanTitleForAi(name) {
  if (!name) return 'furniture piece';
  return String(name)
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ')
    .replace(/\b(hàng sẵn|giá rẻ|cao cấp|chính hãng|đa năng|tiện lợi|bảo hành \d+ năm|số lượng lớn|hot|mẫu mới|sale|freeship)\b/gi, ' ')
    .replace(/\b(aiodiy|boenin|sta|luxe|size \w+)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function inferDimensionsAndPlacement(product) {
  const existing = product.dimensionsCm || {};
  const hasDimensions = Number(existing.width) > 0 || Number(existing.height) > 0;
  if (hasDimensions) {
    const dimensions = Object.entries(existing)
      .filter(([, value]) => Number(value) > 0)
      .map(([name, value]) => `${name} ${value} cm`)
      .join(', ');
    return {
      dimensions,
      placementSurface: product.placementSurface || 'floor',
      usageType: product.usageType || 'standard',
    };
  }

  const text = `${product.productName || ''} ${product.categoryName || ''}`.toLowerCase();
  if (/sofa|ghế dài|đi-văng|couch/.test(text)) {
    return {
      dimensions: 'width 180 cm, depth 85 cm, height 80 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Large living room sofa seating. Must sit firmly on the floor.',
    };
  }
  if (/bàn trà|bàn bệt|bàn nhật|coffee table/.test(text)) {
    return {
      dimensions: 'width 90 cm, depth 55 cm, height 42 cm',
      placementSurface: 'floor',
      usageType: 'floor-seating',
      spatialHint: 'Low coffee table placed on the floor or carpet.',
    };
  }
  if (/bàn học gấp gọn|bàn để giường|bàn mini|khay/.test(text)) {
    return {
      dimensions: 'width 60 cm, depth 40 cm, height 28 cm',
      placementSurface: 'tabletop',
      usageType: 'standard',
      spatialHint: 'Small portable mini lap desk. Keep it compact, not a large table.',
    };
  }
  if (/bàn làm việc|bàn học|bàn ăn|desk|dining table/.test(text)) {
    return {
      dimensions: 'width 120 cm, depth 60 cm, height 75 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Standard height desk or table.',
    };
  }
  if (/ghế|chair|armchair/.test(text)) {
    return {
      dimensions: 'width 60 cm, depth 60 cm, height 90 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Single person chair seating.',
    };
  }
  if (/kệ|tủ|giá sách|shelf|rack|cabinet|wardrobe/.test(text)) {
    return {
      dimensions: 'width 90 cm, depth 35 cm, height 140 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Vertical storage unit placed against a wall.',
    };
  }
  if (/cây|hoa|đèn bàn|bình|bonsai|chậu|decor|trang trí/.test(text)) {
    return {
      dimensions: 'width 25 cm, depth 25 cm, height 35 cm',
      placementSurface: 'tabletop',
      usageType: 'standard',
      spatialHint: 'Small decorative tabletop item. Do not make it giant. Must rest on a desk, shelf or countertop.',
    };
  }
  if (/tranh|gương treo|kệ treo/.test(text)) {
    return {
      dimensions: 'width 60 cm, depth 5 cm, height 80 cm',
      placementSurface: 'wall',
      usageType: 'standard',
      spatialHint: 'Wall-mounted decor.',
    };
  }

  return {
    dimensions: 'width 80 cm, depth 50 cm, height 75 cm',
    placementSurface: product.placementSurface || 'floor',
    usageType: product.usageType || 'standard',
    spatialHint: 'Standard interior furniture.',
  };
}

function mapPositionToEnglish(pos) {
  if (!pos) return '';
  const text = String(pos).toLowerCase().trim();
  const directives = [];
  if (/cửa sổ|ban công|window|balcony/.test(text)) directives.push('Place next to or directly under the window, catching natural daylight.');
  if (/góc|corner/.test(text)) directives.push('Place neatly in the corner of the room flush against the walls.');
  if (/giữa phòng|chính giữa|trung tâm|center|middle/.test(text)) directives.push('Place prominently in the open center floor area of the room.');
  if (/sát tường bên trái|tường trái|left wall/.test(text)) {
    directives.push('Place flat and completely flush against the left wall, squarely grounded on the floor with zero gap behind.');
  } else if (/sát tường bên phải|tường phải|right wall/.test(text)) {
    directives.push('Place flat and completely flush against the right wall, squarely grounded on the floor with zero gap behind.');
  } else if (/sát tường|cạnh tường|vách tường|against.*wall/.test(text)) {
    directives.push('Place flat and completely flush against the wall surface with zero gap behind.');
  }
  if (/bên trái|phía trái|left/.test(text) && !/sát tường bên trái|tường trái/.test(text)) directives.push('Position on the left side of the room view.');
  if (/bên phải|phía phải|right/.test(text) && !/sát tường bên phải|tường phải/.test(text)) directives.push('Position on the right side of the room view.');
  if (/trên bàn|mặt bàn|trên kệ|tabletop|on.*shelf/.test(text)) directives.push('Place directly resting on top of a table, desk, or shelf surface.');
  if (/cửa ra vào|lối đi|door|entrance/.test(text)) directives.push('Place near the entrance without blocking the walking path.');
  if (/cạnh giường|đầu giường|bed/.test(text)) directives.push('Place beside the bed as a bedside unit.');
  return directives.length ? directives.join(' ') : `Place specifically at location: "${pos}".`;
}

function productPrompt(product, index) {
  const cleanTitle = cleanTitleForAi(product.productName);
  const inferred = inferDimensionsAndPlacement(product);
  const dimensions = inferred.dimensions;
  const placement = inferred.placementSurface;
  const usage = inferred.usageType === 'floor-seating'
    ? 'It is low furniture for floor seating; keep it low and do not add high chair legs.'
    : '';
  const support = {
    floor: 'It must stand firmly on the floor with all support legs completely visible and clear contact shadows under each leg.',
    wall: 'It must be mounted flat on the wall.',
    tabletop: 'It must rest naturally on top of an existing table, desk or shelf surface.',
  }[placement] || '';

  const positionDirective = product.desiredPosition
    ? `USER-REQUESTED TARGET POSITION: "${product.desiredPosition}". Directive: ${mapPositionToEnglish(product.desiredPosition)} This user-specified placement is MANDATORY. Place product ${index + 1} at this exact spot. If an existing movable object is there, replace only that item. Keep all architectural fixtures unchanged.`
    : 'No specific position was requested. Choose a balanced empty floor area away from doors and walking paths.';

  const specifications = (product.specifications || [])
    .map((item) => `${item.name}: ${item.value}`)
    .join(', ');

  return [
    `Product ${index + 1}: ${JSON.stringify(cleanTitle)}.`,
    positionDirective,
    `Reference image ${index + 2} is this exact product. Preserve its silhouette, color, material, proportions, legs, handles and supports.`,
    'Structural integrity: All support legs, frame members, and feet must be completely rendered, fully intact, and firmly touching the floor. Never omit, cut off, or blend legs into walls.',
    product.categoryName ? `Category: ${product.categoryName}.` : '',
    dimensions ? `Real-world dimensions: ${dimensions}.` : '',
    inferred.spatialHint || '',
    usage,
    support,
    specifications ? `Specifications: ${specifications}.` : '',
    product.aiDescription ? `Detail: ${product.aiDescription}.` : '',
  ].filter(Boolean).join(' ');
}

function buildPrompt(input) {
  return [
    'Create one photorealistic edit of the original room in image 1.',
    `Add exactly ${input.products.length} selected product${input.products.length > 1 ? 's' : ''}, using the following reference images in order.`,
    ...input.products.map(productPrompt),
    'Keep image 1 as the unchanged base photo. Preserve its camera, framing, walls, floor, ceiling, doors, windows, stairs, fixed fixtures, room shape and existing objects.',
    'For products with a requested position, place them strictly at the user-specified locations. When placed against a wall, align the back of the furniture squarely and flush with the wall.',
    'Place every selected product exactly once.',
    'Structural completeness: Ensure all furniture legs and frames are 100% complete and fully visible, with contact shadows on floor tiles.',
    'Ground all furniture scale using standard room proportions (doors ~200cm tall, ceilings ~270cm, floor tiles ~40-60cm). Match perspective and ambient lighting.',
    'Negative constraints: Do not distort walls or architectural lines. Do not omit furniture legs. Do not change product color or style. Do not add unselected furniture, extra humans, pets, text or watermarks.',
    'Return only the finished room image.',
  ].filter(Boolean).join(' ');
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callPollinations(input, model) {
  const form = new FormData();
  form.append('image', new Blob([input.room.buffer], { type: input.room.mimeType }), 'room.jpg');
  input.products.forEach((product, index) => {
    form.append('image', new Blob([product.image.buffer], { type: product.image.mimeType }), `product-${index + 1}.png`);
  });
  form.append('prompt', input.prompt);
  form.append('model', model);
  form.append('size', `${input.size.width}x${input.size.height}`);
  form.append('response_format', 'b64_json');

  const response = await fetchWithTimeout('https://gen.pollinations.ai/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.pollinationsApiKey}` },
    body: form,
  });
  if (!response.ok) throw serviceError(`Pollinations trả lỗi ${response.status}.`);

  const body = await response.json();
  if (body?.data?.[0]?.b64_json) return `data:image/png;base64,${body.data[0].b64_json}`;
  if (body?.data?.[0]?.url) {
    const imageResponse = await fetchWithTimeout(body.data[0].url, {});
    if (!imageResponse.ok) throw serviceError('Không tải được ảnh Pollinations.');
    const type = (imageResponse.headers.get('content-type') || 'image/png').split(';')[0];
    return imageDataUrl(Buffer.from(await imageResponse.arrayBuffer()), type);
  }
  throw serviceError('Pollinations không trả về ảnh.');
}

async function callCloudflare(input, model) {
  const form = new FormData();
  form.append('prompt', input.prompt);
  form.append('width', String(input.size.width));
  form.append('height', String(input.size.height));
  form.append('input_image_0', new Blob([input.room.buffer], { type: input.room.mimeType }), 'room.jpg');
  input.products.forEach((product, index) => {
    form.append(`input_image_${index + 1}`, new Blob([product.image.buffer], { type: product.image.mimeType }), `product-${index + 1}.png`);
  });

  const url = `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/run/${model}`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.cloudflareApiToken}` },
    body: form,
  });
  const type = response.headers.get('content-type') || '';
  if (!response.ok) throw serviceError(`Cloudflare trả lỗi ${response.status}.`);
  if (type.startsWith('image/')) return imageDataUrl(Buffer.from(await response.arrayBuffer()), type.split(';')[0]);

  const body = await response.json();
  const base64 = typeof body.result === 'string' ? body.result : body.result?.image;
  if (base64) return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  throw serviceError('Cloudflare không trả về ảnh.');
}

function providerList() {
  const requested = String(env.roomImageProviderOrder || 'pollinations,cloudflare')
    .split(',').map((name) => name.trim()).filter(Boolean);
  const providers = [];
  for (const name of requested) {
    if (name === 'pollinations' && env.pollinationsApiKey) {
      String(env.pollinationsImageModels || 'gpt-image-2')
        .split(',').map((model) => model.trim()).filter(Boolean).slice(0, 2)
        .forEach((model) => providers.push({ name, model }));
    }
    if (name === 'cloudflare' && env.cloudflareAccountId && env.cloudflareApiToken) {
      providers.push({ name, model: env.cloudflareImageModel });
    }
  }
  return providers;
}

async function generateRoomPreview(input) {
  const room = readImage(input.roomImageDataUrl, 'Ảnh phòng');
  const products = input.products.map((product, index) => ({
    ...product,
    image: readImage(product.image, `Ảnh sản phẩm ${index + 1}`),
  }));
  const totalBytes = room.buffer.length + products.reduce((sum, product) => sum + product.image.buffer.length, 0);
  if (totalBytes > MAX_TOTAL_BYTES) throw serviceError('Tổng dung lượng ảnh vượt quá 15 MB.', 400);

  const providers = providerList();
  if (!providers.length) throw serviceError('Chưa cấu hình dịch vụ tạo ảnh.', 503);
  const request = { ...input, room, products, size: outputSize(input.imageSize) };
  request.prompt = buildPrompt(request);
  const errors = [];
  const startedAt = Date.now();

  for (const provider of providers) {
    try {
      const image = provider.name === 'pollinations'
        ? await callPollinations(request, provider.model)
        : await callCloudflare(request, provider.model);
      return {
        imageDataUrl: image,
        provider: provider.name,
        model: provider.model,
        elapsedMs: Date.now() - startedAt,
        productCount: products.length,
      };
    } catch (error) {
      errors.push(`${provider.name}/${provider.model}: ${error.message}`);
    }
  }

  const error = serviceError('Các dịch vụ tạo ảnh đang bận.');
  error.diagnostic = errors;
  throw error;
}

module.exports = { generateRoomPreview, buildPrompt, providerList, outputSize };
