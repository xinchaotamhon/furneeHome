import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <main className="container page not-found"><div className="not-found-number">404</div><p className="eyebrow">BẠN ĐANG ĐI LẠC TRONG CĂN PHÒNG NÀO ĐÓ</p><h1>Trang này không tồn tại</h1><p>Đường dẫn có thể đã đổi hoặc nội dung đã được chuyển sang nơi khác.</p><div><Link className="button" to="/">Về trang chủ</Link><Link className="button button-secondary" to="/products">Xem sản phẩm</Link></div></main>;
}
