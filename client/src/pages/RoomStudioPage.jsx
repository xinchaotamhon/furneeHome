import { useEffect, useRef, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import { useProducts } from '../context/ProductContext';

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
  const [requestReady, setRequestReady] = useState(false);
  const stageRef = useRef(null);
  const selectedProduct = products.find((product) => product._id === selectedId) || products[0];

  useEffect(() => () => {
    if (roomImage.startsWith('blob:')) URL.revokeObjectURL(roomImage);
  }, [roomImage]);

  const uploadRoom = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (roomImage.startsWith('blob:')) URL.revokeObjectURL(roomImage);
    setRoomImage(URL.createObjectURL(file));
    setRoomFileName(file.name);
    setImageSize({ width: 0, height: 0 });
    setTarget(initialTarget);
    setHasTarget(false);
    setRequestReady(false);
    setMessage('Ảnh đã được thêm. Hãy chấm vào nơi bạn muốn đặt sản phẩm.');
  };

  const updateTargetFromPointer = (event) => {
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setTarget({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99),
    });
    setRequestReady(false);
  };

  const placeTarget = (event) => {
    if (!roomImage) return;
    updateTargetFromPointer(event);
    setHasTarget(true);
    setMessage('Đã chọn vị trí. Bạn có thể kéo ghim sang bất kỳ chỗ nào khác.');
  };

  const moveTarget = (event) => {
    if (!dragging) return;
    updateTargetFromPointer(event);
  };

  const chooseProduct = (id) => {
    setSelectedId(id);
    localStorage.setItem('furneehome-room-product', id);
    setRequestReady(false);
  };

  const prepareAiRequest = () => {
    if (!roomImage) {
      setMessage('Bạn cần tải ảnh căn phòng trước.');
      return;
    }
    if (!hasTarget) {
      setMessage('Hãy chấm một vị trí trên ảnh để AI biết cần đặt sản phẩm ở đâu.');
      return;
    }
    setRequestReady(true);
    setMessage('Ảnh, sản phẩm và tọa độ ghim đã sẵn sàng để gửi tới backend.');
  };

  const saveTemplate = () => {
    if (!roomImage || !hasTarget) {
      setMessage('Hãy tải ảnh và chọn vị trí trước khi lưu mẫu.');
      return;
    }
    saveRoomTemplate({
      name: `Mẫu phòng với ${selectedProduct.name}`,
      productId: selectedProduct._id,
      productName: selectedProduct.name,
      roomFileName,
      target,
      imageSize,
    });
    setMessage('Đã lưu lựa chọn vào Bộ sưu tập.');
  };

  const normalizedX = Number((target.x / 100).toFixed(4));
  const normalizedY = Number((target.y / 100).toFixed(4));

  return (
    <main className="container page room-studio-page">
      <div className="page-heading split-heading">
        <div><p className="eyebrow">ẢNH PHÒNG THẬT + GHIM VỊ TRÍ</p><h1>Phòng thử</h1><p>Chọn sản phẩm, chấm vào vị trí bạn muốn đặt và kéo ghim nếu cần thay đổi.</p></div>
        <div className="privacy-note"><strong>Ảnh chỉ dùng trong phiên thử</strong><span>Bản hiện tại không tải ảnh lên máy chủ.</span></div>
      </div>

      <ol className="studio-steps">
        <li><span>1</span><div><strong>Tải ảnh phòng</strong><small>Chọn ảnh rõ khu vực bạn muốn đặt đồ.</small></div></li>
        <li><span>2</span><div><strong>Chấm một vị trí</strong><small>Ghim là nơi đáy sản phẩm sẽ tiếp xúc.</small></div></li>
        <li><span>3</span><div><strong>Tạo bản thử AI</strong><small>AI nhận ảnh, sản phẩm và tọa độ ghim.</small></div></li>
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
            <p>Bấm vào ảnh để đặt ghim. Sau đó giữ và kéo ghim đến vị trí khác nếu muốn.</p>
            {hasTarget ? <div className="target-summary"><span className="mini-pin" /><div><strong>Đã chọn vị trí</strong><small>Ngang {target.x.toFixed(1)}% · Dọc {target.y.toFixed(1)}%</small></div></div> : <div className="target-empty">Chưa chọn vị trí trên ảnh</div>}
            {hasTarget && <button className="text-button" type="button" onClick={() => { setHasTarget(false); setRequestReady(false); setMessage('Hãy chấm một vị trí mới trên ảnh.'); }}>Chọn lại từ đầu</button>}
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
            {roomImage && hasTarget && <button
              className={`target-marker ${dragging ? 'is-dragging' : ''}`}
              type="button"
              aria-label="Vị trí đặt sản phẩm, kéo để thay đổi"
              style={{ left: `${target.x}%`, top: `${target.y}%` }}
              onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
              onPointerMove={moveTarget}
              onPointerUp={(event) => { event.stopPropagation(); setDragging(false); }}
            ><span /><b>Đặt {selectedProduct.name} tại đây</b></button>}
            {requestReady && <div className="edit-mask-label">Ghim đã sẵn sàng cho AI</div>}
          </div>

          <div className="studio-message" aria-live="polite">{message || 'Tải ảnh lên, chọn sản phẩm rồi chấm đúng nơi bạn muốn đặt đồ.'}</div>

          <div className="product-picker">
            <div className="section-title"><div><span className="step-label">CHỌN SẢN PHẨM</span><h2>{selectedProduct?.name}</h2></div></div>
            <div className="product-picker-list">
              {products.map((product) => (
                <button className={selectedProduct?._id === product._id ? 'active' : ''} type="button" key={product._id} onClick={() => chooseProduct(product._id)}>
                  <ProductArtwork product={product} /><span>{product.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="studio-actions">
            <button className="button button-secondary" type="button" onClick={saveTemplate}>Lưu vào Bộ sưu tập</button>
            <button className="button" type="button" onClick={prepareAiRequest}>Chuẩn bị bản thử AI</button>
          </div>
          {requestReady && <div className="api-ready-card">
            <div><span className="status-dot" /><strong>Dữ liệu vị trí đã sẵn sàng</strong></div>
            <p>Backend sẽ gửi ảnh gốc, ảnh sản phẩm và tọa độ chuẩn hóa. Ghim biểu thị điểm tiếp xúc đáy sản phẩm; backend sẽ tạo vùng chỉnh sửa quanh điểm này.</p>
            <dl><div><dt>Tọa độ X</dt><dd>{normalizedX}</dd></div><div><dt>Tọa độ Y</dt><dd>{normalizedY}</dd></div><div><dt>Gốc tọa độ</dt><dd>Góc trên bên trái</dd></div></dl>
            {imageSize.width > 0 && <small className="muted">Trên ảnh gốc: khoảng {Math.round(normalizedX * imageSize.width)} × {Math.round(normalizedY * imageSize.height)} px.</small>}
          </div>}
        </section>
      </div>
    </main>
  );
}
