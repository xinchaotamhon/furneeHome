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

function buildPrompt(input) {
  const product = input.sceneProduct || {};
  const dimensions = Object.entries(product.dimensionsCm || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([name, value]) => `${name} ${value} cm`)
    .join(', ');
  const lowFurniture = product.usageType === 'floor-seating'
    ? 'This is low furniture for floor seating. Keep its top and legs low. Do not turn it into a normal-height desk and do not add a chair.'
    : '';
  const support = {
    floor: 'Keep it standing on the visible floor.',
    wall: 'Keep it mounted on the visible wall without adding floor legs.',
    tabletop: 'Keep it on an existing tabletop or shelf.',
  }[product.placementSurface] || 'Keep the support structure shown in the product reference.';

  return [
    'Create one photorealistic interior edit.',
    'Image 1 is the original room, image 2 is the exact placement guide, and image 3 is the exact product reference.',
    `Use exactly one ${JSON.stringify(input.productName)} at the position and size shown in the placement guide.`,
    'Keep the product recognizable: preserve its silhouette, colors, material, proportions, number of legs, shelves, doors, handles and supports.',
    dimensions ? `Known product dimensions: ${dimensions}. Preserve these proportions.` : 'Its exact dimensions are unknown. Do not invent measurements; follow the reference proportions.',
    lowFurniture,
    support,
    product.aiDescription ? `Important product detail: ${product.aiDescription}` : '',
    input.designBrief?.desiredPosition ? `Preferred position: ${input.designBrief.desiredPosition}` : '',
    input.designBrief?.keepClear ? `Keep clear: ${input.designBrief.keepClear}` : '',
    input.userPrompt ? `Additional preference: ${input.userPrompt}` : '',
    'Preserve the original camera, framing, walls, floor, ceiling, doors, windows, stairs, bathroom, fixtures and existing large objects.',
    'Change only the guided product area. Match perspective, light and a small contact shadow. Do not add text, logos, watermarks, duplicate products or extra furniture.',
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
  form.append('image', new Blob([input.guide.buffer], { type: input.guide.mimeType }), 'placement.jpg');
  form.append('image', new Blob([input.product.buffer], { type: input.product.mimeType }), 'product.png');
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
  form.append('input_image_1', new Blob([input.guide.buffer], { type: input.guide.mimeType }), 'placement.jpg');
  form.append('input_image_2', new Blob([input.product.buffer], { type: input.product.mimeType }), 'product.png');

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
      const models = String(env.pollinationsImageModels || 'gpt-image-2')
        .split(',').map((model) => model.trim()).filter(Boolean).slice(0, 2);
      models.forEach((model) => providers.push({ name, model }));
    }
    if (name === 'cloudflare' && env.cloudflareAccountId && env.cloudflareApiToken) {
      providers.push({ name, model: env.cloudflareImageModel });
    }
  }
  return providers;
}

async function generateRoomPreview(input) {
  const room = readImage(input.roomImageDataUrl, 'Ảnh phòng');
  const guide = readImage(input.guideImageDataUrl, 'Ảnh vị trí');
  const product = readImage(input.productImageDataUrl, 'Ảnh sản phẩm');
  if (room.buffer.length + guide.buffer.length + product.buffer.length > MAX_TOTAL_BYTES) {
    throw serviceError('Tổng dung lượng ảnh vượt quá 15 MB.', 400);
  }

  const providers = providerList();
  if (!providers.length) throw serviceError('Chưa cấu hình dịch vụ tạo ảnh.', 503);
  const request = { ...input, room, guide, product, size: outputSize(input.imageSize), prompt: buildPrompt(input) };
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
        editRegion: input.editRegion,
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
