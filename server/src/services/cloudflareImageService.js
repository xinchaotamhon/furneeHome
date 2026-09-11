
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

function translateTitleToEnglish(name) {
  if (!name) return 'interior furniture item';
  const text = String(name).toLowerCase();

  // 1. Thảm trải sàn / thảm lau chân
  if (/thảm/.test(text)) {
    if (/tắm|chân|diatomit|chùi/.test(text)) return 'absorbent non-slip floor bath mat';
    if (/bếp/.test(text)) return 'washable kitchen floor runner rug';
    return 'modern decorative floor rug mat';
  }
  // 2. Giường ngủ
  if (/giường/.test(text)) {
    if (/gấp/.test(text)) return 'folding solid wood single bed frame';
    return 'modern minimalist bedroom bed';
  }
  // 3. Sofa & Ghế dài
  if (/sofa|ghế dài|đi-văng|couch/.test(text)) return 'comfortable upholstered living room sofa';
  // 4. Bàn các loại
  if (/bàn trà|bàn bệt|bàn nhật|coffee table/.test(text)) return 'low wooden floor-seating coffee table';
  if (/bàn trang điểm/.test(text)) return 'compact vanity makeup table with mirror';
  if (/bàn học gấp gọn|bàn để giường|bàn mini|ngồi bệt/.test(text)) return 'ultra-low folding lap desk for floor sitting';
  if (/bàn camping|bàn dã ngoại|bàn xếp|bàn tròn.*cafe/.test(text)) return 'compact folding round cafe table';
  if (/bàn làm việc|bàn học|desk/.test(text)) return 'modern wooden office study desk';
  if (/bàn ăn|dining table/.test(text)) return 'wooden dining room table';
  if (/bàn/.test(text)) return 'compact modern furniture table';
  // 5. Ghế các loại
  if (/ghế xoay|ghế công thái học|ergonomic/.test(text)) return 'ergonomic swivel office desk chair';
  if (/ghế nhựa|ghế xếp|ghế đẩu/.test(text)) return 'simple lightweight moulded plastic chair with straight legs';
  if (/ghế/.test(text)) return 'modern comfortable accent chair';
  // 6. Giàn phơi / Giá treo quần áo
  if (/giàn phơi|giá treo quần áo|giá chữ a/.test(text)) return 'A-frame clothes hanging drying rack';
  // 7. Xe đẩy lưu trữ
  if (/xe đẩy/.test(text)) return 'rolling 3-tier utility storage cart with wheels';
  // 8. Kệ / Tủ / Giá sách
  if (/giá sách|kệ sách/.test(text)) return 'tall open wooden bookshelf';
  if (/kệ để đồ|kệ đa năng|kệ bếp|kệ gia vị|giá treo|giá đựng|giỏ/.test(text)) return 'multi-tier kitchen storage shelf rack';
  if (/tủ/.test(text)) return 'wooden storage cabinet unit';
  if (/kệ/.test(text)) return 'minimalist storage shelf';
  // 9. Đồ trang trí: Đèn, Cây, Hoa, Tranh, Gương
  if (/đèn cây|đèn đứng|đèn sàn|floor lamp/.test(text)) return 'tall modern floor standing lamp with slender pole';
  if (/đèn treo|đèn chùm|pendant/.test(text)) return 'hanging ceiling pendant light';
  if (/đèn/.test(text)) return 'modern ambient table lamp';
  if (/cây|bonsai/.test(text)) return 'small potted decorative green houseplant';
  if (/hoa|chậu hoa/.test(text)) return 'artificial flower vase arrangement';
  if (/tranh/.test(text)) return 'framed minimalist wall art painting';
  if (/gương/.test(text)) return 'modern wall-mounted hanging mirror';

  return cleanTitleForAi(name);
}

function categoryToEnglish(cat) {
  const map = {
    'Phòng khách': 'Living Room',
    'Phòng làm việc': 'Home Office',
    'Phòng ngủ': 'Bedroom',
    'Bếp & Phòng ăn': 'Kitchen & Dining',
    'Trang trí & Đèn': 'Home Decor & Lighting',
  };
  return map[cat] || cat || 'Interior';
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

  const text = `${product.productName || product.name || ''} ${product.categoryName || ''}`.toLowerCase();

  // 1. Thảm trải sàn
  if (/thảm/.test(text)) {
    return {
      dimensions: 'width 60 cm, depth 40 cm, height 1 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Flat floor mat or rug resting completely flat on the floor tiles. Must lay flat with zero thickness, no legs.',
    };
  }
  // 2. Giường ngủ
  if (/giường/.test(text)) {
    return {
      dimensions: 'width 195 cm, depth 95 cm, height 45 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Full adult human-scale single bed measuring roughly 1.95 meters long, realistically sized for an adult person to lie down fully.',
    };
  }
  // 3. Giàn phơi / Giá treo quần áo chữ A
  if (/giàn phơi|giá treo quần áo|giá chữ a/.test(text)) {
    return {
      dimensions: 'width 100 cm, depth 50 cm, height 145 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Standing A-frame clothes drying rack resting squarely on the floor near a window or wall.',
    };
  }
  // 4. Xe đẩy đa năng
  if (/xe đẩy/.test(text)) {
    return {
      dimensions: 'width 45 cm, depth 35 cm, height 85 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Rolling utility storage cart with wheels standing on the floor.',
    };
  }
  // 5. Sofa & Ghế dài
  if (/sofa|ghế dài|đi-văng|couch/.test(text)) {
    return {
      dimensions: 'width 180 cm, depth 85 cm, height 80 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Large living room sofa seating. Must sit firmly on the floor.',
    };
  }
  // 6. Bàn các loại
  if (/bàn trà|bàn bệt|bàn nhật|coffee table/.test(text)) {
    return {
      dimensions: 'width 90 cm, depth 55 cm, height 42 cm',
      placementSurface: 'floor',
      usageType: 'floor-seating',
      spatialHint: 'Low coffee table placed on the floor or carpet.',
    };
  }
  if (/bàn trang điểm/.test(text)) {
    return {
      dimensions: 'width 60 cm, depth 40 cm, height 70 cm',
      placementSurface: 'floor',
      usageType: 'floor-seating',
      spatialHint: 'Compact floor vanity makeup desk with mirror.',
    };
  }
  if (/bàn học gấp gọn|bàn để giường|bàn mini|ngồi bệt|khay/.test(text)) {
    return {
      dimensions: 'width 60 cm, depth 40 cm, height 28 cm',
      placementSurface: 'floor',
      usageType: 'floor-seating',
      spatialHint: 'Low-profile folding mini lap desk. Legs are strictly 28cm short designed for sitting cross-legged directly on the floor, definitely NOT a tall high desk.',
    };
  }
  if (/bàn camping|bàn dã ngoại|bàn xếp|bàn tròn.*cafe/.test(text)) {
    return {
      dimensions: 'width 70 cm, depth 70 cm, height 65 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Compact portable folding table standing on the floor.',
    };
  }
  if (/bàn làm việc|bàn học|bàn ăn|desk|dining table|bàn/.test(text)) {
    return {
      dimensions: 'width 120 cm, depth 60 cm, height 75 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Standard height desk or table.',
    };
  }
  // 7. Ghế
  if (/ghế nhựa|ghế xếp|ghế đẩu/.test(text)) {
    return {
      dimensions: 'width 45 cm, depth 45 cm, height 80 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Lightweight moulded plastic chair with straight clean plastic legs, unpadded smooth surface, NO bulky upholstery cushions.',
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
  // 8. Kệ / Tủ / Giá treo đồ
  if (/kệ|tủ|giá sách|shelf|rack|cabinet|wardrobe|giá treo|giá đựng|giỏ/.test(text)) {
    return {
      dimensions: 'width 90 cm, depth 35 cm, height 140 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Vertical storage unit placed against a wall.',
    };
  }
  // 9. Đèn cây đứng / Đèn sàn
  if (/đèn cây|đèn đứng|đèn sàn|floor lamp/.test(text)) {
    return {
      dimensions: 'width 38 cm, depth 38 cm, height 155 cm',
      placementSurface: 'floor',
      usageType: 'standard',
      spatialHint: 'Tall floor-standing lamp with a long vertical pole reaching 1.55 meters high, standing directly on the floor tiles next to furniture.',
    };
  }
  // 10. Đồ decor nhỏ: Cây, Hoa, Đèn bàn
  if (/cây|hoa|đèn bàn|bình hoa|bonsai|chậu/.test(text)) {
    return {
      dimensions: 'width 25 cm, depth 25 cm, height 35 cm',
      placementSurface: 'tabletop',
      usageType: 'standard',
      spatialHint: 'Small decorative tabletop item. Do not make it giant. Must rest on a desk, shelf or countertop.',
    };
  }
  // 11. Tranh & Gương treo tường
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
  const englishTitle = translateTitleToEnglish(product.productName);
  const inferred = inferDimensionsAndPlacement(product);
  const dimensions = inferred.dimensions;
  const placement = inferred.placementSurface;
  const usage = inferred.usageType === 'floor-seating'
    ? 'It is low furniture for floor seating; keep it low and do not add high chair legs.'
    : '';
  const isRug = /thảm|rug|mat/.test(String(product.productName || '').toLowerCase());
  const support = placement === 'floor'
    ? (isRug
        ? 'It is a flat floor mat/rug laying directly and completely flat on the floor surface with no legs.'
        : 'It must stand firmly on the floor with all support legs completely visible and clear contact shadows under each leg.')
    : placement === 'wall'
      ? 'It must be mounted flat on the wall.'
      : 'It must rest naturally on top of an existing table, desk or shelf surface.';

  const positionDirective = product.desiredPosition
    ? `USER-REQUESTED TARGET POSITION: "${product.desiredPosition}". Directive: ${mapPositionToEnglish(product.desiredPosition)} This user-specified placement is MANDATORY. Place product ${index + 1} at this exact spot. If an existing movable object is there, replace only that item. Keep all architectural fixtures unchanged.`
    : 'No specific position was requested. Choose a balanced empty floor area away from doors and walking paths.';

  const specifications = (product.specifications || [])
    .map((item) => `${item.name}: ${item.value}`)
    .join(', ');

  const englishCategory = categoryToEnglish(product.categoryName);

  return [
    `Product ${index + 1}: ${JSON.stringify(englishTitle)}.`,
    positionDirective,
    `Reference image ${index + 2} is this exact product. Preserve its silhouette, color, material, proportions, legs, handles and supports.`,
    'Structural integrity: All support legs, frame members, and feet must be completely rendered, fully intact, and firmly touching the floor. Never omit, cut off, or blend legs into walls.',
    englishCategory ? `Category: ${englishCategory}.` : '',
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
    'Clearance from fixed fixtures: Do not merge, clip, or overlap furniture with existing permanent room fixtures (such as wall sinks, drainage pipes, stair railings, or doors). Every table, desk, and chair must have its own distinct, unbroken legs clearly resting on the open floor tiles.',
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
