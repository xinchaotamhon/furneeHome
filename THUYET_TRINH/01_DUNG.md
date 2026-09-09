# Dũng — Phần 1/4: Tổng quan và tìm sản phẩm

> **Vị trí:** nói đầu tiên. **Luồng:** Bài toán → Trang chủ → Người dùng → Danh sách sản phẩm → Liên hệ/Báo nội dung → bàn giao cho Triều.

## Thẻ liếc nhanh

- **Mục tiêu:** giúp hội đồng hiểu FurneeHome bán gì, phục vụ ai và khách tìm sản phẩm như thế nào.
- **Trang demo:** `/` → `/products` → một trang chi tiết → `/feedback`.
- **Từ khóa code:** `HomePage` · `Header` · `ProductListPage` · `list` · `escapeRegex` · `FeedbackPage`.
- **Không làm trong phần này:** chưa thêm giỏ, chưa đặt hàng, chưa trình bày sâu AI.

## Bước 1 — Mở đầu dự án

### Nói

> “FurneeHome là website bán nội thất và đồ trang trí cho sinh viên, học sinh, công nhân và các gia đình phổ thông. Bài toán nhóm giải quyết là giúp khách tìm, mua sản phẩm dễ dàng và hình dung sản phẩm trong căn phòng thật trước khi quyết định.”

FurneeHome có hai phần:

- Luồng thương mại điện tử: xem hàng, giỏ hàng, thanh toán, đơn hàng, đánh giá.
- Điểm nổi bật: Phòng thử AI ghép 1–3 sản phẩm vào ảnh phòng.

### Hội đồng có thể hỏi

**Tại sao đối tượng là người dùng phổ thông?**

Vì giao diện ít bước, giá hiển thị rõ và sản phẩm phù hợp không gian sống thường ngày.

**Tại sao vẫn cần website bán hàng khi đã có Shopee?**

Website giúp cửa hàng tự quản lý sản phẩm, khách hàng và đơn hàng; Phòng thử AI là chức năng riêng hỗ trợ quyết định mua.

**Công nghệ chính là gì?**

React, HTML, CSS và Axios ở frontend; Node.js, Express ở backend; MongoDB và Mongoose lưu dữ liệu; Pollinations và Cloudflare tạo ảnh.

## Bước 2 — Trang chủ và điều hướng

### Thao tác

1. Mở `/`.
2. Chỉ vào menu: **Trang chủ, Sản phẩm, Phòng thử, Giỏ hàng, Liên hệ**.
3. Chỉ vào hai nút chính **Xem sản phẩm** và **Mở Phòng thử**.
4. Nói ngắn ba bước trên trang chủ: chọn sản phẩm → đặt hàng → thử trong phòng.

### Dấu hiệu đúng

- Menu đưa đến đúng trang, không tải lại toàn bộ website.
- Khách chưa đăng nhập thấy nút **Đăng nhập** và **Đăng ký**.
- Giao diện co lại được trên màn hình nhỏ.

### Nếu bị hỏi

**Điều hướng nằm ở đâu?**

`client/src/router.jsx` khai báo URL; `client/src/components/layout/Header.jsx` hiển thị menu; `MainLayout.jsx` ghép header, nội dung và footer.

**Tại sao giao diện không dùng framework UI lớn?**

Nhóm dùng CSS trực tiếp để giao diện nhẹ và mã nguồn dễ đọc, phù hợp phạm vi đồ án.

**Nếu gõ một URL không tồn tại?**

Route `*` trong `router.jsx` mở `NotFoundPage`.

## Bước 3 — Giải thích các nhóm người dùng

### Nói

- **Khách:** xem, tìm sản phẩm, dùng giỏ tạm và thử phòng.
- **Khách hàng:** đăng nhập để đặt hàng, xem lịch sử, đánh giá và sửa hồ sơ.
- **Admin:** quản lý sản phẩm, khách hàng, đơn hàng và báo nội dung.
- **Orchestra Admin:** có thêm quyền quản lý các Admin cấp dưới.

### Nếu bị hỏi

**Ẩn nút trên giao diện đã đủ phân quyền chưa?**

Chưa. Frontend chỉ giúp hiển thị đúng giao diện. Backend vẫn kiểm tra JWT và vai trò bằng `authenticate()` và `requireAdmin()`.

**Khách gõ thẳng `/admin` thì sao?**

`AdminRoute()` không hiển thị trang quản trị nếu vai trò không đúng; API quản trị còn được middleware backend bảo vệ.

## Bước 4 — Tìm kiếm và lọc sản phẩm

### Thao tác đã kiểm tra

1. Mở `/products`.
2. Gõ từ khóa **bàn** vào ô tìm kiếm.
3. Chọn danh mục **Phòng làm việc**.
4. Chọn sắp xếp **Giá thấp đến cao**.
5. Nếu có nhiều trang, bấm **Sau**, rồi **Trước**.
6. Bấm vào ảnh hoặc tên của một sản phẩm để mở chi tiết.

### Dấu hiệu đúng

- Số sản phẩm phù hợp và danh sách thay đổi theo từ khóa.
- Danh mục chỉ giữ sản phẩm cùng nhóm.
- Giá được sắp xếp đúng.
- Mỗi trang lấy tối đa 12 sản phẩm từ API.
- Sản phẩm ngừng bán hoặc có giá không hợp lệ không xuất hiện với khách.

### Luồng dữ liệu thật

```text
Nhập từ khóa / chọn bộ lọc
        ↓
ProductListPage tạo page, limit, search, category, sort
        ↓
productService.getPage gọi GET /api/products
        ↓
productController.list kiểm tra và truy vấn MongoDB
        ↓
API trả products + categories + pagination
        ↓
React cập nhật danh sách
```

Ở lần mở mặc định, `ProductListPage` đọc `data_import.json` để hiện nhanh một bản chụp. Ngay sau đó API MongoDB trả về và thay thế bằng dữ liệu chính thức.

### Nếu bị hỏi

**Giá chính thức lấy từ đâu?**

MongoDB. JSON chỉ giúp hiện danh sách ban đầu nhanh hơn; thao tác mua hàng không lấy giá từ JSON.

**Nếu JSON cũ hơn MongoDB?**

Người dùng có thể thấy bản chụp cũ trong thời gian rất ngắn, sau đó API thay bằng dữ liệu MongoDB. Khi chạy localhost, Admin có nút đồng bộ một chiều MongoDB → JSON.

**Danh mục có hard-code không?**

Không. API lấy các `categoryName` hiện có trong MongoDB rồi trả về cho giao diện.

**Nếu tìm chuỗi có `*`, `(` hoặc ký tự regex?**

`escapeRegex()` biến ký tự đặc biệt thành văn bản thường trước khi truy vấn, tránh lỗi Regex và ReDoS.

**Nếu không có kết quả?**

Trang hiện “Không tìm thấy sản phẩm” và đề nghị đổi từ khóa hoặc danh mục.

**Nếu MongoDB chậm?**

Bản JSON giúp trang mặc định có nội dung sớm. Với thao tác tìm kiếm hoặc lọc, giao diện chờ API vì MongoDB là nguồn chính thức.

## Bước 5 — Từ thẻ sản phẩm sang chức năng khác

### Thao tác

Trên một thẻ sản phẩm, chỉ vào:

- Ảnh/tên: mở chi tiết.
- **Thêm giỏ:** thêm món vào giỏ.
- **Thử phòng:** chuyển sản phẩm sang Phòng thử.

Khi đi từ Phòng thử sang danh sách, thẻ có ô chọn và chỉ cho chọn tối đa 3 món.

### Nếu bị hỏi

**Tại sao giới hạn 3 món?**

Để thao tác chọn dễ hiểu, request ảnh không quá nặng và AI ít nhầm sản phẩm hơn. Hiệp sẽ giải thích sâu ở phần cuối.

**Nếu món không có ảnh?**

Món đó không phù hợp làm ảnh tham chiếu nên không được thêm vào lựa chọn Phòng thử.

## Bước 6 — Liên hệ và Báo nội dung

### Thao tác đã kiểm tra

1. Mở trực tiếp `/feedback`: trang chỉ hiện địa chỉ, điện thoại, email và Zalo.
2. Quay lại một trang chi tiết sản phẩm.
3. Bấm **Báo nội dung**.
4. Trang `/feedback` lúc này hiện tên sản phẩm và ô nhập nội dung báo cáo.

### Dấu hiệu đúng

- Liên hệ trực tiếp không hiện form thừa.
- Báo cáo đi từ sản phẩm mang theo đúng sản phẩm cần báo.
- Sau khi gửi, dữ liệu được lưu vào collection `feedbacks` để Admin xử lý.

### Nếu bị hỏi

**Tại sao Liên hệ và Báo nội dung cùng một URL?**

Trang có hai trạng thái. Mở trực tiếp là thông tin liên hệ; đi từ sản phẩm thì nhận `targetId`, `targetName` và hiện form báo cáo.

**Các trạng thái báo cáo là gì?**

`new` → `reviewed` → `resolved`, tương ứng Mới → Đã xem → Đã xử lý.

## Bản đồ code của Dũng

| Nội dung | Hàm / component | File |
|---|---|---|
| Trang chủ | `HomePage()` | `client/src/pages/HomePage.jsx` |
| Menu và trạng thái đăng nhập | `Header()` | `client/src/components/layout/Header.jsx` |
| Các URL | `router` | `client/src/router.jsx` |
| Tìm, lọc, phân trang | `ProductListPage()` | `client/src/pages/ProductListPage.jsx` |
| Gọi API sản phẩm | `getPage()` | `client/src/services/productService.js` |
| Truy vấn sản phẩm | `list()` | `server/src/controllers/productController.js` |
| Làm an toàn từ khóa | `escapeRegex()` | `server/src/controllers/productController.js` |
| Liên hệ/Báo nội dung | `FeedbackPage()` | `client/src/pages/FeedbackPage.jsx` |
| Lưu báo cáo | `create()` | `server/src/controllers/feedbackController.js` |

## Câu bàn giao cho Triều

> “Như vậy khách đã tìm được sản phẩm phù hợp. Tiếp theo, bạn Triều sẽ trình bày chi tiết sản phẩm, giỏ hàng, thanh toán, lịch sử đơn và đánh giá sau khi mua.”

## Checklist 30 giây

- [ ] Nhớ đúng đối tượng và bài toán.
- [ ] Tìm **bàn**, lọc **Phòng làm việc**, sắp xếp giá.
- [ ] Nói đúng: JSON hiện nhanh, MongoDB là dữ liệu chính thức.
- [ ] Phân biệt Liên hệ trực tiếp với Báo nội dung từ sản phẩm.
- [ ] Mở được `ProductListPage.jsx` và `productController.list()` khi bị hỏi code.
- [ ] Bàn giao cho Triều, không đi sang giỏ hàng.
