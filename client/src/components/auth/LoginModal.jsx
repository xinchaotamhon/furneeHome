import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import authService from '../../services/authService';

const emptyForm = {
  name: '',
  email: '',
  otp: '',
  password: '',
  confirmPassword: '',
};

export default function LoginModal() {
  const {
    isLoginOpen,
    authMode,
    closeLogin,
    login,
    register,
    switchAuthMode,
  } = useAuth();
  const [view, setView] = useState(authMode);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setView(authMode);
    setForm(emptyForm);
    setNotice('');
    setError('');
  }, [authMode, isLoginOpen]);

  if (!isLoginOpen) return null;

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const changeMainView = (nextView) => {
    switchAuthMode(nextView);
  };

  const openForgotPassword = () => {
    setView('forgot');
    setNotice('');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setNotice('');
    setError('');

    if ((view === 'register' || view === 'reset') && form.password !== form.confirmPassword) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (view === 'register') {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        });
      } else if (view === 'forgot') {
        const result = await authService.requestPasswordReset(form.email.trim());
        setView('reset');
        setForm((current) => ({ ...current, otp: result?.devOtp || '' }));
        setNotice(result?.devOtp
          ? `Mã thử localhost: ${result.devOtp}`
          : 'Mã xác minh đã được gửi đến email.');
      } else if (view === 'reset') {
        await authService.resetPassword({
          email: form.email.trim(),
          otp: form.otp.trim(),
          password: form.password,
        });
        setView('login');
        setForm((current) => ({
          ...emptyForm,
          email: current.email,
        }));
        setNotice('Đã đổi mật khẩu. Bạn có thể đăng nhập.');
      } else {
        await login({
          email: form.email.trim(),
          identity: form.email.trim(),
          password: form.password,
        });
      }
    } catch (submitError) {
      setError(submitError.response?.data?.message || submitError.message || 'Không thể thực hiện yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = {
    login: 'Đăng nhập',
    register: 'Tạo tài khoản',
    forgot: 'Quên mật khẩu',
    reset: 'Đặt mật khẩu mới',
  }[view];

  const submitText = {
    login: 'Đăng nhập',
    register: 'Đăng ký',
    forgot: 'Gửi mã xác minh',
    reset: 'Đổi mật khẩu',
  }[view];

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeLogin}>
      <form
        className="login-card"
        aria-labelledby="auth-modal-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" aria-label="Đóng" onClick={closeLogin}>×</button>
        <h2 id="auth-modal-title">{title}</h2>

        {view === 'register' && (
          <label>
            Họ và tên
            <input
              type="text"
              value={form.name}
              onChange={updateField('name')}
              autoComplete="name"
              required
              maxLength="80"
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={updateField('email')}
            autoComplete="email"
            readOnly={view === 'reset'}
            required
          />
        </label>

        {view === 'reset' && (
          <label>
            Mã xác minh
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength="6"
              value={form.otp}
              onChange={updateField('otp')}
              autoComplete="one-time-code"
              required
            />
          </label>
        )}

        {(view === 'login' || view === 'register' || view === 'reset') && (
          <label>
            {view === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
            <input
              type="password"
              value={form.password}
              onChange={updateField('password')}
              autoComplete={view === 'login' ? 'current-password' : 'new-password'}
              minLength="6"
              required
            />
          </label>
        )}

        {(view === 'register' || view === 'reset') && (
          <label>
            Nhập lại mật khẩu
            <input
              type="password"
              value={form.confirmPassword}
              onChange={updateField('confirmPassword')}
              autoComplete="new-password"
              minLength="6"
              required
            />
          </label>
        )}

        {notice && <p className="form-success" role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang xử lý…' : submitText}
        </button>

        {view === 'login' && (
          <button className="auth-switch" type="button" onClick={openForgotPassword}>
            Quên mật khẩu?
          </button>
        )}

        {(view === 'forgot' || view === 'reset') ? (
          <button className="auth-switch" type="button" onClick={() => changeMainView('login')}>
            Quay lại đăng nhập
          </button>
        ) : (
          <button
            className="auth-switch"
            type="button"
            disabled={isSubmitting}
            onClick={() => changeMainView(view === 'register' ? 'login' : 'register')}
          >
            {view === 'register' ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </button>
        )}
      </form>
    </div>
  );
}
