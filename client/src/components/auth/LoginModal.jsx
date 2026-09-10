import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';

const REMEMBERED_EMAIL_KEY = 'furneehome-login-email';
const emptyForm = { name: '', email: '', otp: '', password: '', confirmPassword: '' };

function rememberedEmail() {
  try { return String(localStorage.getItem(REMEMBERED_EMAIL_KEY) || '').trim(); } catch { return ''; }
}

function saveRememberedEmail(email, remember) {
  try {
    if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch {}
}

export default function LoginModal() {
  const navigate = useNavigate();
  const { isLoginOpen, authMode, closeLogin, login, requestRegistration, completeRegistration, switchAuthMode } = useAuth();
  const [view, setView] = useState('login');
  const [form, setForm] = useState(emptyForm);
  const [remember, setRemember] = useState(() => Boolean(rememberedEmail()));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextView = authMode === 'register' ? 'register-email' : authMode;
    setView(nextView);
    setForm({ ...emptyForm, email: nextView === 'login' ? rememberedEmail() : '' });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setNotice('');
    setError('');
  }, [authMode, isLoginOpen]);

  if (!isLoginOpen) return null;
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const toLogin = () => {
    switchAuthMode('login');
    setView('login');
    setForm({ ...emptyForm, email: rememberedEmail() });
  };

  const submit = async (event) => {
    event.preventDefault();
    setNotice('');
    setError('');
    if ((view === 'register-complete' || view === 'reset') && form.password !== form.confirmPassword) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (view === 'register-email') {
        const result = await requestRegistration(form.email.trim());
        setForm((current) => ({ ...current, email: result.email || current.email.trim(), otp: result.devOtp || '' }));
        setView('register-complete');
        setNotice(result.devOtp ? `Mã thử localhost: ${result.devOtp}` : 'Mã xác minh đã được gửi đến email.');
      } else if (view === 'register-complete') {
        await completeRegistration({ name: form.name.trim(), email: form.email.trim(), otp: form.otp.trim(), password: form.password });
      } else if (view === 'forgot') {
        const result = await authService.requestPasswordReset(form.email.trim());
        setView('reset');
        setForm((current) => ({ ...current, otp: result?.devOtp || '' }));
        setNotice(result?.devOtp ? `Mã thử localhost: ${result.devOtp}` : 'Mã xác minh đã được gửi đến email.');
      } else if (view === 'reset') {
        await authService.resetPassword({ email: form.email.trim(), otp: form.otp.trim(), password: form.password });
        toLogin();
        setNotice('Đã đổi mật khẩu. Bạn có thể đăng nhập.');
      } else {
        const email = form.email.trim().toLowerCase();
        const loggedInUser = await login({ email, password: form.password });
        saveRememberedEmail(email, remember);
        if (loggedInUser.role === 'admin' || loggedInUser.role === 'superadmin') navigate('/admin');
      }
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Không thể thực hiện yêu cầu.');
    } finally { setIsSubmitting(false); }
  };

  const title = { login: 'Đăng nhập', 'register-email': 'Xác minh email', 'register-complete': 'Tạo tài khoản', forgot: 'Quên mật khẩu', reset: 'Đặt mật khẩu mới' }[view];
  const submitText = { login: 'Đăng nhập', 'register-email': 'Gửi mã xác minh', 'register-complete': 'Tạo tài khoản', forgot: 'Gửi mã xác minh', reset: 'Đổi mật khẩu' }[view];

  return <div className="modal-backdrop" role="presentation" onMouseDown={closeLogin}>
    <form className="login-card" aria-labelledby="auth-modal-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" type="button" aria-label="Đóng" onClick={closeLogin}>×</button>
      <h2 id="auth-modal-title">{title}</h2>
      {view === 'register-email' && <label>Email<input type="email" value={form.email} onChange={updateField('email')} autoComplete="email" required /></label>}
      {view === 'register-complete' && <><p className="muted">Email {form.email}</p><label>Họ và tên<input type="text" value={form.name} onChange={updateField('name')} autoComplete="name" maxLength="80" required /></label><label>Mã xác minh<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={form.otp} onChange={updateField('otp')} autoComplete="one-time-code" required /></label></>}
      {view === 'login' && <label>Email<input type="email" value={form.email} onChange={updateField('email')} autoComplete="email" required /></label>}
      {(view === 'forgot' || view === 'reset') && <label>Email<input type="email" value={form.email} onChange={updateField('email')} autoComplete="email" readOnly={view === 'reset'} required /></label>}
      {view === 'reset' && <label>Mã xác minh<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={form.otp} onChange={updateField('otp')} autoComplete="one-time-code" required /></label>}
      {(view === 'login' || view === 'register-complete' || view === 'reset') && (
        <label>
          {view === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
          <div className="password-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={updateField('password')}
              autoComplete={view === 'login' ? 'current-password' : 'new-password'}
              minLength={view === 'login' ? 1 : 6}
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
        </label>
      )}
      {(view === 'register-complete' || view === 'reset') && (
        <label>
          Nhập lại mật khẩu
          <div className="password-input-wrap">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={updateField('confirmPassword')}
              autoComplete="new-password"
              minLength="6"
              required
            />
            <button
              type="button"
              className="password-toggle-btn"
              aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowConfirmPassword((prev) => !prev)}
            >
              {showConfirmPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
        </label>
      )}
      {view === 'login' && <label className="remember-login"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Ghi nhớ email</span></label>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang xử lý…' : submitText}</button>
      {view === 'login' && <><button className="auth-switch" type="button" onClick={() => setView('forgot')}>Quên mật khẩu?</button><button className="auth-switch" type="button" onClick={() => switchAuthMode('register')}>Chưa có tài khoản? Đăng ký</button></>}
      {(view === 'forgot' || view === 'reset' || view === 'register-email' || view === 'register-complete') && <button className="auth-switch" type="button" onClick={toLogin}>Quay lại đăng nhập</button>}
    </form>
  </div>;
}
