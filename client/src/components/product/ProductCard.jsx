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
      {product.offers?.length > 0 && <div className="product-offers">
        {product.offers.map((offer) => <a href={offer.url} target="_blank" rel="noreferrer" key={offer.id} title={`Mở ${offer.name} trên Shopee`}>
          <span className="offer-thumb"><ProductArtwork product={offer} /></span>
          <span><small>{offer.name}</small><strong>{offer.displayPrice}</strong></span>
          <b aria-hidden="true">↗</b>
        </a>)}
      </div>}
      <div className="product-card-content">
        <span className="category-label">{product.category}</span>
        <h3>{product.name}</h3>
        <div className="card-actions">
          <button className="button" type="button" onClick={tryInRoom}>Thử trong phòng</button>
          <a className="button button-secondary" href={shopeeSearchUrl} target="_blank" rel="noreferrer">Tìm trên Shopee</a>
          <button className={`icon-button ${saved ? 'is-saved' : ''}`} type="button" aria-label={saved ? 'Bỏ lưu' : 'Lưu sản phẩm'} onClick={() => toggleProduct(product)}>{saved ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>
  );
}
