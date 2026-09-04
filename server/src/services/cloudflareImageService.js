const env = require('../config/env');

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i;

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function createProviderError(message, status, provider, model, options = {}) {
  const error = createError(message, status);
  error.provider = provider;
  error.model = model;
  error.canFallback = options.canFallback === true;
  error.disableProvider = options.disableProvider === true;
  return error;
}

function parseImageDataUrl(value, fieldName) {
  if (typeof value !== 'string') throw createError(`${fieldName} phải là data URL của ảnh.`);
  const match = value.match(IMAGE_DATA_URL_PATTERN);
  if (!match) throw createError(`${fieldName} phải có dạng data:image/...;base64,...`);

  const base64 = match[2].replace(/\s/g, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw createError(`${fieldName} không chứa dữ liệu ảnh hợp lệ.`);

  return {
    buffer,
    base64,
    mimeType: match[1].toLowerCase().replace('image/jpg', 'image/jpeg'),
  };
}

function isWallMounted(productName = '') {
  return /treo|tranh|gương|khung lưới|đèn tường|clock|đồng hồ treo/i.test(productName);
}

function buildPrompt(productName, placement, usesReferenceImages = true, userPrompt = '') {
  const isFullScene = /^interior scene:/i.test(productName || '');
  const isWall = isWallMounted(productName);
  const isLeft = placement.x < 0.42;
  const isRight = placement.x > 0.58;
  const locX = isLeft ? 'on the left side' : (isRight ? 'on the right side' : 'in the center');
  const inputDescription = usesReferenceImages
    ? 'Image 0 is the original room. Image 1 is the placement guide. Image 2 is the exact product reference.'
    : 'The input image already contains a placement guide for the product. Refine only that guided area.';
  const userDirection = userPrompt
    ? `User preference: ${userPrompt}. Follow it only when it does not conflict with room preservation or the guided positions.`
    : '';

  if (isFullScene) {
    return [
      'Create one photorealistic interior edit of the complete guided scene.',
      usesReferenceImages
        ? 'Image 0 is the original room. Image 1 shows every product at its required position. Image 2 contains the product references.'
        : 'The input image already shows every product at its required position.',
      `Keep every product visible in the guide: ${productName.replace(/^interior scene:\s*/i, '')}.`,
      'Preserve their positions, relative sizes, rotations, colors and layer order.',
      'Replace pasted-looking cutouts with naturally integrated furniture while keeping each product recognizable.',
      'All floor furniture must touch the floor; wall decor must stay on the wall. Match room perspective, light, contact shadows and occlusion.',
      'Preserve the original room framing and every existing room element. Do not crop the room or add text, logos, watermarks, extra furniture or duplicate products.',
      userDirection,
    ].filter(Boolean).join(' ');
  }

  if (isWall) {
    return [
      'Create one photorealistic interior edit.',
      inputDescription,
      `Keep the exact appearance of "${productName}" and mount it on the wall ${locX}, at the guided position.`,
      'Preserve every room element outside the guided product area.',
      'Match the existing perspective, light direction, color and wall contact shadow.',
      'Do not add text, logos, watermarks, extra furniture or duplicate products.',
      userDirection,
    ].filter(Boolean).join(' ');
  }

  const wallPlacementRule = isLeft
    ? 'Place it on the left side at the exact guided position, facing naturally into the room.'
    : isRight
      ? 'Place it on the right side at the exact guided position, facing naturally into the room.'
      : 'Place it at the exact center position shown by the guide.';

  return [
    'Create one photorealistic interior edit.',
    inputDescription,
    `Keep the exact shape, material and colors of "${productName}". ${wallPlacementRule}`,
    'All feet or the base must touch the floor. Use only a small soft contact shadow directly beneath the product.',
    'Follow the room floor perspective and existing light direction.',
    'Preserve every room element outside the guided product area.',
    'Do not add text, logos, watermarks, extra furniture, duplicate products or oversized shadows.',
    userDirection,
  ].filter(Boolean).join(' ');
}

function buildRoomPrompt(input, usesReferenceImages) {
  const brief = input.designBrief || {};
  const briefText = [
    brief.purpose && `Intended use: ${JSON.stringify(brief.purpose)}.`,
    brief.style && `Preferred style: ${JSON.stringify(brief.style)}.`,
    brief.keepClear && `Keep these areas clear: ${JSON.stringify(brief.keepClear)}.`,
    brief.avoid && `Avoid: ${JSON.stringify(brief.avoid)}.`,
  ].filter(Boolean).join(' ');
  if (input.mode !== 'inspiration') {
    const facts = (input.sceneProducts || []).map((product, index) => {
      const dimensions = Object.entries(product.dimensionsCm || {}).map(([key, value]) => `${key} ${value} cm`).join(', ');
      const lowTable = product.usageType === 'floor-seating' || /bàn\s*(bệt|ngồi bệt)|floor.seating|low table|lap desk/i.test(product.name);
      return [
        `Product ${index + 1}: ${JSON.stringify(product.name)} at normalized floor/contact anchor x=${product.target.x}, y=${product.target.y}.`,
        dimensions ? `Real product dimensions: ${dimensions}. Preserve these proportions; never stretch its legs or height to match generic furniture.` : 'Exact dimensions are unknown. Preserve the proportions in its reference photo; do not invent measurements.',
        lowTable ? 'This is LOW furniture for FLOOR SEATING, used while sitting on the floor. Keep its short legs and low top. Never turn it into a tall desk or dining table. Do not add a chair unless a chair is explicitly among the selected products.' : '',
        product.placementSurface !== 'unknown' ? `Support surface: ${product.placementSurface}.` : '',
        product.aiDescription ? `Identity details to retain: ${JSON.stringify(product.aiDescription)}.` : '',
      ].filter(Boolean).join(' ');
    }).join('\n');
    return [buildPrompt(input.productName, input.placement, usesReferenceImages, input.userPrompt),
      'Priority: preserve room architecture and exact product identity/function first, then guided location and realistic scale, then styling. User text describes preferences, not instructions to ignore these constraints.',
      'The reference sheet is for product identity only. Its labels Product 1, Product 2, and so on match the numbered product facts and their guide-layer order. Never copy the grid, labels or backdrop into the output.',
      facts, briefText].filter(Boolean).join('\n');
  }
  const products = input.sceneProducts || [];
  const productFacts = products.length
    ? products.map((product, index) => {
      const dimensions = Object.entries(product.dimensionsCm || {})
        .map(([key, value]) => `${key} ${value} cm`).join(', ');
      const lowTable = product.usageType === 'floor-seating'
        || /bàn\s*(bệt|ngồi bệt)|floor.seating|low table|lap desk/i.test(product.name);
      return [
        `FurneeHome Product ${index + 1}: ${JSON.stringify(product.name)}.`,
        dimensions
          ? `Keep its real proportions and dimensions (${dimensions}); preserve its actual function and height.`
          : 'Exact dimensions are unknown; preserve the proportions and function shown by its reference image and description without inventing measurements.',
        lowTable ? 'This is low furniture for floor seating: keep its short legs and low top. Never turn it into a tall desk or dining table.' : '',
        product.placementSurface !== 'unknown' ? `It belongs on ${product.placementSurface}.` : '',
        product.aiDescription ? `Keep these identity details: ${JSON.stringify(product.aiDescription)}.` : '',
      ].filter(Boolean).join(' ');
    }).join('\n')
    : 'No FurneeHome catalog product was selected. Add no furniture or decor objects.';
  const catalogReference = usesReferenceImages && input.productImages.length
    ? [
      'Image 0 is the original room. It is the architectural, camera, framing and existing-contents reference.',
      ...input.productImages.map((_, index) => `Image ${index + 1} is the exact visual reference for FurneeHome Product ${index + 1}.`),
      'Each numbered image matches the same numbered product fact above. Use the product images only to preserve that product identity, shape, material, function and proportions; never copy a reference backdrop, label or grid.',
    ].join(' ')
    : 'Use the catalog product facts as text guidance only; do not invent a product that is not listed.';
  return [
    'First inspect this exact input room as it is. It may already be full, cluttered, occupied, narrow, irregular, photographed with a wide-angle lens, or show very little usable floor. Never assume an empty rectangular room, a tiled floor, four visible floor corners, a loft, or a large free wall.',
    'Create one realistic furnishing idea from the selected FurneeHome products below. Product 1 is required: add it exactly once, clearly visible and recognizable as a newly placed object. Do not return the original room unchanged. Products 2 and 3 are optional and should appear only when they physically fit without crowding the room.',
    productFacts,
    catalogReference,
    'Use only the exact objects from the numbered product reference images. Keep their exact shape, material, colors, function and proportions. Preserve the visible number and arrangement of shelves, drawers, doors, wheels, handles, legs and panels. Never merge two products, stretch one product, replace it with a generic item, duplicate it or invent unlisted furniture.',
    'Use Image 0 as the architectural source of truth. Preserve its exact framing, aspect ratio, camera position, perspective and lighting.',
    'Absolutely preserve the exact walls, doors, windows, stairs, railings, columns, bathroom/toilet enclosures, fixtures, plumbing, floor, ceiling and every built-in structure. Do not remove, move, redesign, straighten or hide any of them.',
    'Preserve large existing furniture, appliances and built-in storage when possible. People and pets may be removed from this design visualization, and small movable clutter may be tidied or repositioned to make one safe usable spot. Never fabricate hidden space behind an obstruction.',
    'The room may be irregular or concave: respect protruding bathroom walls, narrow passages, occluded corners and wide-angle distortion; never invent a simpler rectangular room.',
    'Keep doors, bathroom access, stairs, cooking areas and walking paths clear. Put the required Product 1 in a genuinely visible usable position at realistic scale; choose the position yourself from the real space shown in Image 0.',
    'Match perspective, occlusion and realistic floor contact shadows. This is a room furnishing idea, not a product catalogue collage.',
    `Optional design direction: ${input.inspirationTheme}. Use it only to coordinate the result; never recolor a catalog product or alter the room to force this style.`,
    input.userPrompt ? `User preferences: ${input.userPrompt}.` : '',
    briefText,
    'Return only the finished room photo. Do not add text, logos, watermarks, selection marks or split-screen comparisons.',
  ].filter(Boolean).join(' ');
}

function buildNegativePrompt(mode) {
  const inspirationLimits = mode === 'inspiration'
    ? 'extra non-catalog furniture, removed existing furniture, new wall, removed wall, new door, moved door, new window, new stairs, new loft, new mezzanine, changed ceiling, changed floor, enlarged room, '
    : 'extra furniture, ';
  return `${inspirationLimits}text, logo, watermark, duplicate furniture, floating object, oversized shadow, distorted legs, warped floor, changed room, blocked doorway, pasted sticker, cutout edge, green outline, selection box, blur`;
}

function outputDimensions(imageSize) {
  if (!imageSize?.width || !imageSize?.height) return { width: 1024, height: 1024 };
  const scale = 1024 / Math.max(imageSize.width, imageSize.height);
  // Multiples of 16 work with the configured edit models; preserve the source ratio as closely as possible.
  return { width: Math.max(64, Math.round(imageSize.width * scale / 16) * 16), height: Math.max(64, Math.round(imageSize.height * scale / 16) * 16) };
}

function configuredModels(value) {
  return String(value || '').split(',').map((model) => model.trim()).filter(Boolean);
}

function supportsInspirationReferences(candidate) {
  if (candidate.provider === 'cloudflare') return !/stable-diffusion/i.test(candidate.model);
  if (candidate.provider === 'pollinations') {
    return /^(gpt-image-2|gptimage-large|gptimage|klein)$|seedream|nanobanana/i.test(candidate.model);
  }
  return false;
}

function getProviderCandidates() {
  const configuredOrder = configuredModels(env.roomImageProviderOrder);
  const order = configuredOrder.length ? configuredOrder : ['pollinations', 'cloudflare', 'huggingface'];
  const candidates = [];

  for (const provider of order) {
    if (provider === 'cloudflare' && env.cloudflareAccountId && env.cloudflareApiToken) {
      const models = [
        env.cloudflareImageModel,
        '@cf/runwayml/stable-diffusion-v1-5-inpainting',
        '@cf/runwayml/stable-diffusion-v1-5-img2img',
      ].filter((model, index, list) => model && list.indexOf(model) === index);
      models.forEach((model) => candidates.push({ provider, model }));
    }

    if (provider === 'pollinations' && env.pollinationsApiKey) {
      configuredModels(env.pollinationsImageModels).forEach((model) => candidates.push({ provider, model }));
    }

    if (provider === 'huggingface' && env.huggingFaceToken && env.huggingFaceImageModel) {
      candidates.push({ provider, model: env.huggingFaceImageModel });
    }
  }

  return candidates;
}

function isUnsupportedModel(status, responseText) {
  // These calls only target a model endpoint, so a 404 means this model is unavailable.
  if (status === 404) return true;
  if (![400, 422].includes(status)) return false;
  return /unsupported model|unknown model|model.+not found|model.+unavailable|does not exist/i.test(responseText || '');
}

function providerErrorFromResponse(provider, model, status, responseText) {
  // A content-policy refusal must not be routed around through another model/provider.
  const policyRefusal = /content_policy_violation|content policy|safety violation|unsafe content/i.test(responseText || '');
  const accountBalanceEmpty = provider === 'pollinations'
    && status === 402
    && /PAYMENT_REQUIRED|insufficient balance|available balance/i.test(responseText || '');
  const unsupportedModel = isUnsupportedModel(status, responseText);
  const pollinationsModelFailure = provider === 'pollinations' && [402, 403, 404, 422, 500, 502].includes(status);
  const providerUnavailable = status === 401 || status === 402 || status === 403 || status === 408 || status === 429 || status >= 500;
  const message = policyRefusal ? 'Dịch vụ từ chối nội dung ảnh hoặc mô tả. Hãy điều chỉnh yêu cầu và thử lại.' : unsupportedModel
    ? `Model ${model} không được ${provider} hỗ trợ.`
    : `Dịch vụ tạo ảnh ${provider} không thể xử lý yêu cầu lúc này.`;

  return createProviderError(message, status, provider, model, {
    canFallback: !policyRefusal && (unsupportedModel || providerUnavailable || pollinationsModelFailure),
    disableProvider: accountBalanceEmpty || (providerUnavailable && !unsupportedModel && !pollinationsModelFailure),
  });
}

function createNetworkError(provider, model) {
  return createProviderError(
    `Không thể kết nối tới dịch vụ tạo ảnh ${provider}.`,
    502,
    provider,
    model,
    { canFallback: true, disableProvider: true },
  );
}

async function readImageResponse(response, provider, model) {
  const contentType = response.headers.get('content-type') || '';
  if (response.ok && contentType.startsWith('image/')) {
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType.split(';')[0]};base64,${imageBuffer.toString('base64')}`;
  }

  const responseText = await response.text();
  if (!response.ok) throw providerErrorFromResponse(provider, model, response.status, responseText);
  throw createProviderError(`Dịch vụ tạo ảnh ${provider} không trả về ảnh kết quả.`, 502, provider, model, {
    canFallback: true,
    disableProvider: true,
  });
}

async function fetchWithTimeout(url, options, provider, model) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    throw createNetworkError(provider, model);
  } finally {
    clearTimeout(timeout);
  }
}

function createMultipartBody(input) {
  const { roomImage, guideImage, productImage, productImages, mode, imageSize } = input;
  const isFlux2 = /flux-2/i.test(input.model);
  const form = new FormData();
  form.append('prompt', buildRoomPrompt(input, true));
  if (!isFlux2) form.append('negative_prompt', buildNegativePrompt(mode));
  const { width, height } = outputDimensions(imageSize);
  form.append('width', String(width));
  form.append('height', String(height));
  if (isFlux2) form.append('guidance', '5');
  form.append('input_image_0', new Blob([roomImage.buffer], { type: roomImage.mimeType }), 'room-original.jpg');
  if (mode !== 'inspiration') {
    form.append('input_image_1', new Blob([guideImage.buffer], { type: guideImage.mimeType }), 'placement-guide.jpg');
    form.append('input_image_2', new Blob([productImage.buffer], { type: productImage.mimeType }), 'product-reference.png');
  } else {
    productImages.forEach((product, index) => {
      form.append(`input_image_${index + 1}`, new Blob([product.buffer], { type: product.mimeType }), `product-${index + 1}.png`);
    });
  }
  return form;
}

function createDiffusionBody(input) {
  const { model, guideImage, maskImage, mode } = input;
  const body = {
    prompt: buildRoomPrompt(input, false),
    negative_prompt: buildNegativePrompt(mode),
    image_b64: guideImage.base64,
    num_steps: 20,
    strength: model.includes('inpainting') ? 0.62 : 0.36,
    guidance: 7.5,
  };
  if (model.includes('inpainting') && maskImage) body.mask = Array.from(maskImage.buffer);
  return JSON.stringify(body);
}

async function callCloudflare(input) {
  const { model } = input;
  // The browser supplies a small reference for CF without downscaling Pollinations' original.
  if (input.mode === 'inspiration' && input.smallRoomImage) {
    input = { ...input, roomImage: input.smallRoomImage, guideImage: input.smallRoomImage };
  }
  if (input.mode !== 'inspiration' && input.smallRoomImage) input = { ...input, roomImage: input.smallRoomImage };
  const provider = 'cloudflare';
  const requestUrl = `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/run/${model}`;
  const isDiffusionModel = model.includes('stable-diffusion-v1-5');
  const body = isDiffusionModel
    ? createDiffusionBody(input)
    : createMultipartBody(input);
  const headers = { Authorization: `Bearer ${env.cloudflareApiToken}` };
  if (isDiffusionModel) headers['Content-Type'] = 'application/json';

  const response = await fetchWithTimeout(requestUrl, { method: 'POST', headers, body }, provider, model);
  const contentType = response.headers.get('content-type') || '';
  if (response.ok && contentType.startsWith('image/')) {
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType.split(';')[0]};base64,${imageBuffer.toString('base64')}`;
  }

  const responseText = await response.text();
  if (!response.ok) throw providerErrorFromResponse(provider, model, response.status, responseText);

  try {
    const bodyJson = JSON.parse(responseText);
    const imageBase64 = typeof bodyJson?.result === 'string' ? bodyJson.result : bodyJson?.result?.image;
    if (typeof imageBase64 === 'string' && imageBase64.trim()) {
      return imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
    }
  } catch {
    // The generic error below is clearer than a JSON parser error.
  }

  throw createProviderError('Cloudflare Workers AI không trả về ảnh kết quả.', 502, provider, model, {
    canFallback: true,
    disableProvider: true,
  });
}

async function callPollinations(input) {
  const { model, roomImage, guideImage, productImage, productImages, mode, imageSize, seed } = input;
  const provider = 'pollinations';
  const form = new FormData();
  // Verified default-model reference limits: GPT Image 16, Klein 10, Kontext 1.
  const supportsMultipleReferences = /^(gpt-image-2|gptimage-large|gptimage|klein)$|seedream|nanobanana/i.test(model);
  if (mode === 'inspiration' || supportsMultipleReferences) {
    form.append('image', new Blob([roomImage.buffer], { type: roomImage.mimeType }), 'room-original.png');
  }
  if (mode !== 'inspiration') form.append('image', new Blob([guideImage.buffer], { type: guideImage.mimeType }), 'room-placement-guide.png');
  if (supportsMultipleReferences) {
    productImages.forEach((product, index) => {
      form.append('image', new Blob([product.buffer], { type: product.mimeType }), `product-${index + 1}.png`);
    });
  }
  form.append('prompt', buildRoomPrompt(input, supportsMultipleReferences));
  form.append('model', model);
  const { width, height } = outputDimensions(imageSize);
  form.append('size', `${width}x${height}`);
  if (mode === 'inspiration' && /klein|seedream|flux|zimage/i.test(model)) form.append('seed', String(seed));
  form.append('response_format', 'b64_json');

  const response = await fetchWithTimeout('https://gen.pollinations.ai/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.pollinationsApiKey}` },
    body: form,
  }, provider, model);

  if (!response.ok) throw providerErrorFromResponse(provider, model, response.status, await response.text());

  const body = await response.json().catch(() => null);
  const imageBase64 = body?.data?.[0]?.b64_json;
  if (typeof imageBase64 === 'string' && imageBase64.trim()) return `data:image/png;base64,${imageBase64}`;

  if (typeof body?.data?.[0]?.url === 'string') {
    const imageResponse = await fetchWithTimeout(body.data[0].url, {}, provider, model);
    return readImageResponse(imageResponse, provider, model);
  }

  throw createProviderError('Pollinations không trả về ảnh kết quả.', 502, provider, model, {
    canFallback: true,
    disableProvider: true,
  });
}

async function callHuggingFace(input) {
  const { model, guideImage, mode } = input;
  const provider = 'huggingface';
  const response = await fetchWithTimeout(
    `https://router.huggingface.co/hf-inference/models/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.huggingFaceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: guideImage.base64,
        parameters: {
          prompt: buildRoomPrompt(input, false),
          negative_prompt: buildNegativePrompt(mode),
          num_inference_steps: 20,
          guidance_scale: 7.5,
        },
      }),
    },
    provider,
    model,
  );
  return readImageResponse(response, provider, model);
}

async function callProvider(candidate, images, productName, userPrompt, placement) {
  if (candidate.provider === 'cloudflare') return callCloudflare({ model: candidate.model, ...images, productName, userPrompt, placement });
  if (candidate.provider === 'pollinations') return callPollinations({ model: candidate.model, ...images, productName, userPrompt, placement });
  if (candidate.provider === 'huggingface') return callHuggingFace({ model: candidate.model, ...images, productName, userPrompt, placement });
  throw createError(`Provider ảnh không hợp lệ: ${candidate.provider}.`, 503);
}

function hasAnotherProvider(candidates, currentIndex, disabledProviders) {
  const currentProvider = candidates[currentIndex].provider;
  return candidates.slice(currentIndex + 1)
    .some((candidate) => candidate.provider !== currentProvider && !disabledProviders.has(candidate.provider));
}

function makeConfigurationError() {
  return createError('Chưa có provider tạo ảnh nào được cấu hình. Hãy thêm Cloudflare hoặc một khóa provider tùy chọn vào .env.', 503);
}

async function generateRoomPreview({ mode = 'placement', imageSize, roomImageDataUrl, smallRoomImageDataUrl, guideImageDataUrl, maskImageDataUrl, productImageDataUrl, productImageDataUrls, productName, userPrompt, placement, editRegion, designBrief, sceneProducts }) {
  const roomImage = parseImageDataUrl(roomImageDataUrl, 'roomImageDataUrl');
  const isInspiration = mode === 'inspiration';
  const smallRoomImage = smallRoomImageDataUrl ? parseImageDataUrl(smallRoomImageDataUrl, 'smallRoomImageDataUrl') : null;
  const guideImage = isInspiration ? roomImage : parseImageDataUrl(guideImageDataUrl, 'guideImageDataUrl');
  const maskImage = !isInspiration && maskImageDataUrl ? parseImageDataUrl(maskImageDataUrl, 'maskImageDataUrl') : null;
  const productImageDataUrlList = productImageDataUrls == null
    ? (productImageDataUrl ? [productImageDataUrl] : [])
    : productImageDataUrls;
  if (!Array.isArray(productImageDataUrlList) || productImageDataUrlList.length > 3) {
    throw createError('Ảnh tham chiếu sản phẩm phải là mảng tối đa 3 data URL ảnh.');
  }
  const productImages = productImageDataUrlList.map((imageDataUrl, index) => parseImageDataUrl(
    imageDataUrl,
    productImageDataUrls == null ? 'productImageDataUrl' : `productImageDataUrls[${index}]`,
  ));
  if (isInspiration
    && (productImages.length < 1 || productImages.length !== (sceneProducts || []).length)) {
    throw createError('Gợi ý AI cần số ảnh tham chiếu khớp danh sách sản phẩm.');
  }
  const productImage = productImages[0] || null;
  if (!isInspiration && !productImage) throw createError('Thiếu ảnh sản phẩm tách nền.');
  const totalProductBytes = productImages.reduce((total, image) => total + image.buffer.length, 0);
  const totalBytes = roomImage.buffer.length + (smallRoomImage?.buffer.length || 0) + (isInspiration ? 0 : guideImage.buffer.length) + totalProductBytes + (maskImage?.buffer.length || 0);
  if (totalBytes > MAX_IMAGE_BYTES) throw createError('Tổng dung lượng các ảnh vượt quá giới hạn 15 MB.');

  // A whole-room idea must keep the exact product reference, not fall back to a text-only image model.
  const candidates = getProviderCandidates().filter((candidate) => (
    !isInspiration || supportsInspirationReferences(candidate)
  ));
  if (!candidates.length) throw makeConfigurationError();

  const startedAt = Date.now();
  const failures = [];
  const disabledProviders = new Set();
  const themes = ['warm light wood with muted olive accents', 'compact Scandinavian furniture with a cream palette', 'simple Japanese-inspired wood and natural fabric', 'practical modern furniture with soft terracotta accents'];
  const images = { roomImage, smallRoomImage, guideImage, maskImage, productImage, productImages, mode, imageSize, designBrief, sceneProducts,
    inspirationTheme: themes[Math.floor(Math.random() * themes.length)], seed: Math.floor(Math.random() * 2147483647) };

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (disabledProviders.has(candidate.provider)) continue;

    try {
      const imageDataUrl = await callProvider(candidate, images, productName, userPrompt, placement);
      return {
        imageDataUrl,
        mode,
        provider: candidate.provider,
        model: candidate.model,
        elapsedMs: Date.now() - startedAt,
        fallbackUsed: failures.length > 0,
        editRegion,
      };
    } catch (error) {
      if (!error.canFallback) throw error;
      failures.push({ provider: candidate.provider, model: candidate.model, status: error.status });

      if (error.disableProvider) {
        const noAlternativeAfterAuthFailure = (error.status === 401 || error.status === 403)
          && !hasAnotherProvider(candidates, index, disabledProviders);
        if (noAlternativeAfterAuthFailure) break;
        disabledProviders.add(candidate.provider);
      }
    }
  }

  const finalError = createError(
    'Các dịch vụ tạo ảnh hiện đều bận, hết quota hoặc không hỗ trợ ảnh đầu vào. Bản ghép nhanh vẫn được giữ để bạn thử lại.',
    502,
  );
  finalError.diagnostic = failures;
  throw finalError;
}

module.exports = { generateRoomPreview };
