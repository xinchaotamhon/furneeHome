import { formatPrice } from '../../utils/formatPrice';

export const SHIP_VOUCHERS = [
  {
    id: 'ship_hcm_20k',
    labelVi: 'Giảm 20.000₫ phí vận chuyển',
    discount: 20000,
    minOrder: 100000,
    code: 'SHIP20K',
  },
  {
    id: 'ship_south_30k',
    labelVi: 'Giảm 30.000₫ phí vận chuyển',
    discount: 30000,
    minOrder: 200000,
    code: 'SHIP30K',
  },
  {
    id: 'ship_north_35k',
    labelVi: 'Giảm 35.000₫ phí vận chuyển',
    discount: 35000,
    minOrder: 300000,
    code: 'SHIP35K',
  },
];

export default function VoucherModal({ onClose, onApply, subtotal, appliedVoucherId, baseShippingFee }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="login-card voucher-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        <h2 id="voucher-modal-title">Voucher vận chuyển</h2>
        <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#6b7280' }}>
          Voucher không giới hạn thời gian sử dụng. Chọn voucher đủ điều kiện với đơn hàng.
        </p>

        <div className="voucher-list">
          {SHIP_VOUCHERS.map((v) => {
            const eligible = subtotal >= v.minOrder;
            const effectiveDiscount = Math.min(v.discount, baseShippingFee);
            const isSelected = appliedVoucherId === v.id;

            return (
              <button
                key={v.id}
                type="button"
                className={"voucher-item" + (isSelected ? " voucher-item--selected" : "") + (!eligible ? " voucher-item--disabled" : "")}
                onClick={() => { if (!eligible) return; onApply(isSelected ? null : v); onClose(); }}
                disabled={!eligible}
              >
                <div className="voucher-item-left">
                  <div className="voucher-tag">{v.code}</div>
                  <div className="voucher-label">{v.labelVi}</div>
                  <div className="voucher-desc">Đơn tối thiểu {formatPrice(v.minOrder)}</div>
                  {eligible && <div className="voucher-save">Tiết kiệm {formatPrice(effectiveDiscount)}</div>}
                  {!eligible && (
                    <div className="voucher-locked">
                      `Cần thêm ${formatPrice(v.minOrder - subtotal)} để dùng`
                    </div>
                  )}
                </div>
                <div className="voucher-item-right">
                  {isSelected ? (
                    <span className="voucher-check">✓</span>
                  ) : eligible ? (
                    <span className="voucher-use">Dùng</span>
                  ) : (
                    <span className="voucher-na">Chưa đủ</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {appliedVoucherId && (
          <button type="button" className="voucher-remove-btn" onClick={() => { onApply(null); onClose(); }}>
            Bỏ áp dụng voucher
          </button>
        )}
      </div>
    </div>
  );
}
