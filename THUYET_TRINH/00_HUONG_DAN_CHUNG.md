# Hướng dẫn chung — luồng trình bày theo trang

## 1. Thứ tự mới và câu chuyện chung

Thứ tự cố định: **Phúc → Dũng → Triều → Hiệp**. Mỗi người trình bày đúng nhóm trang được giao, thao tác liên tục trên website và bàn giao tại dữ liệu đã tạo.

```text
Phúc: Đăng nhập/Đăng ký → Quên mật khẩu → Tài khoản người dùng → Admin/Orchestra
  ↓ bàn giao tài khoản customer và tài khoản quản trị đã đăng nhập
Dũng: Giỏ hàng → Thanh toán
  ↓ bàn giao đơn hàng vừa tạo
Triều: Chi tiết một sản phẩm → Đơn mua → Đánh giá
  ↓ bàn giao sản phẩm, đơn và đánh giá để quản trị kiểm tra
Hiệp: Danh sách sản phẩm → Phòng thử → toàn bộ Trang quản trị
  ↓ kết luận: dữ liệu từ khách đến Admin được xử lý trong cùng một hệ thống
```

Không mở lại phần giới thiệu dài ở mỗi lượt. Người trước chỉ cần nói câu bàn giao, người sau tiếp tục từ trang đã mở.

| Thứ tự | Người nói | Trang phải trình bày | Điểm bàn giao |
|---|---|---|---|
| 1 | **Phúc** | Đăng nhập, Đăng ký, Quên mật khẩu, Tài khoản người dùng, quyền Admin và Orchestra Admin | Đã có tài khoản customer/admin và trạng thái hồ sơ để người sau dùng |
| 2 | **Dũng** | Giỏ hàng, Thanh toán | Đã tạo một đơn có địa chỉ, phí ship và phương thức thanh toán |
| 3 | **Triều** | Chi tiết một sản phẩm, Đơn mua, Đánh giá | Có đơn đã giao để mở đánh giá, đồng thời chỉ ra trạng thái không được hủy/hoàn |
| 4 | **Hiệp** | Danh sách sản phẩm, Phòng thử, toàn bộ Trang quản trị | Admin xem và xử lý sản phẩm, khách hàng, đơn hàng, báo nội dung |

Mục tiêu khoảng 4 phút mỗi người. Mỗi bước gồm năm ý: mục đích, thao tác, kết quả đúng, trường hợp sai và nơi có code.

## 2. Chuẩn bị trước khi trình bày

Mở sẵn các tab sau:

- Website: `https://furneehome.pages.dev/`
- Danh sách: `/products`
- Phòng thử: `/room-studio`
- Kiểm tra backend: `https://furneehome.onrender.com/api/health`

Chuẩn bị một cửa sổ ẩn danh cho khách và một cửa sổ quản trị. Bản cuối yêu cầu đăng nhập bằng email, vì vậy dùng đúng các email demo dưới đây, không dùng username để chứng minh đăng nhập. Nếu bản deploy hiện còn nhận username, phải merge phần Phúc trước khi bảo vệ.

| Vai trò | Email đăng nhập | Tên hiển thị | Mật khẩu |
|---|---|---|---|
| Orchestra Admin | `admin@furneehome.vn` | Hiệp - Orchestra Admin | `123` |
| Admin | `phuc@furneehome.vn` | Phúc - Admin | `123` |
| Admin | `trieu@furneehome.vn` | Triều - Admin | `123` |
| Admin | `dung@furneehome.vn` | Dũng - Admin | `123` |
| Khách hàng | `customer@furneehome.vn` | Khách hàng demo | `user123456` |

Các email/mật khẩu này lấy từ seed hiện tại. Nếu Render đã đặt `ADMIN_PASSWORD`, `TEAM_ADMIN_PASSWORD` khác mặc định, dùng mật khẩu trong biến môi trường đã cấu hình.

| Dữ liệu demo | Cần có |
|---|---|
| Khách hàng | Email đã xác minh, mật khẩu hiện tại, ít nhất một đơn đã giao |
| Giỏ hàng | Hai sản phẩm, có một sản phẩm chưa chọn để chứng minh tính chọn lọc |
| Đơn hàng | Một đơn `Pending` hoặc `Processing`, một đơn `Shipped`, một đơn `Delivered` |
| Phòng thử | Ảnh `client/public/images/home-room-1.webp`, 1–3 sản phẩm có ảnh |
| Quản trị | Một tài khoản `admin`, một tài khoản `superadmin`/Orchestra Admin |

Không xóa dữ liệu thật, không đổi mật khẩu demo ngay trước buổi bảo vệ. Nếu phải tạo đơn mới, chọn COD hoặc QR theo dữ liệu môi trường đang hoạt động.

## 3. Quy tắc nói về code

Mỗi đoạn code trong file của từng người đều có đường dẫn và tên hàm. Khi hội đồng hỏi, mở đúng file và nói:

> “Thao tác bắt đầu ở component trang này. Service gọi API. Controller kiểm tra dữ liệu và quyền trước khi đọc hoặc ghi MongoDB. Frontend chỉ hiển thị kết quả trả về.”

Không đọc thuộc số dòng. Đường dẫn tính từ thư mục dự án:

```text
client/src/…  giao diện, state, gọi service
server/src/…  route, middleware, controller, model
server/src/models/…  schema và collection MongoDB
```

## 4. Bản đồ code dùng chung

| Chức năng | Giao diện | Backend |
|---|---|---|
| Đăng nhập, OTP, đặt lại mật khẩu | `LoginModal.jsx`, `AuthContext.jsx` | `authController.js`, `authMiddleware.js` |
| Hồ sơ | `ProfilePage.jsx`, `userService.js` | `userController.js`, `User.js` |
| Giỏ và checkout | `CartPage.jsx`, `CartContext.jsx`, `CheckoutPage.jsx` | `cartController.js`, `orderController.js` |
| Chi tiết và danh sách | `ProductDetailPage.jsx`, `ProductListPage.jsx` | `productController.js` |
| Đơn và đánh giá | `OrderHistoryPage.jsx`, `OrderReviewPage.jsx` | `orderController.js`, `reviewController.js` |
| Phòng thử | `RoomStudioPage.jsx` | `roomPreviewController.js`, `cloudflareImageService.js` |
| Quản trị | `AdminPage.jsx` | `adminController.js`, `productController.js`, `orderController.js` |

### Hai đoạn code dùng khi hội đồng hỏi luồng request

`client/src/services/apiClient.js` — `API_BASE_URL`

```js
const API_BASE_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD
    ? 'https://furneehome.onrender.com/api' : 'http://localhost:5000/api');
```

`server/src/app.js` — `health`

```js
function health(req, res) {
  return res.json({
    success: true, message: 'FurneeHome API đang hoạt động.', data: null,
  });
}
```

Khi trình bày, chỉ cần nói request đi từ component → service → route/controller → MongoDB → JSON response. Không cần mở toàn bộ file cấu hình.

## 5. Mẫu phản biện ngắn

**Frontend có tự quyết định giá, phí ship hoặc quyền không?**

> “Không. Frontend chỉ gửi lựa chọn của người dùng. Backend đọc giá và tồn kho từ MongoDB, tính phí vận chuyển, kiểm tra JWT và role rồi mới ghi dữ liệu.”

**Nếu API hoặc dịch vụ ngoài chậm?**

> “Em mở `/api/health` để kiểm tra server. Với Phòng thử, em nói rõ đây là ảnh tham khảo bằng AI và có fallback, không cam kết kết quả giống tuyệt đối.”

**Nếu hội đồng hỏi một tính năng đang thay đổi?**

> “Đây là yêu cầu đã chốt, nhóm sẽ xác nhận lại đúng tên component và kết quả sau khi merge code; em không khẳng định một nút chưa kiểm tra trên bản deploy.”

## 6. Câu bàn giao chính xác

Phúc nói:

> “Tài khoản đã được xác minh và đăng nhập đúng vai trò. Em bàn giao giỏ hàng của khách cho Dũng.”

Dũng nói:

> “Đơn hàng đã được tạo với địa chỉ và phí vận chuyển do backend tính. Mời Triều mở Đơn mua để theo dõi và đánh giá.”

Triều nói:

> “Sản phẩm đã có trong đơn, đơn đã giao có thể đánh giá và đơn đang giao bị chặn hủy/hoàn theo nghiệp vụ. Mời Hiệp kiểm tra các màn hình quản trị.”

Hiệp kết luận:

> “Từ danh sách sản phẩm, Phòng thử đến các tab quản trị, mọi thay đổi đều đi qua API và được kiểm soát theo vai trò.”

## 7. Điểm phải rà trước khi bảo vệ

- Kiểm tra bản deploy đã nhận commit mới nhất, nhất là đăng nhập bằng email và xác minh email trước khi đổi mật khẩu.
- Kiểm tra tài khoản bị khóa hiển thị thông báo rõ cho cả customer và Admin.
- Kiểm tra địa chỉ, số điện thoại, ghi chú trong hồ sơ có được nạp mặc định sang checkout.
- Kiểm tra đơn có hóa đơn, hồ sơ khách và trạng thái đủ hồ sơ theo phần Hiệp dự kiến.
- Nếu tính năng chưa có trên deploy, mở code và trình bày luồng, sau đó nói rõ giới hạn thay vì bấm một nút không tồn tại.

## 8. Mở file theo thứ tự

1. [Phúc — Đăng nhập, tài khoản và quyền](./01_PHUC.md)
2. [Dũng — Giỏ hàng và thanh toán](./02_DUNG.md)
3. [Triều — Chi tiết, đơn mua và đánh giá](./03_TRIEU.md)
4. [Hiệp — Sản phẩm, Phòng thử và quản trị](./04_HIEP.md)
