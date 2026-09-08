import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { openLogin } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại chưa trùng khớp.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await authService.resetPassword({ token, password });
      setIsSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại sau.';
      setError(msg);
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

        {!token ? (
          <div className="auth-status-box error">
            <div className="status-icon-circle danger">!</div>
            <span className="eyebrow">LIÊN KẾT KHÔNG HỢP LỆ</span>
            <h2>Thiếu mã xác thực</h2>
            <p className="muted">
              Đường link đặt lại mật khẩu không đầy đủ mã xác thực hoặc đã bị chỉnh sửa. Vui lòng kiểm tra lại liên kết trong email hoặc gửi yêu cầu mới.
            </p>
            <div className="auth-page-actions">
              <Link to="/forgot-password" className="button">
                Gửi lại yêu cầu mới
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="auth-status-box success">
            <div className="status-icon-circle">✓</div>
            <span className="eyebrow">HOÀN TẤT</span>
            <h2>Đổi mật khẩu thành công!</h2>
            <p className="muted">
              Mật khẩu mới của bạn đã được cập nhật an toàn. Bây giờ bạn có thể đăng nhập vào FurneeHome bằng mật khẩu mới này.
            </p>
            <div className="auth-page-actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  navigate('/');
                  openLogin('login');
                }}
              >
                Đăng nhập ngay
              </button>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <span className="eyebrow">BẢO MẬT</span>
            <h2>Đặt lại mật khẩu mới</h2>
            <p className="muted">
              Thiết lập mật khẩu mới có ít nhất 6 ký tự cho tài khoản của bạn.
            </p>

            <label>
              Mật khẩu mới
              <input
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <label>
              Nhập lại mật khẩu mới
              <input
                type="password"
                placeholder="Nhập lại mật khẩu mới"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </label>

            {error && (
              <div className="form-error-wrap">
                <p className="form-error">{error}</p>
                {error.includes('hết hạn') && (
                  <Link to="/forgot-password" className="text-button inline-link">
                    Yêu cầu gửi lại liên kết mới →
                  </Link>
                )}
              </div>
            )}

            <button className="button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Đang cập nhật…' : 'Cập nhật mật khẩu mới'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
