import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import feedbackService from '../services/feedbackService';

export default function FeedbackPage() {
  const location = useLocation();
  const reportedProduct = location.state?.product;
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsSending(true);

    try {
      await feedbackService.create({
        type: 'report',
        content: content.trim(),
        targetType: 'product',
        targetId: reportedProduct?._id || reportedProduct?.id || '',
        targetName: reportedProduct?.name || '',
      });
      setContent('');
      setMessage('Đã gửi phản hồi.');
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Không thể gửi phản hồi.');
    } finally {
      setIsSending(false);
    }
  };

  if (!reportedProduct) {
    return (
      <main className="container page">
        <div className="page-heading"><h1>Liên hệ FurneeHome</h1></div>
        <section className="panel-card contact-card">
          <a href="https://maps.google.com/?q=71%2F5+Hu%E1%BB%B3nh+T%E1%BA%A5n+Ph%C3%A1t%2C+Nh%C3%A0+B%C3%A8%2C+TP.HCM" target="_blank" rel="noreferrer">71/5 Huỳnh Tấn Phát, Ấp 31, Xã Nhà Bè, TP.HCM</a>
          <a href="tel:0372208100">0372 208 100</a>
          <a href="mailto:furneehome@gmail.com">furneehome@gmail.com</a>
          <a href="https://zalo.me/0372208100" target="_blank" rel="noreferrer">Zalo: 0372 208 100</a>
        </section>
      </main>
    );
  }

  return (
    <main className="container page">
      <div className="page-heading">
        <h1>Báo nội dung</h1>
      </div>

      <form className="panel-card admin-form feedback-card" onSubmit={submit}>
        <p className="feedback-target"><strong>Sản phẩm:</strong> {reportedProduct.name}</p>
        <label>
          Nội dung
          <textarea
            rows="7"
            minLength="10"
            maxLength="2000"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={"Ví dụ:\n- Ảnh sản phẩm không đúng mô tả.\n- Giá hoặc kích thước chưa chính xác.\n- Bình luận có nội dung không phù hợp."}
            required
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}

        <button className="button" type="submit" disabled={isSending}>
          {isSending ? 'Đang gửi…' : 'Gửi phản hồi'}
        </button>
      </form>
    </main>
  );
}
