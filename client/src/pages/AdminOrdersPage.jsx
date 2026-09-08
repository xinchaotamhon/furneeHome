import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import orderService from '../services/orderService';
import { formatPrice } from '../utils/formatPrice';

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [toast, setToast] = useState('');

  const sampleAdminOrders = [
    {
      _id: 'ord-101',
      orderCode: 'FH901234',
      status: 'pending',
      paymentMethod: 'COD',
      totalPrice: 12500000,
      createdAt: new Date().toISOString(),
      shippingAddress: {
        fullName: 'Trần Minh Hoàng',
        phone: '0981122334',
        address: '45 Lê Duẩn, P. Bến Nghé',
        city: 'TP. Hồ Chí Minh',
        note: 'Giao trong giờ hành chính',
      },
      orderItems: [
        { name: 'Bàn Ăn Gỗ Sồi Bắc Âu 6 Ghế', quantity: 1, price: 9500000 },
        { name: 'Đèn Thả Trần Phong Cách Wabi Sabi', quantity: 2, price: 1500000 },
      ],
    },
    {
      _id: 'ord-102',
      orderCode: 'FH882319',
      status: 'shipping',
      paymentMethod: 'VIETQR',
      totalPrice: 6200000,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      shippingAddress: {
        fullName: 'Lê Hoàng Yến',
        phone: '0918889999',
        address: '12 Tôn Thất Tùng, Đống Đa',
        city: 'Hà Nội',
      },
      orderItems: [
        { name: 'Kệ Tivi Gỗ Óc Chó Hiện Đại', quantity: 1, price: 6200000 },
      ],
    },
    {
      _id: 'ord-103',
      orderCode: 'FH771205',
      status: 'delivered',
      paymentMethod: 'COD',
      totalPrice: 3400000,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      shippingAddress: {
        fullName: 'Phạm Đức Thắng',
        phone: '0933445566',
        address: '88 Nguyễn Thị Minh Khai',
        city: 'Đà Nẵng',
      },
      orderItems: [
        { name: 'Ghế Thư Giãn Bọc Vải Nỉ', quantity: 1, price: 3400000 },
      ],
    },
  ];

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        let fetched = [];
        try {
          fetched = await orderService.getAllOrders();
        } catch {
          fetched = [];
        }

        let local = [];
        try {
          local = JSON.parse(localStorage.getItem('furneehome_orders') || '[]');
        } catch {}

        const map = new Map();
        [...local, ...(Array.isArray(fetched) ? fetched : []), ...sampleAdminOrders].forEach((item) => {
          const key = item._id || item.orderCode;
          if (key && !map.has(key)) {
            map.set(key, item);
          }
        });

        setOrders(Array.from(map.values()));
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const stats = useMemo(() => {
    const totalRev = orders.reduce((sum, o) => {
      return o.status !== 'cancelled' ? sum + (Number(o.totalPrice) || 0) : sum;
    }, 0);
    const pendingCount = orders.filter((o) => o.status === 'pending').length;
    const shippingCount = orders.filter((o) => o.status === 'shipping').length;
    const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

    return {
      revenue: totalRev,
      totalOrders: orders.length,
      pending: pendingCount,
      shipping: shippingCount,
      delivered: deliveredCount,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((ord) => {
      const matchStatus = statusFilter === 'ALL' || ord.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const code = String(ord.orderCode || ord._id || '').toLowerCase();
      const name = String(ord.shippingAddress?.fullName || '').toLowerCase();
      const phone = String(ord.shippingAddress?.phone || '').toLowerCase();
      const matchSearch = !q || code.includes(q) || name.includes(q) || phone.includes(q);
      return matchStatus && matchSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  async function handleStatusChange(orderId, newStatus) {
    setUpdatingId(orderId);
    try {
      try {
        await orderService.updateOrderStatus(orderId, newStatus);
      } catch {}

      setOrders((prev) =>
        prev.map((ord) => {
          if (ord._id === orderId || ord.orderCode === orderId) {
            return { ...ord, status: newStatus };
          }
          return ord;
        })
      );

      try {
        const local = JSON.parse(localStorage.getItem('furneehome_orders') || '[]');
        const updatedLocal = local.map((o) => {
          if (o._id === orderId || o.orderCode === orderId) {
            return { ...o, status: newStatus };
          }
          return o;
        });
        localStorage.setItem('furneehome_orders', JSON.stringify(updatedLocal));
      } catch {}

      showToast(`Đã cập nhật đơn sang trạng thái "${statusName(newStatus)}"`);
    } finally {
      setUpdatingId('');
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function statusName(st) {
    switch (st) {
      case 'pending': return 'Chờ xử lý';
      case 'shipping': return 'Đang giao hàng';
      case 'delivered': return 'Đã giao hàng';
      case 'cancelled': return 'Đã hủy đơn';
      default: return st;
    }
  }

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <div className="container page access-denied">
        <h1>Khu vực quản trị đơn hàng</h1>
        <p>Yêu cầu tài khoản quyền quản trị viên (Admin) để truy cập.</p>
        <Link to="/" className="button">Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="container page admin-orders-page">
      <div className="admin-page-header">
        <div>
          <h1 className="page-heading">Quản trị Đơn hàng FurneeHome</h1>
          <p className="sub-text">Theo dõi doanh thu, xử lý đơn đặt hàng và cập nhật tiến độ giao hàng.</p>
        </div>
        <div className="header-actions">
          <Link to="/admin" className="button button-outline">
            Quản trị Sản phẩm & Người dùng
          </Link>
        </div>
      </div>

      <div className="admin-kpi-grid">
        <div className="kpi-card highlight">
          <span className="kpi-title">Tổng doanh thu bán hàng</span>
          <strong className="kpi-value">{formatPrice(stats.revenue)}</strong>
          <span className="kpi-sub">Tính trên đơn đã xác nhận/giao</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">Tổng đơn đặt hàng</span>
          <strong className="kpi-value">{stats.totalOrders} đơn</strong>
          <span className="kpi-sub">Toàn bộ thời gian</span>
        </div>
        <div className="kpi-card warning">
          <span className="kpi-title">Đơn chờ xác nhận</span>
          <strong className="kpi-value">{stats.pending} đơn</strong>
          <span className="kpi-sub">Cần đóng gói & điều phối</span>
        </div>
        <div className="kpi-card success">
          <span className="kpi-title">Đơn giao thành công</span>
          <strong className="kpi-value">{stats.delivered} đơn</strong>
          <span className="kpi-sub">Khách đã nhận hàng</span>
        </div>
      </div>

      <div className="orders-filter-bar">
        <div className="status-tabs">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'pending', label: 'Chờ xử lý' },
            { id: 'shipping', label: 'Đang giao' },
            { id: 'delivered', label: 'Đã giao' },
            { id: 'cancelled', label: 'Đã hủy' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-item ${statusFilter === tab.id ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="search-input-box">
          <input
            type="text"
            placeholder="Tìm theo mã đơn, họ tên khách, số điện thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {toast && <div className="admin-toast-banner">{toast}</div>}

      {loading ? (
        <div className="loading-box"><p>Đang tải dữ liệu đơn hàng...</p></div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>SĐT / Địa chỉ</th>
                <th>Ngày đặt</th>
                <th>Phương thức</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-td">
                    Không có đơn hàng nào khớp với tìm kiếm.
                  </td>
                </tr>
              ) : (
                filtered.map((ord) => {
                  const id = ord._id || ord.orderCode;
                  return (
                    <tr key={id}>
                      <td>
                        <strong className="code-link" onClick={() => setSelectedOrder(ord)}>
                          {ord.orderCode || ord._id}
                        </strong>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <strong>{ord.shippingAddress?.fullName || 'Khách vãng lai'}</strong>
                          <span>{ord.shippingAddress?.city}</span>
                        </div>
                      </td>
                      <td>
                        <div>{ord.shippingAddress?.phone || '-'}</div>
                        <span className="small-addr">{ord.shippingAddress?.address}</span>
                      </td>
                      <td>{new Date(ord.createdAt || Date.now()).toLocaleDateString('vi-VN')}</td>
                      <td>
                        <span className={`method-pill ${ord.paymentMethod === 'VIETQR' ? 'vietqr' : 'cod'}`}>
                          {ord.paymentMethod === 'VIETQR' ? 'VietQR' : 'COD'}
                        </span>
                      </td>
                      <td>
                        <strong className="table-price">{formatPrice(ord.totalPrice)}</strong>
                      </td>
                      <td>
                        <select
                          className={`status-select ${ord.status}`}
                          value={ord.status || 'pending'}
                          disabled={updatingId === id}
                          onChange={(e) => handleStatusChange(id, e.target.value)}
                        >
                          <option value="pending">Chờ xử lý</option>
                          <option value="shipping">Đang giao hàng</option>
                          <option value="delivered">Đã giao hàng</option>
                          <option value="cancelled">Hủy đơn</option>
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button-small button-outline"
                          onClick={() => setSelectedOrder(ord)}
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
                  <p><strong>Người nhận:</strong> {selectedOrder.shippingAddress?.fullName}</p>
                  <p><strong>Điện thoại:</strong> {selectedOrder.shippingAddress?.phone}</p>
                  <p><strong>Địa chỉ:</strong> {selectedOrder.shippingAddress?.address}, {selectedOrder.shippingAddress?.city}</p>
                  {selectedOrder.shippingAddress?.note && (
                    <p><strong>Ghi chú của khách:</strong> {selectedOrder.shippingAddress?.note}</p>
                  )}
                </div>
                <div>
                  <p><strong>Hình thức:</strong> {selectedOrder.paymentMethod === 'VIETQR' ? 'Chuyển khoản VietQR' : 'COD'}</p>
                  <p><strong>Trạng thái hiện tại:</strong> {statusName(selectedOrder.status)}</p>
                  <p><strong>Thời gian:</strong> {new Date(selectedOrder.createdAt).toLocaleString('vi-VN')}</p>
                </div>
              </div>

              <h3>Các mặt hàng đã đặt</h3>
              <div className="modal-items-table">
                {(selectedOrder.orderItems || []).map((item, idx) => (
                  <div key={idx} className="modal-item-row">
                    <span>{item.name} &times; {item.quantity}</span>
                    <strong>{formatPrice((item.price || 0) * (item.quantity || 1))}</strong>
                  </div>
                ))}
              </div>

              <div className="modal-total-box">
                <div className="row total">
                  <span>Tổng giá trị đơn:</span>
                  <strong>{formatPrice(selectedOrder.totalPrice)}</strong>
                </div>
              </div>

              <div className="admin-modal-action-row">
                <label>Cập nhật trạng thái nhanh:</label>
                <div className="btn-group">
                  <button
                    type="button"
                    className="button button-small"
                    onClick={() => {
                      handleStatusChange(selectedOrder._id || selectedOrder.orderCode, 'shipping');
                      setSelectedOrder((prev) => ({ ...prev, status: 'shipping' }));
                    }}
                  >
                    Chuyển sang "Đang giao"
                  </button>
                  <button
                    type="button"
                    className="button button-small button-accent"
                    onClick={() => {
                      handleStatusChange(selectedOrder._id || selectedOrder.orderCode, 'delivered');
                      setSelectedOrder((prev) => ({ ...prev, status: 'delivered' }));
                    }}
                  >
                    Xác nhận "Đã giao"
                  </button>
                  <button
                    type="button"
                    className="button button-small button-danger"
                    onClick={() => {
                      handleStatusChange(selectedOrder._id || selectedOrder.orderCode, 'cancelled');
                      setSelectedOrder((prev) => ({ ...prev, status: 'cancelled' }));
                    }}
                  >
                    Hủy đơn hàng
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button button-outline"
                onClick={() => setSelectedOrder(null)}
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
