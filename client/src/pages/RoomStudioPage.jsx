import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import { useProducts } from '../context/ProductContext';
import { createRoomPreview } from '../services/roomPreviewService';
import {
  compositeRoomPreview,
  createRoomPreviewImages,
  getProductImageSource,
} from '../utils/roomPreviewCanvas';
import { normalizeText } from '../utils/normalizeText';

const SESSION_KEY = 'furneehome-room-studio';
const HANDOFF_KEY = 'furneehome-room-design-to-open';
const PRODUCTS_PER_PAGE = 6;
const START_POSITION = { x: 50, y: 76 };

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getProductId(product) {
  return product?._id || product?.id || '';
}

function getCategoryName(product) {
  if (typeof product?.category === 'object') return product.category?.name || 'Khác';
  return product?.category || product?.categoryName || 'Khác';
}

function readSession() {
  try {
    const handoffText = sessionStorage.getItem(HANDOFF_KEY);
    if (handoffText) {
      sessionStorage.removeItem(HANDOFF_KEY);
      const handoff = JSON.parse(handoffText);
      const savedPlacement = handoff.sceneItems?.[0] || handoff.placements?.[0] || {};
      const savedTarget = savedPlacement.target || handoff.target || START_POSITION;
      return {
        ...handoff,
        selectedId: savedPlacement.productId || handoff.selectedId || '',
        position: {
          x: Number(savedTarget.x) <= 1 ? Number(savedTarget.x) * 100 : Number(savedTarget.x),
          y: Number(savedTarget.y) <= 1 ? Number(savedTarget.y) * 100 : Number(savedTarget.y),
        },
        scale: savedPlacement.scale || handoff.scale || 1,
        flipped: Boolean(savedPlacement.flip || savedPlacement.isFlipped || handoff.flip),
        brief: {
          desiredPosition: handoff.designBrief?.desiredPosition || '',
          avoid: handoff.designBrief?.avoid || handoff.designBrief?.keepClear || '',
          notes: handoff.roomRequest || handoff.userPrompt || '',
        },
      };
    }
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {};
  } catch {
    return {};
  }
}

function writeSession(data) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // Ảnh lớn có thể vượt giới hạn của trình duyệt. Luồng hiện tại vẫn tiếp tục.
  }
}

function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc ảnh phòng.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Ảnh phòng không hợp lệ.'));
      image.onload = () => {
        const maximumEdge = 1400;
        const ratio = Math.min(1, maximumEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * ratio));
        const height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.86), width, height });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function createSmallPreview(source) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve('');
    image.onload = () => {
      const ratio = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    image.src = source;
  });
}

function productFacts(product) {
  return {
    name: product?.name || 'Sản phẩm FurneeHome',
    usageType: product?.usageType || 'unknown',
    placementSurface: product?.placementSurface || 'unknown',
    dimensionsCm: product?.dimensionsCm || {},
    aiDescription: product?.aiDescription || 'Giữ đúng hình dáng, màu sắc và cấu tạo của sản phẩm tham chiếu.',
  };
}

export default function RoomStudioPage() {
  const location = useLocation();
  const saved = useRef(readSession()).current;
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const { products } = useProducts();
  const { saveRoomTemplate } = useCollection();

  const [roomImage, setRoomImage] = useState(saved.roomImage || '');
  const [roomName, setRoomName] = useState(saved.roomName || '');
  const [imageSize, setImageSize] = useState(saved.imageSize || { width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState(saved.selectedId || getProductId(location.state?.product));
  const [position, setPosition] = useState(saved.position || START_POSITION);
  const [scale, setScale] = useState(saved.scale || 1);
  const [flipped, setFlipped] = useState(Boolean(saved.flipped));
  const [resultImage, setResultImage] = useState(saved.resultImage || '');
  const [showResult, setShowResult] = useState(Boolean(saved.resultImage));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [brief, setBrief] = useState(saved.brief || { desiredPosition: '', avoid: '', notes: '' });
  const [isGenerating, setGenerating] = useState(false);
  const [message, setMessage] = useState(saved.roomImage
    ? 'Đã mở lại mẫu phòng.'
    : 'Tải ảnh phòng và chọn một sản phẩm để bắt đầu.');

  const selectedProduct = products.find((product) => getProductId(product) === selectedId) || null;

  useEffect(() => {
    writeSession({ roomImage, roomName, imageSize, selectedId, position, scale, flipped, resultImage, brief });
  }, [roomImage, roomName, imageSize, selectedId, position, scale, flipped, resultImage, brief]);

  const categories = useMemo(() => [...new Set(products.map(getCategoryName))].sort(), [products]);
  const filteredProducts = useMemo(() => {
    const keyword = normalizeText(query);
    return products.filter((product) => {
      const matchesText = !keyword || normalizeText(`${product.name} ${getCategoryName(product)}`).includes(keyword);
      const matchesCategory = !category || getCategoryName(product) === category;
      return matchesText && matchesCategory && getProductImageSource(product);
    });
  }, [products, query, category]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const visibleProducts = filteredProducts.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);

  useEffect(() => setPage(1), [query, category]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function pointFromEvent(event) {
    const box = stageRef.current.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - box.left) / box.width) * 100, 2, 98),
      y: clamp(((event.clientY - box.top) / box.height) * 100, 8, 98),
    };
  }

  async function handleRoomUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Chọn ảnh JPG, PNG hoặc WEBP.');
      return;
    }

    try {
      const image = await imageFromFile(file);
      setRoomImage(image.dataUrl);
      setRoomName(file.name);
      setImageSize({ width: image.width, height: image.height });
      setResultImage('');
      setShowResult(false);
      setMessage('Ảnh phòng đã sẵn sàng. Chọn hoặc kéo một sản phẩm vào ảnh.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function selectProduct(product, nextPosition = START_POSITION) {
    setSelectedId(getProductId(product));
    setPosition(nextPosition);
    setScale(1);
    setFlipped(false);
    setResultImage('');
    setShowResult(false);
    setMessage(roomImage
      ? 'Kéo sản phẩm để đổi vị trí và chỉnh kích thước bên dưới.'
      : 'Đã chọn sản phẩm. Tải ảnh phòng để tiếp tục.');
  }

  function handleStagePointerDown(event) {
    if (!roomImage) return;
    const point = pointFromEvent(event);
    if (selectedProduct) setPosition(point);
  }

  function startDragging(event) {
    event.stopPropagation();
    dragRef.current = true;
    stageRef.current?.setPointerCapture?.(event.pointerId);
  }

  function handleStagePointerMove(event) {
    if (!dragRef.current) return;
    setPosition(pointFromEvent(event));
  }

  function stopDragging(event) {
    dragRef.current = null;
    stageRef.current?.releasePointerCapture?.(event.pointerId);
  }

  function handleDrop(event) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/product-id');
    const product = products.find((item) => getProductId(item) === id);
    if (product) selectProduct(product, pointFromEvent(event));
  }

  function removeProduct() {
    setSelectedId('');
    setResultImage('');
    setShowResult(false);
    setMessage('Đã xóa sản phẩm khỏi phòng.');
  }

  async function buildLocalPreview() {
    const productSource = getProductImageSource(selectedProduct);
    const placement = {
      productId: getProductId(selectedProduct),
      productName: selectedProduct.name,
      product: selectedProduct,
      productSource,
      target: position,
      scale,
      isFlipped: flipped,
    };
    const images = await createRoomPreviewImages({ roomSource: roomImage, placements: [placement] });
    return { images, placement };
  }

  async function generatePreview() {
    if (!roomImage) {
      setMessage('Hãy tải ảnh phòng trước.');
      return;
    }
    if (!selectedProduct) {
      setMessage('Hãy chọn một sản phẩm trước.');
      return;
    }

    setGenerating(true);
    setMessage('Đang tạo ảnh...');
    try {
      const { images } = await buildLocalPreview();
      setResultImage(images.guideImageDataUrl);
      setShowResult(true);

      try {
        const facts = productFacts(selectedProduct);
        const aiResult = await createRoomPreview({
          mode: 'placement',
          roomImageDataUrl: images.roomImageDataUrl,
          guideImageDataUrl: images.guideImageDataUrl,
          maskImageDataUrl: images.maskImageDataUrl,
          productImageDataUrl: images.productImageDataUrl,
          productName: selectedProduct.name,
          imageSize,
          placement: { x: position.x / 100, y: position.y / 100, anchor: 'bottom-center' },
          editRegion: images.editRegion,
          userPrompt: brief.notes,
          designBrief: { desiredPosition: brief.desiredPosition, keepClear: brief.avoid },
          sceneProducts: [{ ...facts, target: { x: position.x / 100, y: position.y / 100 } }],
        });
        const finalImage = await compositeRoomPreview({
          roomSource: roomImage,
          resultSource: aiResult.imageDataUrl,
          maskSource: images.compositeMaskImageDataUrl,
          identityOverlaySource: images.identityOverlayDataUrl,
          editRegion: aiResult.editRegion || images.editRegion,
        });
        setResultImage(finalImage);
        setMessage('Ảnh đã tạo xong.');
      } catch {
        setMessage('Đã tạo bản xem trước. AI đang bận nên bạn vẫn có thể lưu hoặc thử lại.');
      }
    } catch (error) {
      setMessage(error.message || 'Không thể tạo ảnh.');
    } finally {
      setGenerating(false);
    }
  }

  async function saveDesign() {
    if (!roomImage || !selectedProduct) {
      setMessage('Cần có ảnh phòng và sản phẩm trước khi lưu.');
      return;
    }

    try {
      let preview = resultImage;
      if (!preview) preview = (await buildLocalPreview()).images.guideImageDataUrl;
      const smallPreview = await createSmallPreview(preview);
      await saveRoomTemplate({
        name: `Thiết kế ${new Date().toLocaleDateString('vi-VN')}`,
        roomImage,
        resultImage: preview,
        previewImage: smallPreview,
        productId: getProductId(selectedProduct),
        productName: selectedProduct.name,
        productImage: getProductImageSource(selectedProduct),
        target: { x: position.x / 100, y: position.y / 100 },
        scale,
        flip: flipped,
        userPrompt: brief.notes,
        designBrief: { desiredPosition: brief.desiredPosition, avoid: brief.avoid },
        placements: [{
          productId: getProductId(selectedProduct),
          productName: selectedProduct.name,
          product: selectedProduct,
          target: { x: position.x / 100, y: position.y / 100 },
          scale,
          flip: flipped,
        }],
      });
      setMessage('Đã lưu vào bộ sưu tập.');
    } catch {
      setMessage('Không thể lưu thiết kế. Hãy thử lại.');
    }
  }

  function resetStudio() {
    sessionStorage.removeItem(SESSION_KEY);
    setRoomImage('');
    setRoomName('');
    setImageSize({ width: 0, height: 0 });
    setSelectedId('');
    setPosition(START_POSITION);
    setScale(1);
    setFlipped(false);
    setResultImage('');
    setShowResult(false);
    setBrief({ desiredPosition: '', avoid: '', notes: '' });
    setMessage('Tải ảnh phòng và chọn một sản phẩm để bắt đầu.');
  }

  const previewWidth = clamp((Number(selectedProduct?.defaultScale) || 0.22) * 100 * scale, 9, 58);

  return (
    <main className="simple-studio page-shell">
      <header className="simple-studio__header">
        <div>
          <p className="eyebrow">PHÒNG THỬ</p>
          <h1>Thử nội thất trong phòng của bạn</h1>
          <p>Tải ảnh, chọn sản phẩm, đặt vào phòng rồi tạo ảnh.</p>
        </div>
        <button type="button" className="button button--quiet" onClick={resetStudio}>Làm lại</button>
      </header>

      <div className="simple-studio__layout">
        <section className="simple-studio__controls" aria-label="Các bước tạo ảnh">
          <div className="simple-step">
            <h2><span>1</span> Ảnh phòng</h2>
            <label className="simple-upload">
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleRoomUpload} />
              <strong>{roomImage ? 'Đổi ảnh phòng' : 'Chọn ảnh phòng'}</strong>
              {roomName && <small>{roomName}</small>}
            </label>
          </div>

          <div className="simple-step">
            <h2><span>2</span> Sản phẩm</h2>
            <div className="simple-product-filters">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm sản phẩm" />
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">Tất cả</option>
                {categories.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div className="simple-product-list">
              {visibleProducts.map((product) => {
                const id = getProductId(product);
                return (
                  <button
                    type="button"
                    key={id}
                    className={selectedId === id ? 'is-selected' : ''}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/product-id', id)}
                    onClick={() => selectProduct(product)}
                  >
                    <ProductArtwork product={product} />
                    <span>{product.name}</span>
                  </button>
                );
              })}
            </div>
            {filteredProducts.length === 0 && <p className="simple-empty">Không tìm thấy sản phẩm.</p>}
            {pageCount > 1 && (
              <div className="simple-pagination">
                <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Trước</button>
                <span>{page}/{pageCount}</span>
                <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Sau</button>
              </div>
            )}
          </div>

          {selectedProduct && (
            <div className="simple-step">
              <h2><span>3</span> Điều chỉnh</h2>
              <p className="simple-selected-name">{selectedProduct.name}</p>
              <label>Kích thước <input type="range" min="0.5" max="1.8" step="0.05" value={scale} onChange={(event) => setScale(Number(event.target.value))} /></label>
              <button type="button" className="button button--quiet" onClick={() => setFlipped((value) => !value)}>Lật sản phẩm</button>
              <label>Vị trí bạn muốn<input value={brief.desiredPosition} onChange={(event) => setBrief({ ...brief, desiredPosition: event.target.value })} placeholder="Ví dụ: sát tường bên trái" /></label>
              <label>Bạn không muốn<input value={brief.avoid} onChange={(event) => setBrief({ ...brief, avoid: event.target.value })} placeholder="Ví dụ: không che cửa" /></label>
              <label>Ghi chú khác<textarea value={brief.notes} onChange={(event) => setBrief({ ...brief, notes: event.target.value })} placeholder="Ví dụ: ánh sáng tự nhiên" /></label>
            </div>
          )}
        </section>

        <section className="simple-studio__workspace">
          <div
            ref={stageRef}
            className="simple-stage"
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            {roomImage ? (
              <>
                <img className="simple-stage__room" src={showResult && resultImage ? resultImage : roomImage} alt="Phòng đang thiết kế" draggable="false" />
                {!showResult && selectedProduct && (
                  <div
                    className="simple-stage__product"
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      width: `${previewWidth}%`,
                      transform: `translate(-50%, -100%) scaleX(${flipped ? -1 : 1})`,
                    }}
                    onPointerDown={startDragging}
                  >
                    <ProductArtwork product={{ ...selectedProduct, image: getProductImageSource(selectedProduct) }} />
                    <button type="button" aria-label="Xóa sản phẩm" onPointerDown={(event) => event.stopPropagation()} onClick={removeProduct}>×</button>
                  </div>
                )}
              </>
            ) : (
              <label className="simple-stage__empty">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleRoomUpload} />
                <strong>Chọn ảnh phòng</strong>
                <span>JPG, PNG hoặc WEBP</span>
              </label>
            )}

            {roomImage && resultImage && (
              <div className="simple-compare">
                <button type="button" className={!showResult ? 'is-active' : ''} onClick={() => setShowResult(false)}>Ảnh gốc</button>
                <button type="button" className={showResult ? 'is-active' : ''} onClick={() => setShowResult(true)}>Kết quả</button>
              </div>
            )}
            {isGenerating && <div className="simple-stage__loading"><span />Đang tạo ảnh...</div>}
          </div>

          <p className="simple-studio__message" role="status">{message}</p>
          <div className="simple-studio__actions">
            <button type="button" className="button button--primary" disabled={isGenerating || !roomImage || !selectedProduct} onClick={generatePreview}>
              {isGenerating ? 'Đang tạo...' : 'Tạo ảnh'}
            </button>
            <button type="button" className="button button--quiet" disabled={!roomImage || !selectedProduct} onClick={saveDesign}>Lưu bộ sưu tập</button>
          </div>
        </section>
      </div>
    </main>
  );
}
