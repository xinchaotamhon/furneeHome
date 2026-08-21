import { useEffect, useRef, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import { useProducts } from '../context/ProductContext';
import { createRoomPreview } from '../services/roomPreviewService';
import { compositeRoomPreview, createRoomPreviewImages, getProductImageSource, getProductPreviewStyle } from '../utils/roomPreviewCanvas';
import { solveCameraFromUserLines } from '../utils/cameraSolver';

const initialTarget = { x: 50, y: 72 };

const DEFAULT_CALIBRATION_LINES = {
  axisX: [
    [{ x: 12, y: 82 }, { x: 38, y: 66 }], // Đường 1 dọc tường trái
    [{ x: 6, y: 36 }, { x: 40, y: 30 }],  // Đường 2 dọc dầm/trần trái
  ],
  axisY: [
    [{ x: 38, y: 66 }, { x: 74, y: 68 }], // Đường 1 dọc tường sau
    [{ x: 40, y: 30 }, { x: 76, y: 34 }], // Đường 2 dọc xà ngang sau
  ],
};

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
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationLines, setCalibrationLines] = useState(DEFAULT_CALIBRATION_LINES);
  const [cameraParams, setCameraParams] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null);
  const [dragging, setDragging] = useState(false);
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

  // Tính toán lại thông số Camera từ các đường gióng thực tế của người dùng
  const solveCalibration = (lines, width = 1000, height = 1000) => {
    const solved = solveCameraFromUserLines(lines.axisX, lines.axisY, width, height);
    if (solved) {
      setCameraParams(solved);
      setMessage(`✓ Đã khóa phối cảnh: Tiêu cự f = ${Math.round(solved.focalLength)}px, Nghiêng sàn = ${solved.pitchDeg}°, Góc nhìn = ${solved.yawDeg}°.`);
    }
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
    setMessage('Ảnh phòng đã nạp. Chấm một điểm trên sàn để đặt đồ hoặc bật "Căn phối cảnh fSpy" để khớp góc phòng.');
  };

  const handlePointerDownHandle = (axis, lineIdx, pointIdx, event) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingHandle({ axis, lineIdx, pointIdx });
  };

  const handlePointerMoveStage = (event) => {
    if (!stageRef.current || isGenerating) return;
    const rect = stageRef.current.getBoundingClientRect();
    const currentX = clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99);
    const currentY = clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99);

    if (draggingHandle) {
      const { axis, lineIdx, pointIdx } = draggingHandle;
      const newLines = JSON.parse(JSON.stringify(calibrationLines));
      newLines[axis][lineIdx][pointIdx] = { x: Number(currentX.toFixed(1)), y: Number(currentY.toFixed(1)) };
      setCalibrationLines(newLines);
      solveCalibration(newLines, rect.width, rect.height);
      return;
    }

    if (dragging) {
      setTarget({ x: currentX, y: currentY });
      clearGeneratedResult();
    }
  };

  const handlePointerUpStage = () => {
    if (draggingHandle) {
      setDraggingHandle(null);
    }
    setDragging(false);
  };

  const placeTarget = (event) => {
    if (!roomImage || isGenerating || calibrationMode) return;
    if (!stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    setTarget({
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99),
    });
    setHasTarget(true);
    clearGeneratedResult();
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
        isFlipped,
        cameraParams,
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
        photo: finalImage,
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
        <li><span>2</span><div><strong>Chấm vị trí hoặc Căn góc fSpy</strong><small>Khóa ma trận 3D phối cảnh phòng thật.</small></div></li>
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
            <div className="section-title">
              <div>
                <span className="step-label">BƯỚC 2</span>
                <h2>Vị trí đặt đồ</h2>
              </div>
              {roomImage && (
                <button
                  className={`button button-small ${calibrationMode ? 'button-active' : 'button-secondary'}`}
                  type="button"
                  onClick={() => {
                    const next = !calibrationMode;
                    setCalibrationMode(next);
                    if (next) solveCalibration(calibrationLines);
                  }}
                  title="Bật thước gióng fSpy để căn góc phòng 3D động"
                >
                  📐 {calibrationMode ? 'Khóa góc fSpy' : 'Căn góc fSpy'}
                </button>
              )}
            </div>

            <p>
              {calibrationMode
                ? 'Kéo các điểm tròn đỏ (Trục tường trái) và xanh (Trục tường sau) theo các đường thẳng thật trong phòng để khóa ma trận 3D.'
                : 'Chạm vào ảnh để đặt ghim. Ghim là nơi đáy sản phẩm tiếp xúc với sàn.'}
            </p>

            {cameraParams?.calibrated && (
              <div className="calibration-badge">
                <span>📐 Đã khóa phối cảnh fSpy:</span>
                <small>Nghiêng sàn: {cameraParams.pitchDeg}° · Góc quay: {cameraParams.yawDeg}°</small>
              </div>
            )}

            {hasTarget ? (
              <div className="target-summary">
                <span className="mini-pin" />
                <div>
                  <strong>Đã chọn vị trí</strong>
                  <small>Ngang {target.x.toFixed(1)}% · Dọc {target.y.toFixed(1)}%</small>
                </div>
              </div>
            ) : (
              <div className="target-empty">Chưa chọn vị trí trên ảnh</div>
            )}
            
            {hasTarget && (
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setHasTarget(false);
                  clearGeneratedResult();
                  setMessage('Hãy chấm một vị trí mới trên ảnh.');
                }}
              >
                Chọn lại từ đầu
              </button>
            )}
          </section>
        </aside>

        <section className="studio-workspace">
          <div
            className={`room-stage ${roomImage ? 'has-image' : ''}`}
            ref={stageRef}
            onPointerDown={placeTarget}
            onPointerMove={handlePointerMoveStage}
            onPointerUp={handlePointerUpStage}
            onPointerCancel={handlePointerUpStage}
          >
            {!roomImage && <div className="room-placeholder"><span>＋</span><h2>Tải ảnh căn phòng</h2><p>Sau khi tải ảnh, bạn chỉ cần bấm vào nơi muốn đặt sản phẩm.</p><label className="button">Chọn ảnh phòng<input type="file" accept="image/png,image/jpeg" capture="environment" onChange={uploadRoom} /></label></div>}
            {roomImage && <img className="room-photo" src={roomImage} alt="Căn phòng do người dùng tải lên" draggable="false" onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />}
            
            {/* Lớp thước gióng phối cảnh fSpy động */}
            {roomImage && calibrationMode && (
              <svg className="calibration-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                {calibrationLines.axisX.map((line, idx) => (
                  <line
                    key={`axisX-line-${idx}`}
                    x1={line[0].x}
                    y1={line[0].y}
                    x2={line[1].x}
                    y2={line[1].y}
                    stroke="#ef4444"
                    strokeWidth="0.8"
                    strokeDasharray="1.5, 1"
                  />
                ))}
                {calibrationLines.axisY.map((line, idx) => (
                  <line
                    key={`axisY-line-${idx}`}
                    x1={line[0].x}
                    y1={line[0].y}
                    x2={line[1].x}
                    y2={line[1].y}
                    stroke="#3b82f6"
                    strokeWidth="0.8"
                    strokeDasharray="1.5, 1"
                  />
                ))}
              </svg>
            )}

            {roomImage && calibrationMode && (
              <>
                {calibrationLines.axisX.map((line, lineIdx) =>
                  line.map((pt, ptIdx) => (
                    <button
                      key={`handle-X-${lineIdx}-${ptIdx}`}
                      type="button"
                      className="calibration-handle axis-x"
                      style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                      onPointerDown={(e) => handlePointerDownHandle('axisX', lineIdx, ptIdx, e)}
                      aria-label="Kéo điểm gióng trục X (Đỏ)"
                    />
                  ))
                )}
                {calibrationLines.axisY.map((line, lineIdx) =>
                  line.map((pt, ptIdx) => (
                    <button
                      key={`handle-Y-${lineIdx}-${ptIdx}`}
                      type="button"
                      className="calibration-handle axis-y"
                      style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                      onPointerDown={(e) => handlePointerDownHandle('axisY', lineIdx, ptIdx, e)}
                      aria-label="Kéo điểm gióng trục Y (Xanh)"
                    />
                  ))
                )}
              </>
            )}

            {roomImage && hasTarget && productImageSource && (
              <img
                className="room-product-preview"
                src={productImageSource}
                alt="Sản phẩm đang được đặt thử"
                style={getProductPreviewStyle(selectedProduct, target, isFlipped, cameraParams)}
                draggable="false"
              />
            )}
            
            {roomImage && hasTarget && !calibrationMode && (
              <button
                className={`target-marker ${dragging ? 'is-dragging' : ''}`}
                type="button"
                aria-label="Vị trí đặt sản phẩm, kéo để thay đổi"
                style={{ left: `${target.x}%`, top: `${target.y}%` }}
                onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
                onPointerMove={handlePointerMoveStage}
                onPointerUp={(event) => { event.stopPropagation(); setDragging(false); }}
                disabled={isGenerating}
              >
                <span />
                <b>Đặt {selectedProduct?.name || 'sản phẩm'} tại đây</b>
              </button>
            )}
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
            <button className="button button-secondary" type="button" onClick={() => { setIsFlipped(!isFlipped); clearGeneratedResult(); }} title="Lật gương sản phẩm để đổi góc quay trái/phải phù hợp góc phòng">
              ↔ Lật gương {isFlipped ? '(Đang lật)' : ''}
            </button>
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
