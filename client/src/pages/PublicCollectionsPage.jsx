import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import roomDesignService from '../services/roomDesignService';

function getItems(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

export default function PublicCollectionsPage() {
  const [designs, setDesigns] = useState([]);
  const [state, setState] = useState('loading');
  useEffect(() => {
    roomDesignService.listPublic().then((data) => { setDesigns(getItems(data)); setState('ready'); }).catch(() => setState('error'));
  }, []);
  return <main className="container page">
    <div className="page-heading"><p className="eyebrow">CỘNG ĐỒNG FURNEEHOME</p><h1>Mẫu phòng công khai</h1><p>Xem cách mọi người sắp xếp nội thất và dùng một mẫu làm điểm bắt đầu cho căn phòng của bạn.</p></div>
    <div className="privacy-note"><strong>Chia sẻ có chủ động</strong><span>Chỉ khi chủ sở hữu bật công khai thì ảnh phòng, ảnh kết quả và cách sắp xếp mới xuất hiện để người khác xem và dùng lại.</span></div>
    {state === 'loading' && <p className="muted">Đang tải mẫu phòng…</p>}
    {state === 'error' && <p className="error-message" role="alert">Không thể tải mẫu công khai lúc này. Bạn có thể thử lại sau.</p>}
    {state === 'ready' && !designs.length && <div className="empty-state"><span className="empty-icon">▦</span><h2>Chưa có mẫu công khai</h2><p>Hãy quay lại sau hoặc tự tạo một mẫu trong Phòng thử.</p><Link className="button" to="/room-studio">Mở Phòng thử</Link></div>}
    {designs.length > 0 && <div className="collection-grid">{designs.map((design) => { const key = design.shareSlug || design._id || design.id; return <article className="saved-card room-saved-card" key={key}><div className="room-template-icon">{design.resultImage ? <img src={design.resultImage} alt={`Mẫu phòng ${design.name}`} /> : '▦'}</div><div><span className="category-label">MẪU CÔNG KHAI</span><h2>{design.name}</h2><p>{design.productName || 'Nhiều sản phẩm'}{design.creatorName ? ` · bởi ${design.creatorName}` : ''}</p></div><div className="saved-actions"><Link className="button" to={`/collections/public/${design.shareSlug || design._id}`}>Xem mẫu</Link></div></article>; })}</div>}
  </main>;
}
