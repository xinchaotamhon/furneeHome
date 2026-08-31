import { useEffect, useRef, useState } from 'react';
import ProductArtwork from '../components/product/ProductArtwork';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../context/CollectionContext';
import { useProducts } from '../context/ProductContext';
import { createRoomPreview } from '../services/roomPreviewService';
import { compositeRoomPreview, createRoomPreviewImages, getProductImageSource, getProductPreviewStyle } from '../utils/roomPreviewCanvas';

const CORNER_COLORS = ['#ef4444', '#0ea5e9', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6'];
const initialTarget = { x: 50, y: 72 };
const MAX_FLASHCARDS = 10;
const GUEST_SESSION_KEY = 'furneehome_guest_studio_session';

const getUserStorageKey = (user) => {
  if (!user) return GUEST_SESSION_KEY;
  const uid = user.id || user._id || user.email || 'user';
  return `furneehome_user_studio_${uid}`;
};

function readSavedStudioSession(user) {
  try {
    const key = getUserStorageKey(user);
    // Nếu có tài khoản đăng nhập -> lấy từ localStorage, nếu khách -> lấy từ sessionStorage
    const raw = user ? localStorage.getItem(key) : sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSavedStudioSession(user, data) {
  try {
    const payload = JSON.stringify(data);
    if (user) {
      const key = getUserStorageKey(user);
      localStorage.setItem(key, payload);
    } else {
      sessionStorage.setItem(GUEST_SESSION_KEY, payload);
    }
  } catch (err) {
    console.warn('Storage quota exceeded or storage error:', err);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Hàm tính toán hiệu ứng xếp chồng, góc xoay và độ lệch cho từng thẻ trong xấp (Nghiêng & xòe sang bên phải)
function getCardStackStyle(cardIndex, activeIndex) {
  const diff = cardIndex - activeIndex;

  if (diff === 0) {
    // Thẻ đang ở trên cùng (Active Top Card)
    return {
      zIndex: 25,
      transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1)',
      opacity: 1,
      pointerEvents: 'auto',
      boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08)',
    };
  }

  // Thẻ ở phía sau: Xòe và nghiêng sang phải vào khoảng trống rộng rãi
  const absDiff = Math.abs(diff);
  const rotateDeg = absDiff * 3.6; // Góc nghiêng dương sang phải
  const translateX = absDiff * 22; // Dịch chuyển sang phải
  const translateY = absDiff * 6;  // Dịch nhẹ xuống dưới
  const scale = Math.max(0.88, 1 - absDiff * 0.026);
  const zIndex = Math.max(1, 20 - absDiff);
  const opacity = Math.max(0.68, 1 - absDiff * 0.08);

  return {
    zIndex,
    transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotateDeg}deg) scale(${scale})`,
    transformOrigin: 'bottom left',
    opacity,
    pointerEvents: 'auto',
    cursor: 'pointer',
    boxShadow: '0 14px 30px -6px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.06)',
  };
}

export default function RoomStudioPage() {
  const { user, openLogin } = useAuth();
  const { products } = useProducts();
  const { saveRoomTemplate } = useCollection();

  // Khởi tạo state từ dữ liệu lưu trước đó (nếu chuyển qua trang khác rồi quay lại)
  const savedInitial = useRef(readSavedStudioSession(user)).current;

  const preferredId = localStorage.getItem('furneehome-room-product');
  const [selectedId, setSelectedId] = useState(savedInitial?.selectedId || preferredId || products[0]?._id);
  const [roomImage, setRoomImage] = useState(savedInitial?.roomImage || '');
  const [roomFileName, setRoomFileName] = useState(savedInitial?.roomFileName || '');
  const [imageSize, setImageSize] = useState(savedInitial?.imageSize || { width: 0, height: 0 });
  
  // Quản lý các điểm góc do người dùng tự chấm trên ảnh phòng của họ
  const [markedCorners, setMarkedCorners] = useState(savedInitial?.markedCorners || []);
  const [isMarkingMode, setIsMarkingMode] = useState(savedInitial?.isMarkingMode ?? true);

  // Vị trí đặt sản phẩm
  const [target, setTarget] = useState(savedInitial?.target || initialTarget);
  const [hasTarget, setHasTarget] = useState(savedInitial?.hasTarget || false);
  const [selectedCornerId, setSelectedCornerId] = useState(savedInitial?.selectedCornerId || null);
  const [dragging, setDragging] = useState(false);
  const [isFlipped, setIsFlipped] = useState(savedInitial?.isFlipped || false);

  // Trạng thái AI preview
  const [message, setMessage] = useState('');
  const [resultImage, setResultImage] = useState('');
  const [elapsedMs, setElapsedMs] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const stageRef = useRef(null);

  // Quản lý danh sách Flashcard xếp chồng
  const [flashcards, setFlashcards] = useState(savedInitial?.flashcards || []);
  const [activeCardIndex, setActiveCardIndex] = useState(savedInitial?.activeCardIndex || 0);
  const [limitNotice, setLimitNotice] = useState('');

  const selectedProduct = products.find((product) => product._id === selectedId) || products[0];
  const productImageSource = getProductImageSource(selectedProduct);

  // Tự động lưu phiên làm việc:
  // - Khách vãng lai: Lưu vào sessionStorage (chuyển trang trong site không mất)
  // - Đã đăng nhập: Lưu vĩnh viễn vào localStorage
  useEffect(() => {
    const sessionData = {
      roomImage,
      roomFileName,
      imageSize,
      markedCorners,
      isMarkingMode,
      target,
      hasTarget,
      selectedCornerId,
      selectedId,
      isFlipped,
      flashcards,
      activeCardIndex,
    };
    writeSavedStudioSession(user, sessionData);
  }, [
    user,
    roomImage,
    roomFileName,
    imageSize,
    markedCorners,
    isMarkingMode,
    target,
    hasTarget,
    selectedCornerId,
    selectedId,
    isFlipped,
    flashcards,
    activeCardIndex,
  ]);

  // Cảnh báo khi người dùng CHƯA ĐĂNG NHẬP mà bấm F5 hoặc đóng trình duyệt
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!user && flashcards.length > 0) {
        e.preventDefault();
        e.returnValue = 'Bạn chưa đăng nhập. Nếu tải lại trang hoặc thoát, toàn bộ thẻ ảnh đã tạo sẽ bị mất!';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user, flashcards.length]);

  const clearGeneratedResult = () => {
    setResultImage('');
    setElapsedMs(null);
  };

  // Tải ảnh căn phòng (sử dụng FileReader để chuỗi ảnh được lưu bền vững qua session)
  const uploadRoom = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (!dataUrl) return;
      setRoomImage(dataUrl);
      setRoomFileName(file.name);
      setImageSize({ width: 0, height: 0 });
      setMarkedCorners([]);
      setIsMarkingMode(true);
      setTarget(initialTarget);
      setHasTarget(false);
      setSelectedCornerId(null);
      clearGeneratedResult();
      setActiveCardIndex(0);
      setMessage('Bước 1: Hãy bấm chuột vào các góc chân tường/mép sàn trên ảnh để đánh dấu các góc phòng của bạn.');
    };
    reader.readAsDataURL(file);
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
    setIsMarkingMode(false);
    clearGeneratedResult();
    setActiveCardIndex(0); // Đưa thẻ phòng thử lên đầu khi chọn góc
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

  // Hàm tải ảnh của Flashcard về máy tính
  const handleDownloadCard = (card, e) => {
    if (e) e.stopPropagation();
    if (!card || !card.image) return;
    const link = document.createElement('a');
    link.href = card.image;
    const cleanName = (card.productName || 'phong-thu')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-');
    link.download = `furneehome-${cleanName}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMessage(`Đã tải ảnh "${card.productName}" về máy thành công.`);
  };

  // Hàm xóa một Flashcard
  const handleDeleteCard = (cardIndexToDelete, e) => {
    if (e) e.stopPropagation();
    setFlashcards((prev) => {
      const next = prev.filter((_, idx) => idx !== cardIndexToDelete);
      if (activeCardIndex === cardIndexToDelete + 1) {
        setActiveCardIndex(next.length > 0 ? Math.min(cardIndexToDelete + 1, next.length) : 0);
      } else if (activeCardIndex > cardIndexToDelete + 1) {
        setActiveCardIndex(activeCardIndex - 1);
      }
      return next;
    });
    setLimitNotice('');
    setMessage('Đã xóa thẻ kết quả khỏi xấp thẻ.');
  };

  // Hàm làm mới toàn bộ phòng thử và xấp thẻ
  const handleResetSession = () => {
    if (window.confirm('Bạn có chắc muốn làm mới toàn bộ phòng thử và xóa xấp thẻ hiện tại không?')) {
      setRoomImage('');
      setRoomFileName('');
      setImageSize({ width: 0, height: 0 });
      setMarkedCorners([]);
      setIsMarkingMode(true);
      setTarget(initialTarget);
      setHasTarget(false);
      setSelectedCornerId(null);
      setFlashcards([]);
      setActiveCardIndex(0);
      clearGeneratedResult();
      try {
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        if (user) {
          localStorage.removeItem(getUserStorageKey(user));
        }
      } catch {}
      setMessage('Đã làm mới phòng thử thành công.');
    }
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
    setMessage('Đang tạo ảnh AI và xếp thêm thẻ mới vào xấp…');

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

      // Tự động lưu vào Collection
      saveRoomTemplate({
        name: `Bản chân thực với ${selectedProduct.name}${isFlipped ? ' (Lật gương)' : ''}`,
        productId: selectedProduct._id,
        productName: selectedProduct.name,
        target: normalizedPlacement,
        resultImage: finalImage,
      });

      // Tạo Thẻ xếp chồng mới cho ảnh vừa gen
      const newCard = {
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        image: finalImage,
        productName: selectedProduct.name,
        isFlipped,
        target: { ...normalizedPlacement },
        cornerLabel: selectedCornerId ? markedCorners.find((c) => c.id === selectedCornerId)?.label : 'Tự do',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        elapsedMs: result.elapsedMs,
      };

      // Cập nhật danh sách Thẻ (Tối đa 10 thẻ, từ thẻ 11 thẻ cũ nhất sẽ mất)
      setFlashcards((prev) => {
        let updated;
        if (prev.length >= MAX_FLASHCARDS) {
          // Xóa card cũ nhất ở đầu mảng (index 0) và thêm card mới vào cuối
          updated = [...prev.slice(1), newCard];
          setLimitNotice('⚠️ Đã đạt giới hạn tối đa 10 thẻ. Thẻ cũ nhất dưới đáy xấp đã được tự động loại bỏ để lưu thẻ mới.');
        } else {
          updated = [...prev, newCard];
          setLimitNotice('');
        }
        // Đưa Thẻ kết quả vừa tạo lên đỉnh của xấp thẻ
        setActiveCardIndex(updated.length);
        return updated;
      });

      setMessage('Đã thêm thẻ mới vào đỉnh xấp thẻ! Bạn có thể bấm vào thẻ bên dưới hoặc nút quay về phòng thử.');
    } catch (error) {
      clearGeneratedResult();
      setMessage('Ảnh AI chưa đạt hoặc không tạo được. Vẫn giữ bản xem sản phẩm đúng vị trí; bạn có thể thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const totalCardsCount = flashcards.length + 1; // Thẻ 0 (Studio) + các thẻ kết quả

  return (
    <main className="container page room-studio-page">
      <div className="page-heading split-heading">
        <div>
          <p className="eyebrow">ẢNH PHỐI CẢNH 3D</p>
          <h1>Phòng thử</h1>
          <p>Mỗi lần tạo ảnh sẽ xếp thêm 1 tấm mới vào xấp. Click vào các ảnh phía sau hoặc nút điều hướng để lật xem.</p>
        </div>
        <div className="privacy-note">
          <strong>Có thể lưu tối đa {MAX_FLASHCARDS} ảnh</strong>
          <span>Tấm ảnh thứ 11 sẽ thay thế ảnh cũ nhất.</span>
        </div>
      </div>

      {/* CẢNH BÁO / NHẮC NHỞ LƯU KHI CHƯA ĐĂNG NHẬP HOẶC ĐÃ LƯU TỰ ĐỘNG */}
      {!user && flashcards.length > 0 && (
        <div className="guest-save-banner">
          <div className="guest-save-content">
            <span className="guest-save-icon">⚠️</span>
            <div>
              <strong>Bạn chưa đăng nhập ({flashcards.length} ảnh trong phiên)</strong>
              <span>Nếu tải lại trang (F5) hoặc đóng trình duyệt, xấp ảnh sẽ bị mất. Hãy đăng nhập để lưu vĩnh viễn!</span>
            </div>
          </div>
          <button
            type="button"
            className="button button-small guest-save-btn"
            onClick={() => openLogin('login')}
          >
            🔑 Đăng nhập để lưu vĩnh viễn
          </button>
        </div>
      )}

      {user && flashcards.length > 0 && (
        <div className="user-saved-notice">
          <span>☁️ Đã lưu<strong>{flashcards.length} tấm ảnh</strong> vào tài khoản <strong>{user.name || user.email}</strong>.</span>
          <button
            type="button"
            className="text-button"
            onClick={handleResetSession}
            title="Xóa xấp ảnh hiện tại và làm mới phòng thử"
          >
            🔄 Làm mới phòng thử
          </button>
        </div>
      )}

      {/* THANH ĐIỀU HƯỚNG XẤP THẺ */}
      <div className="stack-deck-bar">
        <div className="stack-deck-header">
          <div className="stack-deck-title">
            <span className="step-label">XẤP ẢNH PHÒNG THỬ</span>
            <strong>
              {activeCardIndex === 0
                ? 'Đang ở đỉnh xấp: Ảnh Phòng thử & Chấm góc'
                : `🖼️ Đang ở đỉnh xấp: Ảnh kết quả #${activeCardIndex} (${flashcards[activeCardIndex - 1]?.productName})`}
            </strong>
          </div>
          
          <div className="stack-deck-controls">
            <span className="badge-count">
              {flashcards.length}/{MAX_FLASHCARDS} Tấm đã tạo
            </span>
            <button
              type="button"
              className={`button button-small ${activeCardIndex === 0 ? 'button-active' : 'button-secondary'}`}
              onClick={() => setActiveCardIndex(0)}
              title="Đưa thẻ phòng thử lên trên cùng để đổi góc / chọn đồ"
            >
              Đưa phòng thử lên đầu
            </button>
            <button
              type="button"
              className="button button-small button-secondary"
              disabled={activeCardIndex <= 0}
              onClick={() => setActiveCardIndex((prev) => Math.max(0, prev - 1))}
              title="Xem thẻ phía trước"
            >
              ❮
            </button>
            <span className="deck-page-pill">
              {activeCardIndex + 1} / {totalCardsCount}
            </span>
            <button
              type="button"
              className="button button-small button-secondary"
              disabled={activeCardIndex >= flashcards.length}
              onClick={() => setActiveCardIndex((prev) => Math.min(flashcards.length, prev + 1))}
              title="Xem thẻ phía sau"
            >
              ❯
            </button>
          </div>
        </div>

        {limitNotice && (
          <div className="flashcard-limit-alert">
            {limitNotice}
          </div>
        )}

        {/* THUMBNAIL LIST / PILLS DƯỚI THANH ĐIỀU HƯỚNG */}
        <div className="stack-deck-pills">
          <button
            type="button"
            className={`deck-pill ${activeCardIndex === 0 ? 'active' : ''}`}
            onClick={() => setActiveCardIndex(0)}
          >
            🏠 Phòng thử {roomImage ? '• Có ảnh' : ''}
          </button>
          {flashcards.map((c, i) => {
            const num = i + 1;
            return (
              <button
                key={c.id}
                type="button"
                className={`deck-pill ${activeCardIndex === num ? 'active' : ''}`}
                onClick={() => setActiveCardIndex(num)}
              >
                🖼️ Thẻ #{num}: {c.productName}
              </button>
            );
          })}
        </div>
      </div>

      <div className="studio-layout studio-layout-simple">
        {/* PANEL ĐIỀU KHIỂN BÊN TRÁI */}
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
                    onClick={() => {
                      setIsMarkingMode(!isMarkingMode);
                      setActiveCardIndex(0); // Hiện thẻ phòng thử khi bấm thao tác góc
                    }}
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
                  setActiveCardIndex(0);
                  setMessage('Hãy chọn một góc đã chấm hoặc chạm vào ảnh.');
                }}
              >
                Chọn lại vị trí
              </button>
            )}
          </section>

          {/* CHỌN SẢN PHẨM MUỐN THỬ */}
          <section className="product-picker-section">
            <span className="step-label">BƯỚC 3</span>
            <h2>Sản phẩm & Thao tác</h2>
            <div className="product-picker-compact-list">
              {products.map((product) => (
                <button
                  key={product._id}
                  type="button"
                  className={`product-compact-chip ${selectedProduct?._id === product._id ? 'active' : ''}`}
                  onClick={() => {
                    chooseProduct(product._id);
                    setActiveCardIndex(0);
                  }}
                >
                  <ProductArtwork product={product} />
                  <span>{product.name}</span>
                </button>
              ))}
            </div>

            <div className="studio-sidebar-actions">
              <button className="button button-large" type="button" onClick={previewRoom} disabled={isGenerating}>
                {isGenerating ? 'Đang tạo thẻ mới…' : '✨ Tạo thẻ xem thử (Xếp chồng)'}
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setIsFlipped(!isFlipped);
                  clearGeneratedResult();
                  setActiveCardIndex(0);
                }}
                title="Lật gương sản phẩm để đổi góc quay trái/phải phù hợp góc phòng"
              >
                ↔ Lật gương {isFlipped ? '(Đang lật)' : ''}
              </button>
            </div>
          </section>
        </aside>

        {/* KHU VỰC HIỂN THỊ XẤP THẺ XẾP CHỒNG (STACKED DECK STAGE) */}
        <section className="studio-workspace stack-deck-stage-area">
          <div className="deck-stack-wrapper">
            
            {/* THẺ 0: THẺ PHÒNG THỬ GỐC */}
            <div
              className={`stacked-card studio-card ${activeCardIndex === 0 ? 'is-top-card' : 'is-stacked-behind'}`}
              style={getCardStackStyle(0, activeCardIndex)}
              onClick={() => {
                if (activeCardIndex !== 0) setActiveCardIndex(0);
              }}
            >
              <div className="stacked-card-header">
                <div className="card-badge-label">
                  <span className="card-tag-num">🏠 GỐC</span>
                  <strong className="card-product-title">Phòng thử & Thiết lập góc</strong>
                </div>
                <div className="card-badge-state">
                  {activeCardIndex === 0 ? <span className="chip-badge">Đang thao tác</span> : <span className="peek-tag">Click để đưa lên đầu</span>}
                </div>
              </div>

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

                {/* Vẽ các đường nối nhẹ giữa các góc đã chấm */}
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

                {/* Các chấm góc người dùng đã đánh dấu */}
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

                {/* Live Preview sản phẩm tại vị trí đã chọn */}
                {roomImage && hasTarget && productImageSource && (
                  <img
                    className="room-product-preview"
                    src={productImageSource}
                    alt="Sản phẩm đang được đặt thử"
                    style={getProductPreviewStyle(selectedProduct, target, isFlipped)}
                    draggable="false"
                  />
                )}
                
                {/* Ghim định vị sản phẩm */}
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
                    
                  </button>
                )}
              </div>

              <div className="stacked-card-footer">
                <div className="studio-message" aria-live="polite">
                  {message || '👉 Chấm các góc phòng → Chọn sản phẩm & vị trí → Bấm tạo thẻ xem thử.'}
                </div>
              </div>
            </div>

            {/* CÁC THẺ KẾT QUẢ GEN ẢNH XẾP CHỒNG (CARD 1..N) */}
            {flashcards.map((card, idx) => {
              const cardNum = idx + 1;
              const isTop = activeCardIndex === cardNum;

              return (
                <div
                  key={card.id}
                  className={`stacked-card result-card ${isTop ? 'is-top-card' : 'is-stacked-behind'}`}
                  style={getCardStackStyle(cardNum, activeCardIndex)}
                  onClick={() => {
                    if (!isTop) setActiveCardIndex(cardNum);
                  }}
                >
                  <div className="stacked-card-header">
                    <div className="card-badge-label">
                      <span className="card-tag-num">THẺ #{cardNum}</span>
                      <strong className="card-product-title" title={card.productName}>
                        {card.productName}
                      </strong>
                    </div>
                    <div className="card-badge-state">
                      {isTop ? <span className="chip-badge">Đang xem</span> : <span className="peek-tag">Click để lật thẻ</span>}
                    </div>
                  </div>

                  <div className="stacked-card-visual">
                    <img
                      src={card.image}
                      alt={`Bản chân thực với ${card.productName}`}
                      className="stacked-card-img"
                    />

                    {/* TAG THÔNG TIN DƯỚI GÓC ẢNH (Có khoảng đệm chuẩn, không đè lên icon chấm) */}
                    <div className="stacked-photo-overlay-tag">
                      <span className="overlay-pin-dot" />
                      <span className="overlay-text">
                        {card.productName} {card.isFlipped ? '(Lật gương)' : ''} – {card.cornerLabel || 'Góc phòng đã chọn'}
                      </span>
                    </div>
                  </div>

                  <div className="stacked-card-actions">
                    <button
                      type="button"
                      className="button button-primary button-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCardIndex(0);
                      }}
                      title="Quay lại thẻ phòng thử để thử món đồ hoặc vị trí khác"
                    >
                      ← Đưa phòng thử lên đầu
                    </button>
                    
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={(e) => handleDownloadCard(card, e)}
                      title="Tải ảnh kết quả về máy"
                    >
                      ⬇️ Tải ảnh về máy
                    </button>

                    <button
                      type="button"
                      className="button-delete-card"
                      onClick={(e) => handleDeleteCard(idx, e)}
                      title="Xóa thẻ này khỏi xấp"
                    >
                      🗑️ Xóa thẻ
                    </button>

                    <span className="stacked-card-time">
                      🕒 {card.timestamp} {card.elapsedMs ? `(${card.elapsedMs}ms)` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
