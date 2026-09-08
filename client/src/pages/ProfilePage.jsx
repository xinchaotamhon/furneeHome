import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, openLogin, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setAvatarUrl(user?.avatarUrl || '');
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

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsSaving(true);

    try {
      await updateProfile({ name: name.trim(), avatarUrl: avatarUrl.trim() });
      setMessage('Đã cập nhật hồ sơ.');
    } catch (submitError) {
      setError(submitError.message || 'Không thể cập nhật hồ sơ.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="container page">
      <div className="page-heading">
        <h1>Tài khoản</h1>
        <p>Thông tin cá nhân của bạn.</p>
      </div>

      <section className="panel-card profile-card">
        {avatarUrl && <img className="profile-avatar" src={avatarUrl} alt="Ảnh đại diện" />}
        <form className="admin-form" onSubmit={submit}>
          <label>
            Họ và tên
            <input value={name} onChange={(event) => setName(event.target.value)} required maxLength="80" />
          </label>
          <label>
            Email
            <input value={user.email || ''} readOnly />
          </label>
          <label>
            URL ảnh đại diện
            <input type="url" value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://..." />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}

          <button className="button" type="submit" disabled={isSaving}>
            {isSaving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </form>
      </section>
    </main>
  );
}
