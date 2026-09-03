import { Link, useNavigate } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import { formatPrice } from '../utils/formatPrice';

const HANDOFF_KEY = 'furneehome-room-design-to-open';

function targetText(item) {
  const target = item.target || { x: 0.5, y: 0.72 };
  const x = target.x <= 1 ? target.x * 100 : target.x;
  const y = target.y <= 1 ? target.y * 100 : target.y;
  return `${Math.round(x)}%, ${Math.round(y)}%`;
}

function saveHandoff(item) {
  const target = item.target || { x: 0.5, y: 0.72 };
  localStorage.setItem(HANDOFF_KEY, JSON.stringify({
    selectedId: item.productId || item.product?._id || '',
    target: {
      x: target.x <= 1 ? target.x * 100 : target.x,
      y: target.y <= 1 ? target.y * 100 : target.y,
    },
    hasTarget: true,
    resultImage: item.resultImage || '',
    roomImage: item.roomImage || '',
    roomFileName: item.roomFileName || '',
    markedCorners: item.markedCorners || [],
    sceneItems: item.placements || item.sceneItems || item.items || [],
  }));
}

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
  return Promise.resolve();
}

export default function CollectionPage() {
  const {
    items,
    removeItem,
    updateRoomTemplate,
    isLoadingDesigns,
    syncMessage,
    syncError,
  } = useCollection();
  const navigate = useNavigate();
  const products = items.filter((item) => item.type === 'product');
  const designs = items.filter((item) => item.type === 'room-template');

  const openDesign = (item) => {
    saveHandoff(item);
    navigate('/room-studio');
  };

  const shareDesign = async (item) => {
    if (item.visibility === 'public' && item.shareSlug) {
      await copyText(`${window.location.origin}/collections/public/${item.shareSlug}`);
      window.alert('Đã sao chép liên kết chia sẻ.');
      return;
    }

    const updated = await updateRoomTemplate(item.id, { visibility: 'public' });
    if (updated?.shareSlug) {
      await copyText(`${window.location.origin}/collections/public/${updated.shareSlug}`);
      window.alert('Đã công khai mẫu và sao chép liên kết.');
    }
  };

  return <main className="container page">
    <div className="page-heading split-heading">
      <div>
        <p className="eyebrow">KHÔNG PHẢI GIỎ HÀNG</p>
        <h1>Bộ sưu tập của bạn</h1>
        <p>Lưu món đồ yêu thích và những mẫu phòng bạn đã tự sắp xếp.</p>
      </div>
      <Link className="button button-secondary" to="/collections/public">Khám phá mẫu công khai</Link>
    </div>

    <div className="privacy-note">
      <strong>Quyền riêng tư</strong>
      <span>Mẫu phòng chỉ được chia sẻ khi bạn chủ động bấm “Chia sẻ”.</span>
    </div>
    {isLoadingDesigns && <p className="muted" aria-live="polite">Đang tải mẫu phòng từ tài khoản…</p>}
    {syncMessage && <p className="studio-message" aria-live="polite">{syncMessage}</p>}
    {syncError && <p className="error-message" role="alert">{syncError}</p>}

    <section>
      <div className="section-heading">
        <div><span className="eyebrow">SẢN PHẨM</span><h2>Món đồ đã lưu ({products.length})</h2></div>
      </div>
      {products.length ? <div className="collection-grid">
        {products.map((item) => <article className="saved-card" key={item.id}>
          <div className="saved-visual"><ProductArtwork product={item.product} /></div>
          <div>
            <span className="category-label">SẢN PHẨM ĐÃ LƯU</span>
            <h2>{item.product.name}</h2>
            <p>{item.product.dimensions}</p>
            <strong>{formatPrice(item.product.price)}</strong>
          </div>
          <div className="saved-actions">
            <button className="button" type="button" onClick={() => {
              localStorage.setItem('furneehome-room-product', item.product._id);
              navigate('/room-studio');
            }}>Thử trong phòng</button>
            <button className="text-button danger" type="button" onClick={() => removeItem(item.id)}>Bỏ lưu</button>
          </div>
        </article>)}
      </div> : <p className="muted">Chưa có sản phẩm yêu thích. <Link to="/products">Khám phá sản phẩm</Link></p>}
    </section>

    <section>
      <div className="section-heading">
        <div><span className="eyebrow">MẪU PHÒNG</span><h2>Thiết kế đã lưu ({designs.length})</h2></div>
      </div>
      {designs.length ? <div className="collection-grid">
        {designs.map((item) => <article className="saved-card room-saved-card" key={item.id}>
          <div className="room-template-icon">
            {item.resultImage ? <img src={item.resultImage} alt={`Mẫu phòng ${item.name}`} /> : '▦'}
          </div>
          <div>
            <span className="category-label">{item.visibility === 'public' ? 'ĐANG CÔNG KHAI' : 'MẪU RIÊNG TƯ'}</span>
            <h2>{item.name}</h2>
            <p>{item.productName} · vị trí {targetText(item)}</p>
            {item.syncStatus === 'local' && <small className="muted">Chỉ lưu trên thiết bị này vì chưa đồng bộ được tài khoản.</small>}
          </div>
          <div className="saved-actions">
            <button className="button" type="button" onClick={() => openDesign(item)}>Mở Phòng thử</button>
            {item._id && <button className="button button-secondary" type="button" onClick={() => shareDesign(item)}>
              {item.visibility === 'public' ? 'Sao chép link' : 'Chia sẻ công khai'}
            </button>}
            {item.visibility === 'public' && <button className="text-button" type="button" onClick={() => updateRoomTemplate(item.id, { visibility: 'private' })}>Đặt riêng tư</button>}
            <button className="text-button danger" type="button" onClick={() => removeItem(item.id)}>Xóa mẫu</button>
          </div>
        </article>)}
      </div> : <p className="muted">Chưa có mẫu phòng. Hãy thử một sản phẩm trong <Link to="/room-studio">Phòng thử</Link>.</p>}
    </section>
  </main>;
}
