export const BANK_CONFIG = {
  bankId: 'VCB',
  bankName: 'Vietcombank (Ngân hàng TMCP Ngoại thương Việt Nam)',
  shortName: 'Vietcombank',
  accountNo: '9901397875',
  accountName: 'NGUYEN HONG PHUC',
};

/**
 * Generate a dynamic VietQR image URL compatible with VNPAY and all VN banking apps.
 * @param {number} amount - Total payment amount in VND
 * @param {string} memo - Transfer content / Order number
 * @returns {string} VietQR image URL
 */
export function getVietQrUrl(amount, memo) {
  const cleanMemo = encodeURIComponent((memo || '').replace(/[^a-zA-Z0-9]/g, ''));
  const cleanAccountName = encodeURIComponent(BANK_CONFIG.accountName);
  const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
  return `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.png?amount=${cleanAmount}&addInfo=${cleanMemo}&accountName=${cleanAccountName}`;
}
