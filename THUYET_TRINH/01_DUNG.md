# Dũng — Phần 1/4: Mở đầu và hành trình tìm sản phẩm

## Vai trò của Dũng

Dũng nói đầu tiên. Nhiệm vụ là giúp ban giám khảo hiểu FurneeHome giải quyết vấn đề gì, dành cho ai và khách bắt đầu mua hàng như thế nào.

Thứ tự toàn bài: **Dũng → Triều → Phúc → Hiệp**.

## 1. Mở đầu

Ý chính để tự diễn đạt:

- FurneeHome là website bán nội thất và đồ trang trí.
- Đối tượng chính là sinh viên, học sinh, công nhân và gia đình phổ thông.
- Khách thường khó chọn đồ vừa giá, vừa diện tích và khó hình dung món đồ trong căn phòng thật.
- FurneeHome giải quyết toàn bộ hành trình từ tìm sản phẩm, xem chi tiết, đặt hàng, theo dõi đơn đến thử sản phẩm bằng AI.
- Phòng thử AI là điểm wow, nhưng phần cốt lõi vẫn là website bán hàng hoàn chỉnh.

Luồng cần nhớ:

`Nhu cầu của khách → Tìm sản phẩm → Xem thông tin → Mua hàng hoặc Phòng thử AI`

## 2. Người dùng và quyền

- Khách chưa đăng nhập: xem trang chủ, danh sách và chi tiết sản phẩm.
- Khách hàng: dùng giỏ hàng, đặt hàng, xem lịch sử đơn, sửa hồ sơ, đánh giá, báo xấu và dùng Phòng thử.
- Admin: quản lý sản phẩm, khách hàng, đơn hàng và báo nội dung.
- Orchestra Admin: có toàn bộ quyền Admin và được cấp hoặc thu quyền Admin cấp dưới.

Câu có thể bị hỏi:

**Tại sao phải chia quyền?**  
Để khách không gọi được API quản trị và Admin thường không tự cấp quyền cao nhất cho mình.

## 3. Trang chủ

Trình tự demo:

1. Mở trang chủ.
2. Giới thiệu ngắn FurneeHome bán gì và cho ai.
3. Chỉ thanh điều hướng: Sản phẩm, Giỏ hàng, Phòng thử, Liên hệ, tài khoản.
4. Bấm nút đi tới danh sách sản phẩm.

Kết quả cần thấy: người xem hiểu ngay giá trị của hệ thống và biết bước tiếp theo là chọn sản phẩm.

Code cần biết:

- `HomePage()` — `client/src/pages/HomePage.jsx`: hiển thị nội dung trang chủ.
- `Header()` — `client/src/components/layout/Header.jsx`: hiển thị điều hướng theo trạng thái đăng nhập và quyền.
- `router` — `client/src/router.jsx`: nối URL với từng trang React.

Câu có thể bị hỏi:

**Nếu bỏ Phòng thử AI thì hệ thống còn hoạt động không?**  
Có. Khách vẫn tìm sản phẩm, mua hàng, thanh toán, theo dõi đơn, đánh giá và quản trị bình thường. AI là tính năng hỗ trợ quyết định mua.

**Tại sao giao diện không làm quá phức tạp?**  
Đối tượng chính là người dùng phổ thông, nên nhóm ưu tiên ít bước, chữ rõ và thao tác trực tiếp.

## 4. Danh sách sản phẩm

Ý chính:

- Dữ liệu đang bán được tải từ MongoDB qua API.
- Khách có thể tìm theo tên, lọc danh mục, sắp xếp và chuyển trang.
- Mỗi thẻ hiển thị ảnh, tên, giá, đánh giá và tình trạng sản phẩm.
- Sản phẩm ngừng bán không hiện với khách nhưng Admin vẫn thấy để mở bán lại.
- Khi vào từ Phòng thử, khách có thể chọn tối đa ba sản phẩm rồi quay lại Phòng thử.

Luồng:

`Nhập từ khóa → Chọn danh mục → Sắp xếp → Xem kết quả → Mở chi tiết hoặc chọn cho Phòng thử`

Trình tự demo:

1. Mở **Sản phẩm**.
2. Tìm một từ khóa có kết quả.
3. Chọn một danh mục.
4. Đổi cách sắp xếp.
5. Mở sản phẩm đầu tiên.

Code cần biết:

- `ProductListPage()` — `client/src/pages/ProductListPage.jsx`: nhận thao tác tìm, lọc và phân trang.
- `ProductCard()` — `client/src/components/product/ProductCard.jsx`: hiển thị một thẻ sản phẩm.
- `fetchProducts()` — `client/src/context/ProductContext.jsx`: gọi API và chia sẻ danh sách cho các trang.
- `list()` — `server/src/controllers/productController.js`: lọc và sắp xếp dữ liệu MongoDB.

Câu có thể bị hỏi:

**Nếu MongoDB tải chậm thì sao?**  
Giao diện hiển thị trạng thái tải và chờ nguồn dữ liệu thật. Nhóm không hiện JSON cũ thay thế vì có thể làm sai giá vừa được Admin sửa.

**Giá sản phẩm lấy từ đâu?**  
MongoDB. Frontend chỉ hiển thị dữ liệu API trả về và server tiếp tục đọc lại giá MongoDB khi tạo đơn.

**Nếu không tìm thấy sản phẩm?**  
Trang báo không có kết quả; người dùng bỏ từ khóa hoặc chọn lại danh mục.

**Sản phẩm hết hàng có đặt được không?**  
Không. Giao diện thông báo hết hàng và server kiểm tra tồn kho lần cuối khi tạo đơn.

## 5. Trang Liên hệ

Trang chỉ hiển thị:

- Địa chỉ: 71/5 Huỳnh Tấn Phát, Ấp 31, Xã Nhà Bè, TP.HCM.
- Điện thoại: 0372 208 100.
- Gmail: furneehome@gmail.com.
- Zalo: 0372 208 100.

Điện thoại, Gmail và Zalo có thể bấm để mở ứng dụng tương ứng. Báo xấu sản phẩm là một luồng riêng ở trang chi tiết, không phải biểu mẫu liên hệ chung.

Code cần biết:

- `FeedbackPage()` — `client/src/pages/FeedbackPage.jsx`: hiển thị thông tin liên hệ; khi nhận một sản phẩm thì hiển thị biểu mẫu báo nội dung.
- `Footer()` — `client/src/components/layout/Footer.jsx`: lặp lại thông tin liên hệ ở cuối trang.

## 6. Câu chuyển cho Triều

> Khách đã tìm được sản phẩm phù hợp. Tiếp theo, Triều sẽ trình bày cách xem đầy đủ thông tin sản phẩm, đánh giá, thêm giỏ và hoàn tất mua hàng.

## Tự kiểm tra trước khi bảo vệ

- Nói được FurneeHome dành cho ai và giải quyết vấn đề gì.
- Phân biệt được bốn loại quyền.
- Demo được tìm kiếm, lọc và mở chi tiết.
- Trả lời được dữ liệu sản phẩm lấy từ MongoDB.
- Nhớ câu chuyển phần cho Triều.
