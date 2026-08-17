import { Link, useNavigate } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useCollection } from '../context/CollectionContext';
import { formatPrice } from '../utils/formatPrice';

export default function CollectionPage() {
  const { items, removeItem } = useCollection();
  const navigate = useNavigate();

  const getSavedTarget = (item) => item.target || item.placement || { x: 50, y: 50 };

  const tryProduct = (product) => {
    localStorage.setItem('furneehome-room-product', product._id);
    navigate('/room-studio');
  };

  return (
    <main className="container page">
      <div className="page-heading"><p className="eyebrow">KHÔNG PHẢI GIỎ HÀNG</p><h1>Bộ sưu tập của bạn</h1><p>Lưu những sản phẩm bạn thích và những mẫu phòng bạn đã tự sắp xếp.</p></div>
      {!items.length ? (
        <div className="empty-state collection-empty">
          <span className="empty-icon">♡</span>
          <h2>Bộ sưu tập đang trống</h2>
          <p>Khi gặp một món đồ phù hợp, hãy bấm biểu tượng trái tim để xem lại sau.</p>
          <Link className="button" to="/products">Khám phá sản phẩm</Link>
        </div>
      ) : (
        <div className="collection-grid">
          {items.map((item) => item.type === 'product' ? (
            <article className="saved-card" key={item.id}>
              <div className="saved-visual"><ProductArtwork product={item.product} /></div>
              <div><span className="category-label">SẢN PHẨM ĐÃ LƯU</span><h2>{item.product.name}</h2><p>{item.product.dimensions}</p><strong>{formatPrice(item.product.price)}</strong></div>
              <div className="saved-actions"><button className="button" type="button" onClick={() => tryProduct(item.product)}>Thử trong phòng</button><button className="text-button danger" type="button" onClick={() => removeItem(item.id)}>Bỏ lưu</button></div>
            </article>
          ) : (
            <article className="saved-card room-saved-card" key={item.id}>
              <div className="room-template-icon">▦</div>
              <div><span className="category-label">MẪU PHÒNG CỦA BẠN</span><h2>{item.name}</h2><p>{item.productName} · vị trí {Math.round(getSavedTarget(item).x)}%, {Math.round(getSavedTarget(item).y)}%</p><small className="muted">Ảnh phòng không được lưu vào dữ liệu thử để tránh đầy bộ nhớ trình duyệt.</small></div>
              <div className="saved-actions"><Link className="button" to="/room-studio">Mở Phòng thử</Link><button className="text-button danger" type="button" onClick={() => removeItem(item.id)}>Xóa mẫu</button></div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
