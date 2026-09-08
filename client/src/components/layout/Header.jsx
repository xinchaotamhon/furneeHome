import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useCollection } from '../../context/CollectionContext';
import '../../styles/discovery.css';

export default function Header() {
  const { user, openLogin, openRegister, logout } = useAuth();
  const { itemCount } = useCollection();
  const { totalCount } = useCart();

  return (
    <header className="site-header fh-site-header">
      <div className="container header-inner fh-header-inner">
        <NavLink className="brand fh-brand" to="/" aria-label="FurneeHome - Trang chủ">
          Furnee<span>Home</span>
        </NavLink>

        <nav className="main-nav" aria-label="Điều hướng chính">
          <NavLink to="/">Trang chủ</NavLink>
          <NavLink to="/products">Sản phẩm</NavLink>
          <NavLink to="/cart" className="cart-nav-link">
            Giỏ hàng <span className="count-badge cart-badge">{totalCount}</span>
          </NavLink>
          {user && <NavLink to="/orders">Đơn mua</NavLink>}
          <NavLink to="/room-studio">Phòng thử</NavLink>
          <NavLink to="/collection">
            Bộ sưu tập <span className="count-badge">{itemCount}</span>
          </NavLink>
          <NavLink to="/feedback">Hỗ trợ</NavLink>
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <>
              <NavLink to="/admin">Sản phẩm & User</NavLink>
              <NavLink to="/admin/orders">Đơn hàng (Admin)</NavLink>
            </>
          )}
        </nav>

        {user ? (
          <div className="account-menu fh-account-menu">
            <NavLink to="/profile" title={user.name}>Tài khoản</NavLink>
            <button className="text-button" type="button" onClick={logout}>Đăng xuất</button>
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
