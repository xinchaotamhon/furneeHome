const bcrypt = require('bcryptjs');
const User = require('../models/User');

function profileData(user) {
  const profileComplete = Boolean(
    user.phone && user.address && user.provinceCode && user.districtCode && user.wardCode,
  );
  return {
    id: user._id,
    name: user.name,
    username: user.username || '',
    email: user.email,
    avatarUrl: user.avatarUrl || '',
    phone: user.phone || '',
    address: user.address || '',
    provinceCode: user.provinceCode || '',
    districtCode: user.districtCode || '',
    districtName: user.districtName || '',
    wardCode: user.wardCode || '',
    wardName: user.wardName || '',
    deliveryNote: user.deliveryNote || '',
    profileComplete,
    role: user.role,
  };
}

async function getMe(req, res) {
  return res.json({ success: true, message: 'Đã tải hồ sơ.', data: profileData(req.user) });
}

async function updateMe(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.', data: null });

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name || name.length < 2 || name.length > 20) {
        return res.status(400).json({ success: false, message: 'Họ và tên phải từ 2 đến 20 ký tự.', data: null });
      }
      user.name = name;
    }

    if (req.body.avatarUrl !== undefined) {
      const avatarUrl = String(req.body.avatarUrl || '').trim();
      const isWebUrl = !avatarUrl || /^https?:\/\/[^\s]+$/i.test(avatarUrl);
      if (!isWebUrl || avatarUrl.length > 2_000) {
        return res.status(400).json({ success: false, message: 'Ảnh đại diện không hợp lệ.', data: null });
      }
      user.avatarUrl = avatarUrl;
    }

    const deliveryFields = [
      'phone', 'address', 'provinceCode', 'districtCode', 'districtName',
      'wardCode', 'wardName', 'deliveryNote',
    ];
    const updatingDelivery = deliveryFields.some((field) => req.body[field] !== undefined);
    if (updatingDelivery) {
      const phone = String(req.body.phone || '').trim().replace(/[.\s-]/g, '');
      const address = String(req.body.address || '').normalize('NFC').trim();
      const provinceCode = Number(req.body.provinceCode);
      const districtCode = Number(req.body.districtCode);
      const districtName = String(req.body.districtName || '').normalize('NFC').trim();
      const wardCode = Number(req.body.wardCode);
      const wardName = String(req.body.wardName || '').normalize('NFC').trim();
      const deliveryNote = String(req.body.deliveryNote || '').trim();

      if (!/^(?:\+?84|0)[35789]\d{8}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Số điện thoại Việt Nam không hợp lệ.', data: null });
      }
      if (address.length < 5 || address.length > 150) {
        return res.status(400).json({ success: false, message: 'Địa chỉ phải từ 5 đến 150 ký tự.', data: null });
      }
      if (!Number.isInteger(provinceCode) || provinceCode < 1 || provinceCode > 99) {
        return res.status(400).json({ success: false, message: 'Tỉnh hoặc thành phố không hợp lệ.', data: null });
      }
      if (!Number.isInteger(districtCode) || districtCode < 1 || districtName.length > 100) {
        return res.status(400).json({ success: false, message: 'Quận hoặc huyện không hợp lệ.', data: null });
      }
      if (!districtName) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn quận hoặc huyện.', data: null });
      }
      if (!Number.isInteger(wardCode) || wardCode < 1 || wardName.length > 100) {
        return res.status(400).json({ success: false, message: 'Phường hoặc xã không hợp lệ.', data: null });
      }
      if (!wardName) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn phường hoặc xã.', data: null });
      }
      if (deliveryNote.length > 500) {
        return res.status(400).json({ success: false, message: 'Ghi chú giao hàng tối đa 500 ký tự.', data: null });
      }

      user.phone = phone;
      user.address = address;
      user.provinceCode = provinceCode;
      user.districtCode = districtCode;
      user.districtName = districtName;
      user.wardCode = wardCode;
      user.wardName = wardName;
      user.deliveryNote = deliveryNote;
    }

    await user.save();
    return res.json({ success: true, message: 'Đã cập nhật hồ sơ.', data: profileData(user) });
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    if (!currentPassword || newPassword.length < 6 || newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Thông tin mật khẩu không hợp lệ.', data: null });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.', data: null });
    const correctPassword = await bcrypt.compare(currentPassword, user.password);
    if (!correctPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.', data: null });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ success: true, message: 'Đã đổi mật khẩu.', data: null });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getMe, updateMe, changePassword, profileData };
