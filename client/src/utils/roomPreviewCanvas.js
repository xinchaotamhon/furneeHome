import { computeProductPerspectiveTransform } from './cameraSolver';

const DEFAULT_PRODUCT_SCALE = 0.22;
// FLUX multi-reference inputs are limited to 512 px per edge on Workers AI.
const MAX_GUIDE_EDGE = 512;
const MAX_REFERENCE_EDGE = 512;
const CROP_PADDING_PX = 16;

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

function getCategoryBaseScale(product) {
  if (product?.defaultScale && Number.isFinite(Number(product.defaultScale))) {
    return Number(product.defaultScale);
  }
  const name = (product?.name || '').toLowerCase();
  const cat = (typeof product?.category === 'object' ? product?.category?.name : product?.category || product?.categoryName || '').toLowerCase();
  const combined = `${cat} ${name}`;

  if (/đèn|lamp|clock|decor|đồng hồ|tranh|cây|chậu|hoa/.test(combined)) return 0.12;
  if (/tủ nhựa|tủ mini|kệ đầu giường|tab đầu giường|hộc tủ|tủ 3|tủ 4|tủ 5|homi|matsu|ngăn kéo mini/.test(combined)) return 0.18;
  if (/bàn gấp|bàn học mini|bàn làm việc mini|bàn để giường|bàn chữ nhật gấp/.test(combined)) return 0.19;
  if (/ghế|chair|đôn|nệm ngồi/.test(combined)) return 0.21;
  if (/kệ sách|kệ để đồ|kệ đa năng|kệ treo|giá sách/.test(combined)) return 0.23;
  if (/tủ vải|tủ quần áo|tủ gỗ|wardrobe/.test(combined)) return 0.28;
  if (/thảm|rug|carpet/.test(combined)) return 0.36;

  return 0.21;
}

export function getProductScale(product, target = { y: 75 }) {
  const baseScale = getCategoryBaseScale(product);
  const targetY = Number.isFinite(target?.y) ? target.y : 75;
  // Tự động tính tỷ lệ phối cảnh theo chiều sâu: Càng xa (y thấp) vật càng nhỏ, càng gần (y cao) vật càng to
  const depthFactor = 0.60 + (Math.max(30, Math.min(targetY, 95)) / 100) * 0.45;
  return Math.min(0.65, Math.max(0.08, baseScale * depthFactor));
}

function isWallMounted(productName = '') {
  return /treo|tranh|gương|khung lưới|đèn tường|clock|đồng hồ treo/i.test(productName);
}

export function getProductPreviewStyle(product, target, isFlipped = false, cameraParams = null) {
  const scale = getProductScale(product, target);
  const isWall = isWallMounted(product?.name);
  const { cssTransform } = computeProductPerspectiveTransform(target, isWall, isFlipped, cameraParams);

  return {
    left: `${target.x}%`,
    top: `${target.y}%`,
    width: `${scale * 100}%`,
    transform: cssTransform,
    transformOrigin: 'bottom center',
  };
}

function getProductRectangle(roomSize, productImage, target, product, placementScale = 1) {
  const scale = getProductScale(product, target) * Math.max(0.4, Math.min(1.8, Number(placementScale) || 1));
  const productWidth = roomSize.width * scale;
  const productHeight = productWidth * (productImage.naturalHeight / productImage.naturalWidth);
  const anchorX = roomSize.width * (target.x / 100);
  const anchorY = roomSize.height * (target.y / 100);
  const productX = anchorX - (productWidth / 2);
  const productY = anchorY - productHeight;
  const x = Math.max(0, Math.floor(productX - CROP_PADDING_PX));
  const y = Math.max(0, Math.floor(productY - CROP_PADDING_PX));
  const right = Math.min(roomSize.width, Math.ceil(productX + productWidth + CROP_PADDING_PX));
  const bottom = Math.min(roomSize.height, Math.ceil(productY + productHeight + (CROP_PADDING_PX * 2)));

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

function drawPhysicsFloorShadow(context, rect, productName = '', target = { x: 50 }) {
  const isWall = isWallMounted(productName);
  if (isWall) return;

  const { productX, productY, productWidth, productHeight } = rect;
  const footY = productY + productHeight;
  const targetX = Number.isFinite(target?.x) ? target.x : 50;
  
  // Tự động dịch nhẹ tâm bóng theo hướng nguồn sáng và vách tường
  const shadowOffsetX = targetX < 42 ? (productWidth * 0.04) : (targetX > 58 ? -(productWidth * 0.04) : 0);
  const centerX = productX + (productWidth / 2) + shadowOffsetX;

  context.save();

  // 1. Bóng tiếp xúc siêu sát chân sàn (Contact Ambient Occlusion)
  const contactHeight = Math.max(2, Math.min(7, productHeight * 0.02));
  const contactWidth = productWidth * 0.72;

  const contactGrad = context.createRadialGradient(
    centerX, footY - 1, 0,
    centerX, footY - 1, contactWidth / 2
  );
  contactGrad.addColorStop(0, 'rgba(10, 15, 12, 0.48)');
  contactGrad.addColorStop(0.35, 'rgba(15, 20, 18, 0.28)');
  contactGrad.addColorStop(0.75, 'rgba(25, 32, 28, 0.08)');
  contactGrad.addColorStop(1, 'rgba(30, 38, 32, 0)');

  context.beginPath();
  context.ellipse(centerX, footY - 1, contactWidth / 2, contactHeight, 0, 0, Math.PI * 2);
  context.fillStyle = contactGrad;
  context.fill();

  // 2. Bóng lan tỏa mềm theo ánh sáng trần (Soft Diffuse Cast Shadow)
  const diffuseWidth = productWidth * 0.82;
  const diffuseHeight = Math.max(5, Math.min(14, productHeight * 0.045));

  const diffuseGrad = context.createRadialGradient(
    centerX, footY + (diffuseHeight * 0.25), 0,
    centerX, footY + (diffuseHeight * 0.25), diffuseWidth / 2
  );
  diffuseGrad.addColorStop(0, 'rgba(18, 24, 20, 0.18)');
  diffuseGrad.addColorStop(0.5, 'rgba(25, 34, 28, 0.08)');
  diffuseGrad.addColorStop(1, 'rgba(35, 45, 38, 0)');

  context.beginPath();
  context.ellipse(centerX, footY + (diffuseHeight * 0.2), diffuseWidth / 2, diffuseHeight, 0, 0, Math.PI * 2);
  context.fillStyle = diffuseGrad;
  context.fill();

  context.restore();
}

function drawAiProductGuide(fullCanvas, productImage, rectangle, isFlipped = false, productName = '', target = { x: 50 }, cameraParams = null, rotation = 0) {
  const context = fullCanvas.getContext('2d');
  const isWall = isWallMounted(productName);
  const { canvasTransform } = computeProductPerspectiveTransform(target, isWall, isFlipped, cameraParams);

  // 1. Vẽ bóng đổ tiếp xúc vật lý chạm sàn
  drawPhysicsFloorShadow(context, rectangle, productName, target);

  // 2. Vẽ sản phẩm với phối cảnh tự động tính từ cameraSolver
  context.save();
  context.globalAlpha = 1;

  context.translate(rectangle.productX + (rectangle.productWidth / 2), rectangle.productY + (rectangle.productHeight / 2));
  context.rotate((Number(rotation) || 0) * Math.PI / 180);
  if (Array.isArray(canvasTransform)) {
    context.transform(...canvasTransform);
  }
  if (isFlipped) {
    context.scale(-1, 1);
  }
  context.drawImage(productImage, -rectangle.productWidth / 2, -rectangle.productHeight / 2, rectangle.productWidth, rectangle.productHeight);
  context.restore();
}

function createReferenceComposite(scene) {
  const columns = 3;
  const rows = Math.ceil(scene.length / columns);
  const canvas = makeCanvas(MAX_REFERENCE_EDGE, Math.min(MAX_REFERENCE_EDGE, Math.max(1, rows) * 128));
  const context = canvas.getContext('2d');
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / rows;

  scene.forEach(({ placement, image }, index) => {
    const ratio = Math.min((cellWidth * 0.78) / image.naturalWidth, (cellHeight * 0.78) / image.naturalHeight);
    const width = image.naturalWidth * ratio;
    const height = image.naturalHeight * ratio;
    context.save();
    context.translate(((index % columns) * cellWidth) + (cellWidth / 2), (Math.floor(index / columns) * cellHeight) + (cellHeight / 2));
    if (placement.isFlipped) context.scale(-1, 1);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
  });
  return canvas;
}

function getScenePlacements({ placements, productSource, target, product, isFlipped }) {
  if (Array.isArray(placements) && placements.length) return placements.slice(0, 12);
  return productSource && product ? [{ product, target, isFlipped, scale: 1, rotation: 0, zIndex: 1, productSource }] : [];
}

export async function createRoomPreviewImages({ roomSource, placements, productSource, target, product, isFlipped = false, cameraParams = null }) {
  const scenePlacements = getScenePlacements({ placements, productSource, target, product, isFlipped });
  if (!roomSource || !scenePlacements.length) throw new Error('Cần có ảnh phòng và ít nhất một sản phẩm tách nền.');

  const sources = scenePlacements.map((placement) => placement.productSource || getProductImageSource(placement.product));
  if (sources.some((source) => !source)) throw new Error('Một sản phẩm trong phòng chưa có ảnh tách nền.');

  const [roomImage, ...productImages] = await Promise.all([loadImage(roomSource), ...sources.map(loadImage)]);
  const roomSize = fitSize(roomImage.naturalWidth, roomImage.naturalHeight, MAX_GUIDE_EDGE);
  const roomCanvas = makeCanvas(roomSize.width, roomSize.height);
  roomCanvas.getContext('2d').drawImage(roomImage, 0, 0, roomSize.width, roomSize.height);
  const guideCanvas = makeCanvas(roomSize.width, roomSize.height);
  guideCanvas.getContext('2d').drawImage(roomCanvas, 0, 0);

  const maskCanvas = makeCanvas(roomSize.width, roomSize.height);
  const maskContext = maskCanvas.getContext('2d');
  maskContext.fillStyle = '#000';
  maskContext.fillRect(0, 0, roomSize.width, roomSize.height);
  maskContext.fillStyle = '#fff';
  const scene = scenePlacements
    .map((placement, index) => ({ placement, image: productImages[index] }))
    .sort((left, right) => (left.placement.zIndex || 0) - (right.placement.zIndex || 0));

  scene.forEach(({ placement, image }) => {
    const placementTarget = placement.target || target;
    const sceneProduct = placement.product || product;
    const rectangle = getProductRectangle(roomSize, image, placementTarget, sceneProduct, placement.scale);
    drawAiProductGuide(guideCanvas, image, rectangle, placement.isFlipped, placement.productName || sceneProduct?.name, placementTarget, cameraParams, placement.rotation);
    const angle = (Number(placement.rotation) || 0) * Math.PI / 180;
    const rotatedWidth = Math.abs(rectangle.productWidth * Math.cos(angle)) + Math.abs(rectangle.productHeight * Math.sin(angle));
    const rotatedHeight = Math.abs(rectangle.productWidth * Math.sin(angle)) + Math.abs(rectangle.productHeight * Math.cos(angle));
    const padding = Math.ceil(Math.max(rotatedWidth, rotatedHeight) * 0.12);
    const centerX = rectangle.productX + (rectangle.productWidth / 2);
    const centerY = rectangle.productY + (rectangle.productHeight / 2);
    const maskX = Math.max(0, Math.floor(centerX - (rotatedWidth / 2) - padding));
    const maskY = Math.max(0, Math.floor(centerY - (rotatedHeight / 2) - padding));
    const maskRight = Math.min(roomSize.width, Math.ceil(centerX + (rotatedWidth / 2) + padding));
    const maskBottom = Math.min(roomSize.height, Math.ceil(centerY + (rotatedHeight / 2) + padding));
    maskContext.fillRect(maskX, maskY, maskRight - maskX, maskBottom - maskY);
  });

  const referenceCanvas = createReferenceComposite(scene);
  return {
    roomImageDataUrl: roomCanvas.toDataURL('image/jpeg', 0.9),
    guideImageDataUrl: guideCanvas.toDataURL('image/jpeg', 0.9),
    maskImageDataUrl: maskCanvas.toDataURL('image/png'),
    productImageDataUrl: referenceCanvas.toDataURL('image/png'),
    editRegion: { x: 0, y: 0, width: 1, height: 1 },
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
