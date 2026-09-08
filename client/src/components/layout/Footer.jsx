import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer fh-footer">
      <div className="container fh-footer-grid">
        <div className="fh-footer-intro">
          <Link className="brand fh-brand" to="/">Furnee<span>Home</span></Link>
          <p>Chọn nội thất và xem trước sản phẩm trong ảnh phòng của bạn.</p>
        </div>
        <div>
          <h2>Chức năng</h2>
          <Link to="/products">Sản phẩm</Link>
          <Link to="/room-studio">Phòng thử</Link>
          <Link to="/collection">Bộ sưu tập</Link>
          <Link to="/feedback">Góp ý</Link>
        </div>
        <div>
          <h2>Phù hợp với</h2>
          <p>Sinh viên, học sinh, công nhân và gia đình phổ thông.</p>
        </div>
        <div>
          <h2>Liên hệ</h2>
          <p>Đồ án tốt nghiệp của nhóm FurneeHome.</p>
        </div>
      </div>
      <div className="container fh-footer-bottom">
        <small>© 2026 FurneeHome</small>
      </div>
    </footer>
  );
}
