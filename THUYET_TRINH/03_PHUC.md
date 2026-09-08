# Phúc — Phần 3/4: Xác thực, đơn hàng và quản trị

Phúc nói sau Triều. Mỗi bước: **Nói · Demo · Thành công · Lỗi/thay đổi · Hỏi đáp · Hàm + đường dẫn**.

## Bước 1 — Đăng ký bằng OTP

- **Nói:** Người dùng nhập Gmail; server tạo OTP 6 số, chỉ lưu bản băm có hạn 10 phút; gửi qua Gmail SMTP; nhập OTP, tên, username, mật khẩu để hoàn tất.
- **Demo:** Mở hộp đăng nhập → **Đăng ký** → nhập email → nhập OTP, tên và mật khẩu. Local có thể dùng OTP dev nếu SMTP chưa cấu hình.
- **Thành công:** Tạo customer, mật khẩu được băm bằng bcrypt, server trả phiên JWT; không lưu mật khẩu rõ hoặc OTP rõ trong MongoDB.
- **Lỗi/thay đổi:** Email sai/đã dùng, OTP sai/hết hạn, username trùng hoặc mật khẩu ngắn thì không tạo tài khoản; yêu cầu mã mới.
- **Hỏi đáp:** *OTP thật gửi ở đâu?* `SMTP_HOST/PORT/USER/PASS/EMAIL_FROM` trong Environment Variables; `SMTP_PASS` là App Password. *Tại sao băm OTP?* Giảm rủi ro khi dữ liệu bị đọc trái phép.
- **Hàm + đường dẫn:** `registerRequest()` — `server/src/controllers/authController.js`: tạo OTP và gửi; `completeRegistration()` — cùng file: xác minh và tạo user; `sendOtp()`/`createOtp()`/`hashOtp()` — cùng file: gửi, tạo và băm mã; API `POST /api/auth/register/request`, `/complete`.

## Bước 2 — Đăng nhập và quên mật khẩu

- **Nói:** Đăng nhập bằng email hoặc username; bcrypt so mật khẩu; JWT 7 ngày xác định user. Quên mật khẩu cũng qua OTP, mật khẩu mới được băm.
- **Demo:** Đăng nhập thử `customer` / `user123456`; mở **Quên mật khẩu** → nhập email/OTP/mật khẩu mới nếu có môi trường gửi mail.
- **Thành công:** Đăng nhập thành công thấy đúng quyền; request cần đăng nhập mang `Authorization: Bearer <JWT>`.
- **Lỗi/thay đổi:** Tài khoản bị khóa, token sai/hết hạn trả 401. OTP reset sai tối đa 5 lần; sau đó mã bị vô hiệu và phải yêu cầu mã mới.
- **Hỏi đáp:** *JWT nằm ở đâu?* Client lưu token trong `localStorage` và gửi ở header, không lưu mật khẩu. *Nhớ mật khẩu có lưu mật khẩu không?* Không, giao diện chỉ nhớ email/username. *Ai đọc role?* `authenticate()` tìm user thật từ JWT; client không tự khai quyền. *Vì sao giới hạn OTP?* Chặn thử vét cạn 1 triệu mã; lần sai thứ 5 vô hiệu mã hiện tại.
- **Hàm + đường dẫn:** `login()`, `requestPasswordReset()`, `resetPassword()` — `server/src/controllers/authController.js`: đăng nhập, gửi, đếm số lần sai và xác minh OTP; trường `resetOtpAttempts` — `server/src/models/User.js`: lưu số lần sai; `authenticate()` — `server/src/middleware/authMiddleware.js`: bảo vệ API; `LoginModal()` — `client/src/components/auth/LoginModal.jsx`: giao diện; API `POST /api/auth/login`, `POST /api/auth/forgot-password/request`, `POST /api/auth/forgot-password/reset`.

## Bước 3 — Vòng đời đơn và thanh toán

- **Nói:** Trạng thái hợp lệ: `Pending → Processing → Shipped → Delivered`; nhánh hủy chỉ từ `Pending` hoặc `Processing`. Vận chuyển và thanh toán là hai trạng thái khác nhau.
- **Demo:** Vào `/admin` → tab **Đơn hàng** → mở ba đơn `DEMO-PROCESSING-001`, `DEMO-SUCCESS-001`, `DEMO-CANCELLED-001`; chọn bước kế tiếp; xác nhận thanh toán khi hợp lệ.
- **Thành công:** Không nhảy cóc trạng thái; đơn hoàn tất khi `Delivered` và `Paid`; COD chỉ xác nhận tiền sau giao thành công, chuyển khoản sau khi kiểm tra tiền vào.
- **Lỗi/thay đổi:** Server từ chối `Pending → Delivered`, hủy đơn đã giao hoặc xác nhận COD trước khi giao. Hủy hợp lệ hoàn kho đúng một lần.
- **Hỏi đáp:** *Tại sao `Delivered` chưa tự `Paid`?* Giao hàng không đồng nghĩa tiền đã xác nhận, nhất là COD. *Ai giữ tồn kho?* `createOrder()` giữ lúc tạo; `cancelOrder()` hoàn khi hủy.
- **Hàm + đường dẫn:** `ADMIN_TRANSITIONS` — `server/src/controllers/orderController.js`: bảng bước hợp lệ; `updateOrderStatus()` — cùng file: đổi trạng thái/thanh toán; `cancelOrder()` — cùng file: hủy và hoàn kho; `getAllOrders()` — cùng file: danh sách admin; API `GET /api/orders`, `PUT /api/orders/:id/status`.

## Bước 4 — Các tab quản trị

- **Nói:** Admin quản lý Sản phẩm, Khách hàng, Đơn hàng và Báo nội dung. Orchestra Admin có thêm Quản trị admin; admin thường chỉ khóa/mở khách hàng.
- **Demo:** Đăng nhập `admin` / `123` → `/admin` → lần lượt mở 4 tab; nếu đủ thời gian đăng nhập admin thường để chứng minh không có tab nâng quyền; với `admin` superadmin mở **Quản trị admin**.
- **Thành công:** Thêm/sửa/ngừng bán/bán lại sản phẩm; khóa user; chuyển đơn đúng bước; báo cáo đi `new → reviewed → resolved`; tab quyền cao nhất hiển thị đúng role.
- **Lỗi/thay đổi:** Không xóa sản phẩm đang có lịch sử nếu chỉ cần ngừng bán; không đổi role superadmin hoặc tự đổi quyền của chính mình. API vẫn chặn dù có sửa giao diện.
- **Hỏi đáp:** *Admin thường tự thành Orchestra Admin được không?* Không, chỉ `superadmin` được đổi role. *Tại sao ngừng bán?* Giữ đơn/đánh giá cũ và có thể bán lại. *Báo nội dung ở đâu?* Tab **Báo nội dung**, backend `feedbacks`.
- **Hàm + đường dẫn:** `AdminPage()` — `client/src/pages/AdminPage.jsx`: admin có 4 tab, superadmin có thêm tab thứ 5; `AdminRoute()` — `client/src/router.jsx`: bảo vệ giao diện; `requireAdmin()` — `server/src/middleware/authMiddleware.js`: bảo vệ API; `updateUser()`/`updateFeedback()` — `server/src/controllers/adminController.js`: tài khoản và báo cáo; `create()`/`update()`/`remove()`/`addImage()` — `server/src/controllers/productController.js`: sản phẩm.

**Câu bàn giao cho Hiệp:** “Phần tài khoản, giao dịch và quản trị đã hoàn tất. Cuối cùng, Hiệp sẽ giải thích kiến trúc MongoDB, dữ liệu, Phòng thử AI, triển khai và giới hạn thực tế.”

## Phản biện nhanh cuối phần

1. **OTP có lưu rõ trong MongoDB không?** Không; chỉ lưu `resetOtpHash`/`registrationOtpHash` và thời gian hết hạn.
2. **Nếu nhập sai OTP reset lần thứ 5?** Mã bị xóa, bộ đếm đặt lại và người dùng phải yêu cầu mã mới.
3. **Nếu xin mã mới?** `requestPasswordReset()` tạo mã, hạn dùng mới và đặt `resetOtpAttempts = 0`.
4. **Tại sao thông báo quên mật khẩu không nói email có tồn tại?** Tránh cho người lạ dò danh sách tài khoản.
5. **Frontend ẩn tab Admin đã đủ chưa?** Chưa; `authenticate()` và `requireAdmin()` mới bảo vệ API khi request bị sửa.
6. **Admin và Orchestra Admin khác gì?** Admin quản lý nghiệp vụ; `superadmin` có thêm quyền cấp/thu quyền admin cấp dưới.
7. **Đơn giao thành công có tự Paid không?** Không; Admin bấm xác nhận thanh toán. COD chỉ xác nhận sau `Delivered`.
8. **Nếu Admin nhảy `Pending → Delivered`?** `ADMIN_TRANSITIONS` không cho phép và server trả lỗi 409.

### Tự kiểm tra

- Phân biệt OTP đăng ký và OTP quên mật khẩu; nhớ giới hạn 5 lần reset.
- Thuộc vòng đời đơn và điều kiện COD/QR.
- Demo được quyền Admin và Orchestra Admin.
- Nhớ câu bàn giao.
