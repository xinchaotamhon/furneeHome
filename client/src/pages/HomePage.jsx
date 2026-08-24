import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main>
      <section className="hero-section"><div className="container hero-grid"><div><p className="eyebrow">THAM KHẢO TRÊN CHÍNH ẢNH PHÒNG CỦA BẠN</p><h1>Dễ hình dung hơn.<br />Dễ chọn đúng hơn.</h1><p>FurneeHome giúp học sinh, sinh viên và người ở phòng nhỏ thử cách đặt những món nội thất quen thuộc trước khi tìm nơi mua.</p><div className="hero-actions"><Link className="button" to="/room-studio">Thử với ảnh phòng</Link><Link className="button button-secondary" to="/products">Xem sản phẩm mẫu</Link></div></div><div className="hero-visual"><div className="hero-room"><span className="hero-window" /><span className="hero-desk" /><span className="hero-chair" /><span className="hero-plant">♣</span></div><div className="hero-note">Chấm vị trí sản phẩm<br /><strong>trước khi tạo ảnh AI</strong></div></div></div></section>
      <section className="container home-features"><article><span>01</span><h2>Dùng ảnh phòng thật</h2><p>Tải lên ảnh không gian sống mà bạn muốn thử .</p></article><article><span>02</span><h2>Chọn vị trí thật đơn giản</h2><p>Chọn sản phẩm, chấm một điểm trên ảnh và kéo ghim nếu muốn đổi chỗ.</p></article><article><span>03</span><h2>Lưu lại ý tưởng</h2><p>Sản phẩm yêu thích và vị trí đã chọn đều nằm trong một Bộ sưu tập.</p></article></section>
      <section className="container home-callout"><div><p className="eyebrow">BỘ SƯU TẬP ĐA NỘI THẤT</p><h2>50 sản phẩm nội thất tiện ích cho phòng trọ sinh viên</h2><p>Đã được Furnee đồng bộ trực tiếp từ Shopee, sẵn sàng để bạn xem thử sản phẩm trong phòng riêng.</p></div><Link className="button" to="/products">Khám phá ngay</Link></section>
    </main>
  );
}
