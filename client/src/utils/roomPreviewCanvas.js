const PROVIDER_MAX_EDGE = 511;

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(source)) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể đọc ảnh sản phẩm.'));
    image.src = source;
  });
}

function fitSize(width, height, maximumEdge) {
  const ratio = Math.min(1, maximumEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export function getProductImageSource(product) {
  return product?.transparentImage || product?.image || product?.sourceImages?.[0] || '';
}

function baseWidth(product) {
  const savedScale = Number(product?.defaultScale);
  if (savedScale > 0) return savedScale;
  const name = `${product?.name || ''} ${product?.categoryName || product?.category || ''}`.toLowerCase();
  if (/tranh|đèn|gương|đồng hồ/.test(name)) return 0.14;
  if (/thảm|sofa|giường/.test(name)) return 0.34;
  if (/ghế|bàn|tủ|kệ/.test(name)) return 0.23;
  return 0.2;
}

function productRectangle(roomSize, productImage, placement) {
  const target = placement.target || { x: 50, y: 76 };
  const width = roomSize.width * baseWidth(placement.product) * (Number(placement.scale) || 1);
  const height = width * (productImage.naturalHeight / productImage.naturalWidth);
  return {
    x: roomSize.width * (target.x / 100),
    y: roomSize.height * (target.y / 100),
    width,
    height,
  };
}

function drawProduct(context, image, rectangle, placement, opacity = 1) {
  context.save();
  context.globalAlpha = opacity;
  context.translate(rectangle.x, rectangle.y);
  context.scale(placement.isFlipped || placement.flip ? -1 : 1, 1);
  context.drawImage(image, -rectangle.width / 2, -rectangle.height, rectangle.width, rectangle.height);
  context.restore();
}

function drawProductMask(context, image, rectangle, placement, canvasSize) {
  const layer = createCanvas(canvasSize.width, canvasSize.height);
  const layerContext = layer.getContext('2d');
  drawProduct(layerContext, image, rectangle, placement);
  layerContext.globalCompositeOperation = 'source-in';
  layerContext.fillStyle = '#ffffff';
  layerContext.fillRect(0, 0, layer.width, layer.height);
  context.drawImage(layer, 0, 0);
}

function createProductReference(productImages, placements) {
  const canvas = createCanvas(511, 511);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const columns = productImages.length === 1 ? 1 : 2;
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / Math.ceil(productImages.length / columns);
  productImages.forEach((image, index) => {
    const ratio = Math.min((cellWidth * 0.82) / image.naturalWidth, (cellHeight * 0.82) / image.naturalHeight);
    const width = image.naturalWidth * ratio;
    const height = image.naturalHeight * ratio;
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * cellWidth + (cellWidth - width) / 2;
    const y = row * cellHeight + (cellHeight - height) / 2;
    context.save();
    if (placements[index]?.isFlipped || placements[index]?.flip) {
      context.translate(x + width, 0);
      context.scale(-1, 1);
      context.drawImage(image, 0, y, width, height);
    } else {
      context.drawImage(image, x, y, width, height);
    }
    context.restore();
  });
  return canvas.toDataURL('image/png');
}

export async function createRoomPreviewImages({ roomSource, placements = [] }) {
  if (!roomSource || !placements.length) {
    throw new Error('Cần có ảnh phòng và một sản phẩm.');
  }

  const roomImage = await loadImage(roomSource);
  const usablePlacements = placements.slice(0, 3);
  const productImages = await Promise.all(usablePlacements.map((placement) => {
    const source = placement.productSource || getProductImageSource(placement.product);
    if (!source) throw new Error(`${placement.productName || 'Sản phẩm'} chưa có ảnh.`);
    return loadImage(source);
  }));

  const originalSize = { width: roomImage.naturalWidth, height: roomImage.naturalHeight };
  const providerSize = fitSize(originalSize.width, originalSize.height, PROVIDER_MAX_EDGE);
  const providerRoom = createCanvas(providerSize.width, providerSize.height);
  const guide = createCanvas(providerSize.width, providerSize.height);
  const providerMask = createCanvas(providerSize.width, providerSize.height);
  const identityOverlay = createCanvas(originalSize.width, originalSize.height);
  const compositeMask = createCanvas(originalSize.width, originalSize.height);

  providerRoom.getContext('2d').drawImage(roomImage, 0, 0, providerSize.width, providerSize.height);
  guide.getContext('2d').drawImage(providerRoom, 0, 0);
  providerMask.getContext('2d').fillRect(0, 0, providerSize.width, providerSize.height);
  compositeMask.getContext('2d').fillRect(0, 0, originalSize.width, originalSize.height);

  usablePlacements.forEach((placement, index) => {
    const providerRectangle = productRectangle(providerSize, productImages[index], placement);
    drawProduct(guide.getContext('2d'), productImages[index], providerRectangle, placement);
    drawProductMask(providerMask.getContext('2d'), productImages[index], providerRectangle, placement, providerSize);

    const originalRectangle = productRectangle(originalSize, productImages[index], placement);
    drawProduct(identityOverlay.getContext('2d'), productImages[index], originalRectangle, placement);
    drawProductMask(compositeMask.getContext('2d'), productImages[index], originalRectangle, placement, originalSize);
  });

  return {
    roomImageDataUrl: providerRoom.toDataURL('image/jpeg', 0.9),
    guideImageDataUrl: guide.toDataURL('image/jpeg', 0.9),
    maskImageDataUrl: providerMask.toDataURL('image/png'),
    compositeMaskImageDataUrl: compositeMask.toDataURL('image/png'),
    identityOverlayDataUrl: identityOverlay.toDataURL('image/png'),
    productImageDataUrl: createProductReference(productImages, usablePlacements),
    editRegion: { x: 0, y: 0, width: 1, height: 1 },
  };
}

function turnBrightnessIntoAlpha(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const brightness = (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]) / 3;
    pixels.data[index + 3] = brightness;
  }
  context.putImageData(pixels, 0, 0);
}

export async function compositeRoomPreview({ roomSource, resultSource, maskSource, identityOverlaySource }) {
  const [room, result, mask, product] = await Promise.all([
    loadImage(roomSource),
    loadImage(resultSource),
    maskSource ? loadImage(maskSource) : null,
    identityOverlaySource ? loadImage(identityOverlaySource) : null,
  ]);
  const canvas = createCanvas(room.naturalWidth, room.naturalHeight);
  const context = canvas.getContext('2d');
  context.drawImage(room, 0, 0, canvas.width, canvas.height);

  const aiLayer = createCanvas(canvas.width, canvas.height);
  const aiContext = aiLayer.getContext('2d');
  aiContext.drawImage(result, 0, 0, aiLayer.width, aiLayer.height);
  if (mask) {
    const maskLayer = createCanvas(canvas.width, canvas.height);
    maskLayer.getContext('2d').drawImage(mask, 0, 0, maskLayer.width, maskLayer.height);
    turnBrightnessIntoAlpha(maskLayer);
    aiContext.globalCompositeOperation = 'destination-in';
    aiContext.drawImage(maskLayer, 0, 0);
  }
  context.drawImage(aiLayer, 0, 0);

  if (product) {
    context.globalAlpha = 0.82;
    context.drawImage(product, 0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
  }
  return canvas.toDataURL('image/jpeg', 0.92);
}
