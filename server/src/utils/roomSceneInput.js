// Mẫu mô tả và đặc tính sản phẩm dùng chung cho API tạo ảnh và lưu collection.
function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function text(value, max, label) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) invalid(`${label} không hợp lệ.`);
  return value.trim();
}

function cleanDesignBrief(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Mẫu mô tả phòng không hợp lệ.');
  return {
    purpose: text(value.purpose, 80, 'Mục đích sử dụng'),
    style: text(value.style, 80, 'Phong cách'),
    keepClear: text(value.keepClear, 120, 'Khu vực cần giữ trống'),
    avoid: text(value.avoid, 120, 'Điều cần tránh'),
  };
}

function cleanProductFacts(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Thông tin sản phẩm không hợp lệ.');
  const usageType = value.usageType || 'unknown';
  const placementSurface = value.placementSurface || 'unknown';
  if (!['unknown', 'floor-seating', 'standard'].includes(usageType)) invalid('Cách sử dụng sản phẩm không hợp lệ.');
  if (!['unknown', 'floor', 'wall', 'tabletop'].includes(placementSurface)) invalid('Bề mặt đặt sản phẩm không hợp lệ.');
  const dimensionsCm = {};
  if (value.dimensionsCm != null) {
    if (typeof value.dimensionsCm !== 'object' || Array.isArray(value.dimensionsCm)) invalid('Kích thước sản phẩm không hợp lệ.');
    for (const field of ['width', 'depth', 'height']) {
      const number = value.dimensionsCm[field];
      if (number == null || number === '') continue;
      if (!Number.isFinite(number) || number <= 0 || number > 1000) invalid('Kích thước sản phẩm phải từ trên 0 đến 1000 cm.');
      dimensionsCm[field] = number;
    }
  }
  return { usageType, placementSurface, dimensionsCm, aiDescription: text(value.aiDescription, 300, 'Đặc điểm cần giữ') };
}

function cleanSceneProducts(value = []) {
  if (!Array.isArray(value) || value.length > 12) invalid('Danh sách tham chiếu tối đa 12 sản phẩm.');
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) invalid('Tham chiếu sản phẩm không hợp lệ.');
    const name = text(item.name, 200, 'Tên sản phẩm');
    if (!name) invalid('Thiếu tên sản phẩm tham chiếu.');
    for (const axis of ['x', 'y']) {
      if (!Number.isFinite(item.target?.[axis]) || item.target[axis] < 0 || item.target[axis] > 1) invalid('Vị trí tham chiếu không hợp lệ.');
    }
    return { name, target: { x: item.target.x, y: item.target.y }, ...cleanProductFacts(item) };
  });
}

module.exports = { cleanDesignBrief, cleanProductFacts, cleanSceneProducts };
