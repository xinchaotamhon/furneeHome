# Phúc — Phần 3/4: Tài khoản, đơn hàng và quản trị

## Vai trò của Phúc

Phúc nói sau Triều. Nhiệm vụ là giải thích xác thực tài khoản, OTP, mọi trạng thái đơn hàng và cách Admin vận hành hệ thống.

## 1. Đăng ký bằng OTP

Luồng:

1. Người dùng nhập Gmail.
2. `registerRequest()` kiểm tra định dạng và email đã tồn tại hay chưa.
3. Server tạo OTP sáu số, băm OTP và đặt thời hạn.
4. `sendOtp()` gửi mã qua Gmail SMTP.
5. Người dùng nhập OTP, tên, tên đăng nhập và mật khẩu.
6. `completeRegistration()` kiểm tra OTP và thời hạn.
7. Mật khẩu được băm bằng bcrypt rồi user được lưu vào MongoDB.
8. Server trả JWT và thông tin an toàn của user.

Ý cần nói:

- Mật khẩu không lưu dạng rõ.
- OTP trong MongoDB cũng lưu dạng băm.
- Production dùng Gmail App Password qua SMTP.
- Local có thể bật chế độ trả OTP để demo khi SMTP chưa sẵn sàng.

Biến môi trường Gmail:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER`: Gmail gửi thư.
- `SMTP_PASS`: Gmail App Password, không phải mật khẩu Gmail thường.
- `EMAIL_FROM`: địa chỉ hiển thị người gửi.

Code cần biết:

- `registerRequest()` — `server/src/controllers/authController.js`: tạo và gửi OTP đăng ký.
- `completeRegistration()` — `server/src/controllers/authController.js`: xác nhận OTP và tạo user.
- `sendOtp()` — `server/src/controllers/authController.js`: gửi email qua Nodemailer.
- `createOtp()` và `hashOtp()` — `server/src/controllers/authController.js`: tạo mã và băm mã.

Câu có thể bị hỏi:

**OTP có nhận được trong Gmail thật không?**  
Có, nếu Gmail bật xác minh hai bước, tạo App Password và các biến SMTP trên Render được cấu hình đúng.

**OTP hết hạn hoặc sai thì sao?**  
Server từ chối. Người dùng yêu cầu mã mới; mã cũ không được dùng tiếp.

**Tại sao băm OTP?**  
Nếu dữ liệu bị đọc trái phép thì kẻ khác không thấy mã đang còn hiệu lực.

**Nếu Gmail đã tồn tại?**  
Đăng ký bị từ chối để giữ email là duy nhất.

## 2. Đăng nhập, ghi nhớ và quên mật khẩu

Đăng nhập:

`Nhập email hoặc username + mật khẩu → Tìm user → bcrypt so mật khẩu → Kiểm tra khóa tài khoản → Trả JWT`

Quên mật khẩu:

`Nhập Gmail → Gửi OTP → Nhập OTP và mật khẩu mới → Kiểm tra mã → Băm mật khẩu mới → Đăng nhập lại`

Ý cần nói:

- JWT được gửi trong `Authorization` khi gọi API cần đăng nhập.
- `authenticate()` đọc token, tìm user và gắn user vào request.
- Ghi nhớ đăng nhập không lưu mật khẩu rõ.
- Admin khóa tài khoản thì người đó không thể đăng nhập tiếp.

Code cần biết:

- `login()` — `server/src/controllers/authController.js`: kiểm tra tài khoản và tạo JWT.
- `requestPasswordReset()` — `server/src/controllers/authController.js`: gửi OTP quên mật khẩu.
- `resetPassword()` — `server/src/controllers/authController.js`: xác minh mã và thay mật khẩu.
- `authenticate()` — `server/src/middleware/authMiddleware.js`: bảo vệ API cần đăng nhập.
- `LoginModal()` — `client/src/components/auth/LoginModal.jsx`: giao diện đăng nhập, đăng ký và quên mật khẩu.

Câu có thể bị hỏi:

**JWT nằm ở đâu?**  
Client lưu phiên đăng nhập và gửi token trong header. Server không tin vai trò do client tự khai báo mà đọc user thật từ token.

**Nếu token hết hạn hoặc sai?**  
Middleware trả lỗi 401 và client yêu cầu đăng nhập lại.

**Nhớ mật khẩu có an toàn không?**  
Website không lưu mật khẩu dạng rõ. Chức năng ghi nhớ chỉ phục vụ phiên/định danh đăng nhập.

## 3. Vòng đời đơn hàng

Thứ tự hợp lệ:

`Pending → Processing → Shipped → Delivered`

Nhánh hủy:

- `Pending → Cancelled`
- `Processing → Cancelled`
- `Shipped`, `Delivered` hoặc `Cancelled` không được tự hủy.

Ý cần nói:

- Khách đặt xong tạo đơn `Pending`.
- Admin xác nhận tiếp nhận thành `Processing`.
- Giao cho đơn vị vận chuyển thành `Shipped`.
- Khách nhận hàng thành `Delivered`.
- `Delivered` chưa tự động bằng `Paid`; thanh toán có nút xác nhận riêng.
- COD chỉ bấm **Xác nhận thanh toán** sau khi giao thành công.
- Chuyển khoản QR có thể xác nhận sau khi Admin kiểm tra tiền vào.

Dữ liệu demo:

- `DEMO-PROCESSING-001`: đang xử lý.
- `DEMO-SUCCESS-001`: đã giao và đã thanh toán.
- `DEMO-CANCELLED-001`: đã hủy.

Trình tự demo:

1. Mở **Quản trị → Đơn hàng**.
2. Chỉ ba đơn demo ở ba tình huống.
3. Với đơn đang xử lý, chỉ bước tiếp theo hợp lệ.
4. Với đơn đã giao nhưng chưa trả tiền, bấm **Xác nhận thanh toán**.
5. Chỉ đơn hủy và giải thích hoàn tồn kho.

Code cần biết:

- `ADMIN_TRANSITIONS` — `server/src/controllers/orderController.js`: khai báo bước chuyển trạng thái.
- `updateOrderStatus()` — cùng file: kiểm tra trạng thái và xác nhận thanh toán.
- `cancelOrder()` — cùng file: hủy và hoàn tồn kho đúng một lần.
- `getAllOrders()` — cùng file: tải đơn cho Admin.

Câu có thể bị hỏi:

**Khách đang đặt hàng thì sao?**  
`createOrder()` kiểm tra sản phẩm và giữ tồn kho. Nếu tất cả hợp lệ, order được lưu; nếu lỗi thì phần tồn kho đã giữ được hoàn lại.

**Đơn hàng thành công là gì?**  
Về vận chuyển là `Delivered`; hoàn tất toàn bộ là `Delivered` và `Paid`.

**Nếu Admin cố nhảy Pending lên Delivered?**  
Server từ chối vì `ADMIN_TRANSITIONS` không cho phép.

**Tại sao giao thành công chưa tự Paid?**  
Vì giao hàng và xác nhận tiền là hai sự kiện khác nhau, đặc biệt với COD.

## 4. Trang quản trị

Tài khoản demo:

| Quyền | Username | Mật khẩu |
|---|---|---|
| Orchestra Admin | `admin` | `123` |
| Admin | `phuc` | `123` |
| Admin | `trieu` | `123` |
| Admin | `dung` | `123` |

Admin có các phần:

- **Sản phẩm**: thêm, sửa, chọn hoặc tạo danh mục, cập nhật giá/tồn kho, thêm ảnh, ngừng bán và bán lại.
- **Khách hàng**: xem, khóa hoặc mở khóa tài khoản khách.
- **Đơn hàng**: xem chi tiết, chuyển đúng trạng thái và xác nhận thanh toán.
- **Báo nội dung**: xem và chuyển Mới → Đã xem → Đã xử lý.

Orchestra Admin có thêm:

- **Quản trị admin**: nâng customer thành admin, hạ admin thành customer, khóa hoặc mở khóa Admin cấp dưới.
- Admin thường không thấy và không gọi được chức năng phân quyền này.

Trình tự demo:

1. Đăng nhập `admin` / `123`.
2. Vào `/admin`.
3. Mở từng tab Sản phẩm, Khách hàng, Đơn hàng, Báo nội dung.
4. Mở tab Quản trị admin để chứng minh quyền cao nhất.
5. Nếu đủ thời gian, đăng nhập một Admin thường để chứng minh không có tab phân quyền.

Code cần biết:

- `AdminRoute()` — `client/src/router.jsx`: chỉ cho Admin và Superadmin mở giao diện.
- `requireAdmin()` — `server/src/middleware/authMiddleware.js`: bảo vệ API quản trị.
- `updateUser()` — `server/src/controllers/adminController.js`: khóa user và giới hạn thay quyền cho Superadmin.
- `create()`, `update()`, `remove()`, `addImage()` — `server/src/controllers/productController.js`: CRUD sản phẩm.
- `updateFeedback()` — `server/src/controllers/adminController.js`: xử lý báo nội dung.
- `seedAccounts()` — `server/src/utils/seedData.js`: tạo một Orchestra Admin và ba Admin.

Câu có thể bị hỏi:

**Admin thường tự nâng thành Orchestra Admin được không?**  
Không. Server chỉ cho `superadmin` thay đổi role.

**Tại sao Ngừng bán thay vì xóa sản phẩm?**  
Để giữ đơn hàng và đánh giá cũ, đồng thời có thể bán lại.

**Nếu Admin thay giá, JSON có tự đổi không?**  
Không cần. MongoDB là dữ liệu vận hành; JSON chỉ dùng nhập ban đầu. Điều này tránh hai nguồn dữ liệu xung đột.

**Báo nội dung được xử lý thế nào?**  
Người dùng gửi báo cáo gắn với sản phẩm; Admin đọc, chuyển trạng thái và xử lý ngoài giao diện nếu cần.

## 5. Câu chuyển cho Hiệp

> Phần tài khoản, giao dịch và quản trị đã hoàn tất. Cuối cùng, Hiệp sẽ giải thích kiến trúc MongoDB, nguồn dữ liệu, cách Phòng thử AI hoạt động, triển khai và giới hạn thực tế.

## Tự kiểm tra trước khi bảo vệ

- Nói được hai luồng OTP: đăng ký và quên mật khẩu.
- Phân biệt JWT, mật khẩu băm và OTP băm.
- Thuộc vòng đời đơn và hai nhánh hủy.
- Demo được nút xác nhận thanh toán.
- Phân biệt Admin với Orchestra Admin.
- Nhớ câu chuyển phần cho Hiệp.
