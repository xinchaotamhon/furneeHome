import { computeProductPerspectiveTransform } from './cameraSolver.js';

// Workers AI FLUX requires every reference edge to be smaller than 512 px.
const MAX_GUIDE_EDGE = 511;
const MAX_REFERENCE_EDGE = 511;
const CROP_PADDING_PX = 16;
const REFERENCE_BACKGROUND = '#f3f1ec';
const REFERENCE_OBJECT_RATIO = 0.9;
export const IDENTITY_DETAIL_ALPHA = 0.18;
export const OUTPUT_JPEG_QUALITY = 0.94;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(source)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể đọc ảnh để tạo bản hướng dẫn.'));
    image.src = source;
  });
}

function fitSize(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function getRoomLayerSizes(width, height) {
  const safeWidth = Math.max(1, Math.round(Number(width) || 1));
  const safeHeight = Math.max(1, Math.round(Number(height) || 1));
  return {
    provider: fitSize(safeWidth, safeHeight, MAX_GUIDE_EDGE),
    composite: { width: safeWidth, height: safeHeight },
  };
}

export function getProductImageSource(product) {
  return product?.transparentImage || product?.image || '';
}

function getProductImageSources(product) {
  return [...new Set([product?.transparentImage, product?.image].filter(Boolean))];
}

function getCategoryBaseScale(product) {
  let baseScale;
  if (product?.defaultScale && Number.isFinite(Number(product.defaultScale))) {
    baseScale = Number(product.defaultScale);
  } else {
    const name = (product?.name || '').toLowerCase();
    const cat = (typeof product?.category === 'object' ? product?.category?.name : product?.category || product?.categoryName || '').toLowerCase();
    const combined = `${cat} ${name}`;

    if (/đèn|lamp|clock|decor|đồng hồ|tranh|cây|chậu|hoa/.test(combined)) baseScale = 0.12;
    else if (/tủ nhựa|tủ mini|kệ đầu giường|tab đầu giường|hộc tủ|tủ 3|tủ 4|tủ 5|homi|matsu|ngăn kéo mini/.test(combined)) baseScale = 0.18;
    else if (/bàn gấp|bàn học mini|bàn làm việc mini|bàn để giường|bàn chữ nhật gấp/.test(combined)) baseScale = 0.19;
    else if (/ghế|chair|đôn|nệm ngồi/.test(combined)) baseScale = 0.21;
    else if (/kệ sách|kệ để đồ|kệ đa năng|kệ treo|giá sách/.test(combined)) baseScale = 0.23;
    else if (/tủ vải|tủ quần áo|tủ gỗ|wardrobe/.test(combined)) baseScale = 0.28;
    else if (/thảm|rug|carpet/.test(combined)) baseScale = 0.36;
    else baseScale = 0.21;
  }

  // Không có mốc đo của phòng nên dimensionsCm không thể biến thành tỷ lệ mét đáng tin.
  // Fact “ngồi bệt” chỉ hạ mặc định theo hướng thận trọng; người dùng vẫn chỉnh tỷ lệ trực tiếp.
  return product?.usageType === 'floor-seating' ? Math.min(baseScale, 0.17) : baseScale;
}

export function getProductScale(product, target = { y: 75 }) {
  const baseScale = getCategoryBaseScale(product);
  const targetY = Number.isFinite(target?.y) ? target.y : 75;
  // Đây là gợi ý tỷ lệ theo chiều sâu ảnh, không phải phép đo kích thước thật của căn phòng.
  const depthFactor = 0.60 + (Math.max(30, Math.min(targetY, 95)) / 100) * 0.45;
  return Math.min(0.65, Math.max(0.08, baseScale * depthFactor));
}

function getPlacementSurface(product = {}) {
  return product?.placementSurface || 'unknown';
}

function isWallMounted(product = {}) {
  const surface = getPlacementSurface(product);
  if (surface === 'wall') return true;
  if (surface === 'floor' || surface === 'tabletop') return false;
  return /treo|tranh|gương|khung lưới|đèn tường|clock|đồng hồ treo/i.test(product?.name || '');
}

export function getProductPreviewStyle(product, target, isFlipped = false, cameraParams = null, placementScale = 1, rotation = 0) {
  const scale = getProductScale(product, target) * Math.max(0.4, Math.min(1.8, Number(placementScale) || 1));
  const isWall = isWallMounted(product);
  const { cssTransform } = computeProductPerspectiveTransform(target, isWall, isFlipped, cameraParams);

  return {
    left: `${target.x}%`,
    top: `${target.y}%`,
    width: `${scale * 100}%`,
    transform: `rotate(${Number(rotation) || 0}deg) ${cssTransform} translate(-50%, -100%)`,
    transformOrigin: '0 0',
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

function drawPhysicsFloorShadow(context, rect, product = {}, target = { x: 50 }) {
  const surface = getPlacementSurface(product);
  if (isWallMounted(product) || surface === 'tabletop') return;

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

function drawAiProductGuide(fullCanvas, productImage, rectangle, isFlipped = false, product = {}, target = { x: 50 }, cameraParams = null, rotation = 0, includeShadow = true) {
  const context = fullCanvas.getContext('2d');
  const isWall = isWallMounted(product);
  const { canvasTransform } = computeProductPerspectiveTransform(target, isWall, isFlipped, cameraParams);

  if (includeShadow) drawPhysicsFloorShadow(context, rectangle, product, target);

  // 2. Vẽ sản phẩm với phối cảnh tự động tính từ cameraSolver
  context.save();
  context.globalAlpha = 1;

  context.translate(rectangle.productX + (rectangle.productWidth / 2), rectangle.productY + rectangle.productHeight);
  context.rotate((Number(rotation) || 0) * Math.PI / 180);
  if (Array.isArray(canvasTransform)) {
    context.transform(...canvasTransform);
  }
  if (isFlipped) {
    context.scale(-1, 1);
  }
  context.drawImage(productImage, -rectangle.productWidth / 2, -rectangle.productHeight, rectangle.productWidth, rectangle.productHeight);
  context.restore();
}

function drawProductMask(maskContext, roomSize, productImage, rectangle, isFlipped = false, product = {}, target = { x: 50 }, cameraParams = null, rotation = 0) {
  const silhouette = makeCanvas(roomSize.width, roomSize.height);
  const context = silhouette.getContext('2d');
  const isWall = isWallMounted(product);
  const { canvasTransform } = computeProductPerspectiveTransform(target, isWall, isFlipped, cameraParams);

  context.save();
  context.translate(rectangle.productX + (rectangle.productWidth / 2), rectangle.productY + rectangle.productHeight);
  context.rotate((Number(rotation) || 0) * Math.PI / 180);
  if (Array.isArray(canvasTransform)) context.transform(...canvasTransform);
  if (isFlipped) context.scale(-1, 1);
  context.drawImage(productImage, -rectangle.productWidth / 2, -rectangle.productHeight, rectangle.productWidth, rectangle.productHeight);
  context.restore();

  // Convert source alpha into a white silhouette, then add a local halo. The
  // halo gives AI enough room for light and contact shadow without opening a
  // rectangular area that could repaint nearby architecture.
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, roomSize.width, roomSize.height);
  context.globalCompositeOperation = 'source-over';

  const haloSize = Math.max(4, Math.min(24, Math.round(Math.max(rectangle.productWidth, rectangle.productHeight) * 0.055)));
  maskContext.save();
  maskContext.globalAlpha = 0.64;
  maskContext.filter = `blur(${haloSize}px)`;
  maskContext.drawImage(silhouette, 0, 0);
  maskContext.restore();

  if (!isWall && getPlacementSurface(product) !== 'tabletop') {
    maskContext.save();
    maskContext.globalAlpha = 0.58;
    maskContext.filter = `blur(${Math.max(3, Math.round(haloSize * 0.7))}px)`;
    maskContext.fillStyle = '#fff';
    maskContext.beginPath();
    maskContext.ellipse(
      rectangle.productX + (rectangle.productWidth / 2),
      rectangle.productY + rectangle.productHeight,
      Math.max(4, rectangle.productWidth * 0.42),
      Math.max(3, rectangle.productHeight * 0.045),
      0,
      0,
      Math.PI * 2,
    );
    maskContext.fill();
    maskContext.restore();
  }

  maskContext.drawImage(silhouette, 0, 0);
}

function createReferenceComposite(scene) {
  const columns = Math.min(3, Math.max(1, scene.length));
  const rows = Math.ceil(scene.length / columns);
  // Keep a full 511×511 sheet even for one item: the reference is no longer a tiny 1/3 cell.
  const canvas = makeCanvas(MAX_REFERENCE_EDGE, MAX_REFERENCE_EDGE);
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

    const labelX = (index % columns) * cellWidth;
    const labelY = Math.floor(index / columns) * cellHeight;
    context.fillStyle = 'rgba(21, 48, 38, 0.88)';
    context.fillRect(labelX + 8, labelY + 8, 38, 26);
    context.fillStyle = '#ffffff';
    context.font = 'bold 16px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(index + 1), labelX + 27, labelY + 21);
  });
  return canvas;
}

function createSingleProductReference(image) {
  const canvas = makeCanvas(MAX_REFERENCE_EDGE, MAX_REFERENCE_EDGE);
  const context = canvas.getContext('2d');
  // An opaque, quiet background gives the image model a reliable silhouette even
  // when the source PNG has transparent pixels around the product.
  context.fillStyle = REFERENCE_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const maxObjectEdge = canvas.width * REFERENCE_OBJECT_RATIO;
  const ratio = Math.min(
    maxObjectEdge / image.naturalWidth,
    maxObjectEdge / image.naturalHeight,
  );
  const width = image.naturalWidth * ratio;
  const height = image.naturalHeight * ratio;
  context.drawImage(
    image,
    (canvas.width - width) / 2,
    (canvas.height - height) / 2,
    width,
    height,
  );
  return canvas.toDataURL('image/png');
}

/**
 * Build one full-size reference canvas per product for inspiration mode.
 * Candidates are intentionally consumed in order until at most three images
 * load successfully, so a broken URL can be replaced without misaligning the
 * sceneProducts metadata sent alongside the image array.
 */
export async function createProductReferenceImages(products = [], maxImages = 3) {
  const limit = Math.min(3, Math.max(1, Number(maxImages) || 3));
  const usable = [];
  for (const product of products) {
    if (usable.length >= limit) break;
    for (const source of getProductImageSources(product)) {
      try {
        const image = await loadImage(source);
        usable.push({
          product,
          imageDataUrl: createSingleProductReference(image),
        });
        break;
      } catch {
        // Try the product's alternate image URL, then move to the next candidate.
      }
    }
  }
  if (!usable.length) throw new Error('Chưa có sản phẩm nào dùng được để tạo gợi ý.');
  return {
    productImageDataUrls: usable.map(({ imageDataUrl }) => imageDataUrl),
    products: usable.map(({ product }) => product),
  };
}

function getScenePlacements({ placements, productSource, target, product, isFlipped }) {
  if (Array.isArray(placements) && placements.length) return placements.slice(0, 12);
  return productSource && product ? [{ product, target, isFlipped, scale: 1, rotation: 0, zIndex: 1, productSource }] : [];
}

export async function createRoomPreviewImages({ roomSource, placements, productSource, target, product, isFlipped = false, cameraParams = null }) {
  const scenePlacements = getScenePlacements({ placements, productSource, target, product, isFlipped });
  if (!roomSource || !scenePlacements.length) throw new Error('Cần có ảnh phòng và ít nhất một sản phẩm tách nền.');

  const sourceEntries = scenePlacements.map((placement) => ({
    placement,
    sources: [...new Set([
      placement.productSource,
      ...getProductImageSources(placement.product),
    ].filter(Boolean))],
    name: placement.productName || placement.product?.name || 'Sản phẩm chưa đặt tên',
  }));
  const missingNames = sourceEntries.filter(({ sources }) => !sources.length).map(({ name }) => name);
  if (missingNames.length) {
    throw new Error(`Thiếu ảnh tách nền cho: ${missingNames.join(', ')}.`);
  }

  const roomImage = await loadImage(roomSource);
  const productImages = await Promise.all(sourceEntries.map(async ({ sources, name }) => {
    for (const source of sources) {
      try {
        return await loadImage(source);
      } catch {
        // Try the next URL for this product before reporting an unavailable item.
      }
    }
    throw new Error(`Không thể đọc ảnh tách nền của ${name}.`);
  }));
  const { provider: providerSize, composite: compositeSize } = getRoomLayerSizes(
    roomImage.naturalWidth,
    roomImage.naturalHeight,
  );
  const roomCanvas = makeCanvas(providerSize.width, providerSize.height);
  roomCanvas.getContext('2d').drawImage(roomImage, 0, 0, providerSize.width, providerSize.height);
  const guideCanvas = makeCanvas(providerSize.width, providerSize.height);
  guideCanvas.getContext('2d').drawImage(roomCanvas, 0, 0);
  const identityOverlayCanvas = makeCanvas(compositeSize.width, compositeSize.height);

  const providerMaskCanvas = makeCanvas(providerSize.width, providerSize.height);
  const providerMaskContext = providerMaskCanvas.getContext('2d');
  providerMaskContext.fillStyle = '#000';
  providerMaskContext.fillRect(0, 0, providerSize.width, providerSize.height);
  const compositeMaskCanvas = makeCanvas(compositeSize.width, compositeSize.height);
  const compositeMaskContext = compositeMaskCanvas.getContext('2d');
  compositeMaskContext.fillStyle = '#000';
  compositeMaskContext.fillRect(0, 0, compositeSize.width, compositeSize.height);
  const scene = scenePlacements
    .map((placement, index) => ({ placement, image: productImages[index] }))
    .sort((left, right) => (left.placement.zIndex || 0) - (right.placement.zIndex || 0));

  scene.forEach(({ placement, image }) => {
    const placementTarget = placement.target || target;
    const sceneProduct = placement.product || product;
    const productForPlacement = { ...sceneProduct, name: placement.productName || sceneProduct?.name };
    const providerRectangle = getProductRectangle(providerSize, image, placementTarget, sceneProduct, placement.scale);
    drawAiProductGuide(guideCanvas, image, providerRectangle, placement.isFlipped, productForPlacement, placementTarget, cameraParams, placement.rotation);
    drawProductMask(providerMaskContext, providerSize, image, providerRectangle, placement.isFlipped, productForPlacement, placementTarget, cameraParams, placement.rotation);

    const compositeRectangle = getProductRectangle(compositeSize, image, placementTarget, sceneProduct, placement.scale);
    drawAiProductGuide(identityOverlayCanvas, image, compositeRectangle, placement.isFlipped, productForPlacement, placementTarget, cameraParams, placement.rotation, false);
    drawProductMask(compositeMaskContext, compositeSize, image, compositeRectangle, placement.isFlipped, productForPlacement, placementTarget, cameraParams, placement.rotation);
  });

  const referenceCanvas = createReferenceComposite(scene);
  return {
    roomImageDataUrl: roomCanvas.toDataURL('image/jpeg', 0.9),
    guideImageDataUrl: guideCanvas.toDataURL('image/jpeg', 0.9),
    maskImageDataUrl: providerMaskCanvas.toDataURL('image/png'),
    compositeMaskImageDataUrl: compositeMaskCanvas.toDataURL('image/png'),
    identityOverlayDataUrl: identityOverlayCanvas.toDataURL('image/png'),
    productImageDataUrl: referenceCanvas.toDataURL('image/png'),
    referenceSheet: {
      filename: `scene-references-${String(scene.length).padStart(2, '0')}-z-order.png`,
      count: scene.length,
      order: scene.map(({ placement }, index) => ({
        referenceNumber: index + 1,
        productId: placement.productId || placement.product?._id || placement.product?.id || '',
        productName: placement.productName || placement.product?.name || '',
      })),
    },
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

function applyMaskAlpha(cropCanvas, maskImage, width, height) {
  const maskCanvas = makeCanvas(width, height);
  const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
  maskContext.drawImage(maskImage, 0, 0, width, height);
  const pixels = maskContext.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance = Math.round((pixels.data[index] * 0.299)
      + (pixels.data[index + 1] * 0.587)
      + (pixels.data[index + 2] * 0.114));
    pixels.data[index] = 255;
    pixels.data[index + 1] = 255;
    pixels.data[index + 2] = 255;
    pixels.data[index + 3] = luminance;
  }
  maskContext.putImageData(pixels, 0, 0);
  const context = cropCanvas.getContext('2d');
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(maskCanvas, 0, 0);
  context.globalCompositeOperation = 'source-over';
}

export async function compositeRoomPreview({ roomSource, resultSource, maskSource, identityOverlaySource, editRegion }) {
  if (!roomSource || !resultSource || !editRegion) throw new Error('Thiếu ảnh để ghép kết quả AI vào phòng.');
  const [roomImage, resultImage, maskImage, identityOverlay] = await Promise.all([
    loadImage(roomSource),
    loadImage(resultSource),
    maskSource ? loadImage(maskSource) : Promise.resolve(null),
    identityOverlaySource ? loadImage(identityOverlaySource) : Promise.resolve(null),
  ]);
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
  if (maskImage) applyMaskAlpha(cropCanvas, maskImage, width, height);
  else applyFeather(cropCanvas, CROP_PADDING_PX);
  context.drawImage(cropCanvas, x, y, width, height);
  // Keep a little catalogue detail without hiding the lighting and material
  // integration produced by AI. A full-opacity overlay would recreate the
  // pasted cutout that this generation step is meant to remove.
  if (identityOverlay) {
    context.save();
    context.globalAlpha = IDENTITY_DETAIL_ALPHA;
    context.drawImage(identityOverlay, 0, 0, canvas.width, canvas.height);
    context.restore();
  }

  return canvas.toDataURL('image/jpeg', OUTPUT_JPEG_QUALITY);
}
