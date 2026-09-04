import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollection } from '../../context/CollectionContext';
import ProductArtwork from './ProductArtwork';

export default function ProductCard({ product, onReferenceImageError }) {
  const navigate = useNavigate();
  const { isProductSaved, toggleProduct } = useCollection();
  const saved = isProductSaved(product._id);
  const roomImage = product.transparentImage || product.image || '';
  const [hasReferenceImage, setHasReferenceImage] = useState(Boolean(roomImage));
  useEffect(() => setHasReferenceImage(Boolean(roomImage)), [roomImage]);

  const tryInRoom = () => {
    navigate('/room-studio', { state: { product } });
  };

  const shopeeSearchUrl = product.shopeeSearchUrl
    || product.sourceUrl
    || `https://shopee.vn/search?keyword=${encodeURIComponent(product.searchKeyword || product.name)}`;

  const categoryName = typeof product.category === 'object' && product.category?.name
    ? product.category.name
    : (product.category || product.categoryName || '');

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <ProductArtwork product={product} onImageError={() => {
          setHasReferenceImage(false);
          onReferenceImageError?.(product);
        }} />
      </div>
      <div className="product-card-content">
        <div className="product-meta-tags">
          {product.isOfficial && <span className="mall-badge">Mall</span>}
          {categoryName && <span className="category-tag">{categoryName}</span>}
        </div>
        <h3 title={product.name}>{product.name}</h3>
        <div className="price-row">
          <span className="product-price">
            {product.price > 0
              ? `${new Intl.NumberFormat('vi-VN').format(product.price)} ₫`
              : 'Giá sinh viên'}
          </span>
          {product.rating ? <span className="product-rating">⭐ {product.rating}</span> : null}
        </div>
        <div className="card-actions">
          <button className="button" type="button" onClick={tryInRoom} disabled={!hasReferenceImage} title={hasReferenceImage ? 'Đưa sản phẩm vào phòng thử AI' : 'Admin cần thêm ảnh trước'}>{hasReferenceImage ? 'Thử phòng' : 'Chưa có ảnh'}</button>
          <a className="button button-secondary" href={product.sourceUrl || shopeeSearchUrl} target="_blank" rel="noreferrer" title="Xem trên Shopee">Shopee ↗</a>
          <button className={`icon-button ${saved ? 'is-saved' : ''}`} type="button" aria-label={saved ? 'Bỏ lưu' : 'Lưu sản phẩm'} onClick={() => toggleProduct(product)}>{saved ? '♥' : '♡'}</button>
        </div>
      </div>
    </article>
  );
}
