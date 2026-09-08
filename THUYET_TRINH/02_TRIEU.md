# Triều — Phần 2/4: Chi tiết sản phẩm và hành trình mua hàng

## Vai trò của Triều

Triều nói sau Dũng. Nhiệm vụ là trình bày mọi thao tác của khách từ lúc mở một sản phẩm đến lúc tạo được đơn hàng và theo dõi sau mua.

## 1. Chi tiết sản phẩm

Ý chính:

- Trang dùng ID trên URL để tải đúng một sản phẩm từ MongoDB.
- Khách xem ảnh, tên, giá, tồn kho, mô tả, thông số và đánh giá.
- Khách chọn số lượng rồi **Thêm vào giỏ**, **Mua ngay** hoặc chọn sản phẩm cho **Phòng thử**.
- **Báo nội dung** mở biểu mẫu gắn đúng ID và tên sản phẩm đang xem.

Luồng:

`Bấm sản phẩm → API tìm theo ID → Hiển thị thông tin → Chọn số lượng → Thêm giỏ, mua ngay, phòng thử hoặc báo xấu`

Trình tự demo:

1. Mở một sản phẩm có đánh giá mẫu.
2. Chuyển qua các ảnh sản phẩm.
3. Chỉ giá, tồn kho, mô tả và thông số.
4. Chọn số lượng rồi bấm **Thêm vào giỏ**.
5. Chỉ nút **Mua ngay**, **Phòng thử** và **Báo nội dung**.

Code cần biết:

- `ProductDetailPage()` — `client/src/pages/ProductDetailPage.jsx`: hiển thị chi tiết và nhận thao tác người dùng.
- `getById()` — `server/src/controllers/productController.js`: tìm sản phẩm theo ID trong MongoDB.
- `addToCart()` — `server/src/controllers/cartController.js`: kiểm tra sản phẩm và thêm vào giỏ của người đang đăng nhập.

Câu có thể bị hỏi:

**Nếu ID sản phẩm sai hoặc sản phẩm đã ngừng bán?**  
API trả lỗi không tìm thấy; khách không xem được sản phẩm ngừng bán.

**Thông tin hiển thị có lấy lại từ Shopee mỗi lần không?**  
Không. Dữ liệu đã được đưa vào MongoDB. Website vận hành độc lập với trang nguồn.

**Nếu Admin sửa giá trong khi khách đang xem?**  
Khi đặt hàng, server đọc lại giá mới nhất trong MongoDB; không tin giá đang giữ ở trình duyệt.

## 2. Đánh giá và báo xấu

Quy tắc đánh giá:

- Chỉ tài khoản đã có đơn `Delivered` chứa sản phẩm mới được đánh giá.
- Điểm hợp lệ từ 1 đến 5 sao.
- Một tài khoản chỉ đánh giá một lần cho một sản phẩm.
- `refreshRating()` tính lại điểm trung bình và số lượt đánh giá.
- Admin có thể kiểm duyệt nội dung xấu.

Dữ liệu minh họa hiện có 6 đánh giá từ 3 đến 5 sao ở một số sản phẩm đầu trang. Đây là dữ liệu demo, không trình bày như đánh giá thật của khách ngoài hệ thống.

Luồng:

`Khách gửi đánh giá → Kiểm tra đơn đã giao → Lưu reviews → Tính lại ratingAverage và reviewCount → Hiển thị trên sản phẩm`

Code cần biết:

- `createReview()` — `server/src/controllers/reviewController.js`: kiểm tra quyền đánh giá rồi lưu.
- `refreshRating()` — `server/src/controllers/reviewController.js`: tính lại điểm trung bình.
- `getByProduct()` — `server/src/controllers/reviewController.js`: tải đánh giá chưa bị ẩn.
- `create()` — `server/src/controllers/feedbackController.js`: lưu báo xấu vào `feedbacks`.

Câu có thể bị hỏi:

**Người chưa mua có đánh giá được không?**  
Không. Server kiểm tra đơn đã giao, không chỉ ẩn nút ở frontend.

**Nếu đánh giá hai lần?**  
MongoDB có chỉ mục duy nhất theo `user + product`, nên lần thứ hai bị từ chối.

**Nếu có đánh giá xấu về nội dung?**  
Admin có thể ẩn đánh giá; báo cáo sản phẩm được xử lý ở tab Báo nội dung.

## 3. Giỏ hàng

Ý chính:

- Giỏ được tách theo từng tài khoản.
- Khách tăng, giảm, xóa số lượng trong giới hạn tồn kho.
- Khách có thể chọn từng món hoặc chọn tất cả để thanh toán.
- Món không được tích vẫn ở lại giỏ nhưng không nằm trong đơn lần này.
- Sau khi đặt thành công, chỉ những món vừa mua bị xóa khỏi giỏ.

Luồng:

`Thêm sản phẩm → CartContext cập nhật giao diện → API lưu cart theo user → Chọn món cần mua → Chuyển đúng món sang Checkout`

Trình tự demo:

1. Mở giỏ có ít nhất hai sản phẩm.
2. Tăng hoặc giảm số lượng.
3. Bỏ chọn một sản phẩm.
4. Chỉ tổng tiền của các sản phẩm đã chọn.
5. Bấm thanh toán.

Code cần biết:

- `CartProvider()` — `client/src/context/CartContext.jsx`: giữ giỏ, món được chọn và đồng bộ API.
- `toggleItemSelection()` — `client/src/context/CartContext.jsx`: chọn hoặc bỏ một món.
- `toggleSelectAll()` — `client/src/context/CartContext.jsx`: chọn hoặc bỏ toàn bộ.
- `updateQuantity()` — `server/src/controllers/cartController.js`: đổi số lượng nhưng không vượt tồn kho.
- `clearPurchasedItems()` — `client/src/context/CartContext.jsx`: chỉ bỏ món vừa đặt thành công.

Câu có thể bị hỏi:

**Hai tài khoản có dùng chung giỏ không?**  
Không. MongoDB gắn một cart với user; dữ liệu tạm trên trình duyệt cũng tách theo userId.

**Nếu khách đăng xuất?**  
Trạng thái giỏ trên trình duyệt được xóa; lần đăng nhập sau hệ thống tải lại giỏ của tài khoản từ server.

**Nếu tồn kho giảm khi hàng đang ở giỏ?**  
Server kiểm tra lại tồn kho khi tạo đơn; nếu không đủ thì từ chối và yêu cầu khách cập nhật giỏ.

## 4. Checkout và tạo đơn hàng

Ý chính:

- Checkout hiển thị lại đúng các món đã chọn.
- Khách nhập người nhận, số điện thoại Việt Nam, địa chỉ và ghi chú.
- Khách chọn COD hoặc chuyển khoản QR.
- Tổng tiền gồm tạm tính và phí giao hàng.
- Trạng thái đầu tiên của đơn là `Pending`; trạng thái thanh toán là `Pending`.

Luồng tạo đơn:

1. Client gửi ID sản phẩm, số lượng, địa chỉ và phương thức thanh toán.
2. `createOrder()` đọc lại từng sản phẩm từ MongoDB.
3. Server chỉ giảm tồn kho khi tồn kho còn đủ.
4. Tên, giá và ảnh được chụp vào `orderItems`.
5. Server tạo mã đơn và lưu order.
6. Nếu lỗi giữa chừng, server hoàn lại phần tồn kho đã giữ.
7. Client hiện đặt hàng thành công và xóa các món vừa mua.

Trình tự demo:

1. Đăng nhập `customer` / `user123456`.
2. Kiểm tra danh sách sản phẩm ở Checkout.
3. Nhập địa chỉ hợp lệ.
4. Chọn COD hoặc QR.
5. Bấm đặt hàng.
6. Chỉ mã đơn vừa tạo.

Code cần biết:

- `CheckoutPage()` — `client/src/pages/CheckoutPage.jsx`: thu thập thông tin và gửi yêu cầu tạo đơn.
- `createOrder()` — `server/src/controllers/orderController.js`: kiểm tra giá, tồn kho, tạo đơn và khôi phục nếu lỗi.
- `cleanAddress()` — `server/src/controllers/orderController.js`: kiểm tra tên, điện thoại và địa chỉ nhận.

Câu có thể bị hỏi:

**Khách đang đặt hàng thì hệ thống làm gì?**  
Server kiểm tra từng sản phẩm, giữ tồn kho, tính tổng từ giá MongoDB, tạo order rồi trả mã đơn.

**Nếu hai người mua món cuối cùng cùng lúc?**  
Câu lệnh giảm tồn kho có điều kiện `stock >= số lượng`; chỉ yêu cầu thắng trước mới lấy được hàng.

**QR có tự xác nhận tiền đã vào không?**  
Không. QR cung cấp thông tin chuyển khoản; Admin xác nhận sau khi kiểm tra giao dịch.

**Tại sao lưu giá vào orderItems?**  
Để đơn cũ giữ đúng giá tại thời điểm mua dù sản phẩm được sửa giá sau này.

## 5. Lịch sử đơn và hồ sơ

- Khách chỉ xem các đơn của chính mình.
- Khách được hủy đơn khi trạng thái còn `Pending` hoặc `Processing`.
- Hủy đơn hoàn tồn kho đúng một lần.
- Hồ sơ cho phép đổi tên và ảnh đại diện.

Code cần biết:

- `OrderHistoryPage()` — `client/src/pages/OrderHistoryPage.jsx`: hiển thị đơn và nút hủy hợp lệ.
- `cancelMyOrder()` — `server/src/controllers/orderController.js`: hủy đơn của đúng người dùng.
- `cancelOrder()` — `server/src/controllers/orderController.js`: đổi trạng thái và hoàn kho.
- `updateMe()` — `server/src/controllers/userController.js`: cập nhật hồ sơ.

Câu có thể bị hỏi:

**Nếu khách hủy hai lần thì sao?**  
Điều kiện trạng thái và `stockRestored` ngăn hoàn tồn kho lần thứ hai.

**Đơn đang giao có hủy được không?**  
Không. Khi đã `Shipped`, khách phải liên hệ cửa hàng thay vì tự hủy trên hệ thống.

## 6. Câu chuyển cho Phúc

> Phần của khách hàng đã tạo được một đơn hoàn chỉnh. Tiếp theo, Phúc sẽ giải thích tài khoản, OTP, vòng đời của đơn ở phía quản trị và cách phân quyền Admin.

## Tự kiểm tra trước khi bảo vệ

- Demo được chi tiết → giỏ → chọn món → checkout → tạo đơn.
- Trả lời được trường hợp hết hàng, đặt lỗi, hủy đơn và mua đồng thời.
- Nói được điều kiện đánh giá sản phẩm.
- Nhớ tài khoản demo `customer` / `user123456`.
- Nhớ câu chuyển phần cho Phúc.
