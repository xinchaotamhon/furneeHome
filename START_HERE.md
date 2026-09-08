# START HERE — FurneeHome bản bảo vệ

Đọc hết file này trước khi sửa code. README dành cho nhóm; file này là bản đồ làm việc cho AI.

## 1. Mục tiêu

FurneeHome là đồ án tốt nghiệp của nhóm 4 người. Người dùng tìm nội thất và xem thử một sản phẩm trong ảnh phòng thật trước khi quyết định.

Ưu tiên theo thứ tự:

1. Chạy ổn định khi bảo vệ.
2. Luồng dễ hiểu, dễ demo, dễ trả lời câu hỏi.
3. Code ngắn và tuần tự như `pretest2`.
4. Một điểm wow rõ ràng: Phòng thử.
5. Giao diện đủ tốt và responsive, không thêm hiệu ứng hoặc kiến trúc phức tạp.

## 2. Phạm vi chốt

Giữ các chức năng sau:

- Trang chủ.
- Tìm kiếm, lọc và sắp xếp sản phẩm.
- Phòng thử: tải ảnh, chọn đúng một sản phẩm, kéo, đổi kích thước, lật, tạo và lưu ảnh.
- Bộ sưu tập sản phẩm và mẫu phòng cá nhân.
- Đăng ký, đăng nhập, đăng xuất, quên mật khẩu bằng OTP.
- Cập nhật họ tên và ảnh đại diện.
- Góp ý và báo nội dung sản phẩm xấu.
- Admin CRUD sản phẩm và xử lý phản hồi.
- Superadmin quản lý quyền và trạng thái tài khoản.

Không tự thêm giỏ hàng, thanh toán, đơn hàng, chat, mẫu công khai, nhiều sản phẩm trong một ảnh, random phòng, 3D hoặc import Shopee. Những phần đó không thuộc bản chốt.

## 3. Quy tắc code

- Luồng backend: `route → controller → model → MongoDB → JSON response`.
- Luồng frontend: `page/component → service → API → context/state → giao diện`.
- Mỗi hàm làm một việc và đặt tên nói rõ việc đó.
- Ưu tiên `if`, `map`, `filter`, `try/catch`; không tạo abstraction nếu chỉ dùng một lần.
- Không thêm thư viện khi JavaScript, React hoặc CSS hiện có đã làm được.
- Không tạo folder hoặc file phụ chỉ để mô tả kế hoạch, log hay trạng thái.
- Không ghi secret, OTP production hoặc mật khẩu vào code, README, log hay Git.
- Không đổi tên route/hàm quan trọng nếu không thật sự cần, vì Fourgether dùng các tên đó để nhóm học.
- Nội dung giao diện ngắn, trực tiếp; không thêm ghi chú giải thích điều người dùng đã nhìn thấy.
- Giữ thay đổi cũ của người dùng và không khôi phục các file họ đã xóa.

## 4. Bản đồ frontend

| File | Vai trò |
|---|---|
| `client/src/router.jsx` | Khai báo URL và chặn trang quản trị |
| `context/AuthContext.jsx` | User, JWT, mở modal, đăng nhập, đăng ký, logout, cập nhật hồ sơ |
| `context/ProductContext.jsx` | Tải sản phẩm, JSON dự phòng và CRUD admin |
| `context/CollectionContext.jsx` | Sản phẩm đã lưu, mẫu phòng local/MongoDB |
| `pages/HomePage.jsx` | Trang giới thiệu |
| `pages/ProductListPage.jsx` | Tìm, lọc, sắp xếp sản phẩm |
| `pages/RoomStudioPage.jsx` | Toàn bộ luồng Phòng thử |
| `pages/CollectionPage.jsx` | Xem, mở lại và xóa mục đã lưu |
| `pages/ProfilePage.jsx` | Cập nhật hồ sơ |
| `pages/FeedbackPage.jsx` | Góp ý và báo nội dung xấu |
| `pages/AdminPage.jsx` | Ba tab Sản phẩm, Người dùng, Phản hồi |
| `services/*.js` | Gọi API và trả `response.data.data` |
| `utils/roomPreviewCanvas.js` | Tạo ảnh hướng dẫn, mask và ghép kết quả |

Các hàm frontend cần giữ dễ nhận biết:

- `fetchProducts`: API trước, JSON dự phòng sau.
- `generatePreview`: kiểm tra đầu vào, tạo preview local, gọi AI, ghép kết quả.
- `createRoomPreviewImages`: tạo room, guide, mask, reference sản phẩm.
- `compositeRoomPreview`: chỉ ghép vùng sản phẩm lên phòng gốc.
- `saveDesign`: gom trạng thái Phòng thử để lưu.
- `saveRoomTemplate`: giữ local trước, đồng bộ MongoDB khi đã đăng nhập.
- `openDesign`: tải mẫu đầy đủ và chuyển trạng thái về Phòng thử.

## 5. Bản đồ backend

| Route | Controller | Model/Dịch vụ |
|---|---|---|
| `/api/auth` | `authController` | `User`, bcrypt, JWT, nodemailer |
| `/api/users/me` | `userController` | `User` |
| `/api/products` | `productController` | `Product`, `Category` |
| `/api/room-previews` | `roomPreviewController` | `cloudflareImageService` |
| `/api/room-designs` | `roomDesignController` | `RoomDesign` |
| `/api/feedback` | `feedbackController` | `Feedback` |
| `/api/admin` | `adminController` | `User`, `Feedback` |

Các hàm backend cần giữ dễ nhận biết:

- `register`, `login`: kiểm tra dữ liệu, bcrypt, User, JWT.
- `requestPasswordReset`: tạo OTP, chỉ lưu hash và hạn 10 phút, gửi SMTP.
- `resetPassword`: so sánh hash, kiểm tra hạn rồi hash mật khẩu mới.
- `authenticate`: xác minh JWT và nạp user đang hoạt động.
- `requireAdmin`, `requireSuperadmin`: kiểm tra quyền ở backend.
- `productData`: làm sạch dữ liệu sản phẩm dùng cho create/update.
- `cleanDesignInput`: giới hạn ảnh, text, điểm và đúng một sản phẩm.
- `buildPrompt`: giữ kiến trúc phòng và nhận dạng sản phẩm.
- `providerList`: chọn Pollinations rồi Cloudflare theo `.env`.
- `generateRoomPreview`: thử từng provider và trả provider/model đã dùng.

## 6. Quy tắc dữ liệu

- MongoDB là nguồn chung khi API hoạt động.
- JSON trong `client/public/data_import` chỉ là dữ liệu sản phẩm dự phòng.
- `localStorage` giữ sản phẩm yêu thích và bản mẫu nhẹ của khách; không giữ ảnh base64 sản phẩm lớn.
- `sessionStorage` giữ phiên đang chỉnh trong Phòng thử; **Làm lại** xóa phiên.
- Người đăng nhập lưu mẫu phòng lên MongoDB. Nếu API lưu lỗi, bản local vẫn còn.
- Product ảnh base64 tối đa 5 MB chuỗi; RoomDesign kiểm tra kích thước từng trường.
- Không tin role từ frontend. Mọi quyền admin/superadmin phải qua middleware backend.

## 7. Sự thật về Phòng thử

1. Người dùng tải ảnh phòng; trình duyệt nén cạnh dài tối đa 1400 px.
2. Người dùng chọn hoặc kéo một sản phẩm lên ảnh.
3. Sản phẩm hiện ngay để kéo vị trí, đổi tỷ lệ và lật.
4. `createRoomPreviewImages` thu ảnh tham chiếu còn dưới 512 px để phù hợp Cloudflare, đồng thời tạo guide và mask.
5. Bản guide được hiển thị trước để demo không phụ thuộc API.
6. Backend thử model Pollinations theo thứ tự, rồi Cloudflare.
7. `compositeRoomPreview` chỉ lấy vùng mask từ kết quả AI và phủ nhẹ ảnh sản phẩm gốc để giữ nhận dạng.
8. Người dùng so sánh **Ảnh gốc/Kết quả** và lưu.

## 8. Tài khoản và quyền

- Mật khẩu luôn được hash bằng bcrypt.
- JWT hết hạn sau 7 ngày và được kiểm tra lại qua `/users/me` khi mở ứng dụng.
- OTP quên mật khẩu có 6 số, hết hạn sau 10 phút; database chỉ giữ SHA-256 hash.
- Localhost có thể trả `devOtp` để demo nếu chưa có SMTP; production không bao giờ làm vậy.
- `customer` không vào API quản trị.
- `admin` quản lý sản phẩm và phản hồi.
- Chỉ `superadmin` đổi role hoặc khóa/mở tài khoản; không thay đổi chính mình hay superadmin khác.

## 9. Kiểm tra bắt buộc sau khi sửa

Không kết luận hoàn thành nếu chưa kiểm tra phần có liên quan:

1. Chạy `npm run build` trong `client`.
2. Chạy `node --check` cho toàn bộ file JavaScript backend.
3. Mở website và đi qua route vừa sửa.
4. Kiểm tra trạng thái tải, rỗng, thành công, lỗi và nút bị vô hiệu hóa.
5. Với xác thực: thử sai dữ liệu, user thường, admin và superadmin.
6. Với Phòng thử: thử local fallback kể cả khi API AI lỗi.
7. Với lưu dữ liệu: tải lại trang, đăng xuất/đăng nhập và mở lại mẫu.
8. So sánh code/tài liệu/Fourgether; không để tên hàm hoặc hành vi bị lệch.

## 10. Triển khai

- Client là Vite và deploy lên Cloudflare Pages bằng thư mục `client/dist`.
- Backend deploy lên Render từ thư mục `server` với `npm start`.
- MongoDB dùng Atlas.
- Secret chỉ đặt trong biến môi trường Cloudflare/Render.
- `_redirects` trong `client/public` giữ React Router hoạt động khi tải lại URL.

Fourgether là repo học riêng. Khi thay đổi chức năng thật, cập nhật Fourgether sau khi code và kiểm tra đã ổn định.
