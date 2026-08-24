import { useEffect, useRef, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import { useProducts } from '../context/ProductContext';
import { createRoomPreview } from '../services/roomPreviewService';
import { compositeRoomPreview, createRoomPreviewImages, getProductImageSource, getProductPreviewStyle } from '../utils/roomPreviewCanvas';

const CORNER_COLORS = ['#ef4444', '#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'];
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
  
  // Quản lý các điểm góc do người dùng tự chấm trên ảnh phòng của họ
  const [markedCorners, setMarkedCorners] = useState([]);
  const [isMarkingMode, setIsMarkingMode] = useState(true);

  // Vị trí đặt sản phẩm
  const [target, setTarget] = useState(initialTarget);
  const [hasTarget, setHasTarget] = useState(false);
  const [selectedCornerId, setSelectedCornerId] = useState(null);
  const [dragging, setDragging] = useState(false);

  // Trạng thái AI preview
  const [message, setMessage] = useState('');
  const [resultImage, setResultImage] = useState('');
  const [elapsedMs, setElapsedMs] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
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
    setMarkedCorners([]);
    setIsMarkingMode(true);
    setTarget(initialTarget);
    setHasTarget(false);
    setSelectedCornerId(null);
    clearGeneratedResult();
    setMessage('Bước 1: Hãy bấm chuột vào các góc chân tường/mép sàn trên ảnh để đánh dấu các góc phòng của bạn.');
  };

  // Người dùng click lên Stage
  const handleStageClick = (event) => {
    if (!roomImage || isGenerating || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99);
    const roundedX = Number(x.toFixed(1));
    const roundedY = Number(y.toFixed(1));

    // Chế độ 1: Người dùng đang chấm các góc phòng
    if (isMarkingMode) {
      const newCornerIndex = markedCorners.length;
      const newCorner = {
        id: `corner-${Date.now()}-${newCornerIndex}`,
        index: newCornerIndex + 1,
        x: roundedX,
        y: roundedY,
        color: CORNER_COLORS[newCornerIndex % CORNER_COLORS.length],
        label: `Góc ${newCornerIndex + 1}`,
      };
      const nextCorners = [...markedCorners, newCorner];
      setMarkedCorners(nextCorners);
      setMessage(`Đã thêm ${newCorner.label} (${roundedX}%, ${roundedY}%). Bạn có thể chấm thêm góc tiếp theo hoặc bấm "Xong chấm góc".`);
      return;
    }

    // Chế độ 2: Đặt sản phẩm vào vị trí bất kỳ
    setTarget({ x: roundedX, y: roundedY });
    setHasTarget(true);
    setSelectedCornerId(null);
    clearGeneratedResult();
    setMessage(`Đã đặt ${selectedProduct?.name || 'sản phẩm'} tại vị trí (${roundedX}%, ${roundedY}%).`);
  };

  // Người dùng chọn nhanh một góc đã chấm để đặt đồ
  const handleSelectCornerToPlace = (corner, event) => {
    if (event) event.stopPropagation();
    if (isGenerating) return;
    setTarget({ x: corner.x, y: corner.y });
    setHasTarget(true);
    setSelectedCornerId(corner.id);
    setIsMarkingMode(false); // Chuyển sang xem sản phẩm tại góc đó
    clearGeneratedResult();
    setMessage(`Đã đặt ${selectedProduct?.name || 'sản phẩm'} tại ${corner.label}.`);
  };

  // Xóa góc gần nhất
  const handleRemoveLastCorner = () => {
    if (markedCorners.length === 0) return;
    const next = markedCorners.slice(0, -1);
    setMarkedCorners(next);
    setMessage(next.length > 0 ? `Đã xóa góc gần nhất. Còn lại ${next.length} góc.` : 'Đã xóa hết góc. Hãy bấm vào ảnh để chấm lại.');
  };

  // Xóa toàn bộ góc
  const handleClearAllCorners = () => {
    setMarkedCorners([]);
    setSelectedCornerId(null);
    setHasTarget(false);
    setIsMarkingMode(true);
    clearGeneratedResult();
    setMessage('Đã xóa tất cả góc. Bạn có thể chấm lại từ đầu trên ảnh phòng.');
  };

  const handlePointerMoveMarker = (event) => {
    if (!dragging || isGenerating || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99);
    setTarget({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) });
    setSelectedCornerId(null);
    clearGeneratedResult();
  };

  const chooseProduct = (id) => {
    setSelectedId(id);
    localStorage.setItem('furneehome-room-product', id);
    clearGeneratedResult();
    setMessage(`Đã chọn: ${products.find((p) => p._id === id)?.name || 'sản phẩm'}. Hãy bấm vào một góc đã chấm để đặt đồ.`);
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
      setMessage('Hãy bấm vào một góc đã chấm (hoặc chấm vị trí trên sàn) để đặt sản phẩm trước khi xem thử.');
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
        isFlipped,
      });
      const result = await createRoomPreview({
        ...guideImages,
        productName: `${selectedProduct.name}${isFlipped ? ' (mirrored horizontally)' : ''}`,
        placement: normalizedPlacement,
      });

      const finalImage = result.imageDataUrl && result.imageDataUrl.startsWith('data:image/')
        ? result.imageDataUrl
        : await compositeRoomPreview({
            roomSource: roomImage,
            resultSource: result.imageDataUrl,
            editRegion: guideImages.editRegion,
          });

      if (!finalImage.startsWith('data:image/')) {
        throw new Error('Ảnh AI không hợp lệ.');
      }
      setResultImage(finalImage);
      setElapsedMs(result.elapsedMs);
      saveRoomTemplate({
        name: `Bản chân thực với ${selectedProduct.name}${isFlipped ? ' (Lật gương)' : ''}`,
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        target: normalizedPlacement,
        resultImage: finalImage,
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
        <div>
          <p className="eyebrow">PHỐI CẢNH 3 BƯỚC ĐƠN GIẢN</p>
          <h1>Phòng thử</h1>
          <p>1. Chấm các góc phòng của bạn → 2. Chọn sản phẩm & vị trí đặt → 3. Bấm xem thử.</p>
        </div>
        <div className="privacy-note">
          <strong>Ảnh chỉ dùng trong phiên thử</strong>
          <span>Token Cloudflare chỉ được giữ ở backend.</span>
        </div>
      </div>

      <ol className="studio-steps">
        <li className={isMarkingMode ? 'active-step' : ''}>
          <span>1</span>
          <div>
            <strong>Chấm các góc phòng</strong>
            <small>{markedCorners.length > 0 ? `Đã chấm ${markedCorners.length} góc` : 'Bấm vào các góc chân tường trên ảnh'}</small>
          </div>
        </li>
        <li className={!isMarkingMode && !resultImage ? 'active-step' : ''}>
          <span>2</span>
          <div>
            <strong>Chọn đồ & Bấm góc muốn kê</strong>
            <small>{hasTarget ? `Đã đặt tại (${target.x.toFixed(0)}%, ${target.y.toFixed(0)}%)` : 'Bấm vào một góc đã chấm'}</small>
          </div>
        </li>
        <li className={resultImage ? 'active-step' : ''}>
          <span>3</span>
          <div>
            <strong>Xem thử trong phòng</strong>
            <small>Furnee đưa sản phẩm thật vào phòng của bạn</small>
          </div>
        </li>
      </ol>

      <div className="studio-layout studio-layout-simple">
        <aside className="studio-panel">
          {/* BƯỚC 1: TẢI ẢNH VÀ CHẤM CÁC GÓC */}
          <section>
            <span className="step-label">BƯỚC 1</span>
            <h2>Ảnh phòng & Các góc phòng</h2>
            <label className="upload-box">
              <span>＋</span>
              <strong>{roomFileName || 'Tải ảnh căn phòng'}</strong>
              <small>JPG hoặc PNG có sẵn trong máy</small>
              <input type="file" accept="image/png,image/jpeg" capture="environment" onChange={uploadRoom} />
            </label>

            {roomImage && (
              <div className="corners-panel">
                <div className="corners-header">
                  <strong>Các góc đã chấm ({markedCorners.length}):</strong>
                  <button
                    type="button"
                    className={`button button-small ${isMarkingMode ? 'button-active' : 'button-secondary'}`}
                    onClick={() => setIsMarkingMode(!isMarkingMode)}
                  >
                    {isMarkingMode ? '✓ Xong chấm góc' : '＋ Chấm thêm góc'}
                  </button>
                </div>

                {markedCorners.length > 0 ? (
                  <div className="corner-chips-list">
                    {markedCorners.map((corner) => (
                      <button
                        key={corner.id}
                        type="button"
                        className={`corner-chip ${selectedCornerId === corner.id ? 'active' : ''}`}
                        onClick={(e) => handleSelectCornerToPlace(corner, e)}
                        title={`Đặt sản phẩm vào ${corner.label}`}
                      >
                        <span className="corner-chip-dot" style={{ backgroundColor: corner.color }} />
                        <span>{corner.label}</span>
                        {selectedCornerId === corner.id && <span className="chip-badge">Đang chọn</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="hint-text">👉 Hãy bấm vào ảnh để chấm các điểm góc chân tường hoặc mép sàn.</p>
                )}

                {markedCorners.length > 0 && (
                  <div className="corner-actions">
                    <button type="button" className="text-button" onClick={handleRemoveLastCorner}>↺ Xóa góc vừa chấm</button>
                    <button type="button" className="text-button text-danger" onClick={handleClearAllCorners}>🗑 Xóa tất cả</button>
                  </div>
                )}
              </div>
            )}
          </section>
          
          {/* BƯỚC 2: VỊ TRÍ ĐẶT ĐỒ */}
          <section className="target-help">
            <span className="step-label">BƯỚC 2</span>
            <h2>Vị trí đặt đồ</h2>
            <p>
              {markedCorners.length > 0
                ? 'Bấm vào bất kỳ chấm góc nào trên ảnh (hoặc danh sách góc ở trên) để đặt đồ vào đó.'
                : 'Hãy hoàn thành chấm các góc ở Bước 1 hoặc chạm trực tiếp vào nơi muốn kê sản phẩm.'}
            </p>

            {hasTarget ? (
              <div className="target-summary">
                <span className="mini-pin" />
                <div>
                  <strong>{selectedCornerId ? `Đã chọn ${markedCorners.find((c) => c.id === selectedCornerId)?.label || 'góc phòng'}` : 'Đã chọn vị trí'}</strong>
                  <small>Ngang {target.x.toFixed(1)}% · Dọc {target.y.toFixed(1)}%</small>
                </div>
              </div>
            ) : (
              <div className="target-empty">Chưa chọn góc đặt đồ</div>
            )}
            
            {hasTarget && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setHasTarget(false);
                  setSelectedCornerId(null);
                  clearGeneratedResult();
                  setMessage('Hãy chọn một góc đã chấm hoặc chạm vào ảnh.');
                }}
              >
                Chọn lại vị trí
              </button>
            )}
          </section>
        </aside>

        {/* WORKSPACE & STAGE */}
        <section className="studio-workspace">
          <div
            className={`room-stage ${roomImage ? 'has-image' : ''} ${isMarkingMode ? 'is-marking' : ''}`}
            ref={stageRef}
            onClick={handleStageClick}
            onPointerMove={handlePointerMoveMarker}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            {!roomImage && (
              <div className="room-placeholder">
                <span>＋</span>
                <h2>Tải ảnh căn phòng</h2>
                <p>Sau khi tải ảnh, bạn chỉ cần bấm chọn các góc phòng rồi chọn sản phẩm.</p>
                <label className="button">
                  Chọn ảnh phòng
                  <input type="file" accept="image/png,image/jpeg" capture="environment" onChange={uploadRoom} />
                </label>
              </div>
            )}

            {roomImage && (
              <img
                className="room-photo"
                src={roomImage}
                alt="Căn phòng do người dùng tải lên"
                draggable="false"
                onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              />
            )}

            {/* 1. Vẽ các đường nối nhẹ giữa các góc đã chấm */}
            {roomImage && markedCorners.length > 1 && (
              <svg className="corners-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                {markedCorners.map((corner, idx) => {
                  if (idx === 0) return null;
                  const prev = markedCorners[idx - 1];
                  return (
                    <line
                      key={`line-${prev.id}-${corner.id}`}
                      x1={prev.x}
                      y1={prev.y}
                      x2={corner.x}
                      y2={corner.y}
                      stroke="#0ea5e9"
                      strokeWidth="0.75"
                      strokeDasharray="2, 1.5"
                    />
                  );
                })}
              </svg>
            )}

            {/* 2. Hiển thị các chấm góc người dùng đã đánh dấu */}
            {roomImage && markedCorners.map((corner) => (
              <button
                key={corner.id}
                type="button"
                className={`user-corner-dot ${selectedCornerId === corner.id ? 'is-selected' : ''}`}
                style={{ left: `${corner.x}%`, top: `${corner.y}%`, '--dot-bg': corner.color }}
                onClick={(e) => handleSelectCornerToPlace(corner, e)}
                onPointerDown={(e) => e.stopPropagation()}
                title={`${corner.label}: Bấm để đặt đồ vào góc này`}
                aria-label={`Chọn ${corner.label}`}
              >
                <span className="corner-dot-pulse" style={{ backgroundColor: corner.color }} />
                <span className="corner-dot-core" style={{ backgroundColor: corner.color }}>
                  {corner.index}
                </span>
                <span className="corner-dot-label">{corner.label}</span>
              </button>
            ))}

            {/* 3. Hiển thị Live Preview sản phẩm tại vị trí đã chọn */}
            {roomImage && hasTarget && productImageSource && (
              <img
                className="room-product-preview"
                src={productImageSource}
                alt="Sản phẩm đang được đặt thử"
                style={getProductPreviewStyle(selectedProduct, target, isFlipped)}
                draggable="false"
              />
            )}
            
            {/* 4. Ghim định vị sản phẩm */}
            {roomImage && hasTarget && !isMarkingMode && (
              <button
                className={`target-marker ${dragging ? 'is-dragging' : ''}`}
                type="button"
                aria-label="Vị trí đặt sản phẩm, kéo để thay đổi"
                style={{ left: `${target.x}%`, top: `${target.y}%` }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragging(true);
                }}
                onPointerMove={handlePointerMoveMarker}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  setDragging(false);
                }}
                disabled={isGenerating}
              >
                <span />
                <b>Đặt {selectedProduct?.name || 'sản phẩm'} tại đây</b>
              </button>
            )}
          </div>

          <div className="studio-message" aria-live="polite">
            {message || '1. Chấm các góc phòng → 2. Chọn sản phẩm và bấm góc muốn kê → 3. Xem thử.'}
          </div>

          {/* CHỌN SẢN PHẨM */}
          <div className="product-picker">
            <div className="section-title">
              <div>
                <span className="step-label">CHỌN SẢN PHẨM MUỐN THỬ</span>
                <h2>{selectedProduct?.name || 'Chưa chọn sản phẩm'}</h2>
              </div>
            </div>
            <div className="product-picker-list">
              {products.map((product) => (
                <button
                  className={selectedProduct?._id === product._id ? 'active' : ''}
                  type="button"
                  key={product._id}
                  onClick={() => chooseProduct(product._id)}
                >
                  <ProductArtwork product={product} />
                  <span>{product.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* NÚT BẤM XEM THỬ */}
          <div className="studio-actions">
            <button className="button button-large" type="button" onClick={previewRoom} disabled={isGenerating}>
              {isGenerating ? 'Đang xem thử…' : '✨ Xem thử trong phòng'}
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => { setIsFlipped(!isFlipped); clearGeneratedResult(); }}
              title="Lật gương sản phẩm để đổi góc quay trái/phải phù hợp góc phòng"
            >
              ↔ Lật gương {isFlipped ? '(Đang lật)' : ''}
            </button>
          </div>

          {/* KẾT QUẢ AI */}
          {resultImage && (
            <div className="ai-result-card">
              <span className="step-label">KẾT QUẢ AI</span>
              <h2>Bản chân thực trong phòng</h2>
              <img src={resultImage} alt={`Bản chân thực với ${selectedProduct?.name || 'sản phẩm'}`} />
              {Number.isFinite(elapsedMs) && <small className="muted">Thời gian xử lý: {elapsedMs} ms</small>}
            </div>
          )}

          {hasTarget && (
            <div className="api-ready-card">
              <div><span className="status-dot" /><strong>Vị trí đã sẵn sàng</strong></div>
              <p>Ảnh hướng dẫn chỉ là một crop nhỏ quanh sản phẩm. Kết quả crop sẽ được ghép lại vào ảnh phòng gốc để giữ nguyên các vùng khác.</p>
              <dl>
                <div><dt>Tọa độ X</dt><dd>{normalizedPlacement.x}</dd></div>
                <div><dt>Tọa độ Y</dt><dd>{normalizedPlacement.y}</dd></div>
                <div><dt>Góc chọn</dt><dd>{selectedCornerId ? markedCorners.find((c) => c.id === selectedCornerId)?.label : 'Tự do'}</dd></div>
              </dl>
              {imageSize.width > 0 && <small className="muted">Trên ảnh gốc: khoảng {Math.round(normalizedPlacement.x * imageSize.width)} × {Math.round(normalizedPlacement.y * imageSize.height)} px.</small>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
