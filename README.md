# FurneeHome

FurneeHome là website bán nội thất và đồ trang trí cho sinh viên, học sinh, công nhân và gia đình phổ thông. Đây là đồ án tốt nghiệp của nhóm 4 người.

README này đi từ phần gốc của dự án đến cách chạy và giới hạn. Người mới có thể đọc theo thứ tự, sau đó mở đúng file để xem code.

## 1. Gốc của dự án

Người mua thường chỉ nhìn thấy ảnh sản phẩm nên khó biết món đồ có hợp với căn phòng thật hay không. FurneeHome giải quyết hai việc:

1. Bán sản phẩm nội thất có tên, ảnh, giá, tồn kho, giỏ hàng và đơn hàng.
2. Cho phép thử tối đa 3 sản phẩm trên ảnh phòng bằng dịch vụ tạo ảnh AI.

Mục tiêu của đồ án là một website dễ dùng, code dễ đọc và đủ luồng để demo: xem sản phẩm → chọn mua → thanh toán → theo dõi đơn → đánh giá; phần Phòng thử là điểm nổi bật.

## 2. Khái niệm cốt lõi

- **Frontend** là phần React chạy trong trình duyệt. Nó hiển thị trang, giữ trạng thái ngắn hạn và gửi request đến API.
- **Backend** là Node.js + Express. Nó kiểm tra dữ liệu, quyền đăng nhập, tính tiền và gọi MongoDB.
- **MongoDB** là dữ liệu chính: sản phẩm, tài khoản, giỏ hàng, đơn hàng, đánh giá và feedback.
- **API** là các đường dẫn `/api/...`. Frontend không tự sửa MongoDB mà luôn gửi request đến backend.
- **JWT** là token sau khi đăng nhập. Frontend lưu token, gửi trong header `Authorization`; backend dùng token để biết người đang thao tác.
- **Context React** dùng cho dữ liệu dùng ở nhiều trang: `AuthContext` cho tài khoản, `CartContext` cho giỏ, `ProductContext` cho danh sách sản phẩm.
- **Snapshot JSON** ở `client/public/data_import/data_import.json` chỉ giúp sản phẩm hiện sớm. Sau đó `ProductContext` gọi MongoDB qua API và thay bằng dữ liệu chính thức. Giá, tồn kho và thao tác mua luôn lấy từ MongoDB.

## 3. Kiến trúc React – Express – MongoDB

```text
Trình duyệt (React)
  ├─ Router chọn trang
  ├─ Context giữ user, product, cart
  └─ Service gửi HTTP request
          ↓
Express (/api)
  ├─ Route chọn controller
  ├─ Middleware kiểm tra JWT và quyền
  ├─ Controller kiểm tra business logic
  └─ Model Mongoose đọc/ghi MongoDB
          ↓
MongoDB Atlas
```

Khi tạo đơn, server tự đọc giá và tồn kho của từng sản phẩm từ MongoDB. Client không được quyết định lại giá hoặc phí vận chuyển. Sau khi tạo đơn, sản phẩm đã mua được xóa khỏi Cart trên MongoDB.

## 4. Cấu trúc code

```text
client/
  public/data_import/data_import.json  snapshot sản phẩm để hiện nhanh
  src/components/                      Header, login, card, thanh toán...
  src/context/                         Auth, Product, Cart
  src/pages/                           các trang người dùng và quản trị
  src/services/                        các lời gọi API
  src/styles/                          CSS chung và CSS bán hàng
  src/router.jsx                       danh sách đường dẫn frontend

server/
  src/server.js                         khởi động server và kết nối MongoDB
  src/app.js                            CORS, JSON, health check, route, 404
  src/routes/                           khai báo URL API
  src/controllers/                      xử lý từng nghiệp vụ
  src/models/                           schema MongoDB
  src/middleware/                       JWT, quyền admin, lỗi
  src/services/                         dịch vụ tạo ảnh và hỗ trợ khác
  src/utils/                            seed dữ liệu mẫu, tiện ích

THUYET_TRINH/                           kịch bản trình bày theo 4 thành viên
README.md                               tài liệu kỹ thuật tổng quan này
```

## 5. Model dữ liệu MongoDB

- `User`: họ tên, email, mật khẩu đã băm, vai trò, trạng thái khóa, số điện thoại và địa chỉ tỉnh/quận/phường. Ghi chú giao hàng là tùy chọn.
- `Category`: tên và slug danh mục.
- `Product`: tên, slug, danh mục, giá, tồn kho, ảnh, mô tả, thông số, điểm đánh giá và trạng thái đang bán.
- `Cart`: một giỏ theo user, gồm product và quantity. Giỏ tối đa 100 món được chọn để thanh toán.
- `Order`: user, bản chụp sản phẩm và giá lúc mua, địa chỉ giao, phí ship, thanh toán và trạng thái đơn.
- `Review`: user, product, order, số sao, nội dung và trạng thái ẩn/hiện.
- `Feedback`: nội dung báo xấu hoặc góp ý, người gửi và trạng thái xử lý.

Đơn hàng lưu `orderItems` và giá tại thời điểm mua để lịch sử không đổi khi sản phẩm được sửa về sau. Không xóa sản phẩm đã có đơn/đánh giá/giỏ; quản trị dùng **Ngừng bán** để giữ lịch sử. Xóa hẳn chỉ được phép khi sản phẩm chưa được tham chiếu.

## 6. Business logic chính

### Tài khoản và OTP

1. Đăng ký nhập email, server tạo OTP 6 số và gửi qua SMTP (localhost có thể trả mã thử nghiệm).
2. Nhập OTP đúng trong 10 phút rồi tạo mật khẩu.
3. Đăng nhập chỉ nhận email và mật khẩu. Tài khoản `isActive: false` bị báo khóa.
4. Quên mật khẩu chỉ nhận email đã có trong MongoDB, gửi OTP mới và giới hạn 5 lần nhập sai. Hết 5 lần phải xin mã mới.
5. Đổi mật khẩu trong Trang tài khoản cũng đi qua OTP email.

### Giỏ hàng và thanh toán

- Guest có thể thêm sản phẩm vào giỏ local; phải đăng nhập trước khi bấm **Mua ngay** hoặc thanh toán. Khi đăng nhập, giỏ guest được cộng vào giỏ của tài khoản.
- Mỗi dòng có số lượng theo tồn kho; có thể chọn tối đa 100 món.
- Checkout lấy tên, điện thoại, tỉnh, quận, phường và địa chỉ từ hồ sơ. Ghi chú giao hàng không bắt buộc.
- Server tự đọc giá/tồn kho và tự tính phí ship theo tỉnh; không tin `shippingFee` do client gửi.
- Có COD và chuyển khoản QR. Tạo đơn thành công thì xóa các sản phẩm đã mua khỏi Cart MongoDB.

### Trạng thái đơn

```text
Pending → Processing → Shipped → Delivered
   └──────────────→ Cancelled
Processing ───────→ Cancelled
```

Khách chỉ hủy trước khi giao. Đơn đã hủy hiện thanh toán là **Đã hủy**, không hiện **Chờ thanh toán**. Orchestra Admin có thể sửa lại trạng thái vận hành khi admin cấp dưới chọn nhầm. COD chỉ xác nhận đã thanh toán sau khi giao thành công; đơn chuyển khoản có nút xác nhận trong quản trị.

### Đánh giá và báo nội dung

Chỉ sản phẩm trong đơn đã giao mới được đánh giá. Một sản phẩm chỉ có một đánh giá trong một đơn; xóa đánh giá thì có thể đánh giá lại ở lần mua khác. Điểm trung bình chỉ tính review đang hiện. Khách có thể gửi feedback/báo nội dung; admin xem và cập nhật trạng thái.

### Phòng thử

Trang `RoomStudioPage.jsx` cho chọn 1–3 sản phẩm, chọn ảnh phòng, nhập vị trí từng sản phẩm rồi gửi `roomImageDataUrl` và mô tả sản phẩm đến `/api/room-previews`. Backend làm sạch dữ liệu và gọi Pollinations/Cloudflare AI. Ảnh phòng và kết quả lớn chỉ giữ trong React state, không nhét Base64 vào sessionStorage.

## 7. Trang frontend và file chính

| Trang | Đường dẫn | File chính | Việc chính |
|---|---|---|---|
| Trang chủ | `/` | `HomePage.jsx` | giới thiệu, sản phẩm nổi bật, hướng dẫn |
| Chọn sản phẩm | `/products` | `ProductListPage.jsx`, `ProductCard.jsx` | tìm kiếm, lọc, sắp xếp, thêm giỏ |
| Chi tiết | `/products/:id` | `ProductDetailPage.jsx` | mô tả, giá, mua, đánh giá, báo nội dung |
| Giỏ hàng | `/cart` | `CartPage.jsx`, `CartContext.jsx` | chọn món, sửa số lượng, xóa, tối đa 100 |
| Thanh toán | `/checkout` | `CheckoutPage.jsx` | địa chỉ, phí ship, COD/QR, tạo đơn |
| Đơn mua | `/orders` | `OrderHistoryPage.jsx` | xem, hủy, thanh toán QR, đánh giá/hoàn trả theo trạng thái |
| Phòng thử | `/room-studio` | `RoomStudioPage.jsx` | ghép tối đa 3 sản phẩm vào ảnh phòng |
| Tài khoản | `/profile` | `ProfilePage.jsx` | hồ sơ, tỉnh/quận/phường, OTP đổi mật khẩu |
| Liên hệ | `/feedback` | `FeedbackPage.jsx` | gửi góp ý hoặc báo nội dung |
| Quản trị | `/admin` | `AdminPage.jsx` | sản phẩm, khách hàng, đơn hàng, feedback, admin con |

Header và modal đăng nhập nằm trong `client/src/components/layout` và `client/src/components/auth`.

## 8. API và hàm quan trọng

Các route được gắn dưới `/api` trong `server/src/routes/index.js`:

| Nhóm | API tiêu biểu | Controller |
|---|---|---|
| Auth | `POST /auth/login`, `/auth/register/request`, `/auth/register/complete`, `/auth/forgot-password/request`, `/auth/forgot-password/reset` | `authController.js` |
| User | `GET/PATCH /users/me`, `POST /users/me/password` | `userController.js` |
| Product | `GET /products`, `GET /products/:id`, `POST/PUT/DELETE /products...` | `productController.js` |
| Cart | `GET /cart`, `POST /cart/add`, `PUT /cart/update`, `DELETE /cart/...` | `cartController.js` |
| Order | `POST /orders`, `GET /orders/my-orders`, `PATCH /orders/:id/cancel`, `PUT /orders/:id/status` | `orderController.js` |
| Review | `GET /reviews/product/:id`, `POST /reviews/order/:id`, `PATCH /reviews/:id/moderation` | `reviewController.js` |
| Room | `POST /room-previews` | `roomPreviewController.js` |
| Admin | `GET/PATCH /admin/users`, `GET/PATCH /admin/feedback` | `adminController.js` |

Các hàm nên biết khi thuyết trình:

- `login`, `requestPasswordReset`, `resetPassword` trong `authController.js`.
- `authenticate`, `requireAdmin` trong `authMiddleware.js`.
- `createOrder`, `cancelMyOrder`, `updateOrderStatus` trong `orderController.js`.
- `list`, `productData`, `permanentRemove`, `syncJson` trong `productController.js`.
- `refreshRating`, `createOrderReview`, `moderateReview` trong `reviewController.js`.
- `addToCart`, `updateQuantity`, `clearPurchasedItems` trong `CartContext.jsx`.

## 9. Chạy ở máy local

Yêu cầu: Node.js, npm và MongoDB Atlas (hoặc MongoDB local).

```powershell
git clone https://github.com/xinchaotamhon/furneeHome.git
cd furneeHome\client
npm install
cd ..\server
npm install
```

Tạo `.env` ở thư mục gốc (không commit file này):

```env
MONGO_URI=mongodb_connection_string
JWT_SECRET=random_secret
CLIENT_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=gmail_address
SMTP_PASS=gmail_app_password
EMAIL_FROM=gmail_address
POLLINATIONS_API_KEY=api_key
CLOUDFLARE_ACCOUNT_ID=account_id
CLOUDFLARE_API_TOKEN=api_token
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@furneehome.local
ADMIN_PASSWORD=123
TEAM_ADMIN_PASSWORD=123
```

Nếu MongoDB đã có dữ liệu thì không chạy seed. `npm run seed` chỉ dành cho database mới hoàn toàn và có thể tạo dữ liệu mẫu; seed không phải lệnh đồng bộ thường ngày.

Mở hai terminal:

```powershell
cd server
npm run dev
```

```powershell
cd client
npm run dev
```

- Website: `http://localhost:5173`
- API health: `http://localhost:5000/api/health`

Trong localhost, admin có thể bấm **Đồng bộ JSON** để chép dữ liệu hiện có từ MongoDB sang `data_import.json`. Đây là chiều MongoDB → JSON; không dùng JSON để ghi đè MongoDB.

## 10. Tài khoản mẫu hiện có

Các tài khoản này khớp với dữ liệu hiện tại của MongoDB và dùng email để đăng nhập:

| Quyền | Email | Mật khẩu |
|---|---|---|
| Orchestra Admin | `admin@furneehome.local` | `123` |
| Admin Phúc | `phuc@furneehome.vn` | `123` |
| Admin Triều | `trieu@furneehome.vn` | `123` |
| Admin Dũng | `dung@furneehome.vn` | `123` |
| Khách hàng demo | `customer@furneehome.vn` | `user123456` |

Orchestra Admin có thêm phần quản trị admin cấp dưới. Admin thường quản lý sản phẩm, khách hàng, đơn hàng và feedback nhưng không sửa quyền Orchestra.

## 11. Deploy

- **Cloudflare Pages**: thư mục gốc `client`, build `npm run build`, thư mục xuất bản `dist`. Đặt `VITE_API_URL=https://furneehome.onrender.com/api` trong biến môi trường Pages.
- **Render Web Service**: thư mục gốc `server`, build `npm install`, start `npm start`, health path `/api/health`. Đặt `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` và các biến SMTP/AI trong Environment.
- MongoDB dùng MongoDB Atlas. Cloudflare chỉ phục vụ frontend; dữ liệu và business logic vẫn ở Render + MongoDB.
- Direct Upload Cloudflare phải build lại và tải `client/dist` sau mỗi lần sửa. Không tải `.env` lên Git hoặc lên thư mục public.

## 12. Giới hạn và hướng mở rộng

- Tạo ảnh AI phụ thuộc tốc độ và hạn mức API bên ngoài; bản demo có Pollinations và Cloudflare làm nguồn dự phòng.
- Ảnh phòng lớn được giữ trong bộ nhớ trình duyệt trong lúc làm việc, nên người dùng cần giữ nguyên tab.
- API danh sách có phân trang khi truyền `page` và `limit`; nếu có hàng nghìn đơn cần thêm tìm kiếm/phân trang ở màn quản trị.
- Gửi OTP sản xuất cần SMTP Gmail App Password hợp lệ. Localhost có mã thử nghiệm khi bật chế độ phát triển.
- Nếu website có doanh thu lớn, cần thêm lưu ảnh ngoài (R2/S3), hàng đợi tạo ảnh, thanh toán thật, log và phân quyền chi tiết hơn.

## Liên hệ

- Địa chỉ: 71/5 Huỳnh Tấn Phát, Ấp 31, Xã Nhà Bè, TP.HCM
- Điện thoại và Zalo: 0372 208 100
- Email: furneehome@gmail.com
