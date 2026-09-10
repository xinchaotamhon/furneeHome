import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import '../../styles/discovery.css';

export default function Header() {
  const navigate = useNavigate();
  const { user, openLogin, openRegister, logout } = useAuth();
  const { totalCount } = useCart();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  if (isAdmin) {
    return (
      <header className="site-header fh-site-header">
        <div className="container header-inner fh-header-inner">
          <NavLink className="brand fh-brand" to="/admin" aria-label="FurneeHome - Quản trị">
            <img src="/images/furneehome-logo.png" alt="FurneeHome" />
          </NavLink>
          <nav className="main-nav" aria-label="Điều hướng quản trị">
            <NavLink to="/admin">Quản trị</NavLink>
          </nav>
          <div className="account-menu fh-account-menu">
            <span>{user.role === 'superadmin' ? 'Orchestra Admin' : 'Admin'}</span>
            <button className="text-button" type="button" onClick={() => { logout(); navigate('/'); }}>Đăng xuất</button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="site-header fh-site-header">
      <div className="container header-inner fh-header-inner">
        <NavLink className="brand fh-brand" to="/" aria-label="FurneeHome - Trang chủ">
          <img src="/images/furneehome-logo.png" alt="FurneeHome" />
        </NavLink>

        <nav className="main-nav" aria-label="Điều hướng chính">
          <NavLink to="/">Trang chủ</NavLink>
          <NavLink to="/products">Sản phẩm</NavLink>
          <NavLink to="/room-studio">Phòng thử</NavLink>
          <NavLink to="/cart" className="cart-nav-link">
            Giỏ hàng <span className="count-badge cart-badge">{totalCount}</span>
          </NavLink>
          {user && <NavLink to="/orders">Đơn mua</NavLink>}
          <NavLink to="/feedback">Liên hệ</NavLink>
        </nav>

        {user ? (
          <div className="account-menu fh-account-menu">
            <NavLink to="/profile" title="Tài khoản">Xin chào! {user.name || user.username}</NavLink>
            <button className="text-button" type="button" onClick={() => { logout(); navigate('/'); }}>Đăng xuất</button>
          </div>
        ) : (
          <div className="guest-actions fh-guest-actions">
            <button className="button button-secondary button-small" type="button" onClick={() => openLogin('login')}>
              Đăng nhập
            </button>
            <button className="button button-small" type="button" onClick={openRegister}>
              Đăng ký
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
