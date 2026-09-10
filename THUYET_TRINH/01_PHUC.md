# Phúc — Đăng nhập, Đăng ký, Tài khoản và quyền quản trị

> **Vị trí:** phần 1/4, mở bài bằng các trang xác thực. Sau khi chứng minh tài khoản đúng vai trò, bàn giao customer đang đăng nhập cho Dũng. Phần thao tác sâu trên các tab quản trị do Hiệp trình bày.

## Thẻ liếc nhanh

- Trang chính: modal xác thực từ header, `/profile`, `/admin`.
- Trình tự: tài khoản khóa → đăng nhập bằng email → đăng ký xác minh email → quên mật khẩu → hồ sơ → Admin/Orchestra.
- Mật khẩu mới trong tài khoản: gửi mã qua email, xác minh mã rồi mới lưu mật khẩu.
- Không lưu mật khẩu trong localStorage. Chỉ lưu session/token và identity nếu người dùng bật ghi nhớ.

> **Rà trước khi bảo vệ:** kịch bản này dùng email-only theo yêu cầu của nhóm. Nếu bản đang chạy còn nhãn “Email hoặc tên đăng nhập” hoặc còn nhận username, Phúc phải merge phần xác thực rồi mới trình bày là email-only.

### Tài khoản demo và dữ liệu nhập

| Vai trò | Email | Mật khẩu | Sau khi đăng nhập |
|---|---|---|---|
| Customer | `customer@furneehome.vn` | `user123456` | `/profile` và `/orders` |
| Admin | `phuc@furneehome.vn` | `123` | `/admin`, không có tab Quản trị admin |
| Orchestra Admin | `admin@furneehome.vn` | `123` | `/admin`, có tab Quản trị admin |

Nếu môi trường Render đã đổi `ADMIN_PASSWORD` hoặc `TEAM_ADMIN_PASSWORD`, dùng mật khẩu của môi trường đó. Email vẫn giữ theo seed.

## Bước 1 — Đăng nhập bằng email

### Thao tác

1. Mở `https://furneehome.pages.dev/`, bấm **Đăng nhập** trên header.
2. Nhập `customer@furneehome.vn` vào ô **Email**, nhập `user123456` vào ô **Mật khẩu**.
3. Bật **Ghi nhớ email**, bấm **Đăng nhập**.
4. Dấu hiệu đúng: modal đóng, header hiện tên khách và mở `/profile` khi bấm **Tài khoản**.
5. Đăng xuất. Đăng nhập `phuc@furneehome.vn` với `123`, dấu hiệu đúng là tự chuyển đến `/admin`.

### Đúng / sai

- Đúng: email được chuẩn hóa chữ thường, đúng mật khẩu thì tạo session.
- Sai: email chưa đăng ký hoặc mật khẩu sai thì hiện thông báo chung, không tiết lộ dữ liệu nhạy cảm.
- Sai: tài khoản có `isActive = false` phải hiện rõ **Tài khoản đã bị khóa**, áp dụng cho customer, Admin và Orchestra Admin.
- Bản chốt chỉ nhận email. Không nhập `customer`, `phuc` hoặc `admin` vào ô email.

**Cơ chế:** `LoginModal.submit` gửi email/mật khẩu qua `AuthContext.login`; `authService.login` gọi route auth; `authController.login` tìm `User` trong MongoDB, kiểm tra `isActive` và bcrypt, rồi trả JWT cùng role cho header/router.

### Code — `LoginModal.submit()`

`client/src/components/auth/LoginModal.jsx` — `submit`

```jsx
const email = form.email.trim().toLowerCase();
const loggedInUser = await login({ email, password: form.password });
saveRememberedIdentity(email, remember);
if (['admin', 'superadmin'].includes(loggedInUser.role)) {
  navigate('/admin');
}
```

`form.email` và `req.body.email` là dữ liệu dùng ở luồng email-only. `saveRememberedIdentity` chỉ ghi email để lần sau điền nhanh, không ghi mật khẩu.

### Code — kiểm tra tài khoản hoạt động

`server/src/controllers/authController.js` — `login` (sau khi Phúc chốt email-only)

```js
const email = normalizeEmail(req.body.email);
const user = await User.findOne({ email });
if (user && !user.isActive) {
  return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa.', data: null });
}
const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
```

Nếu code cuối dùng thông báo chung thay vì status 403 để tránh dò tài khoản, cần thống nhất thông điệp với yêu cầu “báo tài khoản bị khóa” trước buổi bảo vệ.

## Bước 2 — Đăng ký có mã xác minh email

### Thao tác

1. Ở modal đăng nhập, bấm **Đăng ký**.
2. Nhập email chưa có trong database, bấm **Gửi mã xác minh**.
3. Mở hộp thư nhận OTP.
4. Nhập họ tên, mã 6 số và mật khẩu mới.
5. Nhập lại mật khẩu, bấm **Tạo tài khoản**.

Username không cần nhập trong form này; backend chỉ kiểm tra username nếu request có gửi thêm giá trị đó.

### Đúng / sai

- Đúng: chỉ sau khi OTP hợp lệ tài khoản mới chuyển `emailVerified = true` và đăng nhập được.
- Sai: email đã dùng thì yêu cầu đăng nhập, không tạo bản ghi mới.
- Sai: OTP hết hạn hoặc sai quá 5 lần thì yêu cầu mã mới.
- Sai: mật khẩu nhập lại khác mật khẩu chính thì form dừng ở client.

**Cơ chế:** `LoginModal` gửi email trước, nhận trạng thái OTP từ `AuthContext.requestRegistration`; `authService` gọi `registerRequest`, controller hash OTP và lưu `registrationOtpHash` vào `User`; bước sau gọi `completeRegistration` để xác minh rồi mới lưu mật khẩu.

### Code — gửi OTP đăng ký

`server/src/controllers/authController.js` — `registerRequest`

```js
const email = normalizeEmail(req.body.email);
if (!isValidEmail(email)) throw createError('Email không hợp lệ.');
const otp = createOtp();
user.registrationOtpHash = hashOtp(email, otp);
user.registrationOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
user.registrationOtpAttempts = 0;
await user.save();
```

### Code — hoàn tất đăng ký

`server/src/controllers/authController.js` — `completeRegistration`

```js
if (!user || user.registrationOtpExpiresAt.getTime() <= Date.now()) {
  return res.status(400).json({ success: false, message: 'Mã xác minh không đúng hoặc đã hết hạn.' });
}
if (user.registrationOtpHash !== hashOtp(email, otp)) {
  user.registrationOtpAttempts += 1;
  await user.save();
  return res.status(400).json({ success: false, message: 'Mã xác minh không đúng hoặc đã hết hạn.' });
}
```

## Bước 3 — Quên mật khẩu

### Thao tác

1. Từ màn hình đăng nhập bấm **Quên mật khẩu?**.
2. Nhập email đã đăng ký trong database.
3. Kiểm tra email nhận mã OTP.
4. Nhập OTP, mật khẩu mới và nhập lại mật khẩu.
5. Bấm **Đổi mật khẩu**, quay lại đăng nhập bằng mật khẩu mới.

### Nói ngắn

> “Quên mật khẩu có hai bước: yêu cầu mã tại email đã đăng ký, sau đó xác minh mã rồi mới đổi. Form không cho đổi chỉ bằng cách biết email.”

### Đúng / sai

- Email chưa đăng ký: không tạo mã và không đổi mật khẩu.
- OTP sai 5 lần: mã bị hủy, phải yêu cầu mã mới.
- OTP quá 10 phút: mã hết hiệu lực.
- Mật khẩu nhập lại khác: hiện **Mật khẩu nhập lại chưa khớp**.

**Cơ chế:** `LoginModal` gọi `authService.requestPasswordReset`; controller tìm `User` theo email, lưu OTP reset đã hash; lần bấm **Đổi mật khẩu** gọi `resetPassword`, controller kiểm tra hash/thời hạn/lượt sai rồi mới bcrypt mật khẩu mới.

### Code — flow reset ở client

`client/src/components/auth/LoginModal.jsx` — `submit`, nhánh `forgot/reset`

```jsx
if (view === 'forgot') {
  const result = await authService.requestPasswordReset(form.email.trim());
  setView('reset');
  setForm((current) => ({ ...current, otp: result?.devOtp || '' }));
} else if (view === 'reset') {
  await authService.resetPassword({
    email: form.email.trim(), otp: form.otp.trim(), password: form.password,
  });
  toLogin();
}
```

### Code — reset ở backend

`server/src/controllers/authController.js` — `resetPassword`

```js
const user = await User.findOne({ email, isActive: true })
  .select('+resetOtpHash +resetOtpExpiresAt +resetOtpAttempts');
if (!user || user.resetOtpExpiresAt.getTime() <= Date.now()) {
  return res.status(400).json({ success: false, message: 'Mã OTP không đúng hoặc đã hết hạn.' });
}
```

## Bước 4 — Tài khoản người dùng

### Thao tác

1. Mở `/profile` sau khi đăng nhập customer.
2. Chỉ vào lời chào **Hi tên tài khoản**. Tên tài khoản được lấy từ `username`, nếu tài khoản không có username thì dùng họ tên.
3. Kiểm tra email, số điện thoại, địa chỉ cụ thể và ghi chú giao hàng.
4. Sửa thông tin, bấm **Lưu hồ sơ**.
5. Mở `/checkout` để chứng minh thông tin mới tự điền vào phần thanh toán.
6. Ở khối mật khẩu, yêu cầu mã qua email, nhập OTP rồi nhập mật khẩu mới và xác nhận.

### Đúng / sai

- Hồ sơ thiếu địa chỉ/số điện thoại/ghi chú: hiển thị trạng thái chưa đủ và cho khách bổ sung hoặc bỏ qua rõ ràng.
- Hồ sơ đủ: checkout nạp mặc định nhưng vẫn cho sửa theo đơn.
- OTP đổi mật khẩu sai/hết hạn: không thay đổi mật khẩu cũ.
- Xác nhận mật khẩu khác mật khẩu mới: hiện lỗi ngay như luồng quên mật khẩu.

**Cơ chế:** `ProfilePage.handleSendOtp` gọi `authService.requestPasswordReset(user.email)`; sau khi nhập OTP, `handleResetPassword` gọi `authService.resetPassword`. Hồ sơ gọi `AuthContext.updateProfile`, qua `userService.updateMe` đến `userController.updateMe`, lưu các field trong `User`.

### Code — nạp và lưu hồ sơ

`client/src/context/AuthContext.jsx` — `updateProfile`

```jsx
const response = await userService.updateMe(profile);
const updatedUser = response?.user || response;
saveUser(updatedUser);
setUser(updatedUser);
return updatedUser;
```

`server/src/controllers/userController.js` — `profileData`

```js
const profileComplete = Boolean(user.phone && user.address
  && user.provinceCode && user.deliveryNote);
return {
  id: user._id, name: user.name, username: user.username || '',
  email: user.email, phone: user.phone || '',
  address: user.address || '', provinceCode: user.provinceCode || '',
  deliveryNote: user.deliveryNote || '', profileComplete,
  role: user.role,
};
```

`User.js` hiện có các trường `phone`, `address`, `provinceCode`, `deliveryNote`; backend trả lại cùng `profileComplete` để checkout và Admin dùng chung dữ liệu.

### Code — kiểm tra xác nhận mật khẩu ở form

`client/src/components/auth/LoginModal.jsx` — `submit`

```jsx
if ((view === 'register-complete' || view === 'reset')
    && form.password !== form.confirmPassword) {
  setError('Mật khẩu nhập lại chưa khớp.');
  return;
}
```

## Bước 5 — Tài khoản Admin và Orchestra Admin

### Thao tác

1. Đăng xuất customer.
2. Đăng nhập email tài khoản Admin, kiểm tra tự chuyển `/admin`.
3. Đăng nhập email Orchestra Admin, kiểm tra xuất hiện thêm mục **Quản trị admin**.
4. Chỉ vào quyền trên giao diện, chưa đi sâu CRUD vì Hiệp sẽ trình bày toàn bộ Trang quản trị.

### Quyền cần nói

- Customer: mua hàng, hồ sơ, đơn mua, đánh giá.
- Admin: xử lý sản phẩm, khách hàng, đơn hàng và báo nội dung.
- Orchestra Admin: có thêm quản lý tài khoản Admin; không được tự khóa/chỉnh sửa chính mình hoặc Orchestra Admin cao nhất.

**Cơ chế:** `AdminRoute` chỉ render `/admin` khi role hợp lệ; mọi API tab đi qua `authenticate` và `requireAdmin`, sau đó controller kiểm tra tiếp `req.user.role` trước khi đọc/ghi `User`, `Product` hoặc `Order`.

### Code — bảo vệ route

`server/src/middleware/authMiddleware.js` — `requireAdmin`

```js
function requireAdmin(req, res, next) {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền quản trị.', data: null });
  }
  return next();
}
```

`client/src/router.jsx` — `AdminRoute`

```jsx
function AdminRoute() {
  const { user } = useAuth();
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <AdminPage />;
}
```

### Câu phản biện

**Ẩn nút Admin đã đủ bảo mật chưa?**

> “Chưa. Đó chỉ là giao diện. API dùng JWT và `requireAdmin`, nên gọi thẳng URL/API cũng bị chặn.”

**Admin thường có tạo Admin mới không?**

> “Không. Orchestra Admin mới có quyền quản lý tài khoản Admin. Admin thường chỉ dùng các tab nghiệp vụ được cấp.”

## Câu bàn giao cho Dũng

> “Em đã xác minh email, đăng nhập đúng vai trò và kiểm tra hồ sơ khách. Tài khoản customer đang sẵn sàng, mời Dũng mở sản phẩm và trình bày Giỏ hàng, Thanh toán.”

## Checklist 30 giây

- [ ] Demo email-only, không dùng username.
- [ ] Có câu trả lời riêng cho tài khoản bị khóa.
- [ ] Nói đăng ký và quên mật khẩu đều cần OTP email.
- [ ] Nói OTP hash, thời hạn và giới hạn lần thử theo code thật.
- [ ] Demo lời chào theo tên, hồ sơ và checkout tự điền.
- [ ] Phân biệt Admin với Orchestra Admin.
- [ ] Bàn giao customer cho Dũng, không đi sâu tab quản trị.
