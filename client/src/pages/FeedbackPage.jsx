import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import feedbackService from '../services/feedbackService';

export default function FeedbackPage() {
  const location = useLocation();
  const reportedProduct = location.state?.product;
  const [type, setType] = useState(location.state?.type || 'suggestion');
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
        type,
        content: content.trim(),
        targetType: reportedProduct ? 'product' : 'general',
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

  return (
    <main className="container page">
      <div className="page-heading">
        <h1>Liên hệ FurneeHome</h1>
        <p>Gửi góp ý, báo nội dung hoặc để lại lời nhắn cho nhóm FurneeHome.</p>
      </div>

      <form className="panel-card admin-form feedback-card" onSubmit={submit}>
        {reportedProduct && <p className="feedback-target"><strong>Sản phẩm:</strong> {reportedProduct.name}</p>}
        <label>
            Nội dung liên hệ
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="suggestion">Góp ý</option>
            <option value="report">Báo nội dung</option>
          </select>
        </label>
        <label>
          Nội dung
          <textarea rows="7" minLength="10" maxLength="2000" value={content} onChange={(event) => setContent(event.target.value)} required />
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
