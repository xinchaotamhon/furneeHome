import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useCollection } from '../../context/CollectionContext';
import { formatPrice } from '../../utils/formatPrice';
import ProductArtwork from './ProductArtwork';

export default function ProductCard({ product, onReferenceImageError }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isProductSaved, toggleProduct } = useCollection();
  const saved = isProductSaved(product._id || product.id);
  const roomImage = product.transparentImage || product.image || product.sourceImages?.[0] || '';
  const [hasReferenceImage, setHasReferenceImage] = useState(Boolean(roomImage));
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => setHasReferenceImage(Boolean(roomImage)), [roomImage]);

  const tryInRoom = (e) => {
    e.stopPropagation();
    navigate('/room-studio', { state: { product } });
  };

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  const categoryName = typeof product.category === 'object' && product.category?.name
    ? product.category.name
    : (product.category || product.categoryName || '');

  const productId = product._id || product.id;

  return (
    <article className="product-card">
      <Link to={`/products/${productId}`} className="product-image-wrap">
        <ProductArtwork
          product={product}
          onImageError={() => {
            setHasReferenceImage(false);
            onReferenceImageError?.(product);
          }}
        />
      </Link>
      <div className="product-card-content">
        <div className="product-meta-tags">
          {categoryName && <span className="category-tag">{categoryName}</span>}
        </div>
        <h3>
          <Link to={`/products/${productId}`} className="product-card-title-link">
            {product.name}
          </Link>
        </h3>
        <div className="price-row">
          <span className="product-price">{formatPrice(product.price)}</span>
        </div>
        <div className="card-actions">
          <button
            className={`button ${justAdded ? 'button-accent' : ''}`}
            type="button"
            onClick={handleQuickAdd}
          >
            {justAdded ? 'Đã thêm ✓' : 'Thêm giỏ'}
          </button>
          <button
            className="button button-outline"
            type="button"
            onClick={tryInRoom}
            disabled={!hasReferenceImage}
          >
            {hasReferenceImage ? 'Thử phòng' : 'Chưa có ảnh'}
          </button>
          <button
            className={`button button-secondary ${saved ? 'is-saved' : ''}`}
            type="button"
            onClick={() => toggleProduct(product)}
            title="Lưu vào bộ sưu tập"
          >
            {saved ? '♥ Đã lưu' : '♡ Lưu'}
          </button>
        </div>
      </div>
    </article>
  );
}
