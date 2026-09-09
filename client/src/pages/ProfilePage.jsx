import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';

function errorMessage(error) {
  return error.response?.data?.message || error.message || 'Không thể xử lý yêu cầu.';
}

export default function ProfilePage() {
  const { user, openLogin, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
  }, [user]);

  if (!user) {
    return (
      <main className="container page access-denied">
        <h1>Tài khoản</h1>
        <p>Đăng nhập để xem và cập nhật hồ sơ.</p>
        <button className="button" type="button" onClick={() => openLogin('login')}>Đăng nhập</button>
      </main>
    );
  }

  async function saveProfile(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      setMessage('Đã cập nhật hồ sơ.');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setIsSaving(true);
    try {
      await userService.changePassword(passwords);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Đã đổi mật khẩu.');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="container page">
      <div className="page-heading">
        <h1>Tài khoản</h1>
        <p>Thông tin cá nhân của bạn.</p>
      </div>

      {error && <p className="form-error profile-message" role="alert">{error}</p>}
      {message && <p className="form-success profile-message" role="status">{message}</p>}

      <div className="profile-layout">
        <form className="panel-card admin-form" onSubmit={saveProfile}>
          <h2>Thông tin cá nhân</h2>
          <label>Họ và tên<input value={name} onChange={(event) => setName(event.target.value)} required maxLength="80" /></label>
          <label>Email<input value={user.email || ''} readOnly /></label>
          <button className="button" type="submit" disabled={isSaving}>Lưu thay đổi</button>
        </form>

        <form className="panel-card admin-form" onSubmit={savePassword}>
          <h2>Đổi mật khẩu</h2>
          <label>Mật khẩu hiện tại<input type="password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} required /></label>
          <label>Mật khẩu mới<input type="password" minLength="6" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} required /></label>
          <label>Nhập lại mật khẩu mới<input type="password" minLength="6" value={passwords.confirmPassword} onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })} required /></label>
          <button className="button" type="submit" disabled={isSaving}>Đổi mật khẩu</button>
        </form>
      </div>
    </main>
  );
}
