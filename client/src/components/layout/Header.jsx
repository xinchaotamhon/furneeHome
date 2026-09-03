import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCollection } from '../../context/CollectionContext';

export default function Header() {
  const { user, openLogin, openRegister, logout } = useAuth();
  const { itemCount } = useCollection();

  return (
    <header className="site-header">
      <div className="container header-inner">
      <NavLink className="brand" to="/">Furnee<span>Home</span></NavLink>
      <nav className="main-nav" aria-label="Điều hướng chính">
        <NavLink to="/">Trang chủ</NavLink>
        <NavLink to="/products">Sản phẩm</NavLink>
        <NavLink to="/room-studio">Phòng thử</NavLink>
        <NavLink to="/collections/public">Khám phá mẫu</NavLink>
        <NavLink to="/collection">Bộ sưu tập <span className="count-badge">{itemCount}</span></NavLink>
        {user?.role === 'admin' && <NavLink to="/admin">Quản trị</NavLink>}
      </nav>
      {user
        ? <div className="account-menu"><span>Xin chào, {user.name}</span><button className="text-button" type="button" onClick={logout}>Đăng xuất</button></div>
        : <div className="guest-actions"><button className="button button-secondary button-small" type="button" onClick={() => openLogin('login')}>Đăng nhập</button><button className="button button-small" type="button" onClick={openRegister}>Bắt đầu miễn phí</button></div>}
      </div>
    </header>
  );
}
