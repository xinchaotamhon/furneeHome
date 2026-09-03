import { useEffect, useMemo, useRef, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../context/CollectionContext';
import { useProducts } from '../context/ProductContext';
import useDebounce from '../hooks/useDebounce';
import { createRoomPreview } from '../services/roomPreviewService';
import { estimateRoomCameraParameters, solveCameraFromUserLines } from '../utils/cameraSolver';
import { compositeRoomPreview, createRoomPreviewImages, getProductImageSource, getProductPreviewStyle } from '../utils/roomPreviewCanvas';
import { normalizeText } from '../utils/normalizeText';

const CORNER_COLORS = ['#ef4444', '#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4'];
const GUEST_SESSION_KEY = 'furneehome_guest_studio_session';
const HANDOFF_KEY = 'furneehome-room-design-to-open';
const PRODUCTS_PER_PAGE = 6;
const MAX_PLACEMENTS = 12;
const INITIAL_TARGET = { x: 50, y: 72 };

function getStorageKey(user) {
  return user ? `furneehome_user_studio_${user.id || user._id || user.email || 'user'}` : GUEST_SESSION_KEY;
}

function readSavedStudioSession(user) {
  try {
    const raw = (user ? localStorage : sessionStorage).getItem(getStorageKey(user));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeSavedStudioSession(user, data) {
  try { (user ? localStorage : sessionStorage).setItem(getStorageKey(user), JSON.stringify(data)); } catch {
    // Large photos can exceed browser storage; the current studio session still works.
  }
}

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

function toPercentTarget(target = INITIAL_TARGET) {
  const x = Number(target.x ?? INITIAL_TARGET.x);
  const y = Number(target.y ?? INITIAL_TARGET.y);
  return { x: x <= 1 ? x * 100 : x, y: y <= 1 ? y * 100 : y };
}

function readCollectionHandoff() {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    localStorage.removeItem(HANDOFF_KEY);
    const saved = JSON.parse(raw);
    return { ...saved, placements: saved.placements || saved.sceneItems || saved.items || [] };
  } catch { return null; }
}

function normalizeCorners(points = []) {
  return points.slice(0, 4).map((point, index) => ({
    ...point,
    id: point.id || `corner-saved-${index}`,
    index: index + 1,
    ...toPercentTarget(point),
    color: point.color || CORNER_COLORS[index % CORNER_COLORS.length],
    label: point.label || `Góc ${index + 1}`,
  }));
}

function normalizeRotation(value) {
  return ((((value || 0) + 180) % 360) + 360) % 360 - 180;
}

function toTarget(event, stage) {
  const rect = stage.getBoundingClientRect();
  return {
    x: Number(clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99).toFixed(1)),
    y: Number(clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99).toFixed(1)),
  };
}

function productSnapshot(product) {
  if (!product) return null;
  return { _id: product._id, id: product.id, name: product.name, image: product.image, transparentImage: product.transparentImage, category: product.category, categoryName: product.categoryName, defaultScale: product.defaultScale, visualType: product.visualType, color: product.color };
}

function getProductCategory(product) {
  return (typeof product?.category === 'object' ? product.category?.name : product?.category) || product?.categoryName || 'Khác';
}

function createPlacement(product, target, zIndex) {
  return { id: `placement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, productId: product._id || product.id, productName: product.name, product: productSnapshot(product), target, scale: 1, rotation: 0, isFlipped: false, zIndex };
}

function migrateLegacyPlacement(saved) {
  if (Array.isArray(saved?.placements)) {
    return saved.placements.map((placement, index) => ({
      ...placement,
      id: placement.id || `placement-saved-${index}`,
      target: toPercentTarget(placement.target),
      isFlipped: Boolean(placement.isFlipped ?? placement.flip),
      zIndex: placement.zIndex ?? index + 1,
    }));
  }
  if (!saved?.hasTarget || !saved?.selectedId) return [];
  return [{ id: 'placement-legacy', productId: saved.selectedId, productName: saved.selectedProductName || 'Sản phẩm đã chọn', product: saved.selectedProduct || null, target: toPercentTarget(saved.target), scale: saved.scale || 1, rotation: saved.rotation || 0, isFlipped: Boolean(saved.isFlipped ?? saved.flip), zIndex: 1 }];
}

function buildCameraParameters(markedCorners, imageSize) {
  const width = imageSize.width || 1000;
  const height = imageSize.height || 1000;
  const fallback = estimateRoomCameraParameters(width, height);
  if (markedCorners.length < 4) return fallback;
  const points = markedCorners.slice(0, 4).map((corner) => ({ x: (corner.x / 100) * width, y: (corner.y / 100) * height }));
  // Opposite edges of the first four floor corners calibrate the fSpy-inspired solver.
  return solveCameraFromUserLines([[points[0], points[1]], [points[3], points[2]]], [[points[0], points[3]], [points[1], points[2]]], width, height) || fallback;
}

export default function RoomStudioPage() {
  const { user } = useAuth();
  const { products } = useProducts();
  const { saveRoomTemplate } = useCollection();
  const [savedInitial] = useState(() => readCollectionHandoff() || readSavedStudioSession(user));
  const preferredId = localStorage.getItem('furneehome-room-product');
  const [roomImage, setRoomImage] = useState(savedInitial?.roomImage || '');
  const [roomFileName, setRoomFileName] = useState(savedInitial?.roomFileName || '');
  const [imageSize, setImageSize] = useState(savedInitial?.imageSize || { width: 0, height: 0 });
  const [markedCorners, setMarkedCorners] = useState(() => normalizeCorners(savedInitial?.markedCorners));
  const [isMarkingMode, setIsMarkingMode] = useState(savedInitial?.isMarkingMode ?? true);
  const [selectedId, setSelectedId] = useState(savedInitial?.selectedId || preferredId || '');
  const [placements, setPlacements] = useState(() => migrateLegacyPlacement(savedInitial));
  const [selectedPlacementId, setSelectedPlacementId] = useState(savedInitial?.selectedPlacementId || null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('Tải ảnh phòng, chấm các góc sàn rồi chọn đồ để đặt vào phòng.');
  const [resultImage, setResultImage] = useState(savedInitial?.resultImage || '');
  const [elapsedMs, setElapsedMs] = useState(savedInitial?.elapsedMs || null);
  const [resultInfo, setResultInfo] = useState(savedInitial?.resultInfo || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastFailedPlacementId, setLastFailedPlacementId] = useState(null);
  const [roomRequest, setRoomRequest] = useState(savedInitial?.roomRequest || '');
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const placementsRef = useRef(placements);
  const requestSequenceRef = useRef(0);
  const debouncedQuery = useDebounce(query);

  placementsRef.current = placements;

  useEffect(() => {
    if (!selectedId && products[0]?._id) setSelectedId(products[0]._id);
    setPlacements((current) => current.map((placement) => {
      if (placement.product) return placement;
      const product = products.find((item) => item._id === placement.productId || item.id === placement.productId);
      return product ? { ...placement, product: productSnapshot(product), productName: product.name } : placement;
    }));
  }, [products, selectedId]);

  useEffect(() => {
    writeSavedStudioSession(user, { roomImage, roomFileName, imageSize, markedCorners, isMarkingMode, selectedId, placements, selectedPlacementId, resultImage, elapsedMs, resultInfo, roomRequest });
  }, [user, roomImage, roomFileName, imageSize, markedCorners, isMarkingMode, selectedId, placements, selectedPlacementId, resultImage, elapsedMs, resultInfo, roomRequest]);

  const selectedProduct = products.find((product) => product._id === selectedId || product.id === selectedId) || products[0];
  const activePlacement = placements.find((placement) => placement.id === selectedPlacementId) || null;
  const categories = useMemo(() => [...new Set(products.map(getProductCategory).filter(Boolean))], [products]);
  const filteredProducts = useMemo(() => {
    const search = normalizeText(debouncedQuery.trim());
    return products.filter((product) => {
      const productCategory = getProductCategory(product);
      return (!category || productCategory === category) && (!search || normalizeText(`${product.name || ''} ${productCategory || ''}`).includes(search));
    });
  }, [products, debouncedQuery, category]);
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const visibleProducts = filteredProducts.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);

  const updatePlacement = (id, updates) => {
    const next = placementsRef.current.map((placement) => placement.id === id ? { ...placement, ...updates } : placement);
    placementsRef.current = next;
    setPlacements(next);
    return next;
  };

  const removePlacement = (id) => {
    const next = placementsRef.current.filter((placement) => placement.id !== id);
    placementsRef.current = next;
    setPlacements(next);
    setSelectedPlacementId(null);
    if (next.length) {
      void renderScene(next);
    } else {
      requestSequenceRef.current += 1;
      setIsGenerating(false);
      setResultImage(null);
      setElapsedMs(null);
      setResultInfo(null);
      setMessage('Đã xóa hết sản phẩm khỏi phòng.');
    }
  };

  const renderScene = async (sceneSnapshot, changedPlacementId = null) => {
    const scene = sceneSnapshot.slice(0, MAX_PLACEMENTS).map((placement) => ({
      ...placement,
      product: placement.product || products.find((item) => item._id === placement.productId || item.id === placement.productId),
    }));
    if (!roomImage || !scene.length) return;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setIsGenerating(true); setLastFailedPlacementId(null);
    const names = scene
      .map((placement) => placement.productName || placement.product?.name)
      .filter(Boolean)
      .map((name) => String(name).slice(0, 14))
      .join(', ');
    setMessage(`Đang hoàn thiện toàn bộ bố cục gồm ${scene.length} món bằng AI…`);
    try {
      const guideImages = await createRoomPreviewImages({ roomSource: roomImage, placements: scene, cameraParams: buildCameraParameters(markedCorners, imageSize) });
      const focus = scene.find((placement) => placement.id === changedPlacementId) || scene[scene.length - 1];
      const productName = `Interior scene: ${names}`.slice(0, 200);
      const result = await createRoomPreview({ ...guideImages, productName, userPrompt: roomRequest.trim(), placement: { x: Number((focus.target.x / 100).toFixed(4)), y: Number((focus.target.y / 100).toFixed(4)), anchor: 'bottom-center' } });
      const finalImage = result.imageDataUrl?.startsWith('data:image/') ? result.imageDataUrl : await compositeRoomPreview({ roomSource: roomImage, resultSource: result.imageDataUrl, editRegion: guideImages.editRegion });
      if (!finalImage?.startsWith('data:image/')) throw new Error('Ảnh AI không hợp lệ.');
      if (requestId !== requestSequenceRef.current) return;
      setResultImage(finalImage); setElapsedMs(result.elapsedMs || null); setResultInfo({ provider: result.provider || '', model: result.model || '' });
      setMessage(`Đã tạo ảnh AI cho toàn bộ ${scene.length} sản phẩm trong phòng.`);
    } catch {
      if (requestId !== requestSequenceRef.current) return;
      setLastFailedPlacementId(changedPlacementId);
      setMessage('AI chưa tạo được ảnh này. Bản xem trước tại chỗ vẫn giữ nguyên; bạn có thể thử lại.');
    } finally { if (requestId === requestSequenceRef.current) setIsGenerating(false); }
  };

  const updatePlacementAndRender = (id, updates) => {
    const next = updatePlacement(id, updates);
    void renderScene(next, id);
  };

  const addPlacement = (target, product = selectedProduct) => {
    if (!roomImage) { setMessage('Hãy tải ảnh căn phòng trước khi đặt sản phẩm.'); return; }
    if (!product) { setMessage('Hãy chọn một sản phẩm trước.'); return; }
    if (placementsRef.current.length >= MAX_PLACEMENTS) { setMessage(`Mỗi phòng thử tối đa ${MAX_PLACEMENTS} sản phẩm để dễ chỉnh sửa.`); return; }
    const placement = createPlacement(product, target, Math.max(0, ...placementsRef.current.map((item) => item.zIndex || 0)) + 1);
    const next = [...placementsRef.current, placement];
    placementsRef.current = next;
    setPlacements(next); setSelectedPlacementId(placement.id); setIsMarkingMode(false);
    void renderScene(next, placement.id);
  };

  const addRandomSuggestions = () => {
    if (!roomImage) { setMessage('Hãy tải ảnh căn phòng trước khi nhận gợi ý.'); return; }
    if (isGenerating) { setMessage('Ảnh AI đang được tạo. Hãy chờ xong trước khi nhận gợi ý mới.'); return; }
    const remaining = MAX_PLACEMENTS - placementsRef.current.length;
    if (remaining <= 0) { setMessage(`Mỗi phòng thử tối đa ${MAX_PLACEMENTS} sản phẩm.`); return; }

    const usedProductIds = new Set(placementsRef.current.map((placement) => placement.productId));
    const candidates = products.filter((product) => !usedProductIds.has(product._id || product.id));
    const shuffledCategories = [...new Set(candidates.map(getProductCategory))].sort(() => Math.random() - 0.5);
    const suggestions = shuffledCategories.slice(0, Math.min(3, remaining)).map((categoryName) => {
      const choices = candidates.filter((product) => getProductCategory(product) === categoryName);
      return choices[Math.floor(Math.random() * choices.length)];
    }).filter(Boolean);
    if (!suggestions.length) { setMessage('Chưa còn sản phẩm mới để gợi ý.'); return; }

    const safeTargets = [{ x: 28, y: 78 }, { x: 52, y: 80 }, { x: 76, y: 78 }];
    const startZIndex = Math.max(0, ...placementsRef.current.map((item) => item.zIndex || 0));
    const additions = suggestions.map((product, index) => createPlacement(product, safeTargets[index], startZIndex + index + 1));
    const next = [...placementsRef.current, ...additions];
    placementsRef.current = next;
    setPlacements(next); setSelectedPlacementId(additions[additions.length - 1].id); setIsMarkingMode(false);
    setMessage(`Đã gợi ý ${additions.length} món từ các danh mục khác nhau và đang tạo ảnh toàn phòng.`);
    void renderScene(next, additions[additions.length - 1].id);
  };

  const handleStageClick = (event) => {
    if (!roomImage || !stageRef.current || dragRef.current?.moved) return;
    const target = toTarget(event, stageRef.current);
    if (isMarkingMode) {
      if (markedCorners.length >= 4) {
        setMessage('Đã đủ 4 góc sàn. Bấm “Đủ 4 góc sàn” để bắt đầu đặt đồ.');
        return;
      }
      const index = markedCorners.length;
      const corner = { id: `corner-${Date.now()}-${index}`, index: index + 1, x: target.x, y: target.y, color: CORNER_COLORS[index % CORNER_COLORS.length], label: `Góc ${index + 1}` };
      setMarkedCorners((current) => [...current, corner]);
      setMessage(index === 3 ? 'Đã đủ 4 góc sàn. Bấm “Đủ 4 góc sàn” để bắt đầu đặt đồ.' : `Đã chấm ${corner.label}. Chấm góc sàn tiếp theo theo thứ tự hướng dẫn.`);
    } else addPlacement(target);
  };

  const handleDrop = (event) => {
    event.preventDefault(); if (!stageRef.current) return;
    const id = event.dataTransfer.getData('text/plain');
    addPlacement(toTarget(event, stageRef.current), products.find((item) => item._id === id || item.id === id) || selectedProduct);
  };
  const handlePlacementPointerDown = (event, placement) => {
    event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id: placement.id, moved: false }; setSelectedPlacementId(placement.id);
  };
  const handleStagePointerMove = (event) => {
    if (!dragRef.current || !stageRef.current) return;
    dragRef.current.moved = true; updatePlacement(dragRef.current.id, { target: toTarget(event, stageRef.current) });
  };
  const handleStagePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag || !stageRef.current) return;
    if (drag.moved) {
      const current = placementsRef.current.find((placement) => placement.id === drag.id);
      const placement = current ? { ...current, target: toTarget(event, stageRef.current) } : null;
      if (placement) {
        const next = updatePlacement(placement.id, { target: placement.target });
        void renderScene(next, placement.id);
      }
    }
    window.setTimeout(() => { dragRef.current = null; }, 0);
  };

  const uploadRoom = (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const image = loadEvent.target?.result; if (!image) return;
      requestSequenceRef.current += 1;
      setRoomImage(image); setRoomFileName(file.name); setImageSize({ width: 0, height: 0 }); setMarkedCorners([]); setPlacements([]); setSelectedPlacementId(null); setResultImage(''); setElapsedMs(null); setResultInfo(null); setIsMarkingMode(true); setLastFailedPlacementId(null);
      setMessage('Bước 1: bấm các góc chân tường hoặc mép sàn trên ảnh phòng.');
    };
    reader.readAsDataURL(file);
  };

  const saveCollection = () => {
    if (!roomImage || !placements.length) { setMessage('Hãy tải ảnh và đặt ít nhất một sản phẩm trước khi lưu.'); return; }
    const latest = activePlacement || placements[placements.length - 1];
    const latestProduct = latest.product || products.find((item) => item._id === latest.productId || item.id === latest.productId);
    saveRoomTemplate({
      name: `Phòng thử với ${placements.length} sản phẩm`, productId: latest.productId, productName: latest.productName,
      productImage: getProductImageSource(latestProduct), roomImage,
      target: { x: Number((latest.target.x / 100).toFixed(4)), y: Number((latest.target.y / 100).toFixed(4)), anchor: 'bottom-center' },
      scale: latest.scale, rotation: normalizeRotation(latest.rotation), flip: latest.isFlipped,
      placements: placements.map((placement) => ({
        ...placement,
        image: placement.product?.image || '',
        transparentImage: placement.product?.transparentImage || '',
        target: { x: Number((placement.target.x / 100).toFixed(4)), y: Number((placement.target.y / 100).toFixed(4)) },
        rotation: normalizeRotation(placement.rotation),
        flip: placement.isFlipped,
      })),
      markedCorners: markedCorners.map((corner) => ({ x: Number((corner.x / 100).toFixed(4)), y: Number((corner.y / 100).toFixed(4)) })),
      imageSize, resultImage, userPrompt: roomRequest.trim(), model: resultInfo ? [resultInfo.provider, resultInfo.model].filter(Boolean).join(' · ') : '', elapsedMs,
    });
    setMessage('Đã lưu bố cục phòng và vị trí các sản phẩm vào Bộ sưu tập.');
  };
  const resetStudio = () => {
    requestSequenceRef.current += 1;
    setRoomImage(''); setRoomFileName(''); setImageSize({ width: 0, height: 0 }); setMarkedCorners([]); setPlacements([]); setSelectedPlacementId(null); setResultImage(''); setElapsedMs(null); setResultInfo(null); setIsMarkingMode(true); setLastFailedPlacementId(null); setMessage('Đã làm mới Phòng thử.');
  };
  const renderPlacementStyle = (placement) => {
    const product = placement.product || products.find((item) => item._id === placement.productId || item.id === placement.productId);
    const base = getProductPreviewStyle(product || {}, placement.target, placement.isFlipped, buildCameraParameters(markedCorners, imageSize));
    return { ...base, zIndex: placement.zIndex, transform: `${base.transform} rotate(${normalizeRotation(placement.rotation)}deg) scale(${placement.scale || 1})` };
  };
  const hasFreshAiResult = Boolean(resultImage && !isGenerating);
  const displayedRoomImage = hasFreshAiResult ? resultImage : roomImage;
  const stageAspectRatio = imageSize.width && imageSize.height ? `${imageSize.width} / ${imageSize.height}` : '4 / 3';

  return <main className="container page room-studio-page simple-room-studio">
    <div className="page-heading room-studio-heading"><p className="eyebrow">PHÒNG THỬ AI</p><h1>Thử đồ trong phòng của bạn</h1><p>Bản ghép hiện ngay khi đặt đồ; AI hoàn thiện toàn bộ bố cục ở ngay trong cùng khung ảnh.</p></div>
    <ol className="room-steps" aria-label="Ba bước sử dụng"><li className={roomImage ? 'done' : 'active'}><span>1</span><div><strong>Ảnh & 4 góc sàn</strong><small>Đúng thứ tự để căn phối cảnh.</small></div></li><li className={roomImage && !isMarkingMode ? 'active' : ''}><span>2</span><div><strong>Chọn hoặc gợi ý đồ</strong><small>Tìm nhanh, 6 món mỗi trang.</small></div></li><li className={placements.length ? 'active' : ''}><span>3</span><div><strong>Đặt & xem ảnh AI</strong><small>Kéo, chỉnh và lưu bố cục.</small></div></li></ol>
    <div className="room-studio-layout">
      <section className="room-canvas-panel" aria-label="Ảnh phòng để thử nội thất">
        <div className="room-canvas-toolbar"><div><strong>{roomFileName || 'Ảnh phòng của bạn'}</strong><small>{markedCorners.length} góc đã chấm · {placements.length} sản phẩm đã đặt</small></div><div className="room-toolbar-actions"><label className="button button-small button-secondary">Đổi ảnh<input type="file" accept="image/*" onChange={uploadRoom} hidden /></label>{roomImage && <button type="button" className="button button-small button-secondary" onClick={resetStudio}>Làm mới</button>}</div></div>
        {!roomImage ? <label className="room-upload-empty"><input type="file" accept="image/*" onChange={uploadRoom} hidden /><span className="room-upload-icon">⌂</span><strong>Tải ảnh căn phòng</strong><small>Dùng ảnh JPG, PNG hoặc WEBP. Sau đó chấm đúng 4 góc sàn theo hướng dẫn.</small><span className="button">Chọn ảnh phòng</span></label> : <div className={`room-stage ${isMarkingMode ? 'is-marking' : 'is-placing'}`} style={{ aspectRatio: stageAspectRatio }} ref={stageRef} onClick={handleStageClick} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} onPointerMove={handleStagePointerMove} onPointerUp={handleStagePointerUp} onPointerCancel={handleStagePointerUp}>
          <img src={displayedRoomImage} alt={hasFreshAiResult ? 'Kết quả AI của toàn bộ căn phòng' : 'Căn phòng để thử nội thất'} onLoad={(event) => { if (!hasFreshAiResult) setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); }} />
          {!hasFreshAiResult && markedCorners.length > 1 && <svg className="room-corner-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={markedCorners.slice(0, 4).map((corner) => `${corner.x},${corner.y}`).join(' ')} />{markedCorners.length === 4 && <polygon points={markedCorners.map((corner) => `${corner.x},${corner.y}`).join(' ')} />}</svg>}
          {!hasFreshAiResult && markedCorners.map((corner) => <button key={corner.id} type="button" className="room-corner" style={{ left: `${corner.x}%`, top: `${corner.y}%`, '--corner-color': corner.color }} onClick={(event) => event.stopPropagation()} title={corner.label}>{corner.index}</button>)}
          {(!hasFreshAiResult || isGenerating) && placements.map((placement) => { const product = placement.product || products.find((item) => item._id === placement.productId || item.id === placement.productId); const source = getProductImageSource(product); return <button key={placement.id} type="button" className={`placed-product ${placement.id === selectedPlacementId ? 'selected' : ''}`} style={renderPlacementStyle(placement)} onPointerDown={(event) => handlePlacementPointerDown(event, placement)} onClick={(event) => { event.stopPropagation(); setSelectedPlacementId(placement.id); }} title={`Chọn ${placement.productName}`}>{source ? <img src={source} alt={placement.productName} draggable="false" /> : <ProductArtwork product={product || { name: placement.productName }} />}</button>; })}
          {isGenerating && <div className="stage-generating" role="status" aria-live="polite"><span className="room-spinner" /><strong>Đang tạo ảnh AI</strong><small>Bản ghép tại chỗ vẫn dùng được trong lúc chờ.</small></div>}
          {hasFreshAiResult && <div className="stage-ai-result" onClick={(event) => event.stopPropagation()}><div><strong>Ảnh AI toàn phòng</strong><button type="button" className="stage-edit-button" onClick={() => { setResultImage(''); setMessage('Bạn có thể kéo hoặc chỉnh từng món, rồi ảnh AI sẽ được tạo lại.'); }}>Chỉnh bố cục</button></div><span>{elapsedMs ? `${(elapsedMs / 1000).toFixed(1)} giây` : 'Mới tạo xong'}{resultInfo?.model ? ` · ${resultInfo.model}` : ''}</span></div>}
          <div className="stage-hint">{hasFreshAiResult ? 'Bấm “Chỉnh bố cục” để sửa tiếp' : isMarkingMode ? `${markedCorners.length}/4 · bấm góc sàn tiếp theo` : 'Bấm hoặc kéo sản phẩm vào phòng'}</div>
        </div>}
        {message && <p className="room-status" role="status">{isGenerating && <span className="loading-dot" />} {message}</p>}
      </section>
      <aside className="room-controls-panel">
        <section className="room-control-section"><div className="room-section-title"><span>1</span><div><h2>Định vị mặt sàn</h2><p>Chấm đúng 4 điểm: trước trái → sau trái → sau phải → trước phải. Không chấm trần hoặc tường.</p></div></div><div className="corner-actions"><button type="button" className={`button button-small ${isMarkingMode ? '' : 'button-secondary'}`} disabled={!roomImage || markedCorners.length >= 4} onClick={() => setIsMarkingMode(true)}>Chấm 4 góc</button><button type="button" className="button button-small button-secondary" disabled={!markedCorners.length} onClick={() => setMarkedCorners((current) => current.slice(0, -1))}>Xóa góc cuối</button><button type="button" className="button button-small button-secondary" disabled={!markedCorners.length} onClick={() => setMarkedCorners([])}>Xóa hết</button></div>{markedCorners.length === 4 && <button type="button" className="text-button room-complete-corners" onClick={() => { setIsMarkingMode(false); setMessage('Bước 2: chọn sản phẩm, rồi bấm hoặc kéo nó vào phòng.'); }}>✓ Đủ 4 góc sàn — bắt đầu đặt đồ</button>}</section>
        <section className="room-control-section"><div className="room-section-title"><span>2</span><div><h2>Chọn sản phẩm</h2><p>Tìm một món, hoặc để FurneeHome gợi ý nhanh ba nhóm đồ khác nhau.</p></div></div><div className="room-product-filters"><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm bàn, ghế, đèn…" aria-label="Tìm sản phẩm trong phòng thử" /><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Lọc theo danh mục"><option value="">Tất cả danh mục</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="room-product-grid">{visibleProducts.map((product) => { const chosen = (product._id || product.id) === selectedId; return <button key={product._id || product.id} type="button" draggable className={`room-product-card ${chosen ? 'selected' : ''}`} onDragStart={(event) => { event.dataTransfer.setData('text/plain', product._id || product.id); setSelectedId(product._id || product.id); }} onClick={() => { setSelectedId(product._id || product.id); try { localStorage.setItem('furneehome-room-product', product._id || product.id); } catch {} setMessage(`Đã chọn ${product.name}. Bấm hoặc kéo vào ảnh phòng để đặt.`); }}><ProductArtwork product={product} /><span>{product.name}</span></button>; })}</div>{!visibleProducts.length && <p className="room-empty-products">Không tìm thấy sản phẩm phù hợp.</p>}<div className="room-pagination"><button type="button" className="button button-small button-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>← Trước</button><span>{page} / {totalPages}</span><button type="button" className="button button-small button-secondary" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Sau →</button></div><div className="room-suggestion"><button type="button" className="button button-small button-secondary" disabled={!roomImage || isGenerating} onClick={addRandomSuggestions}>✦ Gợi ý ngẫu nhiên 3 món</button><small>Đặt gần vùng sàn để bạn có một bố cục khởi đầu; vẫn có thể kéo chỉnh từng món.</small></div><label className="room-prompt-field"><span>Mong muốn về căn phòng <em>(tùy chọn)</em></span><input maxLength="300" value={roomRequest} onChange={(event) => setRoomRequest(event.target.value)} placeholder="Ví dụ: ấm áp, gọn gàng, gần cửa sổ" /><small>Nội dung này được gửi kèm yêu cầu tạo ảnh AI.</small><button type="button" className="button button-small button-secondary" disabled={!placements.length || isGenerating} onClick={() => void renderScene(placementsRef.current, activePlacement?.id)}>Áp dụng mô tả vào ảnh AI</button></label></section>
        <section className="room-control-section"><div className="room-section-title"><span>3</span><div><h2>Chỉnh món đang chọn</h2><p>{activePlacement ? activePlacement.productName : 'Chọn một món trên ảnh để chỉnh.'}</p></div></div>{activePlacement ? <div className="placement-tools"><div className="placement-tool-row"><label>Kích thước</label><button type="button" onClick={() => updatePlacementAndRender(activePlacement.id, { scale: Number(clamp(activePlacement.scale - 0.1, 0.4, 1.8).toFixed(1)) })}>−</button><span>{Math.round(activePlacement.scale * 100)}%</span><button type="button" onClick={() => updatePlacementAndRender(activePlacement.id, { scale: Number(clamp(activePlacement.scale + 0.1, 0.4, 1.8).toFixed(1)) })}>+</button></div><div className="placement-tool-row"><label>Xoay</label><button type="button" onClick={() => updatePlacementAndRender(activePlacement.id, { rotation: normalizeRotation(activePlacement.rotation - 15) })}>↺</button><span>{normalizeRotation(activePlacement.rotation)}°</span><button type="button" onClick={() => updatePlacementAndRender(activePlacement.id, { rotation: normalizeRotation(activePlacement.rotation + 15) })}>↻</button></div><div className="placement-action-row"><button type="button" className="button button-small button-secondary" onClick={() => updatePlacementAndRender(activePlacement.id, { isFlipped: !activePlacement.isFlipped })}>Lật ngang</button><button type="button" className="button button-small button-danger" onClick={() => removePlacement(activePlacement.id)}>Xóa món</button></div>{lastFailedPlacementId === activePlacement.id && <button type="button" className="button button-small" onClick={() => void renderScene(placementsRef.current, activePlacement.id)}>Thử lại ảnh AI</button>}</div> : <p className="placement-empty">Sản phẩm đã đặt sẽ hiện ở đây để bạn chỉnh.</p>}<div className="room-save-actions"><button type="button" className="button" disabled={!placements.length} onClick={saveCollection}>Lưu vào Bộ sưu tập</button><small>Vị trí, kích thước và hướng của các món đều được lưu.</small></div></section>
      </aside>
    </div>
  </main>;
}
