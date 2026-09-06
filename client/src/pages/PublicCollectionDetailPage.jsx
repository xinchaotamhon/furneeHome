import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import roomDesignService from '../services/roomDesignService';

const HANDOFF_KEY = 'furneehome-room-design-to-open';

function restorePlacementSnapshot(placement = {}) {
  const productFacts = placement.productFacts || {};
  const existingProduct = placement.product || {};
  return {
    ...placement,
    productFacts,
    product: {
      _id: existingProduct._id || placement.productId,
      id: existingProduct.id || placement.productId,
      name: existingProduct.name || placement.productName || 'Sản phẩm nội thất',
      image: existingProduct.image || placement.image || '',
      transparentImage: existingProduct.transparentImage || placement.transparentImage || '',
      ...existingProduct,
      ...productFacts,
    },
  };
}

function saveHandoff(item) {
  const target = item.target || { x: 0.5, y: 0.72 };
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
    selectedId: item.productId || item.product?._id || '',
    target: { x: target.x <= 1 ? target.x * 100 : target.x, y: target.y <= 1 ? target.y * 100 : target.y },
    hasTarget: true,
    resultImage: item.resultImage || '',
    designMode: item.designMode || 'placement',
    imageSize: item.imageSize,
    resultInfo: { model: item.model || '', elapsedMs: item.elapsedMs },
    elapsedMs: item.elapsedMs,
    roomImage: item.roomImage || '',
    roomFileName: item.roomFileName || '',
    roomRequest: item.userPrompt || '',
    designBrief: item.designBrief || {},
    inspirationProducts: item.inspirationProducts || [],
    scaleReference: item.scaleReference || null,
    markedCorners: item.markedCorners || [],
    sceneItems: (item.placements || item.sceneItems || item.items || []).map(restorePlacementSnapshot),
  }));
}

export default function PublicCollectionDetailPage() {
  const { shareSlug } = useParams();
  const { user, openLogin, openRegister } = useAuth();
  const navigate = useNavigate();
  const [design, setDesign] = useState(null);
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');
  useEffect(() => { roomDesignService.getPublic(shareSlug).then((data) => { setDesign(data); setState('ready'); }).catch(() => setState('error')); }, [shareSlug]);

  const useTemplate = async () => {
    if (!design) return;
    setMessage('');
    if (user && design._id) {
      try {
        const reused = await roomDesignService.reuse(design._id);
        saveHandoff(reused || design);
        navigate('/room-studio');
        return;
      } catch {
        setMessage('Chưa thể sao chép vào tài khoản, nhưng bạn vẫn có thể mở mẫu trên thiết bị này.');
      }
    } else if (!user) {
      setMessage('Bạn có thể mở mẫu này ngay trên thiết bị. Đăng nhập nếu muốn lưu bản sao vào tài khoản.');
    }
    saveHandoff(design);
    navigate('/room-studio');
  };

  if (state === 'loading') return <main className="container page"><p className="muted">Đang tải mẫu phòng…</p></main>;
  if (state === 'error' || !design) return <main className="container page"><div className="empty-state"><h1>Không tìm thấy mẫu phòng</h1><p>Mẫu có thể đã bị xóa hoặc chuyển về riêng tư.</p><Link className="button" to="/collections/public">Quay lại khám phá</Link></div></main>;
  const products = design.designMode === 'inspiration'
    ? (design.inspirationProducts || [])
    : (design.placements || design.sceneItems || design.items || design.products || []);
  return <main className="container page">
    <div className="page-heading"><p className="eyebrow">MẪU PHÒNG CÔNG KHAI</p><h1>{design.name}</h1><p>{design.creatorName ? `Được ${design.creatorName} tự chọn chia sẻ.` : 'Một mẫu sắp xếp nội thất từ cộng đồng FurneeHome.'}</p></div>
    <div className="privacy-note"><strong>Thông tin công khai</strong><span>Chủ mẫu đã chọn chia sẻ ảnh phòng, ảnh kết quả và cách sắp xếp. Bạn có thể tạo một bản sao riêng mà không làm thay đổi mẫu gốc.</span></div>
    {(design.resultImage || design.roomImage) && <div className="room-template-preview"><img src={design.resultImage || design.roomImage} alt={`Bản xem trước ${design.name}`} /></div>}
    {design.designMode === 'inspiration' && <p className="privacy-note">Ý tưởng AI từ {products.length} sản phẩm ngẫu nhiên.</p>}
    <section className="saved-card"><div><span className="category-label">NỘI THẤT TRONG MẪU</span><h2>{design.productName || 'Danh sách sản phẩm'}</h2>{products.length > 0 && <ul>{products.map((product, index) => <li key={product._id || product.id || index}>{product.name || product.productName || product.title || 'Sản phẩm nội thất'}</li>)}</ul>}<p className="muted">Đã lưu {products.length} sản phẩm{design.scaleReference ? `, mốc tỷ lệ ${design.scaleReference.lengthCm} cm` : ''}{design.userPrompt ? ' và mô tả mong muốn' : ''}.</p></div><div className="saved-actions"><button className="button" type="button" onClick={useTemplate}>Dùng mẫu này</button>{!user && <><button className="button button-secondary" type="button" onClick={() => openLogin('login')}>Đăng nhập để lưu bản sao</button><button className="text-button" type="button" onClick={openRegister}>Chưa có tài khoản? Tạo miễn phí</button></>}<Link className="text-button" to="/collections/public">← Xem mẫu khác</Link></div></section>
    {message && <p className="studio-message" aria-live="polite">{message}</p>}
  </main>;
}
