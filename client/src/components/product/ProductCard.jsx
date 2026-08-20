import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../context/CollectionContext';
import ProductArtwork from './ProductArtwork';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { isProductSaved, toggleProduct } = useCollection();
  const saved = isProductSaved(product._id);

  const tryInRoom = () => {
    localStorage.setItem('furneehome-room-product', product._id);
    navigate('/room-studio');
  };

  const shopeeSearchUrl = product.shopeeSearchUrl
    || `https://shopee.vn/search?keyword=${encodeURIComponent(product.searchKeyword || product.name)}`;

  return (
    <article className="product-card">
      <div className="product-image-wrap"><ProductArtwork product={product} /></div>
      <div className="product-card-content">
        {product.isOfficial && (
          <div className="product-meta-tags">
            <span className="mall-badge">Mall Chính hãng</span>
          </div>
        )}
        <h3>{product.name}</h3>
        <div className="price-row">
          <span className="product-price">{new Intl.NumberFormat('vi-VN').format(product.price)} ₫</span>
          {product.rating && <span className="product-rating">⭐ {product.rating}</span>}
        </div>
        <div className="card-actions">
          <button className="button" type="button" onClick={tryInRoom}>Thử trong phòng</button>
          <a className="button button-secondary" href={product.sourceUrl || shopeeSearchUrl} target="_blank" rel="noreferrer">Xem trên Shopee</a>
          <button className={`icon-button ${saved ? 'is-saved' : ''}`} type="button" aria-label={saved ? 'Bỏ lưu' : 'Lưu sản phẩm'} onClick={() => toggleProduct(product)}>{saved ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>
  );
}
