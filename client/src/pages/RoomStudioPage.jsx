import { useEffect, useRef, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import { useProducts } from '../context/ProductContext';
import { createRoomPreview } from '../services/roomPreviewService';
import { compositeRoomPreview, createRoomPreviewImages, getProductImageSource, getProductPreviewStyle } from '../utils/roomPreviewCanvas';

const initialTarget = { x: 50, y: 72 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function RoomStudioPage() {
  const { products } = useProducts();
  const { saveRoomTemplate } = useCollection();
  const preferredId = localStorage.getItem('furneehome-room-product');
  const [selectedId, setSelectedId] = useState(preferredId || products[0]?._id);
  const [roomImage, setRoomImage] = useState('');
  const [roomFileName, setRoomFileName] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [target, setTarget] = useState(initialTarget);
  const [hasTarget, setHasTarget] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [resultImage, setResultImage] = useState('');
  const [elapsedMs, setElapsedMs] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const stageRef = useRef(null);
  const selectedProduct = products.find((product) => product._id === selectedId) || products[0];
  const productImageSource = getProductImageSource(selectedProduct);

  useEffect(() => () => {
    if (roomImage.startsWith('blob:')) URL.revokeObjectURL(roomImage);
  }, [roomImage]);

  const clearGeneratedResult = () => {
    setResultImage('');
    setElapsedMs(null);
  };

  const uploadRoom = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (roomImage.startsWith('blob:')) URL.revokeObjectURL(roomImage);
    setRoomImage(URL.createObjectURL(file));
    setRoomFileName(file.name);
    setImageSize({ width: 0, height: 0 });
    setTarget(initialTarget);
    setHasTarget(false);
    clearGeneratedResult();
    setMessage('Ảnh đã được thêm. Hãy chấm vào nơi bạn muốn đặt sản phẩm.');
  };

  const updateTargetFromPointer = (event) => {
    if (!stageRef.current || isGenerating) return;
    const rect = stageRef.current.getBoundingClientRect();
    setTarget({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99),
    });
    clearGeneratedResult();
  };

  const placeTarget = (event) => {
    if (!roomImage || isGenerating) return;
    updateTargetFromPointer(event);
    setHasTarget(true);
    setMessage('Đã chọn vị trí. Bạn có thể kéo ghim sang bất kỳ chỗ nào khác.');
  };

  const moveTarget = (event) => {
    if (!dragging || isGenerating) return;
    updateTargetFromPointer(event);
  };

  const chooseProduct = (id) => {
    setSelectedId(id);
    localStorage.setItem('furneehome-room-product', id);
    clearGeneratedResult();
    setMessage('Đã chọn sản phẩm. Hãy kiểm tra vị trí ghim trước khi tạo ảnh.');
  };

  const normalizedPlacement = {
    x: Number((target.x / 100).toFixed(4)),
    y: Number((target.y / 100).toFixed(4)),
    anchor: 'bottom-center',
  };

  const previewRoom = async () => {
    if (!roomImage) {
      setMessage('Bạn cần tải ảnh căn phòng trước.');
      return;
    }
    if (!hasTarget) {
      setMessage('Hãy chấm một vị trí trên ảnh để AI biết cần đặt sản phẩm ở đâu.');
      return;
    }
    if (!selectedProduct || !productImageSource) {
      setMessage('Sản phẩm này chưa có ảnh tách nền để tạo bản chân thực.');
      return;
    }

    setIsGenerating(true);
    clearGeneratedResult();
    setMessage('Đang xem thử sản phẩm trong phòng…');

    try {
      const guideImages = await createRoomPreviewImages({
        roomSource: roomImage,
        productSource: productImageSource,
        target,
        product: selectedProduct,
      });
      const result = await createRoomPreview({
        ...guideImages,
        productName: selectedProduct.name,
        placement: normalizedPlacement,
      });

      const compositeImage = await compositeRoomPreview({
        roomSource: roomImage,
        resultSource: result.imageDataUrl,
        editRegion: guideImages.editRegion,
      });
      if (!compositeImage.startsWith('data:image/')) {
        throw new Error('Ảnh AI không hợp lệ.');
      }
      setResultImage(compositeImage);
      setElapsedMs(result.elapsedMs);
      saveRoomTemplate({
        name: `Bản chân thực với ${selectedProduct.name}`,
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        target: normalizedPlacement,
        imageSize,
        resultImage: compositeImage,
        model: result.model,
        elapsedMs: result.elapsedMs,
      });
      setMessage('Đã xem thử và tự động lưu vào Bộ sưu tập.');
    } catch (error) {
      clearGeneratedResult();
      setMessage('Ảnh AI chưa đạt hoặc không tạo được. Vẫn giữ bản xem sản phẩm đúng vị trí; bạn có thể thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="container page room-studio-page">
      <div className="page-heading split-heading">
        <div><p className="eyebrow">ẢNH PHÒNG THẬT + VỊ TRÍ SẢN PHẨM</p><h1>Phòng thử</h1><p>Chọn sản phẩm, chạm vào nơi muốn đặt và xem thử trong phòng.</p></div>
        <div className="privacy-note"><strong>Ảnh chỉ dùng trong phiên thử</strong><span>Token Cloudflare chỉ được giữ ở backend.</span></div>
      </div>

      <ol className="studio-steps">
        <li><span>1</span><div><strong>Tải ảnh phòng</strong><small>Chọn ảnh rõ khu vực bạn muốn đặt đồ.</small></div></li>
        <li><span>2</span><div><strong>Chấm một vị trí</strong><small>Ghim là nơi đáy sản phẩm sẽ tiếp xúc.</small></div></li>
        <li><span>3</span><div><strong>Xem thử trong phòng</strong><small>AI chỉ chỉnh vùng nhỏ quanh vị trí đã chọn.</small></div></li>
      </ol>

      <div className="studio-layout studio-layout-simple">
        <aside className="studio-panel">
          <section>
            <span className="step-label">BƯỚC 1</span>
            <h2>Ảnh căn phòng</h2>
            <label className="upload-box">
              <span>＋</span><strong>{roomFileName || 'Chọn ảnh phòng'}</strong><small>JPG hoặc PNG có sẵn trong máy</small>
              <input type="file" accept="image/png,image/jpeg" capture="environment" onChange={uploadRoom} />
            </label>
          </section>
          <section className="target-help">
            <span className="step-label">BƯỚC 2</span>
            <h2>Vị trí đặt đồ</h2>
            <p>Chạm vào ảnh để đặt ghim. Ghim là vị trí đáy sản phẩm tiếp xúc với sàn hoặc bề mặt.</p>
            {hasTarget ? <div className="target-summary"><span className="mini-pin" /><div><strong>Đã chọn vị trí</strong><small>Ngang {target.x.toFixed(1)}% · Dọc {target.y.toFixed(1)}%</small></div></div> : <div className="target-empty">Chưa chọn vị trí trên ảnh</div>}
            {hasTarget && <button className="text-button" type="button" onClick={() => { setHasTarget(false); clearGeneratedResult(); setMessage('Hãy chấm một vị trí mới trên ảnh.'); }}>Chọn lại từ đầu</button>}
          </section>
        </aside>

        <section className="studio-workspace">
          <div
            className={`room-stage ${roomImage ? 'has-image' : ''}`}
            ref={stageRef}
            onPointerDown={placeTarget}
            onPointerMove={moveTarget}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            {!roomImage && <div className="room-placeholder"><span>＋</span><h2>Tải ảnh căn phòng</h2><p>Sau khi tải ảnh, bạn chỉ cần bấm vào nơi muốn đặt sản phẩm.</p><label className="button">Chọn ảnh phòng<input type="file" accept="image/png,image/jpeg" capture="environment" onChange={uploadRoom} /></label></div>}
            {roomImage && <img className="room-photo" src={roomImage} alt="Căn phòng do người dùng tải lên" draggable="false" onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />}
            {roomImage && hasTarget && productImageSource && <img className="room-product-preview" src={productImageSource} alt="Sản phẩm đang được đặt thử" style={getProductPreviewStyle(selectedProduct, target)} draggable="false" />}
            {roomImage && hasTarget && <button
              className={`target-marker ${dragging ? 'is-dragging' : ''}`}
              type="button"
              aria-label="Vị trí đặt sản phẩm, kéo để thay đổi"
              style={{ left: `${target.x}%`, top: `${target.y}%` }}
              onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
              onPointerMove={moveTarget}
              onPointerUp={(event) => { event.stopPropagation(); setDragging(false); }}
              disabled={isGenerating}
            ><span /><b>Đặt {selectedProduct?.name || 'sản phẩm'} tại đây</b></button>}
          </div>

          <div className="studio-message" aria-live="polite">{message || 'Tải ảnh lên, chọn sản phẩm rồi chấm đúng nơi bạn muốn đặt đồ.'}</div>

          <div className="product-picker">
            <div className="section-title"><div><span className="step-label">CHỌN SẢN PHẨM</span><h2>{selectedProduct?.name || 'Chưa có sản phẩm'}</h2></div></div>
            <div className="product-picker-list">
              {products.map((product) => (
                <button className={selectedProduct?._id === product._id ? 'active' : ''} type="button" key={product._id} onClick={() => chooseProduct(product._id)}>
                  <ProductArtwork product={product} /><span>{product.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="studio-actions">
            <button className="button" type="button" onClick={previewRoom} disabled={isGenerating}>{isGenerating ? 'Đang xem thử…' : 'Xem thử trong phòng'}</button>
          </div>

          {resultImage && <div className="ai-result-card">
            <span className="step-label">KẾT QUẢ AI</span>
            <h2>Bản chân thực</h2>
            <img src={resultImage} alt={`Bản chân thực với ${selectedProduct?.name || 'sản phẩm'}`} />
            {Number.isFinite(elapsedMs) && <small className="muted">Thời gian xử lý: {elapsedMs} ms</small>}
          </div>}

          {hasTarget && <div className="api-ready-card">
            <div><span className="status-dot" /><strong>Vị trí đã sẵn sàng</strong></div>
            <p>Ảnh hướng dẫn chỉ là một crop nhỏ quanh sản phẩm. Kết quả crop sẽ được ghép lại vào ảnh phòng gốc để giữ nguyên các vùng khác.</p>
            <dl><div><dt>Tọa độ X</dt><dd>{normalizedPlacement.x}</dd></div><div><dt>Tọa độ Y</dt><dd>{normalizedPlacement.y}</dd></div><div><dt>Anchor</dt><dd>bottom-center</dd></div></dl>
            {imageSize.width > 0 && <small className="muted">Trên ảnh gốc: khoảng {Math.round(normalizedPlacement.x * imageSize.width)} × {Math.round(normalizedPlacement.y * imageSize.height)} px.</small>}
          </div>}
        </section>
      </div>
    </main>
  );
}
