import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';

export default function OrderHistoryPage() {
  const { user, openLogin } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchCode, setSearchCode] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      try {
        let fetched = [];
        try {
          fetched = await orderService.getMyOrders();
        } catch {
          fetched = [];
        }

        let local = [];
        try {
          local = JSON.parse(localStorage.getItem('furneehome_orders') || '[]');
        } catch {}

        const mergedMap = new Map();
        [...local, ...(Array.isArray(fetched) ? fetched : [])].forEach((ord) => {
          const key = ord._id || ord.orderCode;
          if (key && !mergedMap.has(key)) {
            mergedMap.set(key, ord);
          }
        });

        if (mergedMap.size === 0) {
          const sample = [
            {
              _id: 'sample-ord-1',
              orderCode: 'FH829104',
              status: 'delivered',
              paymentMethod: 'COD',
              itemsPrice: 4850000,
              shippingPrice: 0,
              totalPrice: 4850000,
              createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
              shippingAddress: {
                fullName: user?.name || 'Nguyễn Văn A',
                phone: '0901234567',
                address: '123 Nguyễn Huệ, P. Bến Nghé, Quận 1',
                city: 'TP. Hồ Chí Minh',
              },
              orderItems: [
                {
                  name: 'Ghế Sofa Băng Minimalist Gỗ Sồi',
                  quantity: 1,
                  price: 4850000,
                  image: '/images/home-room-1.webp',
                },
              ],
            },
          ];
          setOrders(sample);
        } else {
          setOrders(Array.from(mergedMap.values()));
        }
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, [user]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const matchStatus = filterStatus === 'ALL' || ord.status === filterStatus;
      const code = String(ord.orderCode || ord._id || '').toLowerCase();
      const matchCode = !searchCode || code.includes(searchCode.trim().toLowerCase());
      return matchStatus && matchCode;
    });
  }, [orders, filterStatus, searchCode]);

  function statusLabel(status) {
    switch (status) {
      case 'pending':
        return { text: 'Chờ xác nhận', cls: 'badge-pending' };
      case 'shipping':
        return { text: 'Đang vận chuyển', cls: 'badge-shipping' };
      case 'delivered':
        return { text: 'Đã giao thành công', cls: 'badge-delivered' };
      case 'cancelled':
        return { text: 'Đã hủy đơn', cls: 'badge-cancelled' };
      default:
        return { text: 'Đang xử lý', cls: 'badge-pending' };
    }
  }

  if (!user) {
    return (
      <div className="container page order-history-page auth-required">
        <div className="empty-cart-card">
          <h2>Đăng nhập để xem lịch sử đơn hàng</h2>
          <p>Theo dõi tiến độ đơn hàng và thông tin bảo hành các món đồ nội thất của bạn.</p>
          <button type="button" className="button" onClick={() => openLogin('login')}>
            Đăng nhập tài khoản
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container page order-history-page">
      <div className="orders-header-row">
        <div>
          <h1 className="page-heading">Lịch sử đơn hàng của tôi</h1>
          <p className="sub-text">Quản lý và theo dõi tiến độ các đơn hàng bạn đã đặt tại FurneeHome.</p>
        </div>
        <Link to="/products" className="button button-outline">
          + Tiếp tục mua sắm
        </Link>
      </div>

      <div className="orders-filter-bar">
        <div className="status-tabs">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'pending', label: 'Chờ xác nhận' },
            { id: 'shipping', label: 'Đang giao' },
            { id: 'delivered', label: 'Đã giao' },
            { id: 'cancelled', label: 'Đã hủy' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-item ${filterStatus === tab.id ? 'active' : ''}`}
              onClick={() => setFilterStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="search-input-box">
          <input
            type="text"
            placeholder="Tìm theo mã đơn (FH...)"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-box">
          <p>Đang tải danh sách đơn hàng...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-orders-box">
          <p>Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.</p>
          <Link to="/products" className="button button-outline">
            Khám phá bộ sưu tập nội thất
          </Link>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map((ord) => {
            const badge = statusLabel(ord.status);
            const items = ord.orderItems || [];
            return (
              <div key={ord._id || ord.orderCode} className="order-item-card">
                <div className="card-top">
                  <div className="order-id-meta">
                    <span className="order-tag">MÃ ĐƠN:</span>
                    <strong className="code-text">{ord.orderCode || ord._id}</strong>
                    <span className="order-date">
                      {new Date(ord.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="order-status-badge">
                    <span className={`badge ${badge.cls}`}>{badge.text}</span>
                  </div>
                </div>

                <div className="card-products-preview">
                  {items.map((it, idx) => (
                    <div key={idx} className="ord-prod-row">
                      <div className="ord-thumb">
                        {it.image ? <img src={it.image} alt={it.name} /> : <span>&#129681;</span>}
                      </div>
                      <div className="ord-name-qty">
                        <p className="p-name">{it.name}</p>
                        <p className="p-sub">Số lượng: {it.quantity} &times; {formatPrice(it.price)}</p>
                      </div>
                      <div className="ord-line-price">
                        {formatPrice((it.price || 0) * (it.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card-bottom">
                  <div className="bottom-info">
                    <span>Phương thức: <strong>{ord.paymentMethod === 'VIETQR' ? 'VietQR' : 'COD'}</strong></span>
                    <span>Địa chỉ: <strong>{ord.shippingAddress?.address}, {ord.shippingAddress?.city}</strong></span>
                  </div>
                  <div className="bottom-actions">
                    <span className="total-label">Tổng thanh toán:</span>
                    <strong className="grand-total">{formatPrice(ord.totalPrice)}</strong>
                    <button
                      type="button"
                      className="button button-small"
                      onClick={() => setSelectedOrder(ord)}
                    >
                      Chi tiết &rarr;
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="modal-dialog order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Chi tiết đơn hàng {selectedOrder.orderCode || selectedOrder._id}</h2>
              <button
                type="button"
                className="btn-close"
                onClick={() => setSelectedOrder(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-meta-grid">
                <div>
                  <p><strong>Khách hàng:</strong> {selectedOrder.shippingAddress?.fullName}</p>
                  <p><strong>Số điện thoại:</strong> {selectedOrder.shippingAddress?.phone}</p>
                  <p><strong>Địa chỉ:</strong> {selectedOrder.shippingAddress?.address}, {selectedOrder.shippingAddress?.city}</p>
                  {selectedOrder.shippingAddress?.note && (
                    <p><strong>Ghi chú:</strong> {selectedOrder.shippingAddress?.note}</p>
                  )}
                </div>
                <div>
                  <p><strong>Hình thức:</strong> {selectedOrder.paymentMethod === 'VIETQR' ? 'Chuyển khoản VietQR' : 'Thanh toán COD'}</p>
                  <p><strong>Trạng thái:</strong> {statusLabel(selectedOrder.status).text}</p>
                  <p><strong>Ngày tạo:</strong> {new Date(selectedOrder.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </div>

              <h3>Danh sách sản phẩm</h3>
              <div className="modal-items-table">
                {(selectedOrder.orderItems || []).map((it, idx) => (
                  <div key={idx} className="modal-item-row">
                    <span>{it.name} (x{it.quantity})</span>
                    <strong>{formatPrice((it.price || 0) * (it.quantity || 1))}</strong>
                  </div>
                ))}
              </div>

              <div className="modal-total-box">
                <div className="row">
                  <span>Tạm tính:</span>
                  <span>{formatPrice(selectedOrder.itemsPrice || selectedOrder.totalPrice)}</span>
                </div>
                {selectedOrder.shippingPrice !== undefined && (
                  <div className="row">
                    <span>Phí vận chuyển:</span>
                    <span>{selectedOrder.shippingPrice === 0 ? 'Miễn phí' : formatPrice(selectedOrder.shippingPrice)}</span>
                  </div>
                )}
                <div className="row total">
                  <span>Tổng cộng:</span>
                  <strong>{formatPrice(selectedOrder.totalPrice)}</strong>
                </div>
              </div>

              {selectedOrder.paymentMethod === 'VIETQR' && selectedOrder.status === 'pending' && (
                <div className="modal-vietqr-section">
                  <h4>Mã thanh toán VietQR cho đơn hàng này:</h4>
                  <img
                    src={`https://img.vietqr.io/image/MB-0987654321-compact2.png?amount=${selectedOrder.totalPrice}&addInfo=${encodeURIComponent('THANHTOAN ' + (selectedOrder.orderCode || selectedOrder._id))}&accountName=CONG%20TY%20NOI%20THAT%20FURNEEHOME`}
                    alt="VietQR"
                    className="qr-modal-img"
                  />
                  <p className="qr-hint">MBBank: 0987654321 - Cú pháp: THANHTOAN {selectedOrder.orderCode || selectedOrder._id}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setSelectedOrder(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
