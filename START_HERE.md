# START HERE — FurneeHome 🛋️✨

> **Dành cho AI Agent & lập trình viên:** đọc file này trước khi sửa code. Đây là bộ nhớ ổn định của dự án; trạng thái tạm thời, log thử nghiệm và các lỗi Room Studio chưa được mô tả không nên ghi vào đây.

## 1. Bản chất và ranh giới dự án

FurneeHome là website giúp học sinh, sinh viên và người ở phòng nhỏ xem trước đồ nội thất trên ảnh phòng thật bằng AI Cloudflare Workers AI.

- Đây **không phải** sàn thương mại điện tử: không giỏ hàng, checkout, thanh toán hay quản lý đơn hàng.
- Không dùng Three.js/WebGL hay mô hình 3D runtime. Phần camera là phép tính phối cảnh vanilla JavaScript để hỗ trợ ảnh 2D.
- Giao diện dùng React + Vite + CSS thuần; backend dùng Express + Mongoose theo Direct MVC.
- Sản phẩm ưng ý được mở qua link nguồn/Shopee; giá Shopee không được xem là dữ liệu cố định.

## 2. Hợp đồng chức năng Room Studio

Room Studio phải được hiểu theo ba bước người dùng:

1. **Chọn các điểm trên ảnh phòng:** người dùng tải ảnh và bấm các điểm góc chân tường/mép sàn. Các điểm này là dữ liệu hình học để [cameraSolver.js](client/src/utils/cameraSolver.js) tính điểm tụ, tiêu cự, hướng camera và phối cảnh. File này là bản vanilla JavaScript có code lấy cảm hứng từ repo tham khảo [fSpy_3d-matching/](fSpy_3d-matching/); repo tham khảo không phải dependency bắt buộc của frontend.
2. **Đặt sản phẩm:** người dùng chọn sản phẩm rồi chọn hoặc kéo đến vị trí muốn đặt trong phòng.
3. **Xem thử:** khi bấm nút xem thử, frontend chuẩn bị ảnh phòng, ảnh hướng dẫn, ảnh sản phẩm và vị trí; [roomPreviewService.js](client/src/services/roomPreviewService.js) gửi payload đến backend. Backend kiểm tra dữ liệu, tạo prompt theo vị trí/sản phẩm và [cloudflareImageService.js](server/src/services/cloudflareImageService.js) gửi ảnh + prompt đến Cloudflare Workers AI. Kết quả được ghép lại và lưu vào Collection bằng trường chuẩn `resultImage`.

Ảnh minh họa người dùng cung cấp có các điểm màu được đánh số và nối thành đường bao. Hãy xem đó là tham chiếu UX quan trọng cho bước 1.

**Trạng thái cần giữ:** người dùng sẽ mô tả thêm các lỗi Room Studio sau. Không tự ý thay đổi thuật toán camera, cách chọn điểm, crop, prompt, composite hoặc kết quả fallback trước khi có mô tả lỗi, ảnh đầu vào và kết quả mong muốn cụ thể. Khi sửa, phải kiểm tra lại cả ba bước và không làm mất luồng Cloudflare hiện có.

## 3. Đăng nhập và Admin là backend thật

- Modal [LoginModal.jsx](client/src/components/auth/LoginModal.jsx) gọi `POST /api/auth/login` hoặc `POST /api/auth/register`.
- Backend [authController.js](server/src/controllers/authController.js) hash mật khẩu đăng ký bằng bcryptjs và trả JWT 7 ngày cùng thông tin user.
- Frontend lưu token ở khóa `accessToken`; [apiClient.js](client/src/services/apiClient.js) tự gắn Bearer token.
- Các API tạo/sửa/xóa sản phẩm ở [productRoutes.js](server/src/routes/productRoutes.js) bắt buộc JWT và role Admin. Route backend mới là lớp bảo vệ thật; kiểm tra role ở router chỉ là phản hồi UX.
- Tài khoản Admin phải là user thật trong MongoDB. Chỉ khi cần tạo/cập nhật bằng biến môi trường mới dùng `ADMIN_EMAIL`, `ADMIN_PASSWORD` rồi chạy `cd server` và `npm run seed`. Không hard-code tài khoản/mật khẩu và không tự tạo tài khoản giả trong localStorage.
- Local giữ nguyên startup contract hiện có: `JWT_SECRET` không bắt buộc để chạy bằng `.env` hiện tại. Khi deploy nên cấu hình secret riêng; không đọc, in hoặc commit giá trị thật của `.env`.

## 4. Dữ liệu sản phẩm và giá

- Dataset hiện tại có **50 sản phẩm**, ảnh local tương ứng và các danh mục đã chuẩn hóa.
- [ProductContext.jsx](client/src/context/ProductContext.jsx) ưu tiên API, chỉ dùng `client/public/data_import/data_import.json` làm dữ liệu dự phòng khi backend chưa trả dữ liệu.
- Admin dùng [AdminPage.jsx](client/src/pages/AdminPage.jsx) để CRUD qua API; không coi localStorage là nguồn ghi dữ liệu chính.
- Giá cào từ Shopee có thể thay đổi. Hiện `price` chỉ là giá tham khảo/affiliate và `sourceUrl` là link mở sang nguồn. Chưa thêm cập nhật giá tự động cho đến khi có tool đáng tin cậy để Admin chạy hằng ngày hoặc bấm cập nhật và kiểm tra được kết quả.

## 5. Nguyên tắc code đơn giản

Tham khảo cách tổ chức dễ đọc của `D:\code\fptaptech\term1\5.SDN\pretest2`, nhưng **không copy code** và không copy các quyết định bảo mật yếu của bài mẫu.

Giữ các nguyên tắc:

- route gọi controller, controller gọi model trực tiếp khi CRUD đơn giản;
- mỗi hàm làm một việc, tên biến rõ, ưu tiên luồng tuần tự dễ đọc;
- chỉ tạo service riêng khi có tích hợp bên ngoài hoặc logic dùng lại thật sự, như Cloudflare;
- comment giải thích mục đích và dữ liệu vào/ra, không comment lại câu lệnh hiển nhiên;
- không thêm Tailwind/Bootstrap/Three.js, không thêm tầng abstraction chỉ để tách file;
- với hình học/canvas, chấp nhận file dài hơn vì đó là thuật toán; ưu tiên test và chú thích rõ thay vì cắt nhỏ mù quáng.

Bản đồ từng file cốt lõi nằm ở [README.md](README.md), mục 7.

## 6. Ranh giới phần trình bày đồ án

Phần cốt lõi cần tập trung khi bảo vệ:

- `client/`: giao diện, Room Studio, Collection, auth modal;
- `server/`: API auth, product, preview và Cloudflare;
- `tools/`: import/sync dữ liệu;
- `client/public/data_import/` và ảnh sản phẩm cần thiết;
- README, START_HERE và tài liệu review.

`fSpy_3d-matching/`, `fourgether/`, `artifacts/` và các folder phụ đạo/repo tham khảo là tài nguyên làm việc hoặc học tập. Không xem chúng là dependency để website chạy, không đưa toàn bộ vào phần giải thích kiến trúc lõi nếu không được hỏi.

## 7. Quy trình trước khi sửa

1. Đọc [README.md](README.md) mục 7 và file liên quan trực tiếp.
2. Kiểm tra `git status`, giữ nguyên thay đổi có sẵn của người dùng.
3. Với code, ưu tiên tìm theo knowledge graph; chỉ dùng tìm chuỗi/file cho config, docs, literal và dữ liệu.
4. Xác định mục tiêu, file được phép sửa, hành vi phải giữ và cách rollback trước khi đổi.
5. Sau khi sửa: chạy build frontend, kiểm tra cú pháp backend, kiểm tra diff và cập nhật tài liệu nếu đổi hợp đồng.

## 8. Tiêu chí hoàn thành

- `npm run build` trong `client/` thành công.
- Backend có thể khởi động bằng `.env` hiện tại của nhóm với `MONGO_URI` và các biến Cloudflare cần cho preview; không tự thêm biến mới nếu chưa có lý do và chưa thống nhất.
- Login/register và Admin CRUD dùng API thật, không dùng demo local.
- 50 sản phẩm và link nguồn không bị xóa nhầm.
- Collection đọc được dữ liệu cũ và dữ liệu mới dùng `resultImage`.
- README/START_HERE không chứa secret thật và liên kết tương đối trong repo hoạt động.
