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

function buildPrompt(productName, placement, editRegion) {
  return [
    `Use image 0 as a tightly cropped room edit region and image 1 as the exact product reference. Add exactly one product: "${productName}".`,
    'Only edit the supplied crop. Keep the room, staircase, walls, floor, lighting, camera viewpoint, perspective, and all existing furniture in that crop unchanged unless needed to place the product.',
    'Do not add a chair, laptop, plant, lamp, decoration, or any other object that was not requested.',
    'Keep the supplied product\'s shape, color, material, identity, and proportions. Do not redesign or replace it with another product.',
    'The supplied product is fully opaque. Do not make it transparent, translucent, ghost-like, or see-through.',
    'Do not let the room background show through the tabletop, legs, or any other product surface.',
    'Place the product at the position shown in image 0. The anchor is bottom-center and the bottom of the product must meet the intended surface at that exact location.',
    'Create natural perspective, contact shadows, cast shadows, and lighting that match the room.',
    `The normalized placement reference is x=${Number(placement.x).toFixed(3)}, y=${Number(placement.y).toFixed(3)}, with the origin at the top-left.`,
    `The normalized full-room edit region is x=${Number(editRegion.x).toFixed(3)}, y=${Number(editRegion.y).toFixed(3)}, width=${Number(editRegion.width).toFixed(3)}, height=${Number(editRegion.height).toFixed(3)}.`,
    'Return one realistic image for this crop only. Do not reconstruct or redesign the rest of the room.',
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
  const guideImage = parseImageDataUrl(guideImageDataUrl, 'guideImageDataUrl');
  const productImage = parseImageDataUrl(productImageDataUrl, 'productImageDataUrl');
  if (roomImage.buffer.length + guideImage.buffer.length + productImage.buffer.length > MAX_IMAGE_BYTES) {
    throw createError('Tổng dung lượng các ảnh vượt quá giới hạn 15 MB.');
  }

  const form = new FormData();
  form.append('prompt', buildPrompt(productName, placement, editRegion));
  // Cloudflare chỉ nhận crop + ảnh tham chiếu. Ảnh phòng gốc vẫn được gửi tới backend
  // để kiểm tra kích thước và dành cho bước composite ở frontend, không gửi vào AI.
  form.append('input_image_0', new Blob([guideImage.buffer], { type: guideImage.mimeType }), 'room-guide');
  form.append('input_image_1', new Blob([productImage.buffer], { type: productImage.mimeType }), 'product-reference');

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
