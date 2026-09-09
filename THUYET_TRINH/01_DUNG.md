# Dũng — Phần 1/4: Từ nhu cầu đến sản phẩm

Thứ tự toàn bài: **Dũng → Triều → Phúc → Hiệp**.

Mỗi bước đọc theo 6 dòng: **Nói · Demo · Thành công · Lỗi/thay đổi · Hỏi đáp · Hàm + đường dẫn**.

## Bước 1 — Mở đầu và trang chủ

- **Nói:** FurneeHome là website bán nội thất, giúp người dùng phổ thông tìm món phù hợp giá và không gian; có cả mua hàng và Phòng thử AI.
- **Demo:** Mở `/` → chỉ logo, thanh điều hướng, nút **Sản phẩm**.
- **Thành công:** Người xem hiểu hệ thống giải quyết việc tìm, chọn và mua nội thất.
- **Lỗi/thay đổi:** Nếu bỏ Phòng thử AI, tìm kiếm, giỏ hàng, đặt hàng và quản trị vẫn hoạt động; AI chỉ hỗ trợ quyết định mua.
- **Hỏi đáp:** *Tại sao giao diện đơn giản?* Vì ưu tiên chữ rõ, ít bước, phù hợp người dùng phổ thông. *Dữ liệu ở đâu?* Catalog vận hành lấy từ MongoDB qua API.
- **Hàm + đường dẫn:** `HomePage()` — `client/src/pages/HomePage.jsx`: nội dung trang chủ; `Header()` — `client/src/components/layout/Header.jsx`: điều hướng theo phiên và quyền; `router` — `client/src/router.jsx`: nối URL với trang.

## Bước 2 — Người dùng và quyền

- **Nói:** Khách chưa đăng nhập được xem, tìm, thêm giỏ tạm và dùng Phòng thử; customer có thêm checkout, lịch sử đơn, hồ sơ và đánh giá; admin quản lý; superadmin (Orchestra Admin) quản lý thêm quyền admin cấp dưới.
- **Demo:** Chỉ thanh điều hướng khi chưa đăng nhập; đăng nhập customer rồi mở giỏ; sau đó mở `/admin` bằng admin.
- **Thành công:** Khách thấy luồng mua; admin thấy các tab quản trị; tab **Quản trị admin** chỉ hiện với `superadmin`.
- **Lỗi/thay đổi:** Nếu khách tự mở `/admin` hoặc tự gọi API, frontend không cấp giao diện và backend trả từ chối quyền.
- **Hỏi đáp:** *Tại sao phải chia quyền?* Để khách không gọi API quản trị và admin thường không tự nâng mình lên quyền cao nhất. *Quyền được kiểm tra ở đâu?* Cả router phía client và middleware phía server.
- **Hàm + đường dẫn:** `AdminRoute()` — `client/src/router.jsx`: chặn giao diện; `authenticate()` và `requireAdmin()` — `server/src/middleware/authMiddleware.js`: xác thực JWT và quyền API.

## Bước 3 — Danh sách sản phẩm

- **Nói:** Khách tìm theo tên, lọc danh mục, sắp xếp giá và chuyển trang; chỉ sản phẩm đang bán, giá hợp lệ mới hiện. Khi vào từ Phòng thử, chọn tối đa 3 món.
- **Demo:** Mở `/products` → gõ từ khóa → chọn danh mục → đổi giá thấp/cao → bấm **Sau** nếu có nhiều trang → mở một thẻ.
- **Thành công:** Số lượng, kết quả và trang thay đổi đúng; có thể quay lại Phòng thử với các ID đã chọn.
- **Lỗi/thay đổi:** Khi mới mở trang, bản chụp `data_import.json` giúp hiện sản phẩm nhanh; kết quả MongoDB tải xong sẽ thay thế ngay. Không có kết quả thì đổi từ khóa/danh mục. Tìm kiếm có ký tự đặc biệt vẫn được xử lý an toàn.
- **Hỏi đáp:** *Giá chính thức lấy từ đâu?* MongoDB; JSON chỉ giúp hiện danh sách ban đầu. *Sản phẩm hết hàng đặt được không?* Không, server kiểm tra lại lúc thêm giỏ và tạo đơn. *Tại sao có phân trang?* Giảm dữ liệu mỗi lần tải; API nhận `page`/`limit`.
- **Hàm + đường dẫn:** `ProductListPage()` — `client/src/pages/ProductListPage.jsx`: gửi điều kiện tìm/lọc/trang; `getPage()` — `client/src/services/productService.js`: gọi API và lấy sản phẩm cùng thông tin trang; `ProductCard()` — `client/src/components/product/ProductCard.jsx`: thẻ sản phẩm; `list()`/`escapeRegex()` — `server/src/controllers/productController.js`: lọc, sắp xếp, phân trang và vô hiệu ký tự regex nguy hiểm; API `GET /api/products`.

## Bước 4 — Liên hệ và bàn giao

- **Nói:** Trang Liên hệ hiển thị địa chỉ 71/5 Huỳnh Tấn Phát, số 0372 208 100, Gmail `furneehome@gmail.com` và Zalo cùng số; báo nội dung là luồng riêng ở chi tiết sản phẩm.
- **Demo:** Mở `/feedback` → bấm thử số điện thoại/Gmail/Zalo; từ một sản phẩm bấm **Báo nội dung** để thấy biểu mẫu gắn đúng sản phẩm.
- **Thành công:** Thông tin liên hệ mở đúng ứng dụng; báo cáo không bị nhầm với liên hệ chung.
- **Lỗi/thay đổi:** Khi đi từ chi tiết sản phẩm, giao diện mang theo ID và tên món để báo đúng nội dung; nếu gửi lỗi thì hiện thông báo để thử lại. Footer vẫn lặp thông tin liên hệ.
- **Hỏi đáp:** *Báo xấu ở đâu?* `POST /api/feedback`, còn giao diện bắt đầu từ `/feedback`. *Tại sao không gộp hai biểu mẫu?* Liên hệ là thông tin cửa hàng; báo cáo cần gắn sản phẩm để admin xử lý.
- **Hàm + đường dẫn:** `FeedbackPage()` — `client/src/pages/FeedbackPage.jsx`: liên hệ và báo nội dung; `Footer()` — `client/src/components/layout/Footer.jsx`: thông tin cuối trang; `create()` — `server/src/controllers/feedbackController.js`: lưu báo cáo.

**Câu bàn giao cho Triều:** “Khách đã tìm được sản phẩm phù hợp. Tiếp theo, Triều sẽ trình bày chi tiết sản phẩm, đánh giá, giỏ hàng và hoàn tất mua hàng.”

## Phản biện nhanh cuối phần

1. **FurneeHome khác trang bán hàng thường ở đâu?** Có Phòng thử AI giúp hình dung sản phẩm trong ảnh phòng thật; mua hàng vẫn là luồng chính.
2. **Tại sao khách chưa đăng nhập vẫn thêm giỏ được?** Để trải nghiệm mua không bị ngắt; giỏ tạm nằm ở trình duyệt và được đồng bộ sau khi đăng nhập.
3. **Tại sao danh sách chỉ tải 12 món?** Server dùng `page`, `limit`, `skip`, `limit` để giảm dữ liệu và thời gian tải.
4. **Nếu tìm `(a+)+$` thì sao?** `escapeRegex()` biến ký tự regex thành văn bản thường, tránh lỗi truy vấn hoặc làm server xử lý quá lâu.
5. **Nếu Admin ngừng bán một món?** Khách không còn thấy món đó; Admin vẫn thấy để mở bán lại và lịch sử đơn cũ không mất.
6. **Danh mục lấy ở đâu?** `list()` trả `categories` từ MongoDB cùng dữ liệu phân trang; giao diện không cần tải toàn bộ catalog để tạo bộ lọc.

### Tự kiểm tra

- Nói được đối tượng, vấn đề và 4 nhóm quyền.
- Demo được `/products`, tìm kiếm, lọc, phân trang và mở chi tiết.
- Nhớ: MongoDB là nguồn vận hành; JSON chỉ là bản chụp hiển thị nhanh và không ghi ngược vào MongoDB.
- Nhớ câu bàn giao.
