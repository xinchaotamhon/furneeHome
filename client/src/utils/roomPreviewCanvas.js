const DEFAULT_PRODUCT_SCALE = 0.28;
const MAX_GUIDE_EDGE = 1024;
const MAX_REFERENCE_EDGE = 512;
const CROP_PADDING_PX = 12;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể đọc ảnh để tạo bản hướng dẫn.'));
    image.src = source;
  });
}

function fitSize(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function getProductImageSource(product) {
  return product?.transparentImage || product?.image || '';
}

export function getProductScale(product) {
  const value = Number(product?.defaultScale);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 0.8) : DEFAULT_PRODUCT_SCALE;
}

export function getProductPreviewStyle(product, target) {
  return {
    left: `${target.x}%`,
    top: `${target.y}%`,
    width: `${getProductScale(product) * 100}%`,
    transform: 'translate(-50%, -100%)',
  };
}

function getProductRectangle(roomSize, productImage, target, product) {
  const productWidth = roomSize.width * getProductScale(product);
  const productHeight = productWidth * (productImage.naturalHeight / productImage.naturalWidth);
  const anchorX = roomSize.width * (target.x / 100);
  const anchorY = roomSize.height * (target.y / 100);
  const productX = anchorX - (productWidth / 2);
  const productY = anchorY - productHeight;
  const x = Math.max(0, Math.floor(productX - CROP_PADDING_PX));
  const y = Math.max(0, Math.floor(productY - CROP_PADDING_PX));
  const right = Math.min(roomSize.width, Math.ceil(productX + productWidth + CROP_PADDING_PX));
  const bottom = Math.min(roomSize.height, Math.ceil(productY + productHeight + CROP_PADDING_PX));

  return {
    productX, productY, productWidth, productHeight, x, y,
    width: Math.max(1, right - x), height: Math.max(1, bottom - y),
  };
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawAiProductGuide(fullCanvas, productImage, rectangle) {
  const context = fullCanvas.getContext('2d');
  context.save();
  context.globalAlpha = 1;
  context.drawImage(productImage, rectangle.productX, rectangle.productY, rectangle.productWidth, rectangle.productHeight);
  context.restore();
}

function createReferenceCanvas(productImage) {
  const referenceSize = fitSize(productImage.naturalWidth, productImage.naturalHeight, MAX_REFERENCE_EDGE);
  const referenceCanvas = makeCanvas(referenceSize.width, referenceSize.height);
  referenceCanvas.getContext('2d').drawImage(productImage, 0, 0, referenceSize.width, referenceSize.height);
  return referenceCanvas;
}

export async function createRoomPreviewImages({ roomSource, productSource, target, product }) {
  if (!roomSource || !productSource) throw new Error('Cần có ảnh phòng và ảnh sản phẩm tách nền.');

  const [roomImage, productImage] = await Promise.all([loadImage(roomSource), loadImage(productSource)]);
  const roomSize = fitSize(roomImage.naturalWidth, roomImage.naturalHeight, MAX_GUIDE_EDGE);
  const roomCanvas = makeCanvas(roomSize.width, roomSize.height);
  roomCanvas.getContext('2d').drawImage(roomImage, 0, 0, roomSize.width, roomSize.height);

  const rectangle = getProductRectangle(roomSize, productImage, target, product);
  const guideCanvas = makeCanvas(roomSize.width, roomSize.height);
  guideCanvas.getContext('2d').drawImage(roomCanvas, 0, 0);
  drawAiProductGuide(guideCanvas, productImage, rectangle);

  const cropCanvas = makeCanvas(rectangle.width, rectangle.height);
  cropCanvas.getContext('2d').drawImage(guideCanvas, rectangle.x, rectangle.y, rectangle.width, rectangle.height, 0, 0, rectangle.width, rectangle.height);

  const referenceCanvas = createReferenceCanvas(productImage);
  return {
    roomImageDataUrl: roomCanvas.toDataURL('image/jpeg', 0.9),
    guideImageDataUrl: cropCanvas.toDataURL('image/jpeg', 0.9),
    productImageDataUrl: referenceCanvas.toDataURL('image/png'),
    editRegion: {
      x: Number((rectangle.x / roomSize.width).toFixed(6)),
      y: Number((rectangle.y / roomSize.height).toFixed(6)),
      width: Number((rectangle.width / roomSize.width).toFixed(6)),
      height: Number((rectangle.height / roomSize.height).toFixed(6)),
    },
  };
}

function applyFeather(cropCanvas, feather = 12) {
  const width = cropCanvas.width;
  const height = cropCanvas.height;
  const size = Math.min(feather, Math.floor(width / 2), Math.floor(height / 2));
  if (size <= 0) return cropCanvas;

  const maskCanvas = makeCanvas(width, height);
  const mask = maskCanvas.getContext('2d');
  mask.fillStyle = '#fff';
  mask.fillRect(size, size, width - (size * 2), height - (size * 2));
  const top = mask.createLinearGradient(0, 0, 0, size);
  top.addColorStop(0, 'rgba(255,255,255,0)'); top.addColorStop(1, '#fff');
  mask.fillStyle = top; mask.fillRect(size, 0, width - (size * 2), size);
  const bottom = mask.createLinearGradient(0, height - size, 0, height);
  bottom.addColorStop(0, '#fff'); bottom.addColorStop(1, 'rgba(255,255,255,0)');
  mask.fillStyle = bottom; mask.fillRect(size, height - size, width - (size * 2), size);
  const left = mask.createLinearGradient(0, 0, size, 0);
  left.addColorStop(0, 'rgba(255,255,255,0)'); left.addColorStop(1, '#fff');
  mask.fillStyle = left; mask.fillRect(0, size, size, height - (size * 2));
  const right = mask.createLinearGradient(width - size, 0, width, 0);
  right.addColorStop(0, '#fff'); right.addColorStop(1, 'rgba(255,255,255,0)');
  mask.fillStyle = right; mask.fillRect(width - size, size, size, height - (size * 2));

  const context = cropCanvas.getContext('2d');
  // Chỉ làm mềm bốn mép ngoài crop; phần giữa, bao gồm toàn bộ sản phẩm, giữ alpha 1.
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(maskCanvas, 0, 0);
  context.globalCompositeOperation = 'source-over';
  return cropCanvas;
}

export async function compositeRoomPreview({ roomSource, resultSource, editRegion }) {
  if (!roomSource || !resultSource || !editRegion) throw new Error('Thiếu ảnh để ghép kết quả AI vào phòng.');
  const [roomImage, resultImage] = await Promise.all([loadImage(roomSource), loadImage(resultSource)]);
  const canvas = makeCanvas(roomImage.naturalWidth, roomImage.naturalHeight);
  const context = canvas.getContext('2d');
  context.globalAlpha = 1;
  context.drawImage(roomImage, 0, 0, canvas.width, canvas.height);

  const x = Math.round(canvas.width * editRegion.x);
  const y = Math.round(canvas.height * editRegion.y);
  const width = Math.max(1, Math.round(canvas.width * editRegion.width));
  const height = Math.max(1, Math.round(canvas.height * editRegion.height));
  const cropCanvas = makeCanvas(width, height);
  const cropContext = cropCanvas.getContext('2d');
  cropContext.globalAlpha = 1;
  cropContext.drawImage(resultImage, 0, 0, width, height);
  applyFeather(cropCanvas, CROP_PADDING_PX);
  context.drawImage(cropCanvas, x, y, width, height);

  return canvas.toDataURL('image/jpeg', 0.9);
}

// Giữ tên cũ để các màn hình hoặc nhánh đang phát triển không bị lỗi import.
export async function createRoomGuideImages(args) {
  return createRoomPreviewImages(args);
}
