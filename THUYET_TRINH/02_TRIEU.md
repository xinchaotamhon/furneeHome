# Triều — Phần 2/4: Từ chi tiết đến đơn hàng

Triều nói sau Dũng. Mỗi bước: **Nói · Demo · Thành công · Lỗi/thay đổi · Hỏi đáp · Hàm + đường dẫn**.

## Bước 1 — Chi tiết sản phẩm

- **Nói:** ID trên URL dùng để tải đúng sản phẩm; khách xem ảnh, giá, tồn kho, mô tả, thông số và đánh giá. Có thể thêm giỏ, mua ngay, thử trong phòng hoặc báo nội dung.
- **Demo:** Mở `/products/:id` → đổi ảnh → chỉ giá/tồn kho → chọn số lượng → **Thêm vào giỏ**, **Mua ngay**, **Thử sản phẩm trong phòng**.
- **Thành công:** Đúng sản phẩm hiện ra; mua ngay chuyển `/checkout`; liên kết Phòng thử mang theo sản phẩm; báo nội dung gắn đúng ID/tên.
- **Lỗi/thay đổi:** ID sai, sản phẩm ngừng bán hoặc không tồn tại thì báo không tìm thấy. Giá/tồn kho thay đổi vẫn được server đọc lại khi đặt hàng.
- **Hỏi đáp:** *Có lấy lại dữ liệu Shopee mỗi lần không?* Không, website vận hành bằng MongoDB. *Tại sao không tin giá trên trình duyệt?* Vì client có thể bị sửa; server là nơi quyết định.
- **Hàm + đường dẫn:** `ProductDetailPage()` — `client/src/pages/ProductDetailPage.jsx`: gọi theo ID và hiển thị; `productService.getById()` — `client/src/services/productService.js`: gọi API chi tiết; `getById()` — `server/src/controllers/productController.js`: lấy sản phẩm; `addToCart()` — `server/src/controllers/cartController.js`: kiểm tra rồi thêm giỏ; API `GET /api/products/:id`, `POST /api/cart/add`.

## Bước 2 — Đánh giá và báo nội dung

- **Nói:** Chỉ người đã có đơn `Delivered` chứa sản phẩm mới được đánh giá; điểm 1–5 sao; mỗi tài khoản chỉ một đánh giá cho một sản phẩm. Admin có thể ẩn/xóa nội dung xấu.
- **Demo:** Mở vùng đánh giá → gửi thử; nếu dùng dữ liệu mẫu thì chỉ 6 đánh giá mẫu từ 3–5 sao; từ chi tiết bấm **Báo nội dung**.
- **Thành công:** Đánh giá hợp lệ xuất hiện; điểm trung bình cập nhật; đánh giá bị ẩn biến khỏi khách và không còn tính điểm.
- **Lỗi/thay đổi:** Chưa mua/chưa nhận hàng, điểm ngoài 1–5, bình luận rỗng hoặc đánh giá lần hai đều bị server từ chối. Admin ẩn rồi hiện lại sẽ tính lại điểm.
- **Hỏi đáp:** *Ẩn nút ở frontend đủ chưa?* Chưa, server kiểm tra đơn đã giao. *Một người đánh giá hai lần?* Chỉ mục `user + product` chặn lần hai. *Báo xấu lưu ở đâu?* Collection `feedbacks`, trạng thái `new → reviewed → resolved`.
- **Hàm + đường dẫn:** `createReview()`, `getByProduct()`, `refreshRating()`, `moderateReview()` — `server/src/controllers/reviewController.js`: kiểm tra, đọc, tính điểm và kiểm duyệt; `create()` — `server/src/controllers/feedbackController.js`: lưu báo cáo; API `POST /api/reviews`, `GET /api/reviews/product/:productId`, `POST /api/feedback`.

## Bước 3 — Giỏ hàng

- **Nói:** Giỏ tách theo tài khoản; tăng/giảm trong tồn kho; có thể chọn từng món hoặc tất cả. Món bỏ chọn vẫn ở giỏ nhưng không đi vào đơn lần này.
- **Demo:** Mở `/cart` có ít nhất 2 món → tăng/giảm → bỏ chọn 1 món → kiểm tra tổng → bấm thanh toán.
- **Thành công:** Tổng tiền chỉ tính món đã chọn; đổi tài khoản không lẫn giỏ; thanh toán mang đúng món sang checkout.
- **Lỗi/thay đổi:** Hết hàng/ngừng bán hoặc tồn kho giảm thì server từ chối cập nhật; giỏ được làm mới theo giá và tồn kho thật. Đặt thành công chỉ xóa món vừa mua, món bỏ chọn vẫn còn.
- **Hỏi đáp:** *Hai tài khoản dùng chung giỏ không?* Không, cart gắn với `user`. *Đăng xuất thì sao?* Giỏ hiển thị được xóa; đăng nhập lại sẽ tải giỏ của tài khoản đó. *Tại sao đồng bộ một lần?* Client gửi cả giỏ qua một request để nhanh và tránh nhiều lần ghi đè nhau. *Tại sao kiểm tra hai lần?* Client tiện thao tác, server bảo vệ dữ liệu.
- **Hàm + đường dẫn:** `CartProvider()` — `client/src/context/CartContext.jsx`: state, localStorage theo user và gọi đồng bộ một lần; `syncCart()` — `server/src/controllers/cartController.js`: cập nhật nhiều món rồi lưu một lần; `toggleItemSelection()`, `toggleSelectAll()`, `clearPurchasedItems()` — `client/src/context/CartContext.jsx`: chọn món và xóa đúng món đã mua; `updateQuantity()` — `server/src/controllers/cartController.js`: kiểm tra tồn kho; đoạn `$pull` trong `createOrder()` — `server/src/controllers/orderController.js`: xóa đúng ID vừa mua khỏi Mongo cart; API `GET /api/cart`, `POST /api/cart/sync`, `POST /api/cart/add`, `PUT /api/cart/update`.

## Bước 4 — Checkout và tạo đơn

- **Nói:** Checkout nhận người nhận, số điện thoại Việt Nam, địa chỉ, tỉnh/thành, ghi chú và COD hoặc chuyển khoản QR. Client gửi `provinceCode`; server tự tính phí, giá và tồn kho.
- **Demo:** Đăng nhập `customer` / `user123456` → `/checkout` → nhập địa chỉ hợp lệ → chọn COD/QR → bấm đặt hàng.
- **Thành công:** Màn hình trả mã đơn; đơn bắt đầu `Pending`, thanh toán bắt đầu `Pending`; tổng gồm tạm tính + phí giao hàng do server tính.
- **Lỗi/thay đổi:** Địa chỉ/điện thoại/tỉnh sai, sản phẩm hết hàng hoặc giá không hợp lệ thì không tạo đơn. Địa chỉ được chuẩn hóa Unicode NFC nên tiếng Việt gõ từ Unikey, Gboard hay Safari vẫn nhận. Nếu lỗi giữa chừng, tồn kho đã giữ lại được hoàn lại. Không gửi và không tin `shippingFee` do client tự nhập.
- **Hỏi đáp:** *Phí giao hàng lấy từ đâu?* `calculateShippingFee()` ở server dựa trên `provinceCode` (79: 30.000đ; từ 48: 40.000đ; dưới 48: 60.000đ). *Nếu sửa phí bằng F12?* Không có tác dụng vì client chỉ gửi tỉnh, server tự tính phí. *Hai người mua món cuối?* Cập nhật có điều kiện `stock >= qty`, chỉ một yêu cầu thành công. *QR có tự xác nhận tiền?* Không, admin kiểm tra giao dịch.
- **Hàm + đường dẫn:** `CheckoutPage()` — `client/src/pages/CheckoutPage.jsx`: nhập form và gửi; `validateSpecificAddress()` — `client/src/utils/validation.js`: chuẩn hóa/kiểm tra địa chỉ tiếng Việt; `createOrder()`, `cleanAddress()`, `calculateShippingFee()` — `server/src/controllers/orderController.js`: kiểm tra, tính phí, giữ kho, chụp giá và tạo đơn; API `POST /api/orders`.

## Bước 5 — Lịch sử đơn và bàn giao

- **Nói:** Khách chỉ xem đơn của mình; chỉ `Pending`/`Processing` được hủy; hủy hoàn kho đúng một lần. Hồ sơ cho phép đổi tên và ảnh đại diện.
- **Demo:** Mở `/orders` → xem mã/trạng thái → hủy một đơn hợp lệ → mở `/profile`.
- **Thành công:** Đơn chuyển `Cancelled`, kho được cộng lại; đơn `Shipped`/`Delivered` không có nút hủy.
- **Lỗi/thay đổi:** Hủy lần hai hoặc hủy đơn người khác bị từ chối; nếu cập nhật đồng thời, server yêu cầu tải lại.
- **Hỏi đáp:** *Tại sao không hủy khi đang giao?* Đơn đã qua bước xử lý, cần liên hệ cửa hàng. *Đơn cũ có đổi giá không?* Không, `orderItems` giữ bản chụp tên/giá lúc mua.
- **Hàm + đường dẫn:** `OrderHistoryPage()` — `client/src/pages/OrderHistoryPage.jsx`: lịch sử và nút hủy; `cancelMyOrder()`/`cancelOrder()` — `server/src/controllers/orderController.js`: giới hạn người hủy và hoàn kho; `updateMe()` — `server/src/controllers/userController.js`: sửa hồ sơ; API `GET /api/orders/my-orders`, `PATCH /api/orders/:id/cancel`, `PATCH /api/users/me`.

**Câu bàn giao cho Phúc:** “Phần khách hàng đã tạo được một đơn hoàn chỉnh. Tiếp theo, Phúc sẽ trình bày OTP, vòng đời đơn ở phía quản trị và phân quyền Admin.”

## Phản biện nhanh cuối phần

1. **Nếu khách sửa giá trong F12?** Không ảnh hưởng; `createOrder()` đọc lại `Product.price` trong MongoDB.
2. **Nếu khách gửi `shippingFee: 0`?** Server bỏ qua; `calculateShippingFee(provinceCode)` tự tính 30.000đ, 40.000đ hoặc 60.000đ.
3. **Nếu khách chỉ mua 1 trong 3 món ở giỏ?** Order chỉ chứa món được chọn; `$pull` chỉ xóa ID vừa mua, hai món còn lại vẫn trong Mongo cart.
4. **Nếu lỗi sau khi đã trừ kho món đầu?** `restoreReservedStock()` cộng lại các món đã giữ trước khi trả lỗi.
5. **Tại sao đơn lưu lại tên và giá?** Đó là bản chụp lúc mua; Admin sửa catalog sau này không làm đơn cũ thay đổi.
6. **Nếu hủy đơn hai lần?** Điều kiện `stockRestored: false` chỉ cho hoàn kho một lần.
7. **Nếu một review bị ẩn?** `refreshRating()` chỉ lấy review chưa ẩn rồi cập nhật lại điểm và số lượt.
8. **LocalStorage và Mongo cart khác nhau thế nào?** LocalStorage giữ trải nghiệm trên trình duyệt; Mongo cart giúp cùng tài khoản dùng được ở thiết bị khác.

### Tự kiểm tra

- Demo được chi tiết → giỏ → món chọn → checkout → mã đơn.
- Nhớ `provinceCode` và phí do server tính lại.
- Trả lời được hết hàng, mua đồng thời, hủy đơn và điều kiện đánh giá.
- Nhớ câu bàn giao.
