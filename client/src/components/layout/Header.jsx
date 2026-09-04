import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCollection } from '../../context/CollectionContext';
import '../../styles/discovery.css';

export default function Header() {
  const { user, openLogin, openRegister, logout } = useAuth();
  const { itemCount } = useCollection();

  return (
    <header className="site-header fh-site-header">
      <div className="container header-inner fh-header-inner">
      <NavLink className="brand fh-brand" to="/" aria-label="FurneeHome - Trang chủ">Furnee<span>Home</span></NavLink>
      <nav className="main-nav" aria-label="Điều hướng chính">
        <NavLink to="/">Trang chủ</NavLink>
        <NavLink to="/products">Chọn sản phẩm</NavLink>
        <NavLink to="/room-studio">Tạo ảnh thử</NavLink>
        <NavLink to="/collections/public">Mẫu công khai</NavLink>
        <NavLink to="/collection">Bộ sưu tập <span className="count-badge">{itemCount}</span></NavLink>
        {user?.role === 'admin' && <NavLink to="/admin">Quản trị</NavLink>}
      </nav>
      {user
        ? <div className="account-menu fh-account-menu"><span title={user.name}>Xin chào, {user.name}</span><button className="text-button" type="button" onClick={logout}>Đăng xuất</button></div>
        : <div className="guest-actions fh-guest-actions"><button className="button button-secondary button-small" type="button" onClick={() => openLogin('login')}>Đăng nhập</button><button className="button button-small" type="button" onClick={openRegister}>Tạo tài khoản</button></div>}
      </div>
    </header>
  );
}
