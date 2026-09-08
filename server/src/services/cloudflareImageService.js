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

function productPrompt(product, index) {
  const dimensions = Object.entries(product.dimensionsCm || {})
    .filter(([, value]) => Number(value) > 0)
    .map(([name, value]) => `${name} ${value} cm`)
    .join(', ');
  const usage = product.usageType === 'floor-seating'
    ? 'It is low furniture for floor seating; keep it low and do not add a chair.'
    : '';
  const support = {
    floor: 'It must stand naturally on the floor.',
    wall: 'It must be mounted naturally on the wall.',
    tabletop: 'It must rest naturally on an existing tabletop or shelf.',
  }[product.placementSurface] || '';

  return [
    `Product ${index + 1}: ${JSON.stringify(product.productName)}.`,
    `Place it ${product.desiredPosition}.`,
    `Reference image ${index + 2} is this exact product. Preserve its silhouette, color, material, proportions, legs, shelves, doors, handles and supports.`,
    dimensions ? `Known dimensions: ${dimensions}.` : '',
    usage,
    support,
    product.aiDescription ? `Product detail: ${product.aiDescription}.` : '',
  ].filter(Boolean).join(' ');
}

function buildPrompt(input) {
  return [
    'Create one photorealistic edit of the original room in image 1.',
    `Add exactly ${input.products.length} selected product${input.products.length > 1 ? 's' : ''}, using the following reference images in order.`,
    ...input.products.map(productPrompt),
    input.userPrompt ? `Other request: ${input.userPrompt}.` : '',
    'Keep the original camera, framing, walls, floor, ceiling, doors, windows, stairs, bathroom, fixtures, room shape and existing large objects unchanged.',
    'Place every selected product once, at a physically possible location described by the user. Match perspective, scale, lighting and contact shadows.',
    'Do not add unselected furniture. Do not duplicate, replace or redesign a selected product. Do not add text, logos or watermarks.',
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
