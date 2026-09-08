import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const { openLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await authService.forgotPassword(email.trim());
      setIsSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể gửi yêu cầu. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container page auth-page-container">
      <div className="auth-card-page">
        <Link to="/" className="auth-back-link">
          ← Quay lại trang chủ
        </Link>

        {isSuccess ? (
          <div className="auth-status-box success">
            <div className="status-icon-circle">✓</div>
            <span className="eyebrow">KIỂM TRA HỘP THƯ</span>
            <h2>Đã gửi liên kết!</h2>
            <p className="muted">
              Nếu địa chỉ <strong>{email}</strong> tồn tại trong hệ thống FurneeHome, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu tới hòm thư của bạn.
            </p>
            <div className="auth-info-callout">
              <p>Liên kết có hiệu lực trong <strong>15 phút</strong>.</p>
              <p>Vui lòng kiểm tra cả thư mục <em>Rác (Spam)</em> hoặc <em>Quảng cáo</em> nếu không thấy liên kết.</p>
            </div>
            <div className="auth-page-actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  navigate('/');
                  openLogin('login');
                }}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setIsSuccess(false);
                  setEmail('');
                }}
              >
                Gửi lại yêu cầu khác
              </button>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <span className="eyebrow">KHÔI PHỤC TÀI KHOẢN</span>
            <h2>Quên mật khẩu?</h2>
            <p className="muted">
              Nhập email bạn đã đăng ký trên FurneeHome để nhận liên kết đặt lại mật khẩu mới.
            </p>

            <label>
              Địa chỉ Email
              <input
                type="email"
                placeholder="ban@example.com"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button className="button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang gửi yêu cầu…' : 'Gửi liên kết đặt lại mật khẩu'}
            </button>

            <div className="auth-card-footer">
              <span>Bạn nhớ lại mật khẩu?</span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  navigate('/');
                  openLogin('login');
                }}
              >
                Đăng nhập ngay
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
