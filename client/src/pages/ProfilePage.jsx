import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import userService from '../services/userService';

function errorMessage(error) {
  return error.response?.data?.message || error.message || 'Không thể xử lý yêu cầu.';
}

export default function ProfilePage() {
  const { user, openLogin, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Đổi mật khẩu qua OTP
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  // Bước 1: Gửi mã OTP về Gmail
  async function handleSendOtp() {
    setError('');
    setMessage('');
    setIsSendingOtp(true);
    try {
      const res = await authService.requestPasswordReset(user.email);
      setOtpSent(true);
      setMessage(res?.devOtp ? `Đã gửi mã! (Mã thử nghiệm: ${res.devOtp})` : 'Mã xác minh đã được gửi về Gmail của bạn.');
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setIsSendingOtp(false);
    }
  }

  // Bước 2: Xác nhận OTP và đặt mật khẩu mới
  async function handleResetPassword(event) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setIsSaving(true);
    try {
      await authService.resetPassword({
        email: user.email,
        otp: otp.trim(),
        password: newPassword,
      });
      setMessage('Đã đổi mật khẩu thành công!');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpSent(false);
    } catch (resetError) {
      setError(errorMessage(resetError));
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

        <form className="panel-card admin-form" onSubmit={handleResetPassword}>
          <h2>Đổi mật khẩu</h2>
          <label>
            Email nhận mã
            <input value={user.email || ''} readOnly />
          </label>

          <button
            type="button"
            className="button"
            onClick={handleSendOtp}
            disabled={isSendingOtp}
            style={{ marginBottom: '1rem' }}
          >
            {isSendingOtp ? 'Đang gửi mã…' : (otpSent ? 'Gửi lại mã OTP' : 'Gửi mã xác minh về Gmail')}
          </button>

          {otpSent && (
            <>
              <label>
                Mã xác minh (OTP)
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  placeholder="Nhập 6 số gửi về Gmail"
                  required
                />
              </label>

              <label>
                Mật khẩu mới
                <div className="password-input-wrap">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    minLength="6"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    onClick={() => setShowNewPassword((prev) => !prev)}
                  >
                    {showNewPassword ? (
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

              <label>
                Nhập lại mật khẩu mới
                <div className="password-input-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    minLength="6"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
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

              <button className="button" type="submit" disabled={isSaving}>
                {isSaving ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}
              </button>
            </>
          )}
        </form>
      </div>
    </main>
  );
}
