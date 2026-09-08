import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import reviewService from '../services/reviewService';
import ProductArtwork from '../components/product/ProductArtwork';
import { formatPrice } from '../utils/formatPrice';

function StarRating({ value, onChange, disabled }) {
  return (
    <div className="order-review-stars">
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

export default function OrderReviewPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');

        const data =
          await reviewService.getOrderReviewStatus(orderId);

        setOrder(data);

        const initialForms = {};

        data.items.forEach((item) => {
          initialForms[item.productId] = {
            rating: item.review?.rating || 5,
            comment: item.review?.comment || '',
            submitted: item.reviewed,
            sending: false,
            error: '',
          };
        });

        setForms(initialForms);
      } catch (err) {
        setError(
          err.response?.data?.message ||
          'Không thể tải đơn hàng.'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [orderId]);

  function updateForm(productId, changes) {
    setForms((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        ...changes,
      },
    }));
  }

  async function submitReview(item) {
    const form = forms[item.productId];

    if (!form || form.submitted) return;

    if (!form.comment.trim()) {
      updateForm(item.productId, {
        error: 'Vui lòng nhập nội dung đánh giá.',
      });

      return;
    }

    updateForm(item.productId, {
      sending: true,
      error: '',
    });

    try {
      await reviewService.addOrderReview(
        orderId,
        item.productId,
        {
          rating: form.rating,
          comment: form.comment.trim(),
        }
      );

      updateForm(item.productId, {
        submitted: true,
        sending: false,
        error: '',
      });
    } catch (err) {
      updateForm(item.productId, {
        sending: false,
        error:
          err.response?.data?.message ||
          'Không thể gửi đánh giá.',
      });
    }
  }

  if (loading) {
    return (
      <main className="container page">
        <div className="empty-state">
          Đang tải đánh giá…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container page">
        <div className="empty-state">
          <h1>Không thể đánh giá</h1>
          <p>{error}</p>

          <button
            className="button"
            type="button"
            onClick={() => navigate('/orders')}
          >
            Về đơn hàng
          </button>
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

        <p>
          Mã đơn hàng:{' '}
          <strong>{order.orderNumber}</strong>
        </p>
      </div>

      <section className="order-review-list">

        {order.items.map((item) => {
          const form = forms[item.productId];

          return (
            <article
              className={`order-review-card ${
                form?.submitted
                  ? 'is-submitted'
                  : ''
              }`}
              key={item.productId}
            >

              <div className="order-review-product">

                <div className="order-review-image">
                  <ProductArtwork
                    product={{
                      image: item.image,
                      name: item.name,
                    }}
                  />
                </div>

                <div className="order-review-product-info">

                  <h2>{item.name}</h2>

                  <p>
                    {formatPrice(item.price)}
                    {' × '}
                    {item.qty}
                  </p>

                </div>

              </div>

              {form?.submitted ? (

                <div className="review-submitted">
                  <span className="review-check">
                    ✓
                  </span>

                  <div>
                    <strong>Đã gửi đánh giá</strong>

                    <p>
                      Cảm ơn bạn đã đánh giá sản phẩm.
                    </p>
                  </div>
                </div>

              ) : (

                <div className="order-review-form">

                  <label>
                    Số sao
                  </label>

                  <StarRating
                    value={form?.rating || 5}
                    onChange={(rating) =>
                      updateForm(
                        item.productId,
                        { rating }
                      )
                    }
                    disabled={form?.sending}
                  />

                  <label>
                    Nhận xét
                  </label>

                  <textarea
                    rows="5"
                    maxLength="1000"
                    placeholder="Hãy chia sẻ trải nghiệm của bạn về sản phẩm..."
                    value={form?.comment || ''}
                    disabled={form?.sending}
                    onChange={(event) =>
                      updateForm(
                        item.productId,
                        {
                          comment:
                            event.target.value,
                          error: '',
                        }
                      )
                    }
                  />

                  {form?.error && (
                    <p
                      className="form-error"
                      role="alert"
                    >
                      {form.error}
                    </p>
                  )}

                  <button
                    className="button"
                    type="button"
                    disabled={form?.sending}
                    onClick={() =>
                      submitReview(item)
                    }
                  >
                    {form?.sending
                      ? 'Đang gửi…'
                      : 'Gửi đánh giá'}
                  </button>

                </div>

              )}

            </article>
          );
        })}

      </section>

      <div className="order-review-bottom-actions">

        <button
          className="button button-outline"
          type="button"
          onClick={() => navigate('/')}
        >
          Bỏ qua
        </button>

        <Link
          className="button"
          to="/orders"
        >
          Về đơn hàng
        </Link>

      </div>

    </main>
  );
}