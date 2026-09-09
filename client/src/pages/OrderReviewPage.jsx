import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ProductArtwork from '../components/product/ProductArtwork';
import reviewService from '../services/reviewService';
import { formatPrice } from '../utils/formatPrice';

function StarRating({ value, onChange, disabled }) {
  return (
    <div className="order-review-stars" aria-label={`${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? 'active' : ''}
          onClick={() => onChange(star)}
          disabled={disabled}
          aria-label={`${star} sao`}
        >
          {star <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}
const messageOf = (error, fallback) => error.response?.data?.message || fallback;

export default function OrderReviewPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    reviewService.getOrderReviewStatus(orderId)
      .then((data) => {
        if (!active) return;
        setOrder(data);
        setForms(Object.fromEntries(data.items.map((item) => [item.productId, {
          rating: item.review?.rating || 5,
          comment: item.review?.comment || '',
          submitted: item.reviewed,
          sending: false,
          error: '',
        }])));
      })
      .catch((loadError) => {
        if (active) setError(messageOf(loadError, 'Không thể tải đơn hàng.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [orderId]);

  const updateForm = (productId, changes) => {
    setForms((current) => ({
      ...current,
      [productId]: { ...current[productId], ...changes },
    }));
  };

  async function submitReview(item) {
    const form = forms[item.productId];
    if (!form || form.submitted || form.sending) return;
    const comment = form.comment.trim();
    if (!comment) {
      updateForm(item.productId, { error: 'Vui lòng nhập nội dung đánh giá.' });
      return;
    }

    updateForm(item.productId, { sending: true, error: '' });
    try {
      await reviewService.addOrderReview(orderId, item.productId, {
        rating: form.rating,
        comment,
      });
      updateForm(item.productId, { submitted: true, sending: false });
    } catch (submitError) {
      updateForm(item.productId, {
        sending: false,
        error: messageOf(submitError, 'Không thể gửi đánh giá.'),
      });
    }
  }

  if (loading) return <main className="container page"><div className="empty-state">Đang tải đánh giá…</div></main>;

  if (error) {
    return (
      <main className="container page">
        <div className="empty-state">
          <h1>Không thể đánh giá</h1>
          <p>{error}</p>
          <button className="button" type="button" onClick={() => navigate('/orders')}>Về đơn hàng</button>
        </div>
      </main>
    );
  }

  if (!order) return null;

  return (
    <main className="container page order-review-page">
      <div className="page-heading">
        <p className="eyebrow">ĐÁNH GIÁ</p>
        <h1>Đánh giá đơn hàng</h1>
        <p>Mã đơn hàng: <strong>{order.orderNumber}</strong></p>
      </div>

      <section className="order-review-list">
        {order.items.map((item) => {
          const form = forms[item.productId];
          return (
            <article className={`order-review-card ${form?.submitted ? 'is-submitted' : ''}`} key={item.productId}>
              <div className="order-review-product">
                <div className="order-review-image">
                  <ProductArtwork product={{ image: item.image, name: item.name }} />
                </div>
                <div className="order-review-product-info">
                  <h2>{item.name}</h2>
                  <p>{formatPrice(item.price)} × {item.qty}</p>
                </div>
              </div>

              {form?.submitted ? (
                <div className="review-submitted">
                  <span className="review-check">✓</span>
                  <div>
                    <strong>Đã gửi đánh giá</strong>
                    <p>Cảm ơn bạn đã đánh giá sản phẩm.</p>
                  </div>
                </div>
              ) : (
                <div className="order-review-form">
                  <label htmlFor={`review-rating-${item.productId}`}>Số sao</label>
                  <StarRating
                    value={form?.rating || 5}
                    onChange={(rating) => updateForm(item.productId, { rating })}
                    disabled={form?.sending}
                  />
                  <label htmlFor={`review-comment-${item.productId}`}>Nhận xét</label>
                  <textarea
                    id={`review-comment-${item.productId}`}
                    rows="4"
                    maxLength="1000"
                    placeholder="Hãy chia sẻ trải nghiệm của bạn về sản phẩm..."
                    value={form?.comment || ''}
                    disabled={form?.sending}
                    onChange={(event) => updateForm(item.productId, {
                      comment: event.target.value,
                      error: '',
                    })}
                  />
                  {form?.error && <p className="form-error" role="alert">{form.error}</p>}
                  <button className="button" type="button" disabled={form?.sending} onClick={() => submitReview(item)}>
                    {form?.sending ? 'Đang gửi…' : 'Gửi đánh giá'}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <div className="order-review-bottom-actions">
        <Link className="button button-outline" to="/orders">Về đơn hàng</Link>
      </div>
    </main>
  );
}
