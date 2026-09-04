import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer fh-footer">
      <div className="container fh-footer-grid">
        <div className="fh-footer-intro">
          <Link className="brand fh-brand" to="/">Furnee<span>Home</span></Link>
          <p>Thử một ý tưởng nội thất trên ảnh phòng của bạn trước khi quyết định tìm hiểu sản phẩm.</p>
        </div>
        <div>
          <h2>Bắt đầu</h2>
          <Link to="/products">Chọn sản phẩm</Link>
          <Link to="/room-studio">Tạo ảnh thử</Link>
          <Link to="/collection">Bộ sưu tập của bạn</Link>
        </div>
        <div>
          <h2>Khám phá</h2>
          <Link to="/collections/public">Mẫu công khai</Link>
          <Link to="/room-studio">Gợi ý AI cho phòng</Link>
          <Link to="/products">Danh mục sản phẩm</Link>
        </div>
        <div>
          <h2>Lưu ý khi dùng</h2>
          <p>Ảnh thử là gợi ý trực quan. Hãy kiểm tra kích thước thật và không gian sử dụng trước khi chọn mua.</p>
          <p>Mẫu phòng chỉ được công khai khi chủ sở hữu tự bấm chia sẻ.</p>
        </div>
      </div>
      <div className="container fh-footer-bottom"><small>© 2026 FurneeHome</small><span>Thiết kế để người mới cũng có thể bắt đầu từng bước.</span></div>
    </footer>
  );
}
