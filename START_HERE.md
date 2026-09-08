# START HERE — FurneeHome bản bảo vệ

AI phải đọc hết file này trước khi sửa code. README dành cho nhóm; file này là bản đồ kỹ thuật.

## 1. Mục tiêu

FurneeHome là website bán nội thất của nhóm 4 người.

Thứ tự ưu tiên:

1. Mua hàng, tài khoản và quản trị phải chạy ổn định.
2. Code tuần tự, dễ đọc như `pretest2`.
3. Luồng dễ demo và dễ giải thích khi bảo vệ.
4. Phòng thử AI là một điểm wow đơn giản.
5. Không thêm chức năng, thư viện hoặc kiến trúc nếu chưa thật sự cần.

## 2. Phạm vi chốt

- Trang chủ, danh sách và chi tiết sản phẩm.
- Tìm kiếm, lọc và sắp xếp.
- Giỏ hàng, thanh toán COD, lịch sử và hủy đơn.
- Đánh giá sau khi đã nhận hàng.
- Đăng ký, đăng nhập, đăng xuất, OTP quên mật khẩu.
- Sửa hồ sơ, góp ý và báo nội dung xấu.
- Bộ sưu tập cá nhân.
- Admin quản lý sản phẩm, ảnh, giá, tồn kho, đơn hàng và phản hồi.
- Superadmin quản lý quyền và trạng thái tài khoản.
- Phòng thử: tải một ảnh, chọn một sản phẩm, tạo ảnh, so sánh và lưu.

Không thêm kéo thả, điểm góc, 3D, nhiều sản phẩm, chat, thanh toán online, import Shopee hoặc mẫu công khai vào bản bảo vệ.

## 3. Quy tắc code

- Backend: `route → controller → model → MongoDB → JSON response`.
- Frontend: `page → service/context → API → state → giao diện`.
- Mỗi hàm làm một việc; ưu tiên `if`, `map`, `filter`, `try/catch`.
- Không tạo abstraction chỉ dùng một lần.
- Không tạo thêm file hoặc folder chỉ để ghi kế hoạch hay trạng thái.
- Nội dung giao diện ngắn và trực tiếp.
- Không đổi route hoặc tên hàm quan trọng nếu không cần; Fourgether liên kết tới mã nguồn thật.
- Không tin giá, tồn kho, tổng tiền hay role do frontend gửi.
- Không ghi `.env`, JWT, OTP, API key hoặc mật khẩu production vào Git.
- Không khôi phục file người dùng đã xóa.

## 4. Bản đồ frontend

| File | Vai trò |
|---|---|
| `client/src/router.jsx` | Khai báo trang và chặn route quản trị |
| `context/AuthContext.jsx` | Phiên đăng nhập và user hiện tại |
| `context/ProductContext.jsx` | MongoDB trước, JSON/cache dự phòng sau |
| `context/CartContext.jsx` | Giỏ khách local, giỏ user MongoDB |
| `context/CollectionContext.jsx` | Sản phẩm và ảnh phòng đã lưu |
| `pages/ProductListPage.jsx` | Danh sách, tìm, lọc, sắp xếp |
| `pages/ProductDetailPage.jsx` | Chi tiết, tồn kho, thêm giỏ, đánh giá |
| `pages/CartPage.jsx` | Số lượng và tổng tạm tính |
| `pages/CheckoutPage.jsx` | Địa chỉ và đặt hàng COD |
| `pages/OrderHistoryPage.jsx` | Theo dõi và hủy đơn |
| `pages/RoomStudioPage.jsx` | Ba bước tạo ảnh AI |
| `pages/ProfilePage.jsx` | Sửa hồ sơ |
| `pages/FeedbackPage.jsx` | Góp ý và báo xấu |
| `pages/AdminPage.jsx` | Sản phẩm, user, phản hồi |
| `pages/AdminOrdersPage.jsx` | Trạng thái đơn hàng |
| `services/*.js` | Gọi API |

## 5. Bản đồ backend

| Route | Controller | Dữ liệu |
|---|---|---|
| `/api/auth` | `authController` | User, bcrypt, JWT, OTP |
| `/api/users` | `userController` | Hồ sơ |
| `/api/products` | `productController` | Product, Category |
| `/api/cart` | `cartController` | Cart, Product |
| `/api/orders` | `orderController` | Order, Product |
| `/api/reviews` | `reviewController` | Review, Order, Product |
| `/api/room-previews` | `roomPreviewController` | Dịch vụ tạo ảnh |
| `/api/room-designs` | `roomDesignController` | RoomDesign |
| `/api/feedback` | `feedbackController` | Feedback |
| `/api/admin` | `adminController` | User, Feedback |

Hàm quan trọng:

- `register`, `login`, `requestPasswordReset`, `resetPassword`: tài khoản và OTP.
- `fetchProducts`: ưu tiên API, sau đó mới dùng JSON/cache.
- `addItem`, `updateItem`, `removeItem`: giỏ hàng.
- `createOrder`: kiểm tra lại sản phẩm, trừ tồn kho và tạo snapshot.
- `cancelOrder`: kiểm tra trạng thái và hoàn tồn kho một lần.
- `updateOrderStatus`: chỉ cho phép chuyển trạng thái hợp lệ.
- `createReview`: chỉ người có đơn đã giao được đánh giá một lần.
- `productData`: kiểm tra giá và tồn kho khi admin lưu.
- `generate`: gọi Phòng thử từ giao diện.
- `buildPrompt`, `generateRoomPreview`: mô tả yêu cầu và thử provider AI.
- `saveRoomTemplate`: lưu ảnh đã tạo vào Bộ sưu tập.
- `updateUser`: chỉ superadmin thay đổi role hoặc khóa tài khoản.

## 6. Quy tắc nghiệp vụ

### Sản phẩm

- Giá là số nguyên VND lớn hơn 0.
- Tồn kho là số nguyên từ 0 trở lên.
- Sản phẩm bị xóa được ẩn thay vì xóa cứng để đơn hàng cũ còn tham chiếu được.
- JSON và ảnh trong `client/public` là bản dự phòng; MongoDB là nguồn chung của nhóm.

### Giỏ và đơn hàng

- Giỏ khách lưu local; sau đăng nhập dùng giỏ MongoDB.
- Backend bỏ qua giá và tổng tiền do client gửi.
- Checkout đọc giá và tồn kho mới nhất từ Product.
- Thanh toán của bản bảo vệ là COD.
- Trạng thái: `Pending → Processing → Shipped → Delivered`.
- Chỉ đơn `Pending` hoặc `Processing` được hủy.
- Trừ kho có điều kiện để kho không âm; hủy đơn hoàn kho đúng một lần.
- Order lưu snapshot tên, giá và ảnh sản phẩm.

### Tài khoản

- Mật khẩu hash bằng bcrypt; JWT kiểm tra ở middleware.
- OTP có 6 số, lưu hash, hết hạn sau 10 phút.
- Production không trả OTP về giao diện.
- `admin` không được tự cấp superadmin.
- `superadmin` không tự hạ quyền và không sửa superadmin khác.

### Phòng thử

1. Nhận ảnh JPG, PNG hoặc WebP dưới 10 MB.
2. Chọn đúng một sản phẩm.
3. `generate` gửi ảnh phòng và ảnh sản phẩm tới backend.
4. Backend thử provider theo biến môi trường.
5. Giao diện hiển thị kết quả, cho so sánh và lưu.
6. Không có kéo, góc, resize, nhiều món hoặc 3D.

## 7. Dữ liệu mẫu

- `client/public/data_import/data_import.json`: 101 sản phẩm có giá và tồn kho hợp lệ.
- 99 sản phẩm có ảnh được bật; 2 sản phẩm thiếu ảnh đang ẩn.
- `server/src/utils/seedData.js`: nạp JSON vào MongoDB và tạo tài khoản demo.
- Seed tìm theo slug nên có thể chạy lại mà không tạo trùng sản phẩm.
- Không chạy seed giữa lúc đang kiểm thử tồn kho đơn hàng vì seed đặt lại giá và tồn kho theo JSON.

## 8. Lưu trữ trình duyệt

- `localStorage`: token/user, giỏ khách, sản phẩm đã lưu và cache sản phẩm nhẹ.
- `sessionStorage`: ảnh phòng, sản phẩm và kết quả của phiên Phòng thử.
- MongoDB: user, sản phẩm, giỏ đăng nhập, đơn, đánh giá, thiết kế và phản hồi.
- Không lưu mật khẩu, OTP hoặc secret trong local/session storage.

## 9. Kiểm tra bắt buộc

Sau mỗi thay đổi, chạy phần liên quan:

```powershell
cd client
npm run smoke
npm run build
```

```powershell
cd server
npm run test:commerce
```

Kiểm tra thủ công trước khi bảo vệ:

1. Sản phẩm có ảnh, giá, tồn kho; lọc và chi tiết hoạt động.
2. Giỏ đổi số lượng đúng; checkout yêu cầu đăng nhập.
3. Đặt COD tạo đơn, trừ kho; hủy đơn hoàn kho.
4. Admin sửa giá/tồn kho và chuyển trạng thái đơn.
5. Customer không vào được route/API admin.
6. OTP local và Gmail production hoạt động theo cấu hình.
7. Phòng thử có đủ ảnh phòng + sản phẩm, trạng thái tải, kết quả, so sánh và lưu.
8. Tải lại URL trực tiếp không ra 404 ở Cloudflare.
9. Fourgether khớp route, hàm và nghiệp vụ hiện tại.

## 10. Deploy và Git

- Cloudflare Pages build thư mục `client`, output `dist`.
- Render chạy thư mục `server` bằng `npm start`.
- MongoDB Atlas là database chung.
- `.env` chỉ nằm local hoặc trong biến môi trường dịch vụ.
- JSON và ảnh sản phẩm được commit để cả nhóm có bản dự phòng giống nhau.
- Không dùng `git push --force`; merge `main` vào nhánh thành viên khi cần cập nhật.

Fourgether là repo học riêng. Chỉ cập nhật Fourgether sau khi code thật và kiểm tra đã ổn định.
