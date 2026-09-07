import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../context/CollectionContext';
import roomDesignService from '../services/roomDesignService';

function getItems(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'FH';
}

function CreatorAvatar({ creator = {}, compact = false }) {
  return <span className={`public-avatar${compact ? ' compact' : ''}`} aria-hidden="true">
    {creator.avatarUrl ? <img src={creator.avatarUrl} alt="" /> : initials(creator.name)}
  </span>;
}

export default function PublicCollectionsPage() {
  const { creatorId } = useParams();
  const { user, openLogin } = useAuth();
  const { addRemoteRoomTemplate } = useCollection();
  const [designs, setDesigns] = useState([]);
  const [state, setState] = useState('loading');
  const [notice, setNotice] = useState('');
  const [savingId, setSavingId] = useState('');

  useEffect(() => {
    let active = true;
    setState('loading');
    setNotice('');
    const request = creatorId
      ? roomDesignService.listPublicByCreator(creatorId)
      : roomDesignService.listPublic();
    request.then((data) => {
      if (!active) return;
      setDesigns(getItems(data));
      setState('ready');
    }).catch(() => {
      if (active) setState('error');
    });
    return () => { active = false; };
  }, [creatorId, user?.id]);

  const toggleLike = async (event, design) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      setNotice('Đăng nhập để thả tim và lưu mẫu vào bộ sưu tập của bạn.');
      openLogin('login');
      return;
    }
    try {
      const updated = await roomDesignService.toggleLike(design._id);
      setDesigns((current) => current.map((item) => (item._id === updated._id ? { ...item, ...updated } : item)));
    } catch {
      setNotice('Chưa thể cập nhật lượt thích. Hãy thử lại sau.');
    }
  };

  const saveDesign = async (event, design) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      openLogin('login');
      return;
    }
    setSavingId(design._id);
    setNotice('');
    try {
      const fork = await roomDesignService.reuse(design._id);
      addRemoteRoomTemplate(fork);
      setNotice('Đã lưu mẫu vào Bộ sưu tập.');
    } catch {
      setNotice('Chưa thể lưu mẫu. Hãy thử lại.');
    } finally {
      setSavingId('');
    }
  };

  const creator = designs[0]?.creator;
  const heading = creatorId && creator ? `Mẫu của ${creator.name}` : 'Mẫu phòng công khai';
  return <main className="container page public-gallery-page">
    <div className="page-heading fh-public-heading">
      <div><p className="eyebrow">MẪU CÔNG KHAI</p><h1>{heading}</h1></div>
      {creatorId ? <Link className="button button-secondary" to="/collections/public">← Tất cả mẫu</Link> : (user ? <Link className="button button-secondary" to="/collection">Mẫu của tôi</Link> : <button className="button button-secondary" type="button" onClick={() => openLogin('register')}>Đăng nhập</button>)}
    </div>
    {notice && <p className="studio-message" aria-live="polite">{notice}</p>}
    {state === 'loading' && <p className="muted">Đang tải mẫu phòng…</p>}
    {state === 'error' && <p className="error-message" role="alert">Không thể tải mẫu công khai lúc này. Bạn có thể thử lại sau.</p>}
    {state === 'ready' && !designs.length && <div className="empty-state"><span className="empty-icon">▦</span><h2>{creatorId ? 'Tác giả này chưa có mẫu công khai' : 'Chưa có mẫu công khai'}</h2><p>Hãy quay lại sau hoặc tự tạo một mẫu trong Phòng thử.</p><Link className="button" to="/room-studio">Mở Phòng thử</Link></div>}
    {designs.length > 0 && <section className="public-gallery-grid" aria-label="Các mẫu phòng công khai">{designs.map((design) => {
      const key = design.shareSlug || design._id || design.id;
      const designCreator = design.creator || { id: design.user, name: design.creatorName, avatarUrl: design.creatorAvatar };
      return <article className="public-design-card" key={key}>
        <Link className="public-design-image" to={`/collections/public/${design.shareSlug || design._id}`} aria-label={`Xem mẫu ${design.name}`}>
          {design.previewImage ? <img src={design.previewImage} alt={`Mẫu phòng ${design.name}`} /> : <span>▦</span>}
          {design.lineage?.isFork && <small>Biến thể</small>}
        </Link>
        <div className="public-design-content">
          <div className="public-design-meta"><span>{design.designMode === 'inspiration' ? 'Ý TƯỞNG AI' : 'BỐ CỤC PHÒNG'}</span><div className="public-card-actions"><button type="button" disabled={savingId === design._id} onClick={(event) => saveDesign(event, design)}>{savingId === design._id ? 'Đang lưu…' : 'Lưu'}</button><button className={`public-like${design.likedByMe ? ' liked' : ''}`} type="button" aria-label={design.likedByMe ? 'Bỏ thích mẫu này' : 'Thích mẫu này'} aria-pressed={Boolean(design.likedByMe)} onClick={(event) => toggleLike(event, design)}>♥ <b>{design.likeCount || 0}</b></button></div></div>
          <Link to={`/collections/public/${design.shareSlug || design._id}`}><h2>{design.name}</h2></Link>
          <p>{design.productName || `${(design.placements || design.inspirationProducts || []).length} sản phẩm trong không gian`}</p>
          {designCreator.id ? <Link className="public-creator" to={`/collections/public/creator/${designCreator.id}`}><CreatorAvatar creator={designCreator} compact /><span>{designCreator.name || 'Thành viên FurneeHome'}</span></Link> : <span className="public-creator"><CreatorAvatar creator={designCreator} compact /><span>{designCreator.name || 'Thành viên FurneeHome'}</span></span>}
        </div>
      </article>;
    })}</section>}
  </main>;
}
