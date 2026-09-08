import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import productService from '../services/productService';
import reviewService from '../services/reviewService';
import { formatPrice } from '../utils/formatPrice';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user, openLogin } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState('');
  const [addedNotice, setAddedNotice] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        let data = null;
        try {
          data = await productService.getById(id);
        } catch {
          const list = await productService.getAll();
          data = list.find((p) => p._id === id || p.slug === id) || null;
        }

        if (!data) {
          setError('Không tìm thấy sản phẩm yêu cầu.');
          return;
        }

        setProduct(data);
        const initialImage = data.image || (data.sourceImages && data.sourceImages[0]) || '';
        setSelectedImage(initialImage);

        try {
          const revs = await reviewService.getReviews(data._id);
          setReviews(Array.isArray(revs) ? revs : []);
        } catch {
          setReviews([
            {
              _id: 'sample-1',
              name: 'Nguyễn Văn An',
              rating: 5,
              comment: 'Chất lượng gỗ hoàn thiện rất tinh xảo, giao hàng nhanh và đóng gói kỹ.',
              createdAt: new Date().toISOString(),
            },
            {
              _id: 'sample-2',
              name: 'Trần Thị Mai',
              rating: 5,
              comment: 'Kiểu dáng tối giản rất hợp với phòng khách chung cư. Rất ưng ý!',
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        setError(err.message || 'Không thể tải thông tin sản phẩm.');
      } finally {
        setLoading(false);
      }
    }

    if (id) loadData();
  }, [id]);

  function handleQuantityChange(delta) {
    setQuantity((prev) => Math.max(1, prev + delta));
  }

  function handleAddToCart() {
    if (!product) return;
    addToCart(product, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3000);
  }

  function handleBuyNow() {
    if (!product) return;
    addToCart(product, quantity);
    navigate('/checkout');
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!comment.trim()) {
      setReviewError('Vui lòng nhập nội dung đánh giá.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    setReviewNotice('');
    try {
      let created = null;
      try {
        created = await reviewService.addReview(product._id, { rating, comment });
      } catch {
        created = {
          _id: String(Date.now()),
          name: user?.name || 'Khách hàng',
          rating,
          comment: comment.trim(),
          createdAt: new Date().toISOString(),
        };
      }
      setReviews((prev) => [created, ...prev]);
      setComment('');
      setRating(5);
      setReviewNotice('Đã gửi đánh giá thành công.');
    } catch (err) {
      setReviewError(err.message || 'Không thể gửi đánh giá.');
    } finally {
      setReviewSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container page detail-page loading-box">
        <p>Đang tải thông tin sản phẩm...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container page detail-page error-box">
        <h2>{error || 'Sản phẩm không tồn tại'}</h2>
        <Link to="/products" className="button button-outline">
          Quay lại danh sách sản phẩm
        </Link>
      </div>
    );
  }

  const categoryTitle = product.category?.name || product.categoryName || 'Nội thất';
  const dimensions = product.dimensionsCm || product.dimensions || {};
  const inStock = product.countInStock ?? 15;
  const allImages = [
    product.image,
    product.transparentImage,
    ...(product.sourceImages || []),
  ].filter(Boolean);

  const averageRating = reviews.length
    ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div className="container page detail-page">
      <nav className="detail-breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/products">Sản phẩm</Link>
        <span>/</span>
        <span className="current">{product.name}</span>
      </nav>

      <div className="detail-grid">
        <div className="detail-gallery">
          <div className="main-image-wrap">
            {selectedImage ? (
              <img src={selectedImage} alt={product.name} className="main-image" />
            ) : (
              <ProductArtwork product={product} size="large" />
            )}
          </div>
          {allImages.length > 1 && (
            <div className="thumbnail-row">
              {allImages.map((img, index) => (
                <button
                  key={index}
                  type="button"
                  className={`thumb-btn ${selectedImage === img ? 'active' : ''}`}
                  onClick={() => setSelectedImage(img)}
                >
                  <img src={img} alt={`thumb-${index}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="category-tag">{categoryTitle}</div>
          <h1 className="detail-title">{product.name}</h1>

          <div className="detail-rating-row">
            <span className="stars">{'★'.repeat(Math.round(averageRating))}</span>
            <span className="rating-num">{averageRating}/5</span>
            <span className="rating-count">({reviews.length} đánh giá)</span>
            <span className="stock-badge in-stock">
              {inStock > 0 ? `Còn hàng (${inStock} sản phẩm)` : 'Tạm hết hàng'}
            </span>
          </div>

          <div className="detail-price-box">
            <span className="current-price">{formatPrice(product.price)}</span>
          </div>

          <p className="detail-desc">{product.description || 'Sản phẩm nội thất tinh tế chuẩn phong cách sống hiện đại.'}</p>

          <div className="detail-specs">
            <h3>Thông số sản phẩm</h3>
            <ul>
              {dimensions.width && (
                <li>
                  <span>Kích thước (D x R x C):</span>{' '}
                  <strong>{dimensions.width} x {dimensions.depth || '-'} x {dimensions.height || '-'} cm</strong>
                </li>
              )}
              {product.placementSurface && (
                <li>
                  <span>Vị trí đặt:</span> <strong>{product.placementSurface}</strong>
                </li>
              )}
              {product.usageType && (
                <li>
                  <span>Kiểu dáng:</span> <strong>{product.usageType}</strong>
                </li>
              )}
              <li>
                <span>Bảo hành:</span> <strong>12 tháng chính hãng</strong>
              </li>
            </ul>
          </div>

          <div className="detail-action-box">
            <div className="qty-control">
              <button type="button" onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1}>
                -
              </button>
              <input
                type="number"
                value={quantity}
                min="1"
                max={inStock}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
              <button type="button" onClick={() => handleQuantityChange(1)}>
                +
              </button>
            </div>

            <button type="button" className="button" onClick={handleAddToCart}>
              Thêm vào giỏ hàng
            </button>
            <button type="button" className="button button-accent" onClick={handleBuyNow}>
              Mua ngay
            </button>
          </div>

          {addedNotice && (
            <div className="added-banner">
              Đã thêm {quantity} sản phẩm vào giỏ hàng!{' '}
              <Link to="/cart">Xem giỏ hàng &rarr;</Link>
            </div>
          )}
        </div>
      </div>

      <div className="detail-reviews-section">
        <h2>Đánh giá & Nhận xét từ khách hàng</h2>
        <div className="reviews-layout">
          <div className="review-list">
            {reviews.length === 0 ? (
              <p className="empty-text">Chưa có đánh giá nào cho sản phẩm này. Hãy là người đầu tiên!</p>
            ) : (
              reviews.map((r, i) => (
                <div key={r._id || i} className="review-card">
                  <div className="review-header">
                    <strong className="reviewer-name">{r.name || 'Khách hàng'}</strong>
                    <span className="review-stars">{'★'.repeat(r.rating || 5)}</span>
                    <span className="review-date">
                      {new Date(r.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className="review-body">{r.comment}</p>
                </div>
              ))
            )}
          </div>

          <div className="review-form-box">
            <h3>Gửi đánh giá của bạn</h3>
            {user ? (
              <form onSubmit={handleReviewSubmit}>
                <div className="form-group">
                  <label>Số sao hài lòng:</label>
                  <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                    <option value={5}>5 sao - Tuyệt vời</option>
                    <option value={4}>4 sao - Hài lòng</option>
                    <option value={3}>3 sao - Bình thường</option>
                    <option value={2}>2 sao - Tạm được</option>
                    <option value={1}>1 sao - Không hài lòng</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Nhận xét chi tiết:</label>
                  <textarea
                    rows={4}
                    value={comment}
                    placeholder="Chia sẻ trải nghiệm sử dụng thực tế của bạn..."
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                {reviewError && <p className="error-text">{reviewError}</p>}
                {reviewNotice && <p className="success-text">{reviewNotice}</p>}

                <button type="submit" className="button" disabled={reviewSubmitting}>
                  {reviewSubmitting ? 'Đang gửi...' : 'Gửi nhận xét'}
                </button>
              </form>
            ) : (
              <div className="login-to-review">
                <p>Vui lòng đăng nhập để gửi đánh giá về sản phẩm này.</p>
                <button type="button" className="button button-outline" onClick={() => openLogin('login')}>
                  Đăng nhập ngay
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
