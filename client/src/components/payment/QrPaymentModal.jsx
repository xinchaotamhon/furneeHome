import { useState } from 'react';
import QrPaymentCard from './QrPaymentCard';
import orderService from '../../services/orderService';

export default function QrPaymentModal({ order, onClose, onConfirmed }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [currentOrder, setCurrentOrder] = useState(order);

  if (!currentOrder) return null;

  const isPaid = currentOrder.paymentStatus === 'Paid';
  const isConfirmed = Boolean(currentOrder.customerConfirmedPayment);

  const handleConfirmPayment = async () => {
    setLoading(true);
    setMessage('');
    try {
      const updated = await orderService.confirmPayment(currentOrder._id);
      setCurrentOrder(updated);
      setMessage('✓ Đã gửi thông báo chuyển khoản tới shop thành công!');
      if (onConfirmed) onConfirmed(updated);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Không thể xác nhận lúc này, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

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
          <QrPaymentCard order={currentOrder} showTitle={false} />
          {message && (
            <div style={{
              margin: '12px 0 0',
              padding: '10px 14px',
              borderRadius: '6px',
              background: message.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${message.startsWith('✓') ? '#86efac' : '#fecaca'}`,
              color: message.startsWith('✓') ? '#166534' : '#991b1b',
              fontSize: '0.88rem',
              fontWeight: 500,
            }}>
              {message}
            </div>
          )}
        </div>
        <footer className="qr-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Đóng
          </button>
          {!isPaid && (
            <button
              type="button"
              className="button button-primary"
              disabled={loading || isConfirmed}
              onClick={handleConfirmPayment}
              style={isConfirmed ? { background: '#16a34a', borderColor: '#16a34a', cursor: 'default' } : {}}
            >
              {loading ? 'Đang gửi…' : isConfirmed ? '✓ Đã báo chuyển khoản' : '✓ Tôi đã chuyển khoản'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
