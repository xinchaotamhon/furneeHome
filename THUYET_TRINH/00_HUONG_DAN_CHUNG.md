# Hướng dẫn chung — Bảo vệ FurneeHome

> Thứ tự cố định: **Dũng → Triều → Phúc → Hiệp** — Bản này được đối chiếu với code và kiểm tra trực tiếp trên website ngày **09/09/2026**.

## 1. Một luồng duy nhất cho toàn bài

```text
Khách tìm sản phẩm
        ↓
Khách hàng xem chi tiết → thêm giỏ → thanh toán → theo dõi đơn → đánh giá
        ↓
Admin quản lý sản phẩm → khách hàng → đơn hàng → báo nội dung
        ↓
Orchestra Admin kiểm soát thêm các tài khoản Admin
        ↓
Phòng thử AI nhận ảnh phòng + 1–3 sản phẩm + vị trí → tạo ảnh tham khảo
        ↓
React trên Cloudflare → Express trên Render → MongoDB Atlas
```

Mỗi người tiếp tục đúng điểm người trước vừa dừng. Không mở đầu lại dự án từ đầu.

## 2. Chia phần

| Thứ tự | Người nói | Nội dung chính | Điểm bàn giao |
|---|---|---|---|
| 1 | **Dũng** | Bài toán, người dùng, trang chủ, tìm kiếm sản phẩm, liên hệ và báo nội dung | Khách đã tìm được món cần mua |
| 2 | **Triều** | Chi tiết, giỏ hàng, thanh toán, lịch sử đơn, đánh giá và hồ sơ | Đơn hàng đã được tạo và cần quản trị |
| 3 | **Phúc** | OTP, đăng nhập, quên mật khẩu, trang quản trị và phân quyền | Hệ thống nghiệp vụ đã hoàn chỉnh |
| 4 | **Hiệp** | Kiến trúc, MongoDB, JSON hiển thị nhanh, Phòng thử AI, deploy và kết luận | Kết thúc toàn bài |

Mục tiêu khoảng **4–5 phút/người**. Nếu hội đồng ngắt để hỏi, trả lời ngay tại bước đang demo rồi mới đi tiếp.

## 3. Chuẩn bị trước buổi bảo vệ

### Các trang cần mở sẵn

- Website: `https://furneehome.pages.dev/`
- Sản phẩm: `https://furneehome.pages.dev/products`
- Phòng thử: `https://furneehome.pages.dev/room-studio`
- API kiểm tra: `https://furneehome.onrender.com/api/health`
- Một cửa sổ đăng nhập khách hàng và một cửa sổ quản trị để đỡ mất thời gian đăng xuất.

### Tài khoản demo

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Orchestra Admin | `admin` | `123` |
| Admin | `phuc` | `123` |
| Admin | `trieu` | `123` |
| Admin | `dung` | `123` |
| Khách hàng | `customer` | `user123456` |

Đây là tài khoản mẫu của đồ án, không phải tài khoản cá nhân. Không đổi mật khẩu ngay trước lúc bảo vệ.

### Dữ liệu cần chuẩn bị

- Giỏ của tài khoản `customer` có ít nhất 2 món.
- Có sẵn một đơn `Pending` hoặc `Processing`, một đơn `Delivered`, một đơn `Cancelled`.
- Có sẵn một đơn `Delivered` chưa đánh giá hết để mở trang đánh giá.
- Ảnh phòng mẫu: `client/public/images/home-room-1.webp`.
- Mở `/api/health` trước buổi bảo vệ vài phút để đánh thức Render nếu lần truy cập đầu chậm.

## 4. Cách nói ở mỗi bước

Mỗi bước chỉ cần nhớ 5 ý:

1. **Mục đích:** chức năng giải quyết việc gì.
2. **Thao tác:** bấm ở đâu, nhập gì.
3. **Kết quả:** dấu hiệu nào chứng minh hoạt động đúng.
4. **Nếu lỗi:** hệ thống chặn hoặc xử lý thế nào.
5. **Code:** tên hàm và file; không học thuộc số dòng vì số dòng đổi sau mỗi lần sửa.

Mẫu trả lời khi được hỏi sâu:

> “Ở giao diện, thao tác bắt đầu tại `TênComponent`. Dữ liệu đi qua API đến `TênController`, controller kiểm tra nghiệp vụ rồi mới đọc hoặc ghi MongoDB bằng model tương ứng.”

## 5. Bản đồ code chung

| Nội dung | Giao diện | Backend |
|---|---|---|
| Điều hướng | `client/src/router.jsx`, `Header.jsx` | — |
| Danh sách sản phẩm | `ProductListPage.jsx`, `productService.js` | `productController.list()` |
| Giỏ hàng | `CartPage.jsx`, `CartContext.jsx` | `cartController.js` |
| Tạo và hủy đơn | `CheckoutPage.jsx`, `OrderHistoryPage.jsx` | `orderController.createOrder()`, `cancelOrder()` |
| Đánh giá | `OrderReviewPage.jsx`, `ProductDetailPage.jsx` | `reviewController.js` |
| Xác thực | `LoginModal.jsx`, `AuthContext.jsx` | `authController.js`, `authMiddleware.js` |
| Quản trị | `AdminPage.jsx` | `productController.js`, `adminController.js`, `orderController.js` |
| Phòng thử | `RoomStudioPage.jsx`, `roomPreviewService.js` | `roomPreviewController.create()`, `cloudflareImageService.js` |
| Kết nối hệ thống | `apiClient.js` | `app.js`, `routes/index.js`, `config/db.js` |

## 6. Kết quả đã kiểm tra trực tiếp

- Tìm kiếm, lọc danh mục, sắp xếp giá và phân trang đều cập nhật danh sách.
- Giỏ hàng thay đổi số lượng, chọn từng món và tính lại tổng tiền đúng.
- Phí giao hàng thay đổi theo tỉnh: TP.HCM hiển thị 30.000đ; khi chọn Hà Nội hiển thị 60.000đ.
- Tài khoản khách chỉ thấy đơn của mình; đơn đã giao mở được trang đánh giá.
- Admin thường có 4 nhóm quản trị; Orchestra Admin có thêm **Quản trị admin**.
- Phòng thử đã chạy đủ 3 bước và trả ảnh sau khoảng 15 giây trong lần kiểm tra. Ảnh giữ bố cục phòng khá tốt nhưng chỉ 2/3 món hiện rõ; đây là giới hạn phải nói trung thực về AI sinh ảnh.
- API `/api/health` và API sản phẩm trên Render trả dữ liệu thành công.

Ngoài thao tác trực tiếp trên giao diện, nhóm chức năng backend/MongoDB được chạy bằng dữ liệu thử tách biệt rồi dọn sạch ngay sau khi kiểm tra. Kết quả **39/39 đạt**:

- Hoàn tất đăng ký bằng OTP; đăng nhập bằng username hoặc email; cập nhật hồ sơ; đổi và đặt lại mật khẩu.
- OTP đặt lại mật khẩu bị hủy sau 5 lần nhập sai.
- Orchestra Admin quản lý Admin thường; Admin quản lý trạng thái khách hàng.
- Thêm, sửa, thêm ảnh, ngừng bán và bán lại sản phẩm.
- Thêm giỏ; tạo đơn bằng giá trong MongoDB; phí vận chuyển do backend tính; món đã mua được xóa khỏi giỏ.
- Đặt đơn trừ kho; hủy đơn hoàn kho đúng một lần; không thể nhảy sai trạng thái đơn.
- Đơn đã giao được xác nhận thanh toán; chỉ khách đã nhận hàng mới đánh giá; chặn đánh giá trùng.
- Ẩn/hiện đánh giá làm điểm sao được tính lại; báo nội dung được tiếp nhận và xử lý.
- Chặn xóa vĩnh viễn sản phẩm đã phát sinh đơn hàng.
- Sau kiểm tra, số tài khoản, sản phẩm, đơn, báo nội dung và đánh giá thử còn lại đều bằng 0.

Hai phần phụ thuộc dịch vụ bên ngoài cần kiểm tra lại ngay trước buổi bảo vệ: Gmail có nhận OTP thật hay không và nhà cung cấp AI có đang phản hồi hay không. Logic OTP và luồng tạo ảnh đã hoạt động; thời gian phản hồi bên ngoài có thể thay đổi.

## 7. Phương án khi demo gặp sự cố

- **Render phản hồi chậm:** mở `/api/health`, đợi server thức rồi tải lại trang.
- **OTP chưa tới:** kiểm tra thư rác và biến SMTP trên Render; chuyển sang tài khoản mẫu để tiếp tục bài.
- **AI đang bận:** nói rõ backend sẽ thử provider kế tiếp; dùng ảnh kết quả đã tạo sẵn để giải thích đầu vào và đầu ra.
- **Không có mạng:** mở code đúng hàm, trình bày luồng request và dữ liệu mẫu đã chuẩn bị.
- **Không được tự ý sửa dữ liệu thật:** không bấm Xóa, Đổi mật khẩu hoặc Xác nhận thanh toán nếu chưa thống nhất với nhóm.

## 8. Mở đúng file của từng người

1. [Dũng — Tổng quan và tìm sản phẩm](./01_DUNG.md)
2. [Triều — Mua hàng và hậu mãi](./02_TRIEU.md)
3. [Phúc — Xác thực và quản trị](./03_PHUC.md)
4. [Hiệp — Kiến trúc, dữ liệu, AI và deploy](./04_HIEP.md)
