/**
 * Tiện ích kiểm tra tính hợp lệ của số điện thoại và địa chỉ giao hàng
 */

/**
 * Kiểm tra số điện thoại có thuộc vùng Việt Nam hay không:
 * - 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09
 * - Hoặc đầu số quốc tế +84 / 84 theo sau bởi 9 số
 */
export function validateVietnamPhone(phone) {
  if (!phone) {
    return { isValid: false, message: 'Vui lòng nhập số điện thoại.' };
  }

  const cleanPhone = String(phone).trim().replace(/[\s.-]/g, '');

  // Regex kiểm tra số điện thoại Việt Nam hợp lệ
  const vnPhoneRegex = /^(?:\+?84|0)[35789]\d{8}$/;

  if (!vnPhoneRegex.test(cleanPhone)) {
    return {
      isValid: false,
      message: 'Số điện thoại không hợp lệ trong vùng Việt Nam. Vui lòng nhập số điện thoại gồm 10 chữ số (đầu số 03, 05, 07, 08, 09 hoặc +84).'
    };
  }

  return { isValid: true, cleanPhone };
}

/**
 * Kiểm tra địa chỉ cụ thể:
 * - Độ dài hợp lệ (từ 5 đến 150 ký tự).
 * - Phải có chữ cái (tên đường/phố/ngõ/xóm, không được chỉ toàn số).
 * - Không được chứa ký tự tầm bậy, mã độc hoặc ký tự đặc biệt vô nghĩa: < > { } [ ] $ ^ ~ \ | @ # % & * = + _ ` ! ?
 * - Chỉ cho phép chữ cái tiếng Việt, chữ số, khoảng trắng, và dấu phân cách chuẩn: , . / -
 * - Không chứa chuỗi lặp ký tự liên tiếp quá 4 lần (chống spam).
 */
export function validateSpecificAddress(address) {
  if (!address || typeof address !== 'string') {
    return { isValid: false, message: 'Vui lòng điền địa chỉ cụ thể (số nhà, tên đường).' };
  }

  const trimmed = address.trim();

  if (trimmed.length < 5) {
    return {
      isValid: false,
      message: 'Địa chỉ cụ thể quá ngắn. Vui lòng nhập rõ số nhà, tên đường (tối thiểu 5 ký tự).'
    };
  }

  if (trimmed.length > 150) {
    return {
      isValid: false,
      message: 'Địa chỉ cụ thể quá dài. Vui lòng nhập tối đa 150 ký tự.'
    };
  }

  // Phải có ít nhất một chữ cái
  if (!/[a-zA-ZÀ-ỹà-ỹ]/.test(trimmed)) {
    return {
      isValid: false,
      message: 'Địa chỉ cụ thể phải có tên đường hoặc tên khu vực (không được chỉ nhập toàn số).'
    };
  }

  // Không được chứa ký tự tầm bậy / đặc biệt
  const invalidCharRegex = /[^a-zA-Z0-9\sÀ-ỹà-ỹ.,/–\-]/;
  if (invalidCharRegex.test(trimmed)) {
    return {
      isValid: false,
      message: 'Địa chỉ chứa ký tự đặc biệt không hợp lệ. Vui lòng chỉ dùng chữ, số, dấu phẩy, chấm, gạch chéo (/) hoặc gạch ngang (-).'
    };
  }

  // Chống spam lặp ký tự (ví dụ: aaaaa, ....., /////)
  if (/(.)\1{4,}/.test(trimmed)) {
    return {
      isValid: false,
      message: 'Địa chỉ chứa các ký tự lặp lại bất thường. Vui lòng nhập đúng địa chỉ thực tế.'
    };
  }

  return { isValid: true, address: trimmed };
}
