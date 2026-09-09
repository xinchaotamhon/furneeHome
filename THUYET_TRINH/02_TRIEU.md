# Triều — Phần 2/4: Mua hàng và hậu mãi

> **Vị trí:** sau Dũng, trước Phúc. **Luồng:** Chi tiết → Đăng nhập khách → Giỏ hàng → Checkout → Đơn hàng → Đánh giá → Hồ sơ → bàn giao cho Phúc.

## Thẻ liếc nhanh

- **Tài khoản:** `customer` / `user123456`.
- **Trang demo:** một `/products/:id` → `/cart` → `/checkout` → `/orders` → `/orders/:orderId/review` → `/profile`.
- **Từ khóa code:** `ProductDetailPage` · `CartProvider` · `createOrder` · `calculateShippingFee` · `cancelOrder` · `createOrderReview` · `changePassword`.
- **Điểm quan trọng:** client không được quyết định giá, phí giao hàng hoặc tồn kho.

## Bước 0 — Đăng nhập trước khi tạo giỏ demo

### Thao tác

1. Bấm **Đăng nhập**.
2. Nhập `customer` và `user123456`.
3. Mở `/cart` để kiểm tra giỏ của tài khoản đã tải xong.

### Vì sao phải làm trước?

Giỏ khách chưa đăng nhập nằm ở key `furneehome_cart_guest`. Giỏ của mỗi tài khoản có key riêng và còn đồng bộ với MongoDB. Bản hiện tại **không tự nhập giỏ khách vào giỏ tài khoản sau đăng nhập**, vì vậy demo nên đăng nhập trước rồi mới thêm món.

## Bước 1 — Chi tiết sản phẩm

### Thao tác đã kiểm tra

1. Mở một sản phẩm từ trang danh sách.
2. Chỉ vào ảnh, danh mục, tên, giá, mô tả và số lượng còn trong kho.
3. Chọn số lượng.
4. Chỉ vào bốn hành động: **Thêm vào giỏ, Mua ngay, Thử trong phòng, Báo nội dung**.
5. Cuộn xuống vùng đánh giá.

### Dấu hiệu đúng

- URL có dạng `/products/:id`.
- Thông tin đúng với sản phẩm đã chọn.
- **Thêm vào giỏ** tăng số trên menu giỏ.
- **Mua ngay** đưa món sang checkout.
- **Thử trong phòng** mang ID sản phẩm sang Room Studio.

Không nói rằng mọi sản phẩm đều có bảng kích thước hoặc nhiều ảnh. Giao diện chỉ hiển thị những dữ liệu thực sự có trong sản phẩm.

### Nếu bị hỏi

**Nếu ID sai hoặc sản phẩm đã ngừng bán?**

`productController.getById()` kiểm tra ObjectId và chỉ trả sản phẩm còn hoạt động, giá lớn hơn 0; không đúng thì trả 404.

**Có cào Shopee mỗi lần khách mở chi tiết không?**

Không. Trang đọc bản ghi sản phẩm đã lưu trong MongoDB.

**Tại sao không lấy giá đang thấy trên HTML để đặt hàng?**

Vì người dùng có thể sửa giao diện bằng F12. Backend phải đọc lại giá từ MongoDB khi tạo đơn.

## Bước 2 — Giỏ hàng

### Thao tác đã kiểm tra

1. Thêm ít nhất 2 sản phẩm.
2. Mở `/cart`.
3. Tăng hoặc giảm số lượng một món.
4. Bỏ chọn một món và quan sát tổng tiền.
5. Bỏ chọn tất cả: tổng tiền về 0 và nút mua bị khóa.
6. Chọn lại đúng một món rồi bấm mua hàng.

### Dấu hiệu đúng

- Tổng số lượng trên menu cập nhật.
- Tổng tiền chỉ tính các món đang được chọn.
- Số lượng không vượt tồn kho.
- Sau đăng nhập, giỏ tài khoản được lấy từ collection `carts`.

### Luồng thật

```text
Khách bấm Thêm giỏ
        ↓
CartContext cập nhật giao diện ngay
        ↓
Nếu đã đăng nhập, cartService gọi API
        ↓
cartController đọc lại Product và kiểm tra isActive, price, stock
        ↓
MongoDB lưu Cart của đúng user
```

### Nếu bị hỏi

**Khách dùng điện thoại khác có thấy giỏ không?**

Có, nếu đã đăng nhập cùng tài khoản, vì giỏ được lưu trong MongoDB.

**Giá lưu trong Cart có phải giá cuối cùng không?**

Không. Trường giá trong Cart chỉ là cache hiển thị; `refreshCart()` cập nhật lại từ Product và `createOrder()` đọc giá chính thức một lần nữa.

**Nếu sản phẩm vừa hết hàng hoặc ngừng bán?**

`refreshCart()` loại món không còn bán; API thêm/sửa số lượng cũng từ chối nếu không đủ kho.

**Tại sao giỏ khách không tự gộp sau đăng nhập?**

Bản hiện tại tách giỏ khách và giỏ từng tài khoản để tránh trộn dữ liệu. Đây là giới hạn hiện tại, có thể bổ sung bước hỏi người dùng có muốn gộp ở phiên bản sau.

## Bước 3 — Checkout và phí giao hàng

### Thao tác đã kiểm tra

1. Từ giỏ, chọn một món và mở `/checkout`.
2. Kiểm tra bảng chỉ có các món đã chọn.
3. Nhập họ tên và số điện thoại Việt Nam.
4. Chọn Tỉnh/Thành phố → Quận/Huyện → Phường/Xã.
5. Nhập số nhà, tên đường; ghi chú là tùy chọn.
6. Chọn **Chuyển khoản QR** hoặc **COD**.
7. Đổi tỉnh từ TP.HCM sang Hà Nội để cho thấy phí giao hàng thay đổi.

### Dấu hiệu đúng

- TP.HCM hiển thị phí 30.000đ; Hà Nội hiển thị 60.000đ trong lần kiểm tra.
- Quận/Huyện tải lại khi đổi tỉnh; Phường/Xã tải lại khi đổi quận.
- Số điện thoại hoặc địa chỉ sai bị chặn trước khi tạo đơn.
- Nút hiển thị **Tiếp tục thanh toán QR** hoặc **Đặt hàng COD** đúng lựa chọn.

### Điều phải nói rõ

Frontend tính phí để người dùng xem trước, nhưng **backend tính lại bằng `calculateShippingFee()`**. Client chỉ gửi mã tỉnh, không quyết định phí cuối cùng.

### Nếu bị hỏi

**Nếu người dùng sửa `shippingFee` thành 0 bằng Postman?**

Không ảnh hưởng vì `createOrder()` không đọc phí client gửi lên; server tự tính từ `shippingAddress.provinceCode`.

**Địa chỉ tiếng Việt có dấu được xử lý thế nào?**

Client và server chuẩn hóa chuỗi về Unicode NFC; server cho phép chữ Unicode, số và một số dấu địa chỉ thông dụng.

**Nếu API lấy Tỉnh/Quận/Phường bị lỗi?**

Client có danh sách tỉnh dự phòng. Quận/phường có thể không tải được, nhưng server vẫn yêu cầu mã tỉnh hợp lệ và địa chỉ chi tiết hợp lệ.

## Bước 4 — Tạo đơn, chống sửa giá và chống âm kho

### Nói

Khi bấm đặt hàng, `createOrder()` làm lần lượt:

```text
Kiểm tra phương thức thanh toán và địa chỉ
        ↓
Đọc lại từng Product trong MongoDB
        ↓
Trừ kho có điều kiện stock >= số lượng
        ↓
Chụp tên + giá + ảnh vào orderItems
        ↓
Tính subtotal + phí giao hàng
        ↓
Tạo Order ở Pending / Pending
        ↓
Xóa đúng các món vừa mua khỏi Cart
```

### Dấu hiệu thành công

- Trang hiện **Đặt hàng thành công** và mã đơn bắt đầu bằng `FUR-`.
- Đơn QR hiện mã thanh toán; đơn COD hiện hướng dẫn trả tiền khi nhận.
- Chỉ sản phẩm đã mua bị xóa khỏi giỏ.

Khi kiểm thử bằng dữ liệu tạm, backend đã lấy giá từ MongoDB, tự tính phí giao hàng, trừ kho và xóa món vừa mua khỏi Cart đúng như luồng trên.

Trong buổi bảo vệ, chỉ bấm tạo đơn mới nếu nhóm đã chuẩn bị dữ liệu demo. Nếu không, dùng đơn có sẵn để tránh làm thay đổi kho.

### Nếu bị hỏi

**Nếu sửa giá 99.000đ thành 1đ trên client?**

Server bỏ qua giá client, dùng `product.price` từ MongoDB.

**Nếu hai người cùng mua món cuối cùng?**

`findOneAndUpdate()` có điều kiện `stock >= qty` và trừ bằng `$inc`. Chỉ request giữ được kho mới thành công; request còn lại nhận lỗi 409.

**Nếu đơn có 3 món, đã trừ 2 món nhưng món thứ ba hết?**

Khối `catch` gọi `restoreReservedStock()` để cộng lại các món đã giữ trước đó.

**Tại sao `orderItems` lưu cả tên, giá và ảnh?**

Đó là bản chụp lúc mua. Admin đổi tên hoặc giá Product sau này không làm sai đơn cũ.

## Bước 5 — Lịch sử và hủy đơn

### Thao tác đã kiểm tra

1. Mở `/orders`.
2. Chỉ ra một đơn đã giao/đã thanh toán và các đơn đã hủy.
3. Với dữ liệu chuẩn bị sẵn, chỉ vào nút **Hủy đơn** ở trạng thái Pending hoặc Processing.
4. Chỉ ra nút **Xem mã QR thanh toán** của đơn chuyển khoản chưa trả.

### Quy tắc trạng thái

```text
Pending → Processing → Shipped → Delivered
    └──────────┐
Processing ────┴→ Cancelled
```

- Khách chỉ tự hủy khi đơn là `Pending` hoặc `Processing`.
- Đơn `Shipped`, `Delivered` hoặc `Cancelled` không còn nút hủy.
- Hủy thành công hoàn kho đúng một lần nhờ `stockRestored`.

Kiểm thử thực tế đã xác nhận lần hủy đầu thành công, lần hủy thứ hai bị chặn 409 và tồn kho chỉ được cộng lại một lần.

### Nếu bị hỏi

**Khách có xem được đơn người khác không?**

Không. `getMyOrders()` lọc bằng `user: req.user._id`; `cancelMyOrder()` cũng thêm điều kiện user.

**Nếu bấm hủy hai lần?**

Lần sau không khớp điều kiện `stockRestored: false`, nên không cộng kho lần hai.

**Nếu hủy đơn đã giao?**

Backend trả lỗi 409; người dùng phải liên hệ cửa hàng để xử lý đổi trả ngoài luồng hiện tại.

## Bước 6 — Đánh giá sau khi nhận hàng

### Thao tác đã kiểm tra

1. Trong `/orders`, chọn một đơn `Delivered`.
2. Bấm **Đánh giá đơn hàng**.
3. Trang mới liệt kê từng sản phẩm trong đơn.
4. Chọn 1–5 sao, nhập nhận xét và bấm **Gửi đánh giá**.
5. Món đã đánh giá hiện trạng thái **Đã gửi đánh giá**.

### Quy tắc nghiệp vụ

- Chỉ đơn đã giao mới mở được dữ liệu đánh giá.
- Sản phẩm phải thuộc chính đơn đó.
- Mỗi tài khoản chỉ đánh giá một lần cho mỗi sản phẩm.
- Đánh giá bị ẩn không hiển thị và không tính vào điểm trung bình.

### Nếu bị hỏi

**Chỉ ẩn nút đánh giá ở frontend có đủ không?**

Không. `getOrderReviewStatus()`, `createOrderReview()` và `createReview()` đều kiểm tra Order trong MongoDB.

**Chặn đánh giá trùng ở đâu?**

Model `Review` có unique index `{ user: 1, product: 1 }`.

**Ẩn đánh giá có làm sai điểm sao không?**

Không. `refreshRating()` chỉ lấy review có `isHidden != true`; `moderateReview()` gọi tính lại sau khi ẩn hoặc hiện.

## Bước 7 — Hồ sơ và đổi mật khẩu

### Thao tác đã kiểm tra

1. Mở `/profile`.
2. Chỉ ra phần sửa họ tên; email chỉ đọc.
3. Chỉ ra form đổi mật khẩu gồm mật khẩu hiện tại, mật khẩu mới và nhập lại.

Không đổi mật khẩu tài khoản demo khi đang thuyết trình.

### Nếu bị hỏi

**Tại sao đổi mật khẩu cần mật khẩu hiện tại?**

`changePassword()` dùng `bcrypt.compare()` xác nhận chủ tài khoản rồi mới băm mật khẩu mới.

**Hồ sơ hiện sửa được gì?**

Giao diện hiện cho sửa họ tên. Model vẫn có `avatarUrl`, nhưng trang hiện tại không có ô nhập ảnh đại diện.

## Bản đồ code của Triều

| Nội dung | Hàm / component | File |
|---|---|---|
| Chi tiết sản phẩm | `ProductDetailPage()` | `client/src/pages/ProductDetailPage.jsx` |
| State giỏ hàng | `CartProvider()` | `client/src/context/CartContext.jsx` |
| Lưu giỏ theo tài khoản | `cartKey()`, `sync()` | `client/src/services/cartService.js` |
| Kiểm tra giỏ trên server | `refreshCart()`, `addToCart()` | `server/src/controllers/cartController.js` |
| Form thanh toán | `CheckoutPage()` | `client/src/pages/CheckoutPage.jsx` |
| Tạo đơn | `createOrder()` | `server/src/controllers/orderController.js` |
| Phí giao hàng | `calculateShippingFee()` | `server/src/controllers/orderController.js` |
| Hoàn kho khi tạo đơn lỗi | `restoreReservedStock()` | `server/src/controllers/orderController.js` |
| Hủy đơn | `cancelOrder()`, `cancelMyOrder()` | `server/src/controllers/orderController.js` |
| Lịch sử đơn | `OrderHistoryPage()` | `client/src/pages/OrderHistoryPage.jsx` |
| Đánh giá theo đơn | `OrderReviewPage()` | `client/src/pages/OrderReviewPage.jsx` |
| Kiểm tra và lưu review | `createOrderReview()`, `refreshRating()` | `server/src/controllers/reviewController.js` |
| Hồ sơ/mật khẩu | `ProfilePage()`, `changePassword()` | `client/src/pages/ProfilePage.jsx`, `server/src/controllers/userController.js` |

## Câu bàn giao cho Phúc

> “Khách hàng đã hoàn thành từ chọn món đến đặt hàng, theo dõi và đánh giá. Tiếp theo, bạn Phúc sẽ trình bày cách hệ thống xác thực người dùng và cách Admin xử lý dữ liệu phát sinh.”

## Checklist 30 giây

- [ ] Đăng nhập `customer` trước khi thêm giỏ.
- [ ] Demo chọn/bỏ chọn món và tổng tiền.
- [ ] Nói rõ server tính lại giá, kho và phí giao hàng.
- [ ] Phân biệt 5 trạng thái đơn và 2 trạng thái thanh toán.
- [ ] Mở đơn Delivered để chứng minh điều kiện đánh giá.
- [ ] Không đổi mật khẩu hoặc tạo đơn thật nếu chưa chuẩn bị.
- [ ] Bàn giao cho Phúc.
