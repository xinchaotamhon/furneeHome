# Hướng dẫn quay video và thuyết minh FurneeHome

Tài liệu này dùng khi quay màn hình và trình bày toàn bộ dự án. Nội dung được
viết theo đúng bản chốt hiện tại: website bán nội thất, có giỏ hàng, checkout,
đơn hàng, đánh giá, quản trị và Phòng thử AI.

## 1. Chuẩn bị trước khi quay

### Các cửa sổ cần mở

1. Một cửa sổ terminal chạy backend trong thư mục `server`.
2. Một cửa sổ terminal chạy frontend trong thư mục `client`.
3. Một trình duyệt mở website local.
4. Một tab mở MongoDB Atlas nếu cần trình bày dữ liệu.
5. Một tab mở website đã deploy để dự phòng.

Chạy local:

```text
cd server
npm install
npm start

cd client
npm install
npm run dev
```

Kiểm tra backend bằng:

```text
http://localhost:5000/api/health
```

Không chạy `npm run seed` trên database đang có dữ liệu. Không mở `.env` khi
quay màn hình.

### Tài khoản demo

Đăng nhập bằng email, không nhập username:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Orchestra Admin | `admin@furneehome.local` | `123` |
| Admin Phúc | `phuc@furneehome.vn` | `123` |
| Admin Triều | `trieu@furneehome.vn` | `123` |
| Admin Dũng | `dung@furneehome.vn` | `123` |
| Khách hàng demo | `customer@furneehome.vn` | `user123456` |

Trước khi record phải đăng nhập thử từng tài khoản. Nếu dữ liệu thực tế đã đổi,
chỉ sửa bảng này theo tài khoản đang dùng được, không tự tạo dữ liệu bằng seed.

### Dữ liệu nên chuẩn bị

- Một sản phẩm còn hàng và có giá thật.
- Một ảnh phòng JPG, PNG hoặc WebP.
- Một đơn đã giao để demo đánh giá.
- Một đơn đang chờ xử lý để demo hủy đơn.
- Một feedback mẫu để demo quản trị.

## 2. Cách nói chung cho mỗi chức năng

Ở mỗi bước, nói theo bốn câu ngắn:

1. Người dùng nhập hoặc bấm gì.
2. Client gửi dữ liệu nào.
3. Server kiểm tra và lưu ở đâu.
4. Màn hình trả về kết quả gì.

Khi giám khảo hỏi code nằm ở đâu, nói theo chuỗi:

`Trang React → Context/Service → API route → Controller → Model MongoDB`.

Không cần đọc cả file. Chỉ chỉ ra một hàm chính và nói hàm đó nhận gì, kiểm tra
gì, trả về gì.

## 3. Trình tự quay và lời thuyết minh

### Bước 1 — Giới thiệu dự án

**Tôi nói**

“FurneeHome là website bán đồ nội thất cho sinh viên, công nhân và các gia đình
phổ thông. Website giải quyết việc người mua khó tìm sản phẩm phù hợp và khó
hình dung sản phẩm trong căn phòng thật. Nhóm bổ sung Phòng thử AI như một điểm
khác biệt.”

**Tôi thao tác**

- Mở trang chủ.
- Chỉ vào logo, thanh điều hướng và nhóm chức năng chính.

**Kết quả cần thấy**

- Trang chủ hiển thị nội dung giới thiệu, sản phẩm và đường dẫn đến Phòng thử.

**Code liên quan**

- `client/src/pages/HomePage.jsx` hiển thị trang chủ.
- `client/src/components/layout/MainLayout.jsx` bao bọc các trang.
- `client/src/components/layout/Header.jsx` và `Footer.jsx` dùng chung.
- `client/src/router.jsx` khai báo route.

**Câu hỏi có thể gặp**

- “Tại sao tách Header và Footer?” — Để dùng lại trên nhiều trang và sửa một nơi.
- “React làm nhiệm vụ gì?” — Nhận state và dữ liệu API rồi hiển thị giao diện.

### Bước 2 — Xem, tìm và lọc sản phẩm

**Tôi nói**

“Người dùng vào Sản phẩm, nhập tên cần tìm, chọn danh mục hoặc cách sắp xếp.
Client gửi điều kiện tìm kiếm lên API. Server lọc dữ liệu MongoDB, phân trang và
trả về danh sách.”

**Tôi thao tác**

- Mở `/products`.
- Nhập một từ khóa.
- Chọn cách sắp xếp và chuyển trang.

**Kết quả cần thấy**

- Chỉ những sản phẩm phù hợp được hiển thị.
- Giá, ảnh, tồn kho và danh mục lấy từ dữ liệu hiện tại.

**Code liên quan**

- `ProductListPage.jsx`: state tìm kiếm, sắp xếp và phân trang.
- `ProductContext.jsx`: tải và làm mới sản phẩm.
- `productService.js`: `getPage()` gọi API.
- `productRoutes.js`: `GET /api/products`.
- `productController.js`: `list()` lọc và phân trang.
- `Product.js`, `Category.js`: model dữ liệu.

**Câu hỏi có thể gặp**

- “Vì sao không tải toàn bộ sản phẩm rồi mới cắt ở client?” — Server phân trang
  trước để giảm dữ liệu truyền và thời gian tải.
- “Nếu nhập ký tự đặc biệt thì sao?” — Từ khóa được chuẩn hóa và escape trước
  khi dùng trong regex MongoDB.

### Bước 3 — Chi tiết sản phẩm

**Tôi nói**

“Trang chi tiết cho người dùng xem thông tin trước khi mua: ảnh, giá, tồn kho,
thông số, đánh giá và hai lựa chọn là thêm vào giỏ hoặc mua ngay.”

**Tôi thao tác**

- Mở một thẻ sản phẩm.
- Chỉ vào ảnh, giá, thông số, nút `Thêm vào giỏ`, `Mua ngay` và `Báo nội dung`.

**Kết quả cần thấy**

- Thông tin khớp với sản phẩm trong database.
- Khách chưa đăng nhập được yêu cầu đăng nhập trước khi mua.

**Code liên quan**

- `ProductDetailPage.jsx`: `addToCart()` và xử lý `buyNow`.
- `productService.js`: `getById()`.
- `reviewService.js`: tải đánh giá.
- `productController.js`: `getById()`.
- `reviewController.js`: `getByProduct()`.

### Bước 4 — Đăng ký, đăng nhập và OTP

**Tôi nói**

“Hệ thống chỉ đăng nhập bằng email. Khi đăng ký, người dùng gửi email trước,
nhận mã OTP, xác minh mã rồi mới tạo mật khẩu. Quên mật khẩu cũng dùng email đã
đăng ký, mã OTP và mật khẩu mới.”

**Tôi thao tác**

- Mở hộp thoại `Đăng nhập`.
- Chỉ ra ô Email, ô Mật khẩu, `Ghi nhớ email` và `Quên mật khẩu?`.
- Nếu SMTP hoạt động, thực hiện đăng ký hoặc quên mật khẩu bằng email kiểm thử.
- Nếu chạy local ở chế độ OTP phát triển, dùng mã được hiển thị trong thông báo local.

**Kết quả cần thấy**

- Email không tồn tại không được đặt lại mật khẩu.
- Sai OTP quá số lần cho phép bị từ chối.
- Tài khoản bị khóa nhận thông báo tài khoản bị khóa.
- Đăng nhập thành công lưu phiên đăng nhập.

**Code liên quan**

- `LoginModal.jsx`: các view `login`, `register-email`, `register-complete`,
  `forgot`, `reset`.
- `AuthContext.jsx`: `login()`, `requestRegistration()`,
  `completeRegistration()`.
- `authService.js`: gọi API xác thực.
- `authRoutes.js`: `/login`, `/register/request`, `/register/complete`,
  `/forgot-password/request`, `/forgot-password/reset`.
- `authController.js`: `login()`, `registerRequest()`,
  `completeRegistration()`, `requestPasswordReset()`, `resetPassword()`.
- `User.js`: email, mật khẩu băm, OTP, số lần thử, role và `isActive`.

**Câu hỏi có thể gặp**

- “Mật khẩu lưu thế nào?” — Server băm bằng bcrypt, không lưu mật khẩu dạng rõ.
- “Tại sao chỉ dùng email?” — Email là thông tin định danh duy nhất và phục vụ gửi OTP.
- “Nếu tài khoản bị khóa thì sao?” — `login()` kiểm tra `isActive` và từ chối trước
  khi cấp token.

### Bước 5 — Giỏ hàng của khách và người đã đăng nhập

**Tôi nói**

“Khách chưa đăng nhập vẫn có thể xem và chuẩn bị giỏ hàng ở trình duyệt. Khi
muốn thêm sản phẩm hoặc mua, hệ thống yêu cầu đăng nhập. Sau khi đăng nhập, giỏ
local được đồng bộ vào Cart của người dùng trong MongoDB.”

**Tôi thao tác**

- Thêm một sản phẩm khi chưa đăng nhập để minh họa yêu cầu đăng nhập nếu giao diện
  đang dùng chính sách bắt buộc.
- Đăng nhập.
- Mở `/cart`, đổi số lượng, bỏ chọn một món và xóa món.

**Kết quả cần thấy**

- Số lượng và tổng tiền thay đổi.
- Giỏ hàng không vượt giới hạn đã đặt.
- F5 hoặc mở lại sau khi đăng nhập vẫn đọc được giỏ từ server.

**Code liên quan**

- `CartContext.jsx`: state giỏ, tính tổng và đồng bộ.
- `cartService.js`: `get()`, `sync()`, `add()`, `update()`, `remove()`, `clear()`.
- `cartRoutes.js`: các route `/api/cart`.
- `cartController.js`: đọc, thêm, sửa, xóa và kiểm tra sản phẩm bán được.
- `Cart.js`: một cart cho mỗi user.

**Câu hỏi có thể gặp**

- “Vì sao phải có Cart trong MongoDB?” — Để giỏ không mất khi đổi máy hoặc mở tab mới.
- “Nếu local và server khác nhau?” — Khi đăng nhập, client gửi các món local lên
  `sync`, server kiểm tra lại sản phẩm rồi hợp nhất.

### Bước 6 — Checkout và đặt hàng

**Tôi nói**

“Checkout lấy thông tin người dùng, cho chọn tỉnh, huyện và phường, sau đó hiển
thị phí vận chuyển và tổng tiền. Khi bấm đặt hàng, server đọc lại sản phẩm, giá,
tồn kho và phí vận chuyển rồi mới tạo Order.”

**Tôi thao tác**

- Mở `/checkout`.
- Chọn hoặc kiểm tra địa chỉ mặc định.
- Chọn phương thức COD hoặc chuyển khoản.
- Chỉ vào phí vận chuyển, tổng tiền và nút đặt hàng.

**Kết quả cần thấy**

- Địa chỉ từ Profile có thể được điền sẵn.
- Đơn thành công có mã đơn và tổng tiền.
- Các sản phẩm đã mua được xóa khỏi Cart trên server.

**Code liên quan**

- `CheckoutPage.jsx`: kiểm tra dữ liệu và gửi `createOrder()`.
- `locationService.js`: tải tỉnh, huyện, phường và tính phí hiển thị.
- `orderService.js`: gọi API đơn hàng.
- `orderRoutes.js`: `POST /api/orders`.
- `orderController.js`: `createOrder()`, tính giá, tồn kho, phí ship và xóa cart.
- `Order.js`: lưu bản chụp sản phẩm, địa chỉ, giá, phí và trạng thái.

**Câu hỏi có thể gặp**

- “Nếu client sửa giá hoặc phí ship?” — Server không tin số tiền client gửi; server
  đọc lại Product và tự tính tổng.
- “Nếu hết hàng lúc đặt?” — `createOrder()` kiểm tra stock và trả lỗi, không tạo đơn.
- “Tại sao Order lưu tên và giá riêng?” — Để hóa đơn giữ đúng thông tin tại thời điểm mua,
  dù sản phẩm sau này đổi tên hoặc giá.

### Bước 7 — Lịch sử đơn hàng, hủy và hoàn hàng

**Tôi nói**

“Người dùng xem được các đơn của mình và trạng thái từng đơn. Đơn đang chờ xác
nhận hoặc đang xử lý có thể hủy theo luật của hệ thống; đơn đã giao hoặc đang
giao không được hủy. Luồng hoàn hàng có trạng thái riêng và có thể ghi thông tin
tài khoản nhận tiền hoàn.”

**Tôi thao tác**

- Mở `/orders`.
- Mở chi tiết một đơn.
- Chỉ vào trạng thái, nút hủy, hoàn hàng và đánh giá.

**Kết quả cần thấy**

- Đơn đã hủy không còn hiển thị như `Chờ thanh toán`.
- Đơn đang giao bị chặn hủy.
- Đơn đã giao có thể chuyển sang đánh giá.

**Code liên quan**

- `OrderHistoryPage.jsx`: hiển thị trạng thái và thao tác hủy/hoàn.
- `orderService.js`: `getMyOrders()`, `cancelOrder()`, `updateRefundInfo()`.
- `orderController.js`: `getMyOrders()`, `cancelMyOrder()`, `updateRefundInfo()`.
- `Order.js`: `orderStatus`, `paymentStatus`, `refundInfo`.

**Câu hỏi có thể gặp**

- “Vì sao phải tách orderStatus và paymentStatus?” — Trạng thái giao hàng và trạng
  thái thanh toán là hai việc khác nhau.
- “Nếu có hàng trăm đơn?” — Bản demo tải danh sách cơ bản; hệ thống thương mại thật
  cần phân trang, tìm kiếm và xử lý hàng đợi ở màn quản trị.

### Bước 8 — Đánh giá sau khi mua

**Tôi nói**

“Chỉ người đã mua đúng sản phẩm trong đơn hợp lệ mới được đánh giá. Server kiểm
tra quan hệ user–order–product và dùng khóa chống trùng. Người dùng có thể xóa
đánh giá của mình theo chính sách, còn admin có thể ẩn đánh giá xấu.”

**Tôi thao tác**

- Mở đơn đã giao.
- Bấm `Đánh giá đơn hàng`.
- Chọn số sao, nhập bình luận và gửi.
- Quay lại trang chi tiết sản phẩm.

**Kết quả cần thấy**

- Đánh giá xuất hiện cùng điểm trung bình.
- Người chưa mua không có quyền tạo đánh giá.
- Đánh giá bị ẩn không còn tính vào điểm trung bình.

**Code liên quan**

- `OrderReviewPage.jsx`: form đánh giá theo từng sản phẩm trong đơn.
- `reviewService.js`: tạo, đọc, xóa và kiểm tra trạng thái đánh giá.
- `reviewRoutes.js`: route product/order/review/moderation.
- `reviewController.js`: `createOrderReview()`, `getOrderReviewStatus()`,
  `moderateReview()`, `deleteReview()`, `refreshRating()`.
- `Review.js`: user, product, order, rating, comment và trạng thái ẩn/xóa.

### Bước 9 — Trang tài khoản

**Tôi nói**

“Trang tài khoản cho phép người dùng sửa tên, số điện thoại và địa chỉ gồm tỉnh,
huyện, phường. Ghi chú giao hàng là tùy chọn. Địa chỉ đã lưu được dùng lại ở
Checkout. Đổi mật khẩu cần nhập lại mật khẩu khớp.”

**Tôi thao tác**

- Mở `/profile`.
- Chỉ vào lời chào `Xin chào! Tên người dùng` ở Header.
- Sửa địa chỉ, lưu lại rồi mở Checkout.
- Mở phần đổi mật khẩu và minh họa lỗi khi hai mật khẩu không trùng.

**Kết quả cần thấy**

- Profile lưu được thông tin bắt buộc.
- Thiếu ghi chú vẫn được lưu vì ghi chú không bắt buộc.
- Checkout tự điền thông tin đã lưu.

**Code liên quan**

- `ProfilePage.jsx`: form profile và đổi mật khẩu.
- `Header.jsx`: lấy tên từ `AuthContext` để hiển thị lời chào.
- `userService.js`: `getMe()`, `updateMe()`, `changePassword()`.
- `userRoutes.js`: `/api/users/me` và `/api/users/me/password`.
- `userController.js`: `getMe()`, `updateMe()`, `changePassword()`.
- `User.js`: thông tin liên hệ và địa chỉ.

### Bước 10 — Liên hệ và báo nội dung

**Tôi nói**

“Trang Liên hệ nhận góp ý chung. Từ trang chi tiết sản phẩm, người dùng có thể
chuyển sang báo nội dung và hệ thống ghi rõ sản phẩm liên quan để admin xử lý.”

**Tôi thao tác**

- Mở `/feedback`.
- Nhập một góp ý hoặc mở `Báo nội dung` từ sản phẩm.

**Kết quả cần thấy**

- Feedback được gửi và có trạng thái xử lý.
- Admin nhìn thấy nội dung trong trang quản trị.

**Code liên quan**

- `FeedbackPage.jsx`.
- `feedbackService.js`.
- `feedbackRoutes.js` và `feedbackController.js`.
- `Feedback.js`.

### Bước 11 — Phòng thử AI

**Tôi nói**

“Phòng thử là phần minh họa AI. Người dùng chọn tối đa ba sản phẩm, tải ảnh phòng
và có thể nhập vị trí riêng cho từng sản phẩm. Client gửi ảnh, danh sách sản phẩm
và mong muốn lên backend. Backend lấy mô tả sản phẩm, tạo prompt rồi gọi dịch vụ
ảnh AI. Kết quả chỉ mang tính tham khảo, không phải bản vẽ kỹ thuật.”

**Tôi thao tác**

1. Mở `/room-studio`.
2. Chọn một đến ba sản phẩm.
3. Tải ảnh phòng.
4. Nhập vị trí nếu muốn, ví dụ “sản phẩm 1 gần cửa sổ”.
5. Bấm `Tạo ảnh`.
6. Chờ thông báo `Ảnh đang được tạo, bạn đợi xíu nghen ^_^`.

**Kết quả cần thấy**

- Ảnh phòng gốc vẫn được giữ.
- Kết quả mới hiển thị trong cùng luồng thao tác.
- Số sản phẩm đã chọn và các vị trí nhập được giữ trong phiên.

**Code liên quan**

- `RoomStudioPage.jsx`: chọn sản phẩm, tải ảnh, nhập vị trí và gửi form.
- `roomPreviewService.js`: `createRoomPreview()`.
- `roomPreviewRoutes.js`: `POST /api/room-previews`.
- `roomPreviewController.js`: kiểm tra payload và đọc sản phẩm.
- `cloudflareImageService.js`: tạo prompt và gọi provider ảnh.
- `Product.js`: `aiDescription`, kích thước, bề mặt đặt và ảnh sản phẩm.

**Câu hỏi có thể gặp**

- “Nếu người dùng không nhập vị trí?” — Hệ thống vẫn gửi prompt cơ bản, AI tự chọn
  vị trí phù hợp.
- “Vì sao ảnh đôi khi không đúng?” — Model sinh ảnh không bảo đảm vị trí hoặc tỷ lệ
  tuyệt đối; đây là tính năng minh họa và có thể mở rộng bằng model/kiểm soát ảnh tốt hơn.
- “Có lưu ảnh Base64 vào sessionStorage không?” — Không lưu ảnh lớn vào sessionStorage;
  ảnh giữ trong state, còn thông tin nhẹ mới lưu trong phiên.

### Bước 12 — Trang quản trị

**Tôi nói**

“Trang quản trị tách khỏi luồng mua hàng. Admin quản lý sản phẩm, khách hàng, đơn
hàng và feedback. Orchestra Admin có thêm quyền quản lý admin cấp dưới và xử lý
những trường hợp cần sửa sai.”

**Tôi thao tác**

- Đăng xuất khách hàng.
- Đăng nhập Orchestra Admin.
- Mở `/admin`.
- Lần lượt mở các tab sản phẩm, khách hàng, đơn hàng, báo nội dung và quản trị admin.
- Mở popup hóa đơn hoặc hồ sơ khách hàng nếu dữ liệu có sẵn.

**Kết quả cần thấy**

- Người không có role admin bị chặn.
- Admin có thể thêm, sửa, ngừng bán và xóa theo quyền.
- Orchestra Admin nhìn thấy phần quản trị admin.
- Trạng thái đơn hàng và feedback cập nhật đúng.

**Code liên quan**

- `AdminPage.jsx`: các tab, form, popup và thao tác CRUD.
- `router.jsx`: `AdminRoute` kiểm tra role trước khi hiển thị.
- `adminRoutes.js`: users và feedback.
- `productRoutes.js`, `orderRoutes.js`, `reviewRoutes.js` cho nghiệp vụ tương ứng.
- `adminController.js`, `productController.js`, `orderController.js` và
  `reviewController.js` xử lý phía server.
- `authMiddleware.js`: kiểm tra token và quyền.

**Câu hỏi có thể gặp**

- “Tại sao phải kiểm tra quyền ở cả client và server?” — Client giúp giao diện dễ
  hiểu, server mới là lớp bảo vệ thật vì request có thể bị giả mạo.
- “Nếu admin thường gửi request của Orchestra Admin?” — Middleware đọc role trong
  token và từ chối request không đủ quyền.

### Bước 13 — MongoDB và JSON snapshot

**Tôi nói**

“MongoDB Atlas là nguồn dữ liệu chính. Các thao tác sản phẩm, giỏ hàng, đơn hàng,
đánh giá và người dùng đều đi qua API để đọc hoặc ghi MongoDB. `data_import.json`
chỉ là snapshot hỗ trợ hiển thị nhanh, không được dùng để ghi đè database.”

**Tôi thao tác**

- Mở MongoDB Atlas.
- Chỉ ra bảy collection.
- Nếu cần, chỉ ra nút đồng bộ JSON trong quản trị.

**Bảy model chính**

- `User`: tài khoản, role, địa chỉ và trạng thái.
- `Category`: danh mục sản phẩm.
- `Product`: tên, giá, tồn kho, ảnh, mô tả và thông số AI.
- `Cart`: giỏ hàng của một người dùng.
- `Order`: sản phẩm tại thời điểm mua, địa chỉ, tiền và trạng thái.
- `Review`: đánh giá gắn với người dùng, sản phẩm và đơn hàng.
- `Feedback`: góp ý hoặc báo nội dung.

**Câu hỏi có thể gặp**

- “Nếu MongoDB chậm thì sao?” — Client có snapshot sản phẩm để hiển thị ban đầu,
  nhưng nghiệp vụ quan trọng vẫn kiểm tra MongoDB.
- “JSON có phải database không?” — Không. JSON chỉ là dữ liệu hiển thị/snapshot.

### Bước 14 — Kiến trúc và deploy

**Tôi nói**

“Frontend React chạy trên Cloudflare Pages. Backend Express chạy trên Render.
Backend kết nối MongoDB Atlas và gọi dịch vụ ảnh AI. Client chỉ gọi API, còn
kiểm tra quyền và business logic nằm ở server.”

**Tôi thao tác**

- Chỉ vào Cloudflare Pages và Render.
- Mở `/api/health` của backend.
- Mở một trang sản phẩm trên frontend deploy.

**Cấu hình cần nhớ**

- Cloudflare root: `client`.
- Cloudflare build: `npm run build`.
- Cloudflare output: `dist`.
- Cloudflare biến public: `VITE_API_URL`.
- Render root: `server`.
- Render build: `npm install`.
- Render start: `npm start`.
- Render health: `/api/health`.
- Secret chỉ đặt trong Environment của Render/Cloudflare, không đưa lên Git.

**Câu hỏi có thể gặp**

- “Tại sao tách frontend và backend?” — Mỗi phần có nhiệm vụ và cách deploy riêng;
  sửa giao diện không cần đóng gói lại server.
- “Nếu API AI hết hạn mức?” — Backend có thứ tự provider/fallback theo cấu hình;
  nếu tất cả đều lỗi thì trả thông báo để người dùng thử lại.

## 4. Kết thúc và chuyển sang bốn thành viên

Nói:

“Như vậy FurneeHome đã có luồng từ xem sản phẩm, đăng nhập, giỏ hàng, checkout,
đơn hàng, đánh giá đến quản trị. Phòng thử AI là phần minh họa để người dùng
thử ý tưởng nội thất trong ảnh phòng. Sau phần tổng quan, nhóm em xin trình bày
chi tiết theo thứ tự: Phúc, Dũng, Triều và Hiệp.”

Thứ tự phần trình bày:

1. **Phúc:** đăng nhập, đăng ký OTP, quên mật khẩu, tài khoản khách hàng, admin và Orchestra Admin.
2. **Dũng:** giỏ hàng, đồng bộ giỏ, checkout và thanh toán.
3. **Triều:** chi tiết sản phẩm, lịch sử đơn hàng, hủy/hoàn và đánh giá.
4. **Hiệp:** danh sách sản phẩm, Phòng thử AI, trang quản trị và kiến trúc dữ liệu.

## 5. Dự phòng khi demo gặp vấn đề

- Render ngủ: mở `/api/health`, chờ backend thức rồi tải lại trang.
- OTP không gửi: nói rõ SMTP là dịch vụ ngoài, dùng mã local nếu đang chạy môi trường phát triển.
- AI tạo ảnh chậm: giữ nguyên màn hình chờ, giải thích request đã gửi đến provider.
- MongoDB chậm: trình bày snapshot JSON cho phần hiển thị, sau đó nhấn mạnh nghiệp vụ
  vẫn xác minh MongoDB.
- Đăng nhập lỗi: dùng tài khoản demo đã kiểm tra trước, không thử nhiều mật khẩu liên tiếp.
- Dữ liệu đơn hàng không phù hợp: không tạo đơn rác trong lúc quay; dùng đơn mẫu đã chuẩn bị.

## 6. Câu trả lời nguyên lý ngắn gọn

- **Client là gì?** Phần React nhận thao tác và hiển thị kết quả.
- **Server là gì?** Phần Express nhận request, kiểm tra quyền và xử lý nghiệp vụ.
- **Model là gì?** Khuôn dạng dữ liệu Mongoose dùng để đọc và ghi MongoDB.
- **API là gì?** Điểm giao tiếp giữa client và server.
- **Middleware là gì?** Hàm chạy trước controller để kiểm tra token, role hoặc dữ liệu.
- **Business logic là gì?** Luật của hệ thống, ví dụ server tự kiểm tra giá, tồn kho và
  chỉ cho người đã mua đánh giá.
- **Tại sao không tin dữ liệu từ client?** Client có thể bị sửa bằng DevTools; server
  phải kiểm tra lại các giá trị ảnh hưởng tiền và quyền.
- **Giới hạn hiện tại?** Ảnh AI phụ thuộc provider và hạn mức; màn quản trị cần mở rộng
  phân trang nếu có rất nhiều dữ liệu; thanh toán hiện là COD/chuyển khoản mô phỏng.
