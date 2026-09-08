// Dữ liệu 63 tỉnh/thành phố chuẩn Việt Nam (dùng làm dữ liệu ban đầu hoặc fallback tức thì)
export const FALLBACK_PROVINCES = [
  { code: 79, name: 'Thành phố Hồ Chí Minh', region: 'hcm' },
  { code: 1, name: 'Thành phố Hà Nội', region: 'north' },
  { code: 48, name: 'Thành phố Đà Nẵng', region: 'central_south' },
  { code: 31, name: 'Thành phố Hải Phòng', region: 'north' },
  { code: 92, name: 'Thành phố Cần Thơ', region: 'central_south' },
  { code: 2, name: 'Tỉnh Hà Giang', region: 'north' },
  { code: 4, name: 'Tỉnh Cao Bằng', region: 'north' },
  { code: 6, name: 'Tỉnh Bắc Kạn', region: 'north' },
  { code: 8, name: 'Tỉnh Tuyên Quang', region: 'north' },
  { code: 10, name: 'Tỉnh Lào Cai', region: 'north' },
  { code: 11, name: 'Tỉnh Điện Biên', region: 'north' },
  { code: 12, name: 'Tỉnh Lai Châu', region: 'north' },
  { code: 14, name: 'Tỉnh Sơn La', region: 'north' },
  { code: 15, name: 'Tỉnh Yên Bái', region: 'north' },
  { code: 17, name: 'Tỉnh Hoà Bình', region: 'north' },
  { code: 19, name: 'Tỉnh Thái Nguyên', region: 'north' },
  { code: 20, name: 'Tỉnh Lạng Sơn', region: 'north' },
  { code: 22, name: 'Tỉnh Quảng Ninh', region: 'north' },
  { code: 24, name: 'Tỉnh Bắc Giang', region: 'north' },
  { code: 25, name: 'Tỉnh Phú Thọ', region: 'north' },
  { code: 26, name: 'Tỉnh Vĩnh Phúc', region: 'north' },
  { code: 27, name: 'Tỉnh Bắc Ninh', region: 'north' },
  { code: 30, name: 'Tỉnh Hải Dương', region: 'north' },
  { code: 33, name: 'Tỉnh Hưng Yên', region: 'north' },
  { code: 34, name: 'Tỉnh Thái Bình', region: 'north' },
  { code: 35, name: 'Tỉnh Hà Nam', region: 'north' },
  { code: 36, name: 'Tỉnh Nam Định', region: 'north' },
  { code: 37, name: 'Tỉnh Ninh Bình', region: 'north' },
  { code: 38, name: 'Tỉnh Thanh Hóa', region: 'north' },
  { code: 40, name: 'Tỉnh Nghệ An', region: 'north' },
  { code: 42, name: 'Tỉnh Hà Tĩnh', region: 'north' },
  { code: 44, name: 'Tỉnh Quảng Bình', region: 'north' },
  { code: 45, name: 'Tỉnh Quảng Trị', region: 'north' },
  { code: 46, name: 'Thành phố Huế', region: 'north' },
  { code: 49, name: 'Tỉnh Quảng Nam', region: 'central_south' },
  { code: 51, name: 'Tỉnh Quảng Ngãi', region: 'central_south' },
  { code: 52, name: 'Tỉnh Bình Định', region: 'central_south' },
  { code: 54, name: 'Tỉnh Phú Yên', region: 'central_south' },
  { code: 56, name: 'Tỉnh Khánh Hòa', region: 'central_south' },
  { code: 58, name: 'Tỉnh Ninh Thuận', region: 'central_south' },
  { code: 60, name: 'Tỉnh Bình Thuận', region: 'central_south' },
  { code: 62, name: 'Tỉnh Kon Tum', region: 'central_south' },
  { code: 64, name: 'Tỉnh Gia Lai', region: 'central_south' },
  { code: 66, name: 'Tỉnh Đắk Lắk', region: 'central_south' },
  { code: 67, name: 'Tỉnh Đắk Nông', region: 'central_south' },
  { code: 68, name: 'Tỉnh Lâm Đồng', region: 'central_south' },
  { code: 70, name: 'Tỉnh Bình Phước', region: 'central_south' },
  { code: 72, name: 'Tỉnh Tây Ninh', region: 'central_south' },
  { code: 74, name: 'Tỉnh Bình Dương', region: 'central_south' },
  { code: 75, name: 'Tỉnh Đồng Nai', region: 'central_south' },
  { code: 77, name: 'Tỉnh Bà Rịa - Vũng Tàu', region: 'central_south' },
  { code: 80, name: 'Tỉnh Long An', region: 'central_south' },
  { code: 82, name: 'Tỉnh Tiền Giang', region: 'central_south' },
  { code: 83, name: 'Tỉnh Bến Tre', region: 'central_south' },
  { code: 84, name: 'Tỉnh Trà Vinh', region: 'central_south' },
  { code: 86, name: 'Tỉnh Vĩnh Long', region: 'central_south' },
  { code: 87, name: 'Tỉnh Đồng Tháp', region: 'central_south' },
  { code: 89, name: 'Tỉnh An Giang', region: 'central_south' },
  { code: 91, name: 'Tỉnh Kiên Giang', region: 'central_south' },
  { code: 93, name: 'Tỉnh Hậu Giang', region: 'central_south' },
  { code: 94, name: 'Tỉnh Sóc Trăng', region: 'central_south' },
  { code: 95, name: 'Tỉnh Bạc Liêu', region: 'central_south' },
  { code: 96, name: 'Tỉnh Cà Mau', region: 'central_south' },
];

const API_BASE = 'https://provinces.open-api.vn/api';
const districtCache = new Map();
const wardCache = new Map();

/**
 * Tính toán phí vận chuyển theo vùng miền:
 * - TP. Hồ Chí Minh: 30.000₫
 * - Đà Nẵng đổ lại vào Hồ Chí Minh (code >= 48, trừ 79): 40.000₫
 * - Đổ vào Hà Nội & các tỉnh phía Bắc (code < 48): 60.000₫
 */
export function calculateShippingFee(provinceCode) {
  if (!provinceCode) {
    return {
      fee: 30000,
      label: 'Nội thành TP.HCM (30.000₫)',
      region: 'hcm',
    };
  }

  const code = Number(provinceCode);
  if (code === 79) {
    return {
      fee: 30000,
      label: 'Nội thành TP. Hồ Chí Minh (30.000₫)',
      region: 'hcm',
    };
  }

  if (code >= 48) {
    return {
      fee: 40000,
      label: 'Khu vực Đà Nẵng - TP. Hồ Chí Minh (40.000₫)',
      region: 'central_south',
    };
  }

  return {
    fee: 60000,
    label: 'Khu vực Hà Nội & các tỉnh phía Bắc (60.000₫)',
    region: 'north',
  };
}

export async function fetchProvinces() {
  try {
    const res = await fetch(`${API_BASE}/p/`);
    if (!res.ok) throw new Error('Failed to fetch provinces');
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data : FALLBACK_PROVINCES;
  } catch {
    return FALLBACK_PROVINCES;
  }
}

export async function fetchDistricts(provinceCode) {
  if (!provinceCode) return [];
  const code = Number(provinceCode);
  if (districtCache.has(code)) {
    return districtCache.get(code);
  }

  try {
    const res = await fetch(`${API_BASE}/p/${code}?depth=2`);
    if (!res.ok) throw new Error('Failed to fetch districts');
    const data = await res.json();
    const districts = Array.isArray(data.districts) ? data.districts : [];
    districtCache.set(code, districts);
    return districts;
  } catch (error) {
    console.error('Error loading districts:', error);
    return [];
  }
}

export async function fetchWards(districtCode) {
  if (!districtCode) return [];
  const code = Number(districtCode);
  if (wardCache.has(code)) {
    return wardCache.get(code);
  }

  try {
    const res = await fetch(`${API_BASE}/d/${code}?depth=2`);
    if (!res.ok) throw new Error('Failed to fetch wards');
    const data = await res.json();
    const wards = Array.isArray(data.wards) ? data.wards : [];
    wardCache.set(code, wards);
    return wards;
  } catch (error) {
    console.error('Error loading wards:', error);
    return [];
  }
}
