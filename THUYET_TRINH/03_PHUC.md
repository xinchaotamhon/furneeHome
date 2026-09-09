# Phúc — Phần 3/4: Xác thực và quản trị

> **Vị trí:** sau Triều, trước Hiệp. **Luồng:** Đăng ký OTP → Đăng nhập/JWT → Quên mật khẩu → Admin thường → Orchestra Admin → bàn giao cho Hiệp.

## Thẻ liếc nhanh

- **Tài khoản Admin thường:** `phuc` / `123`.
- **Tài khoản Orchestra Admin:** `admin` / `123`.
- **Trang demo:** hộp đăng nhập/đăng ký → `/admin`.
- **Từ khóa code:** `registerRequest` · `completeRegistration` · `login` · `resetPassword` · `authenticate` · `requireAdmin` · `updateOrderStatus` · `updateUser`.
- **Điểm quan trọng:** giao diện ẩn chức năng theo quyền, backend vẫn kiểm tra quyền lại.

## Bước 1 — Đăng ký bằng OTP email

### Thao tác đã kiểm tra

1. Khi chưa đăng nhập, bấm **Đăng ký**.
2. Màn hình **Xác minh email** chỉ yêu cầu email.
3. Nhập email sai như `abc`: trình duyệt chặn vì không đúng định dạng.
4. Với email hợp lệ, bấm **Gửi mã xác minh**.
5. Màn hình tiếp theo yêu cầu họ tên, OTP 6 số, mật khẩu và nhập lại mật khẩu.
6. Bấm **Tạo tài khoản**.

Đây là luồng **2 bước**: yêu cầu OTP → hoàn tất tài khoản. Bản hiện tại không có một API “verify” riêng ở giữa.

### Luồng backend

```text
POST /api/auth/register/request
        ↓
Kiểm tra email và cấu hình SMTP
        ↓
Tạo OTP 6 số, lưu SHA-256 hash + hạn 10 phút + attempts = 0
        ↓
Gửi OTP qua Gmail SMTP
        ↓
POST /api/auth/register/complete
        ↓
Kiểm tra OTP, họ tên và mật khẩu
        ↓
Băm mật khẩu bằng bcrypt, emailVerified = true, cấp JWT
```

### Dấu hiệu đúng

- Người dùng nhận mã tại đúng email nếu SMTP trên Render được cấu hình.
- MongoDB không lưu OTP thật và mật khẩu thật.
- Tài khoản mới có role `customer`.
- Sau đăng ký thành công, người dùng được đăng nhập luôn.

### Nếu bị hỏi

**OTP lưu ở đâu?**

Collection `users` lưu `registrationOtpHash`, thời điểm hết hạn và số lần thử; các trường này đặt `select: false`.

**Tại sao băm OTP?**

Nếu dữ liệu bị lộ, người xem database không đọc được OTP đang có hiệu lực.

**Nếu nhập sai nhiều lần?**

`registrationOtpAttempts` tăng. Khi đã chạm giới hạn 5 lần, mã không còn được chấp nhận; người dùng phải xin mã mới.

**Nếu SMTP chưa cấu hình trên môi trường deploy?**

API trả 503 “Máy chủ chưa cấu hình gửi email”. Chế độ hiện OTP thử chỉ được phép ở localhost khi không chạy production.

**Đã kiểm tra email thật chưa?**

Đã kiểm tra API hoàn tất đăng ký với OTP trên dữ liệu tạm và tài khoản được tạo đúng. Chưa xác nhận thư đến trong Gmail thật; nhóm phải gửi một OTP tới email demo trước ngày bảo vệ để kiểm tra riêng SMTP trên Render.

## Bước 2 — Đăng nhập, ghi nhớ và JWT

### Thao tác

1. Bấm **Đăng nhập**.
2. Nhập email hoặc tên đăng nhập và mật khẩu.
3. Có thể tích **Ghi nhớ email hoặc tên đăng nhập**.
4. Đăng nhập `phuc` để thấy chuyển thẳng tới `/admin`.

### Điều phải nói đúng

- “Ghi nhớ” chỉ lưu email/tên đăng nhập, **không lưu mật khẩu**.
- Sau khi login, server cấp JWT hạn 7 ngày.
- Client lưu token ở `localStorage` và Axios thêm `Authorization: Bearer ...` cho request.
- `authenticate()` giải mã token rồi đọc lại user trong MongoDB; tài khoản bị khóa vẫn không dùng được token cũ.

### Nếu bị hỏi

**Nếu mật khẩu sai?**

Server trả cùng một thông báo “Email/tên đăng nhập hoặc mật khẩu không chính xác”, không tiết lộ tài khoản nào tồn tại.

**Nếu token hết hạn hoặc bị sửa?**

`jwt.verify()` thất bại và API trả 401. Client xóa phiên không hợp lệ.

**Lưu JWT trong localStorage có hoàn hảo không?**

Không. Đây là cách đơn giản phù hợp đồ án, nhưng phải tránh XSS. Bản sản xuất lớn nên cân nhắc cookie `httpOnly`, `secure`, `sameSite`.

## Bước 3 — Quên mật khẩu và chống thử OTP liên tục

### Thao tác đã kiểm tra

1. Từ hộp đăng nhập, bấm **Quên mật khẩu?**
2. Nhập email và bấm **Gửi mã xác minh**.
3. Màn hình sau nhận OTP, mật khẩu mới và nhập lại mật khẩu.
4. Bấm **Đổi mật khẩu**.

Không hoàn tất đổi mật khẩu của tài khoản demo trong lúc thuyết trình.

### Luồng backend

- `requestPasswordReset()` luôn trả thông báo chung, dù email có tồn tại hay không.
- Nếu có tài khoản hợp lệ, server lưu `resetOtpHash`, hạn 10 phút và `resetOtpAttempts = 0`.
- `resetPassword()` tăng bộ đếm khi OTP sai.
- Sai đến lần thứ 5 thì hash và hạn OTP bị xóa; phải xin mã mới.
- OTP đúng thì mật khẩu mới được băm bcrypt và các trường reset bị xóa.

Kiểm thử thực tế đã xác nhận mã bị hủy sau lần sai thứ 5; một mã mới hợp lệ vẫn đặt lại mật khẩu và đăng nhập được.

### Nếu bị hỏi

**Tại sao không báo “email không tồn tại”?**

Để kẻ xấu không dùng form quên mật khẩu dò danh sách email khách hàng.

**OTP có 1 triệu khả năng, chống brute-force thế nào?**

Mỗi mã chỉ sống 10 phút và bị hủy sau 5 lần sai, nên không thể thử đủ 000000–999999.

**Đổi mật khẩu trong Hồ sơ và Quên mật khẩu liên hệ với nhau thế nào?**

Cả hai đều dùng chung cơ chế bảo mật xác thực OTP qua Gmail bằng Google App Password. Người dùng trong trang cá nhân cũng không cần nhớ mật khẩu cũ mà chỉ cần xác nhận quyền sở hữu qua mã OTP 6 số gửi về hòm thư Gmail, tái sử dụng các hàm `requestPasswordReset` và `resetPassword`.

## Bước 4 — Trang quản trị riêng và hai cấp quyền

### Demo Admin thường

1. Đăng nhập `phuc` / `123`.
2. Hệ thống chuyển thẳng tới `/admin`.
3. Chỉ vào 4 tab: **Sản phẩm, Khách hàng, Đơn hàng, Báo nội dung**.
4. Chỉ ra trang quản trị có phần đầu riêng, không lẫn menu mua hàng.

### Demo Orchestra Admin

1. Đăng xuất rồi đăng nhập `admin` / `123`.
2. Tab thứ 5 **Quản trị admin** xuất hiện.
3. Trang này tìm được Admin theo tên, username hoặc email và khóa/mở khóa Admin thường.

### So sánh quyền

| Chức năng | Admin | Orchestra Admin (`superadmin`) |
|---|---:|---:|
| Quản lý sản phẩm | Có | Có |
| Khóa/mở khách hàng | Có | Có |
| Xử lý đơn và báo nội dung | Có | Có |
| Chuyển đơn theo bước hợp lệ | Có | Có |
| Sửa lại trạng thái đơn chưa hủy | Không | Có |
| Xem tab Quản trị admin | Không | Có |
| Khóa/mở Admin thường | Không | Có |
| Thay đổi chính Orchestra Admin | Không | Không |

### Giới hạn hiện tại

Trang **Quản trị admin** đang quản lý bốn tài khoản Admin đã tạo sẵn và cho khóa/mở. Giao diện hiện chưa có form tạo một Admin hoàn toàn mới; nếu hội đồng hỏi, nói đây là phạm vi còn lại chứ không tuyên bố đã có.

## Bước 5 — CRUD sản phẩm

### Thao tác trình bày

1. Mở tab **Sản phẩm**.
2. Form bên trái có tên, danh mục, giá, tồn kho, mô tả.
3. Danh mục là select; có mục **+ Tạo danh mục mới**.
4. Danh sách bên phải có tìm kiếm và lọc danh mục.
5. Chỉ ra bốn thao tác: **Sửa, Thêm ảnh, Ngừng bán/Bán lại, Xóa**.
6. Khi chạy localhost, chỉ nút **Đồng bộ JSON**.

### Quy tắc phải nhớ

- **Thêm/Sửa:** ghi trực tiếp MongoDB.
- **Thêm ảnh:** nhận PNG, JPEG hoặc WebP; lưu ảnh vào Product.
- **Ngừng bán:** đặt `isActive = false`, giữ dữ liệu cho đơn cũ.
- **Xóa:** xóa vĩnh viễn chỉ khi sản phẩm chưa được Cart, Order hoặc Review tham chiếu.
- **Đồng bộ JSON:** chỉ localhost, một chiều MongoDB → `data_import.json`.

### Nếu bị hỏi

**Tại sao cần cả Ngừng bán và Xóa?**

Ngừng bán giữ lịch sử và có thể bán lại. Xóa chỉ dành cho bản ghi tạo nhầm chưa liên quan dữ liệu khác.

**Nếu cố xóa món đã có đơn?**

`permanentRemove()` trả lỗi 409 và hướng dẫn dùng Ngừng bán.

**Tạo danh mục mới ở đâu?**

`productData()` gọi `findCategory()`. Nếu slug chưa có, MongoDB tạo Category bằng upsert.

**Nút đồng bộ JSON có ghi ngược vào MongoDB không?**

Không. `syncJson()` đọc Product từ MongoDB rồi ghi bản chụp JSON. Production chặn API này.

## Bước 6 — Quản trị khách hàng

### Thao tác

1. Mở **Khách hàng**.
2. Chỉ ra họ tên, username/email, trạng thái và nút **Khóa/Mở khóa**.

### Nếu bị hỏi

**Khóa tài khoản có xóa đơn cũ không?**

Không. Chỉ đổi `isActive`; Cart, Order và Review vẫn còn để giữ lịch sử.

**Admin có khóa được Admin khác không?**

Không. `updateUser()` chỉ cho Admin thường khóa/mở khách hàng. Orchestra Admin mới quản lý Admin thường.

## Bước 7 — Quản trị đơn hàng

### Thao tác đã kiểm tra

1. Với Admin thường, mở **Đơn hàng**.
2. Một đơn `Pending` chỉ cho chọn `Processing` hoặc `Cancelled`.
3. Một đơn `Shipped` chỉ cho chọn `Delivered`.
4. Đơn `Delivered` và `Cancelled` là kết thúc với Admin thường.
5. Với Orchestra Admin, đơn chưa hủy có thể chọn lại giữa `Pending`, `Processing`, `Shipped`, `Delivered` để sửa sai.

### Quy tắc backend

```text
Admin: Pending → Processing → Shipped → Delivered
          └────────┐
     Processing ───┴→ Cancelled

Orchestra Admin: được sửa giữa 4 trạng thái chưa hủy
Cancelled: không mở lại vì kho đã được hoàn
```

### Thanh toán

- Đơn chuyển khoản chưa Paid có nút **Xác nhận thanh toán**.
- Đơn COD chỉ xác nhận Paid sau khi trạng thái là Delivered.
- Trạng thái đơn và trạng thái thanh toán là hai trường riêng.

### Nếu bị hỏi

**Nếu Admin gửi thẳng Pending → Delivered?**

`updateOrderStatus()` dùng `ADMIN_TRANSITIONS` và trả 409 vì nhảy bước. Orchestra Admin là ngoại lệ để sửa lỗi vận hành.

**Tại sao không mở lại đơn Cancelled?**

Vì khi hủy, tồn kho đã được cộng lại. Mở lại có thể bán vượt kho.

**Nếu Admin xác nhận Paid cho COD chưa giao?**

Backend chặn bằng điều kiện `paymentMethod === 'COD' && orderStatus !== 'Delivered'`.

## Bước 8 — Xử lý Báo nội dung

### Thao tác đã kiểm tra

1. Mở **Báo nội dung**.
2. Chỉ ra tên nội dung/sản phẩm, email người gửi và nội dung báo cáo.
3. Chuyển trạng thái: **Mới → Đã xem → Đã xử lý**.

Các ví dụ đang có gồm bình luận không phù hợp, sai giá/kích thước và ảnh không đúng mô tả.

### Nếu bị hỏi

**Báo cáo được lưu ở đâu?**

Collection `feedbacks`.

**Ai được đổi trạng thái?**

API `/api/admin/feedback/:id` yêu cầu `authenticate` và `requireAdmin`.

## Bản đồ code của Phúc

| Nội dung | Hàm / component | File |
|---|---|---|
| Hộp xác thực | `LoginModal()` | `client/src/components/auth/LoginModal.jsx` |
| Lưu phiên | `saveSession()` | `client/src/context/AuthContext.jsx` |
| Yêu cầu/hoàn tất đăng ký | `registerRequest()`, `completeRegistration()` | `server/src/controllers/authController.js` |
| Đăng nhập | `login()` | `server/src/controllers/authController.js` |
| Quên mật khẩu | `requestPasswordReset()`, `resetPassword()` | `server/src/controllers/authController.js` |
| Bảo vệ API | `authenticate()`, `requireAdmin()` | `server/src/middleware/authMiddleware.js` |
| Chặn trang quản trị | `AdminRoute()` | `client/src/router.jsx` |
| Giao diện quản trị | `AdminPage()` | `client/src/pages/AdminPage.jsx` |
| CRUD sản phẩm | `create()`, `update()`, `remove()`, `permanentRemove()` | `server/src/controllers/productController.js` |
| Đồng bộ bản JSON | `syncJson()` | `server/src/controllers/productController.js` |
| Khách hàng/Admin | `listUsers()`, `updateUser()` | `server/src/controllers/adminController.js` |
| Đơn hàng | `updateOrderStatus()` | `server/src/controllers/orderController.js` |
| Báo nội dung | `listFeedback()`, `updateFeedback()` | `server/src/controllers/adminController.js` |

## Câu bàn giao cho Hiệp

> “Sau khi người dùng tạo dữ liệu, Admin đã có luồng xử lý và quyền hạn rõ ràng. Cuối cùng, bạn Hiệp sẽ nối các phần này thành kiến trúc tổng thể, giải thích MongoDB, Phòng thử AI và cách hệ thống được triển khai.”

## Checklist 30 giây

- [ ] Nói đúng đăng ký 2 bước.
- [ ] Nhớ: ghi nhớ identity, không ghi nhớ mật khẩu.
- [ ] Nói được OTP hash, hạn 10 phút, khóa sau 5 lần sai.
- [ ] Demo Admin thường trước, Orchestra Admin sau.
- [ ] Phân biệt Ngừng bán với Xóa vĩnh viễn.
- [ ] Phân biệt trạng thái đơn với trạng thái thanh toán.
- [ ] Không nói giao diện đã tạo được Admin mới.
- [ ] Bàn giao cho Hiệp.
