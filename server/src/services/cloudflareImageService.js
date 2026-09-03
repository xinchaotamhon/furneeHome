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

function buildNegativePrompt() {
  return 'text, logo, watermark, duplicate furniture, extra furniture, floating object, oversized shadow, distorted legs, warped floor, changed room, pasted sticker, cutout edge, green outline, selection box, blur';
}

function configuredModels(value) {
  return String(value || '').split(',').map((model) => model.trim()).filter(Boolean);
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
  const unsupportedModel = isUnsupportedModel(status, responseText);
  const providerUnavailable = status === 401 || status === 402 || status === 403 || status === 408 || status === 429 || status >= 500;
  const message = unsupportedModel
    ? `Model ${model} không được ${provider} hỗ trợ.`
    : `Dịch vụ tạo ảnh ${provider} không thể xử lý yêu cầu lúc này.`;

  return createProviderError(message, status, provider, model, {
    canFallback: unsupportedModel || providerUnavailable,
    disableProvider: providerUnavailable && !unsupportedModel,
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

function createMultipartBody({ roomImage, guideImage, productImage, productName, userPrompt, placement }) {
  const form = new FormData();
  form.append('prompt', buildPrompt(productName, placement, true, userPrompt));
  form.append('negative_prompt', buildNegativePrompt());
  form.append('input_image_0', new Blob([roomImage.buffer], { type: roomImage.mimeType }), 'room-original.jpg');
  form.append('input_image_1', new Blob([guideImage.buffer], { type: guideImage.mimeType }), 'placement-guide.jpg');
  form.append('input_image_2', new Blob([productImage.buffer], { type: productImage.mimeType }), 'product-reference.png');
  return form;
}

function createDiffusionBody({ model, guideImage, maskImage, productName, userPrompt, placement }) {
  const body = {
    prompt: buildPrompt(productName, placement, false, userPrompt),
    negative_prompt: buildNegativePrompt(),
    image_b64: guideImage.base64,
    num_steps: 20,
    strength: model.includes('inpainting') ? 0.62 : 0.36,
    guidance: 7.5,
  };
  if (model.includes('inpainting') && maskImage) body.mask = Array.from(maskImage.buffer);
  return JSON.stringify(body);
}

async function callCloudflare({ model, roomImage, guideImage, maskImage, productImage, productName, userPrompt, placement }) {
  const provider = 'cloudflare';
  const requestUrl = `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/run/${model}`;
  const isDiffusionModel = model.includes('stable-diffusion-v1-5');
  const body = isDiffusionModel
    ? createDiffusionBody({ model, guideImage, maskImage, productName, userPrompt, placement })
    : createMultipartBody({ roomImage, guideImage, productImage, productName, userPrompt, placement });
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

async function callPollinations({ model, roomImage, guideImage, productImage, productName, userPrompt, placement }) {
  const provider = 'pollinations';
  const form = new FormData();
  const supportsMultipleReferences = /seedream|nanobanana|klein/i.test(model);
  if (supportsMultipleReferences) {
    form.append('image', new Blob([roomImage.buffer], { type: roomImage.mimeType }), 'room-original.png');
  }
  form.append('image', new Blob([guideImage.buffer], { type: guideImage.mimeType }), 'room-placement-guide.png');
  if (supportsMultipleReferences) {
    form.append('image', new Blob([productImage.buffer], { type: productImage.mimeType }), 'product-reference.png');
  }
  form.append('prompt', buildPrompt(productName, placement, supportsMultipleReferences, userPrompt));
  form.append('model', model);
  form.append('size', '1024x1024');
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

async function callHuggingFace({ model, guideImage, productName, userPrompt, placement }) {
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
          prompt: buildPrompt(productName, placement, false, userPrompt),
          negative_prompt: buildNegativePrompt(),
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

async function generateRoomPreview({ roomImageDataUrl, guideImageDataUrl, maskImageDataUrl, productImageDataUrl, productName, userPrompt, placement, editRegion }) {
  const roomImage = parseImageDataUrl(roomImageDataUrl, 'roomImageDataUrl');
  const guideImage = parseImageDataUrl(guideImageDataUrl, 'guideImageDataUrl');
  const maskImage = maskImageDataUrl ? parseImageDataUrl(maskImageDataUrl, 'maskImageDataUrl') : null;
  const productImage = parseImageDataUrl(productImageDataUrl, 'productImageDataUrl');
  const totalBytes = roomImage.buffer.length + guideImage.buffer.length + productImage.buffer.length + (maskImage?.buffer.length || 0);
  if (totalBytes > MAX_IMAGE_BYTES) throw createError('Tổng dung lượng các ảnh vượt quá giới hạn 15 MB.');

  const candidates = getProviderCandidates();
  if (!candidates.length) throw makeConfigurationError();

  const startedAt = Date.now();
  const failures = [];
  const disabledProviders = new Set();
  const images = { roomImage, guideImage, maskImage, productImage };

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (disabledProviders.has(candidate.provider)) continue;

    try {
      const imageDataUrl = await callProvider(candidate, images, productName, userPrompt, placement);
      return {
        imageDataUrl,
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
