import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="fh-home">
      <section className="fh-hero">
        <div className="container fh-hero-grid">
          <div className="fh-hero-copy">
            <p className="eyebrow">NỘI THẤT CHO KHÔNG GIAN SỐNG</p>
            <h1>Chọn đúng sản phẩm cho căn phòng của bạn.</h1>
            <p>Tìm sản phẩm, thử trên ảnh phòng và lưu lại kết quả trong một quy trình đơn giản.</p>
            <div className="hero-actions">
              <Link className="button" to="/products">Xem sản phẩm</Link>
              <Link className="button button-secondary" to="/room-studio">Mở Phòng thử</Link>
            </div>
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
                <img src="/images/home-room-3.webp" alt="Phòng trọ sau khi thử bàn tròn và thảm" />
              </figure>
              <figure className="fh-room-slide" aria-hidden="true">
                <img src="/images/home-room-4.webp" alt="Phòng trọ sau khi thử giá treo đồ và bàn thấp" />
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section className="container fh-start-section">
        <div className="fh-section-intro">
          <p className="eyebrow">MUA HÀNG ĐƠN GIẢN</p>
          <h2>Từ lựa chọn đến căn phòng của bạn</h2>
        </div>
        <div className="fh-step-grid">
          <article>
            <span>01</span>
            <h3>Chọn sản phẩm</h3>
            <p>Tìm kiếm, lọc danh mục và chọn món đồ phù hợp.</p>
            <Link to="/products">Đến danh sách sản phẩm →</Link>
          </article>
          <article>
            <span>02</span>
            <h3>Đặt hàng</h3>
            <p>Thêm vào giỏ, nhập địa chỉ và thanh toán COD.</p>
            <Link to="/cart">Mở giỏ hàng →</Link>
          </article>
          <article>
            <span>03</span>
            <h3>Thử trong phòng</h3>
            <p>Tải ảnh phòng, chọn một món và tạo ảnh AI.</p>
            <Link to="/room-studio">Mở Phòng thử →</Link>
          </article>
        </div>
      </section>

      <section className="container fh-priority-section">
        <div>
          <p className="eyebrow">ĐIỂM NỔI BẬT</p>
          <h2>Xem sản phẩm ngay trong ảnh phòng thật</h2>
          <p>Tải ảnh phòng, chọn một sản phẩm và tạo kết quả để so sánh.</p>
        </div>
        <ol className="fh-priority-list">
          <li><strong>1. Ảnh phòng</strong><span>Không gian thật của người dùng.</span></li>
          <li><strong>2. Sản phẩm</strong><span>Món đồ người dùng muốn thử.</span></li>
          <li><strong>3. Kết quả</strong><span>Ảnh AI để so sánh với phòng gốc.</span></li>
        </ol>
      </section>
    </main>
  );
}
