import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginModal() {
  const { isLoginOpen, authMode, closeLogin, login, register, switchAuthMode } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', identity: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = authMode === 'register';

  useEffect(() => {
    setError('');
  }, [authMode, isLoginOpen]);

  if (!isLoginOpen) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (isRegister && form.password !== form.confirmPassword) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      if (isRegister) await register(form);
      else {
        const identity = form.identity.trim();
        await login({ identity, email: identity, password: form.password });
      }
    } catch (submitError) {
      setError(submitError.message || 'Không thể đăng nhập.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeLogin}>
      <form className="login-card" aria-labelledby="auth-modal-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Đóng" onClick={closeLogin}>×</button>
        <p className="eyebrow">{isRegister ? 'BẮT ĐẦU MIỄN PHÍ' : 'CHÀO MỪNG BẠN QUAY LẠI'}</p>
        <h2 id="auth-modal-title">{isRegister ? 'Tạo tài khoản FurneeHome' : 'Đăng nhập FurneeHome'}</h2>
        <p className="muted">{isRegister ? 'Lưu ý tưởng riêng, sau đó tự quyết định mẫu nào được công khai.' : 'Tiếp tục với Bộ sưu tập và những mẫu phòng đã lưu.'}</p>
        {isRegister && <label>Họ và tên
          <input type="text" placeholder="Nguyễn Văn A" required maxLength={20} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} onBlur={(event) => setForm({ ...form, name: event.target.value.trim() })} />
        </label>}
        {isRegister ? <label>Email
          <input type="email" placeholder="ban@example.com" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label> : <label>Tên đăng nhập hoặc email
          <input type="text" placeholder="admin hoặc ban@example.com" autoComplete="username" required value={form.identity} onChange={(event) => setForm({ ...form, identity: event.target.value })} onBlur={(event) => setForm({ ...form, identity: event.target.value.trim() })} />
        </label>}
        <label>Mật khẩu
          <input type="password" placeholder={isRegister ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu'} minLength={isRegister ? 6 : undefined} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        {isRegister && <label>Nhập lại mật khẩu
          <input type="password" placeholder="Nhập lại mật khẩu" minLength="6" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
        </label>}
        {error && <p className="form-error">{error}</p>}
        <button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Đang xử lý…' : (isRegister ? 'Tạo tài khoản miễn phí' : 'Đăng nhập')}</button>
        <button className="auth-switch" type="button" onClick={() => switchAuthMode(isRegister ? 'login' : 'register')} disabled={isSubmitting}>{isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Bắt đầu miễn phí'}</button>
        <small className="muted">Đăng nhập để lưu mẫu vào tài khoản và chủ động công khai khi bạn muốn.</small>
      </form>
    </div>
  );
}
