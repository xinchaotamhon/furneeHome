import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const REMEMBERED_CREDENTIALS_KEY = 'furneehome_remembered_credentials';

export default function LoginModal() {
  const navigate = useNavigate();
  const { isLoginOpen, authMode, closeLogin, login, register, switchAuthMode } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [rememberPassword, setRememberPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = authMode === 'register';

  useEffect(() => {
    setError('');
    if (authMode === 'register') {
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } else if (isLoginOpen && authMode === 'login') {
      try {
        const saved = JSON.parse(localStorage.getItem(REMEMBERED_CREDENTIALS_KEY));
        if (saved && (saved.email || saved.password)) {
          setForm((prev) => ({
            ...prev,
            email: saved.email || '',
            password: saved.password || '',
          }));
          setRememberPassword(true);
        } else {
          setForm((prev) => ({
            ...prev,
            email: '',
            password: '',
          }));
          setRememberPassword(false);
        }
      } catch {
        setForm((prev) => ({
          ...prev,
          email: '',
          password: '',
        }));
        setRememberPassword(false);
      }
    }
  }, [authMode, isLoginOpen]);

  if (!isLoginOpen) return null;

  const handleRememberChange = (event) => {
    const checked = event.target.checked;
    setRememberPassword(checked);
    if (!checked) {
      localStorage.removeItem(REMEMBERED_CREDENTIALS_KEY);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isRegister && form.password !== form.confirmPassword) {
      setError('Mật khẩu nhập lại chưa khớp.');
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register(form);
      } else {
        await login(form);
        if (rememberPassword) {
          localStorage.setItem(
            REMEMBERED_CREDENTIALS_KEY,
            JSON.stringify({ email: form.email, password: form.password })
          );
        } else {
          localStorage.removeItem(REMEMBERED_CREDENTIALS_KEY);
          setForm({ name: '', email: '', password: '', confirmPassword: '' });
        }
      }
    } catch (submitError) {
      setError(submitError.message || 'Không thể đăng nhập.');
      // Wrong credentials (or any failed attempt) -> clear password field(s)
      setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    closeLogin();
    navigate('/forgot-password');
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeLogin}>
      <form className="login-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} autoComplete="off">
        <button className="modal-close" type="button" aria-label="Đóng" onClick={closeLogin}>×</button>
        <p className="eyebrow">{isRegister ? 'BẮT ĐẦU MIỄN PHÍ' : 'CHÀO MỪNG BẠN QUAY LẠI'}</p>
        <h2>{isRegister ? 'Tạo tài khoản FurneeHome' : 'Đăng nhập FurneeHome'}</h2>
        <p className="muted">{isRegister ? 'Lưu sản phẩm và những ý tưởng phòng của riêng bạn.' : 'Tiếp tục với Bộ sưu tập và những mẫu phòng đã lưu.'}</p>
        {isRegister && <label>Họ và tên
          <input type="text" placeholder="Nguyễn Văn A" required maxLength={20} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} onBlur={(event) => setForm({ ...form, name: event.target.value.trim() })} />
        </label>}
        <label>Email
          <input type="email" name="email" autoComplete="off" placeholder="ban@example.com" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>Mật khẩu
          <input type="password" name="password" autoComplete="new-password" placeholder="Tối thiểu 6 ký tự" minLength="6" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        {!isRegister && (
          <div className="login-options-row">
            <label className="remember-password-label">
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={handleRememberChange}
              />
              <span>Ghi nhớ mật khẩu</span>
            </label>
            <button
              type="button"
              className="text-button forgot-password-link"
              onClick={handleForgotPassword}
            >
              Quên mật khẩu?
            </button>
          </div>
        )}
        {isRegister && <label>Nhập lại mật khẩu
          <input type="password" name="confirmPassword" autoComplete="new-password" placeholder="Nhập lại mật khẩu" minLength="6" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
        </label>}
        {error && <p className="form-error">{error}</p>}
        <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang xử lý…' : (isRegister ? 'Tạo tài khoản miễn phí' : 'Đăng nhập')}</button>
        <button className="auth-switch" type="button" onClick={() => switchAuthMode(isRegister ? 'login' : 'register')} disabled={isSubmitting}>{isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Bắt đầu miễn phí'}</button>
        <small className="muted">Tài khoản được xác thực bởi backend và phiên đăng nhập dùng JWT.</small>
      </form>
    </div>
  );
}