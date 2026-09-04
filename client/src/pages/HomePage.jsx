import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="fh-home">
      <section className="fh-hero">
        <div className="container fh-hero-grid">
          <div className="fh-hero-copy">
            <p className="eyebrow">THỬ TRƯỚC TRÊN ẢNH PHÒNG THẬT</p>
            <h1>Đừng chỉ tưởng tượng.<br />Hãy xem món đồ <em>thực sự hợp</em> với phòng.</h1>
            <p>FurneeHome giúp bạn chọn sản phẩm trước, đặt đúng vị trí trên ảnh phòng, rồi mới tạo ảnh thử bằng AI.</p>
            <div className="hero-actions"><Link className="button" to="/products">1. Chọn sản phẩm</Link><Link className="button button-secondary" to="/room-studio">Tôi đã sẵn sàng tạo ảnh</Link></div>
            <p className="fh-hero-note">Bạn chưa cần biết viết prompt. Chúng tôi sẽ hướng dẫn từng thông tin cần thiết.</p>
          </div>
          <div className="fh-room-story" aria-label="Ảnh phòng và các phương án nội thất">
            <div className="fh-room-slideshow" role="group" aria-label="Slideshow ảnh phòng">
              <figure className="fh-room-slide">
                <img src="/images/home-room-1.webp" alt="Phòng trọ có gác lửng và sàn gạch" />
              </figure>
              <figure className="fh-room-slide" aria-hidden="true">
                <img src="/images/home-room-2.webp" alt="Phòng trọ sau khi thử một bàn thấp" />
              </figure>
              <figure className="fh-room-slide" aria-hidden="true">
                <img src="/images/home-room-3.webp" alt="Phòng trọ sau khi thử thêm tủ đựng đồ" />
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section className="container fh-start-section">
        <div className="fh-section-intro"><p className="eyebrow">BA BƯỚC RÕ RÀNG</p><h2>Bắt đầu ngay cả khi bạn chưa từng thử AI</h2><p>Mỗi bước chỉ yêu cầu một quyết định nhỏ; bạn luôn thấy mình đang làm gì tiếp theo.</p></div>
        <div className="fh-step-grid">
          <article><span>01</span><h3>Chọn sản phẩm trước</h3><p>Chọn món bạn muốn thử trong danh mục, để ảnh không tự đoán một món đồ khác.</p><Link to="/products">Xem sản phẩm →</Link></article>
          <article><span>02</span><h3>Tải ảnh và đặt vị trí</h3><p>Đặt sản phẩm trên ảnh phòng. Căn phối cảnh là tùy chọn, không phải điều kiện để tạo ảnh.</p><Link to="/room-studio">Mở Phòng thử →</Link></article>
          <article><span>03</span><h3>Xem, lưu hoặc chia sẻ</h3><p>Mẫu luôn riêng tư ban đầu. Đăng nhập khi bạn muốn lưu vào tài khoản hoặc công khai nó.</p><Link to="/collections/public">Khám phá mẫu →</Link></article>
        </div>
      </section>

      <section className="container fh-priority-section">
        <div><p className="eyebrow">ĐIỀU GÌ QUAN TRỌNG NHẤT?</p><h2>Để ảnh thử đúng hơn, hãy cho AI dữ liệu đúng theo thứ tự này.</h2><p>Prompt mô tả phong cách rất hữu ích, nhưng không thể thay thế ảnh tham chiếu và công năng thực tế của món đồ.</p></div>
        <ol className="fh-priority-list">
          <li><strong>1. Món đồ thật</strong><span>Ảnh sản phẩm, tên, kích thước và cách dùng.</span></li>
          <li><strong>2. Vị trí trong phòng</strong><span>Bạn tự đặt món trên ảnh để xác định bố cục.</span></li>
          <li><strong>3. Mong muốn thêm</strong><span>Phong cách, màu sắc hoặc điều cần tránh trong ảnh thử.</span></li>
        </ol>
      </section>

      <section className="fh-guided-form-wrap"><div className="container fh-guided-form">
        <div><p className="eyebrow">GỢI Ý ĐIỀN THÔNG TIN</p><h2>Ví dụ cho một bàn trà thấp</h2><p>Những ô gợi ý này biến yêu cầu mơ hồ thành chỉ dẫn có thể kiểm tra được.</p></div>
        <div className="fh-form-preview" aria-label="Ví dụ các trường cần điền">
          <div><span>Sản phẩm & công năng</span><strong>Bàn trà thấp, dùng khi ngồi bệt</strong></div>
          <div><span>Kích thước thật</span><strong>Rộng × sâu × cao (cm)</strong></div>
          <div><span>Vị trí mong muốn</span><strong>Trên sàn, giữa hai đệm ngồi</strong></div>
          <div><span>Mô tả thêm <small>không bắt buộc</small></span><strong>Gỗ sáng, giữ nguyên lối đi</strong></div>
        </div>
        <p className="fh-floor-note"><b>Về phối cảnh:</b> chỉ chấm 4 góc của một ô chữ nhật thật trên sàn khi nhìn thấy rõ. Không có gạch hoặc không thấy đường ron? Bỏ qua bước này.</p>
      </div></section>

      <section className="container fh-home-callout"><div><p className="eyebrow">BẠN MUỐN XEM CÁCH NGƯỜI KHÁC LÀM?</p><h2>Khám phá mẫu được chủ sở hữu tự nguyện công khai.</h2><p>Dùng một mẫu làm điểm bắt đầu, sau đó tạo bản riêng cho căn phòng của bạn.</p></div><Link className="button" to="/collections/public">Xem mẫu công khai</Link></section>
    </main>
  );
}
