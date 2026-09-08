import { useState } from 'react';
import { BANK_CONFIG, getVietQrUrl } from '../../config/bankConfig';
import { formatPrice } from '../../utils/formatPrice';

export default function QrPaymentCard({ order, onComplete, showTitle = true }) {
  const [copiedKey, setCopiedKey] = useState('');
  const [qrLoaded, setQrLoaded] = useState(false);

  const totalAmount = order.totalAmount ?? order.subtotal ?? 0;
  const orderNumber = order.orderNumber || (order._id ? `#${String(order._id).slice(-8).toUpperCase()}` : 'DH');
  const qrUrl = getVietQrUrl(totalAmount, orderNumber);

  const copyToClipboard = async (text, key) => {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2200);
    } catch {
      // Fallback
      const input = document.createElement('textarea');
      input.value = String(text);
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(''), 2200);
    }
  };

  const fields = [
    { key: 'bank', label: 'Ngân hàng', value: BANK_CONFIG.bankName, copyValue: BANK_CONFIG.shortName },
    { key: 'accountNo', label: 'Số tài khoản', value: BANK_CONFIG.accountNo, copyValue: BANK_CONFIG.accountNo, highlight: true },
    { key: 'accountName', label: 'Chủ tài khoản', value: BANK_CONFIG.accountName, copyValue: BANK_CONFIG.accountName },
    { key: 'amount', label: 'Số tiền thanh toán', value: formatPrice(totalAmount), copyValue: totalAmount, highlight: true },
    { key: 'memo', label: 'Nội dung chuyển khoản', value: orderNumber, copyValue: orderNumber, highlight: true, note: 'Vui lòng giữ nguyên nội dung này để xác nhận đơn hàng' },
  ];

  return (
    <div className="qr-payment-card">
      {showTitle && (
        <div className="qr-payment-header">
          <div className="qr-payment-badge">
            <span className="qr-badge-dot" />
            <span>Thanh toán QR qua VNPAY / VietQR</span>
          </div>
          <h2>Quét mã để thanh toán</h2>
          <p className="qr-instruction">
            Sử dụng ứng dụng <strong>VNPAY</strong> hoặc bất kỳ <strong>App Ngân hàng</strong> nào (Vietcombank, Techcombank, MB, Momo...) để quét mã bên dưới.
          </p>
        </div>
      )}

      <div className="qr-payment-body">
        {/* QR Code Column */}
        <div className="qr-code-section">
          <div className="qr-image-wrapper">
            {!qrLoaded && <div className="qr-placeholder">Đang tải mã QR…</div>}
            <img
              src={qrUrl}
              alt={`VietQR thanh toán đơn hàng ${orderNumber}`}
              className={`qr-image ${qrLoaded ? 'loaded' : ''}`}
              onLoad={() => setQrLoaded(true)}
            />
          </div>
          <p className="qr-app-support">
            <span className="app-tag vnpay">VNPAY</span>
            <span className="app-tag">VCB Digibank</span>
            <span className="app-tag">MBBank</span>
            <span className="app-tag">Techcom</span>
            <span className="app-tag">MoMo</span>
          </p>
        </div>

        {/* Bank Info Column */}
        <div className="qr-info-section">
          <div className="qr-info-list">
            {fields.map((f) => (
              <div className={`qr-info-row ${f.highlight ? 'highlight' : ''}`} key={f.key}>
                <div className="qr-info-meta">
                  <span className="qr-info-label">{f.label}</span>
                  <strong className="qr-info-value">{f.value}</strong>
                  {f.note && <small className="qr-info-note">{f.note}</small>}
                </div>
                <button
                  type="button"
                  className={`qr-copy-button ${copiedKey === f.key ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(f.copyValue, f.key)}
                  title={`Sao chép ${f.label}`}
                >
                  {copiedKey === f.key ? '✓ Đã chép' : 'Sao chép'}
                </button>
              </div>
            ))}
          </div>

          <div className="qr-mobile-tip">
            💡 <strong>Mẹo:</strong> Nếu bạn đang dùng điện thoại, hãy nhấn <em>"Sao chép"</em> số tài khoản và nội dung chuyển khoản để dán vào App ngân hàng của bạn.
          </div>

          {onComplete && (
            <div className="qr-actions">
              <button type="button" className="button button-full" onClick={onComplete}>
                Tôi đã hoàn tất chuyển khoản
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
