const env = require('../config/env');

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i;

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getConfigurationError() {
  const missing = [
    ['CLOUDFLARE_ACCOUNT_ID', env.cloudflareAccountId],
    ['CLOUDFLARE_API_TOKEN', env.cloudflareApiToken],
    ['CLOUDFLARE_IMAGE_MODEL', env.cloudflareImageModel],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (!missing.length) return null;
  return createError(`Cloudflare Workers AI chưa được cấu hình. Hãy kiểm tra file .env ở thư mục gốc dự án. Thiếu: ${missing.join(', ')}.`, 503);
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
    mimeType: match[1].toLowerCase().replace('image/jpg', 'image/jpeg'),
  };
}

function isWallMounted(productName = '') {
  return /treo|tranh|gương|khung lưới|đèn tường|clock|đồng hồ treo/i.test(productName);
}

function buildPrompt(productName, placement) {
  const isWall = isWallMounted(productName);
  const isLeft = placement.x < 0.42;
  const isRight = placement.x > 0.58;
  const locX = isLeft ? 'on the left side' : (isRight ? 'on the right side' : 'in the center');

  if (isWall) {
    return [
      'Masterpiece photorealistic interior photography, architectural visualization.',
      `Insert the exact reference product "${productName}" from image 1 into the real room scene in image 0.`,
      'INTEGRATION RULES:',
      `- Mount neatly flat on the vertical wall surface ${locX}.`,
      '- Cast soft ambient drop shadow onto the wall tiles behind it matching ceiling light.',
      '- 100% ROOM PRESERVATION: Keep the stairs, loft, floor tiles, walls, and all existing room elements 100% identical.',
      'One clean, high-resolution photorealistic composite photo.'
    ].join(' ');
  }

  // Floor-standing furniture (bàn, ghế, tủ, kệ, giường...)
  const wallPlacementRule = isLeft
    ? 'The furniture MUST be realistically positioned placed FLUSH against the LEFT wall surface, with its back touching the left wall tiles and its front facing inward into the room corridor (natural 3/4 perspective). It must NOT block the walkway or face flat forward.'
    : isRight
      ? 'The furniture MUST be realistically positioned placed FLUSH against the RIGHT wall surface, with its back touching the right wall and its front facing inward to the left (natural 3/4 perspective).'
      : 'The furniture MUST be placed standing upright on the ground plane, positioned naturally against the back wall facing forward.';

  return [
    'Masterpiece architectural interior photography, shot on 35mm lens, natural interior ambient lighting.',
    `Seamlessly integrate the exact reference furniture "${productName}" from image 1 standing naturally inside the real room scene in image 0.`,
    'SPATIAL & PHYSICAL PLACEMENT RULES:',
    `- ${wallPlacementRule}`,
    '- Ground plane: all wheels/feet/base MUST be solidly planted on the tiled floor with dark contact shadows directly underneath touching the tiles.',
    '- Perspective and vanishing lines must strictly follow the floor tile grid and room geometry.',
    '- Match the room lighting tone, warmth, and diffuse ceiling light reflections.',
    '- 100% ROOM PRESERVATION: Keep the stairs, loft, white wall tiles, floor tiles, bathroom door, and existing furniture 100% identical and untouched.',
    'One crisp, ultra-realistic interior photo.'
  ].join(' ');
}

function getCloudflareErrorMessage(responseBody, status) {
  const messages = Array.isArray(responseBody?.errors)
    ? responseBody.errors.map((error) => error?.message || error?.code).filter(Boolean)
    : [];
  return messages.length ? messages.join('; ') : `Cloudflare Workers AI trả về lỗi HTTP ${status}.`;
}

function redactDiagnosticValue(value) {
  let result = String(value || '');
  if (env.cloudflareApiToken) result = result.replace(env.cloudflareApiToken, '[redacted-token]');
  if (env.cloudflareAccountId) result = result.replace(env.cloudflareAccountId, '[redacted-account-id]');
  return result;
}

function createNetworkDiagnostic(error, requestUrl) {
  const cause = error?.cause || {};
  return {
    name: redactDiagnosticValue(error?.name),
    message: redactDiagnosticValue(error?.message),
    code: redactDiagnosticValue(error?.code),
    causeCode: redactDiagnosticValue(cause.code),
    causeMessage: redactDiagnosticValue(cause.message),
    hostname: new URL(requestUrl).hostname,
    model: env.cloudflareImageModel,
  };
}

async function generateRoomPreview({ roomImageDataUrl, guideImageDataUrl, productImageDataUrl, productName, placement, editRegion }) {
  const configurationError = getConfigurationError();
  if (configurationError) throw configurationError;

  const roomImage = parseImageDataUrl(roomImageDataUrl, 'roomImageDataUrl');
  const productImage = parseImageDataUrl(productImageDataUrl, 'productImageDataUrl');
  if (roomImage.buffer.length + productImage.buffer.length > MAX_IMAGE_BYTES) {
    throw createError('Tổng dung lượng các ảnh vượt quá giới hạn 15 MB.');
  }

  const form = new FormData();
  form.append('prompt', buildPrompt(productName, placement));
  form.append('input_image_0', new Blob([roomImage.buffer], { type: roomImage.mimeType }), 'room-scene.jpg');
  form.append('input_image_1', new Blob([productImage.buffer], { type: productImage.mimeType }), 'product-reference.png');

  const startedAt = Date.now();
  const requestUrl = `https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/run/${env.cloudflareImageModel}`;
  let response;
  let responseBody;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.cloudflareApiToken}` },
      body: form,
    });
    responseBody = await response.json();
  } catch (error) {
    const diagnostic = createNetworkDiagnostic(error, requestUrl);
    console.error('[Cloudflare Workers AI network error]', JSON.stringify(diagnostic));
    const networkError = createError('Không thể kết nối tới Cloudflare Workers AI. Vui lòng thử lại sau.', 502);
    networkError.diagnostic = diagnostic;
    throw networkError;
  }

  if (!response.ok || responseBody?.success === false) {
    throw createError(getCloudflareErrorMessage(responseBody, response.status), 502);
  }

  const imageBase64 = typeof responseBody?.result === 'string'
    ? responseBody.result
    : responseBody?.result?.image;
  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    throw createError('Cloudflare Workers AI không trả về ảnh kết quả.', 502);
  }

  const imageDataUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:image/png;base64,${imageBase64}`;

  return {
    imageDataUrl,
    model: env.cloudflareImageModel,
    elapsedMs: Date.now() - startedAt,
  };
}

module.exports = { generateRoomPreview };
