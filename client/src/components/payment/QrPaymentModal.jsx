import QrPaymentCard from './QrPaymentCard';

export default function QrPaymentModal({ order, onClose }) {
  if (!order) return null;

  return (
    <div className="modal-backdrop qr-modal-backdrop" onClick={onClose}>
      <div className="modal-content qr-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="qr-modal-header">
          <h3>Thông tin chuyển khoản ngân hàng</h3>
          <button type="button" className="close-button" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="qr-modal-body">
          <QrPaymentCard order={order} showTitle={false} />
        </div>
        <footer className="qr-modal-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </div>
    </div>
  );
}
