import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LoginModal() {
  const { isLoginOpen, authMode, closeLogin, login, register, loginDemo, switchAuthMode } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const isRegister = authMode === 'register';

  useEffect(() => {
    setError('');
  }, [authMode, isLoginOpen]);

  if (!isLoginOpen) return null;

  const submit = (event) => {
    event.preventDefault();
    if (isRegister && form.password !== form.confirmPassword) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    if (isRegister) register(form);
    else login(form);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeLogin}>
      <form className="login-card" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Đóng" onClick={closeLogin}>×</button>
        <p className="eyebrow">{isRegister ? 'BẮT ĐẦU MIỄN PHÍ' : 'CHÀO MỪNG BẠN QUAY LẠI'}</p>
        <h2>{isRegister ? 'Tạo tài khoản FurneeHome' : 'Đăng nhập FurneeHome'}</h2>
        <p className="muted">{isRegister ? 'Lưu sản phẩm và những ý tưởng phòng của riêng bạn.' : 'Tiếp tục với Bộ sưu tập và những mẫu phòng đã lưu.'}</p>
        {isRegister && <label>Họ và tên
          <input type="text" placeholder="Nguyễn Văn A" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>}
        <label>Email
          <input type="email" placeholder="ban@example.com" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>Mật khẩu
          <input type="password" placeholder="Tối thiểu 6 ký tự" minLength="6" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        {isRegister && <label>Nhập lại mật khẩu
          <input type="password" placeholder="Nhập lại mật khẩu" minLength="6" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
        </label>}
        {error && <p className="form-error">{error}</p>}
        <button className="button" type="submit">{isRegister ? 'Tạo tài khoản miễn phí' : 'Đăng nhập'}</button>
        {!isRegister && <><div className="divider"><span>hoặc dùng tài khoản thử</span></div><div className="demo-login-actions">
          <button className="button button-secondary" type="button" onClick={() => loginDemo('customer')}>Customer</button>
          <button className="button button-secondary" type="button" onClick={() => loginDemo('admin')}>Admin</button>
        </div></>}
        <button className="auth-switch" type="button" onClick={() => switchAuthMode(isRegister ? 'login' : 'register')}>{isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Bắt đầu miễn phí'}</button>
        <small className="muted">Dữ liệu đăng nhập hiện chỉ dùng để thử giao diện và được lưu trên trình duyệt.</small>
      </form>
    </div>
  );
}
