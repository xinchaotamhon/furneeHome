import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const emptyForm = { name: '', email: '', identity: '', password: '', confirmPassword: '', code: '' };

export default function LoginModal() {
  const {
    isLoginOpen, authMode, closeLogin, login, requestRegistration,
    verifyRegistration, completeRegistration, switchAuthMode,
  } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [registerStep, setRegisterStep] = useState('email');
  const [registrationToken, setRegistrationToken] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = authMode === 'register';

  useEffect(() => {
    setError('');
    setNotice('');
    if (authMode === 'login' || !isLoginOpen) {
      setRegisterStep('email');
      setRegistrationToken('');
      setForm(emptyForm);
    }
  }, [authMode, isLoginOpen]);

  if (!isLoginOpen) return null;

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      if (!isRegister) {
        const identity = form.identity.trim();
        await login({ identity, email: identity, password: form.password });
      } else if (registerStep === 'email') {
        const result = await requestRegistration(form.email.trim());
        setForm((current) => ({ ...current, email: result.email, code: result.devOtp || '' }));
        setRegisterStep('code');
        setNotice(result.devOtp ? `Mã thử localhost: ${result.devOtp}` : 'Mã xác minh đã được gửi. Kiểm tra hộp thư của bạn.');
      } else if (registerStep === 'code') {
        const result = await verifyRegistration(form.email.trim(), form.code.trim());
        setRegistrationToken(result.registrationToken);
        setRegisterStep('profile');
        setNotice('Email đã xác minh. Hãy tạo tên và mật khẩu.');
      } else {
        if (form.password !== form.confirmPassword) throw new Error('Mật khẩu nhập lại chưa khớp.');
        await completeRegistration({
          email: form.email.trim(), registrationToken, name: form.name.trim(), password: form.password,
        });
      }
    } catch (submitError) {
      setError(submitError.message || 'Không thể thực hiện yêu cầu.');
      if (!isRegister || registerStep === 'profile') {
        setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    setIsSubmitting(true);
    try {
      const result = await requestRegistration(form.email.trim());
      setForm((current) => ({ ...current, code: result.devOtp || '' }));
      setNotice(result.devOtp ? `Mã thử localhost: ${result.devOtp}` : 'Đã gửi mã mới. Vui lòng kiểm tra email.');
    } catch (submitError) {
      setError(submitError.message || 'Không thể gửi lại mã.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerTitle = registerStep === 'email' ? 'Xác minh email FurneeHome' : registerStep === 'code' ? 'Nhập mã xác minh' : 'Hoàn tất tài khoản';
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeLogin}>
      <form className="login-card" aria-labelledby="auth-modal-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Đóng" onClick={closeLogin}>×</button>
        <h2 id="auth-modal-title">{isRegister ? registerTitle : 'Đăng nhập FurneeHome'}</h2>
        {isRegister && registerStep === 'email' && <p>Nhập email để nhận mã xác minh trước khi tạo tài khoản.</p>}
        {isRegister && registerStep === 'profile' && <p>Email <strong>{form.email}</strong> đã được xác minh.</p>}
        {!isRegister && <label>Email hoặc tên đăng nhập
          <input type="text" placeholder="admin hoặc ban@example.com" autoComplete="username" required value={form.identity} onChange={update('identity')} onBlur={(event) => setForm((current) => ({ ...current, identity: event.target.value.trim() }))} />
        </label>}
        {isRegister && registerStep === 'email' && <label>Email
          <input type="email" placeholder="ban@example.com" autoComplete="email" required value={form.email} onChange={update('email')} />
        </label>}
        {isRegister && registerStep === 'code' && <label>Mã xác minh 6 số
          <input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" required value={form.code} onChange={update('code')} />
        </label>}
        {isRegister && registerStep === 'profile' && <>
          <label>Họ và tên
            <input type="text" placeholder="Nguyễn Văn A" required maxLength="80" autoComplete="name" value={form.name} onChange={update('name')} />
          </label>
          <label>Mật khẩu
            <input type="password" placeholder="Tối thiểu 6 ký tự" minLength="6" required autoComplete="new-password" value={form.password} onChange={update('password')} />
          </label>
          <label>Nhập lại mật khẩu
            <input type="password" placeholder="Nhập lại mật khẩu" minLength="6" required autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} />
          </label>
        </>}
        {!isRegister && <label>Mật khẩu
          <input type="password" placeholder="Nhập mật khẩu" required autoComplete="current-password" value={form.password} onChange={update('password')} />
        </label>}
        {notice && <p className="form-notice">{notice}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang xử lý…' : (!isRegister ? 'Đăng nhập' : registerStep === 'email' ? 'Gửi mã xác minh' : registerStep === 'code' ? 'Xác minh email' : 'Tạo tài khoản')}</button>
        {isRegister && registerStep === 'code' && <button className="auth-switch" type="button" onClick={resend} disabled={isSubmitting}>Gửi lại mã</button>}
        <button className="auth-switch" type="button" onClick={() => switchAuthMode(isRegister ? 'login' : 'register')} disabled={isSubmitting}>{isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Bắt đầu miễn phí'}</button>
      </form>
    </div>
  );
}
