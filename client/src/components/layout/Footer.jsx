import { Link } from 'react-router-dom';

const contactPhone = import.meta.env.VITE_CONTACT_PHONE || '0900 000 000';
const contactAddress = import.meta.env.VITE_CONTACT_ADDRESS || 'TP. Hồ Chí Minh';
const zaloPhone = (import.meta.env.VITE_ZALO_PHONE || contactPhone).replace(/\D/g, '');

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
          <Link to="/feedback">Liên hệ</Link>
        </div>
        <div>
          <h2>Phù hợp với</h2>
          <p>Sinh viên, học sinh, công nhân và gia đình phổ thông.</p>
        </div>
        <div>
          <h2>Liên hệ</h2>
          <address className="fh-contact-address">{contactAddress}</address>
          <a href={`tel:${contactPhone.replace(/[^+\d]/g, '')}`}>☎ {contactPhone}</a>
          <a href={`https://zalo.me/${zaloPhone}`} target="_blank" rel="noreferrer">Zalo: {zaloPhone || contactPhone}</a>
        </div>
      </div>
      <div className="container fh-footer-bottom">
        <small>© 2026 FurneeHome</small>
      </div>
      <div className="fh-contact-float" aria-label="Liên hệ nhanh">
        <a className="fh-contact-float-button fh-phone-float" href={`tel:${contactPhone.replace(/[^+\d]/g, '')}`} aria-label={`Gọi ${contactPhone}`}>
          <span aria-hidden="true">☎</span><small>{contactPhone}</small>
        </a>
        <a className="fh-contact-float-button fh-zalo-float" href={`https://zalo.me/${zaloPhone}`} target="_blank" rel="noreferrer" aria-label="Mở Zalo">
          <span aria-hidden="true">Z</span><small>Zalo</small>
        </a>
      </div>
    </footer>
  );
}
