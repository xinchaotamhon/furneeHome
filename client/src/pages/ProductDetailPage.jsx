import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductContext';
import reviewService from '../services/reviewService';
import { formatPrice } from '../utils/formatPrice';

function errorMessage(error) {
  return error.response?.data?.message || error.message || 'Không thể hoàn tất thao tác.';
}

function ReviewItem({ review, isAdmin, onModerate, onDelete }) {
  const [working, setWorking] = useState(false);
  const hide = async () => {
    const reason = window.prompt('Lý do ẩn đánh giá (không bắt buộc):', '') ?? '';
    setWorking(true);
    try { await onModerate(review._id, true, reason); } finally { setWorking(false); }
  };
  return (
    <article className="review-item">
      <strong>{review.user?.name || 'Khách hàng FurneeHome'}</strong>
      <span aria-label={`${review.rating} trên 5 sao`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
      <p>{review.comment}</p>
      <small>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</small>
      {isAdmin && <p>
        <button type="button" className="button button-text" disabled={working} onClick={hide}>Ẩn</button>
        <button type="button" className="button button-text" disabled={working} onClick={() => onDelete(review._id)}>Xóa</button>
      </p>}
    </article>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const { products, loading } = useProducts();
  const { addToCart } = useCart();
  const { user, openLogin } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [reviewNotice, setReviewNotice] = useState('');
  const product = products.find((item) => String(item._id || item.id) === id || item.slug === id);
  const productId = product?._id || product?.id;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const loadReviews = async () => {
    if (!productId) return;
    setReviewsLoading(true);
    try { setReviews(await reviewService.getReviews(productId)); } catch { setReviews([]); } finally { setReviewsLoading(false); }
  };

  useEffect(() => { loadReviews(); }, [productId]);

  if (loading) return <main className="container page"><div className="empty-state">Đang tải sản phẩm…</div></main>;
  if (!product) return <main className="container page"><div className="empty-state"><h1>Không tìm thấy sản phẩm</h1><Link className="button" to="/products">Về danh sách sản phẩm</Link></div></main>;

  const stock = Math.max(0, Number(product.stock ?? product.countInStock ?? 99));
  const category = typeof product.category === 'object' ? product.category?.name : (product.category || product.categoryName || 'Nội thất');
  const add = () => { const outcome = addToCart(product, quantity); setNotice(outcome?.ok === false ? outcome.message : 'Đã thêm vào giỏ hàng.'); };
  const submitReview = async (event) => {
    event.preventDefault();
    setReviewNotice('');
    try {
      await reviewService.addReview(productId, reviewForm);
      setReviewForm({ rating: 5, comment: '' });
      setReviewNotice('Đã gửi đánh giá. Cảm ơn bạn!');
      await loadReviews();
    } catch (error) { setReviewNotice(errorMessage(error)); }
  };
  const moderate = async (reviewId, isHidden, reason) => {
    try { await reviewService.moderateReview(reviewId, isHidden, reason); await loadReviews(); } catch (error) { setReviewNotice(errorMessage(error)); }
  };
  const removeReview = async (reviewId) => {
    if (!window.confirm('Xóa đánh giá này?')) return;
    try { await reviewService.deleteReview(reviewId); await loadReviews(); } catch (error) { setReviewNotice(errorMessage(error)); }
  };

  return <main className="container page detail-page">
    <Link className="back-link" to="/products">← Sản phẩm</Link>
    <section className="detail-grid">
      <div className="main-image-wrap"><ProductArtwork product={product} /></div>
      <div className="detail-info">
        <span className="category-tag">{category}</span><h1>{product.name}</h1><p className="current-price">{formatPrice(product.price)}</p>
        <p style={{ whiteSpace: 'pre-line' }}>
          {product.description || 'Sản phẩm nội thất thiết kế gọn gàng, phù hợp cho không gian sống hiện đại.'}
        </p>
        {Array.isArray(product.specifications) && product.specifications.length > 0 && <dl>{product.specifications.map((specification) => <div key={`${specification.name}-${specification.value}`}><dt>{specification.name}</dt><dd>{specification.value}</dd></div>)}</dl>}
        <p className={stock ? 'stock-badge in-stock' : 'stock-badge'}>{stock ? `Còn ${stock} sản phẩm` : 'Tạm hết hàng'}</p>
        {stock > 0 && <div className="detail-action-box">
          <label className="quantity-label">
            <span>Số lượng</span>
            <input
              type="number"
              min="1"
              max={stock}
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.min(stock, Math.max(1, Number(event.target.value) || 1))
                )
              }
            />
          </label>

          <button className="button add-cart-button" type="button" onClick={add}>
            Thêm vào giỏ
          </button>
        </div>}
        {notice && <p className="form-success" role="status">{notice}</p>}
        <div className="detail-links">
          <Link className="text-button" to="/room-studio" state={{ product }}>Thử sản phẩm trong phòng →</Link>
          <Link className="text-button" to="/feedback" state={{ type: 'report', product }}>Báo nội dung</Link>
        </div>
      </div>
    </section>
    <section className="product-reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading">Đánh giá từ khách hàng</h2>
      {reviewsLoading ? <p>Đang tải đánh giá…</p> : reviews.length ? reviews.map((review) => <ReviewItem key={review._id} review={review} isAdmin={isAdmin} onModerate={moderate} onDelete={removeReview} />) : <p>Chưa có đánh giá nào.</p>}
      {user ? <form onSubmit={submitReview} className="review-form">
        <h3>Viết đánh giá</h3>
        <label>Số sao <select value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: Number(event.target.value) }))}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} sao</option>)}</select></label>
        <label>Nhận xét <textarea required maxLength="1000" value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} /></label>
        <button className="button" type="submit">Gửi đánh giá</button>
        <p>Chỉ khách đã nhận sản phẩm mới có thể gửi đánh giá.</p>
      </form> : <p><button className="button button-outline" type="button" onClick={() => openLogin('login')}>Đăng nhập để viết đánh giá</button></p>}
      {reviewNotice && <p role="status">{reviewNotice}</p>}
    </section>
  </main>;
}
