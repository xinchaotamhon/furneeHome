# START HERE — FurneeHome 🛋️✨

> **Dành cho AI Agent & lập trình viên:** đọc file này trước khi sửa code. Đây là bộ nhớ ổn định của dự án; trạng thái tạm thời, log thử nghiệm và các lỗi Room Studio chưa được mô tả không nên ghi vào đây.

## 1. Bản chất và ranh giới dự án

FurneeHome là website giúp học sinh, sinh viên và người ở phòng nhỏ xem trước đồ nội thất trên ảnh phòng thật bằng AI. Backend ưu tiên provider/model mạnh đã cấu hình và tự chuyển sang provider tiếp theo khi dịch vụ trước hết quota hoặc tạm lỗi.

- Đây **không phải** sàn thương mại điện tử: không giỏ hàng, checkout, thanh toán hay quản lý đơn hàng.
- Không dùng Three.js/WebGL hay mô hình 3D runtime. Phần camera là phép tính phối cảnh vanilla JavaScript để hỗ trợ ảnh 2D.
- Giao diện dùng React + Vite + CSS thuần; backend dùng Express + Mongoose theo Direct MVC.
- Sản phẩm ưng ý được mở qua link nguồn/Shopee; giá Shopee không được xem là dữ liệu cố định.

## 2. Hợp đồng chức năng Room Studio

Room Studio phải được hiểu theo ba bước người dùng:

1. **Chọn đúng 4 điểm sàn:** người dùng tải ảnh và chấm theo thứ tự **trước trái → sau trái → sau phải → trước phải**. Không chấm trần hoặc tường; 6 hay 12 điểm không làm kết quả tốt hơn vì [cameraSolver.js](client/src/utils/cameraSolver.js) chỉ dùng bốn điểm đầu để tạo hai cặp đường phối cảnh. File này là vanilla JavaScript có code lấy cảm hứng từ repo tham khảo [fSpy_3d-matching/](fSpy_3d-matching/); repo tham khảo không phải dependency bắt buộc của frontend.
2. **Đặt sản phẩm:** người dùng tìm/lọc sản phẩm trong danh sách 6 món mỗi trang, rồi bấm hoặc kéo nhiều sản phẩm đến các vị trí trong phòng. Mỗi món giữ vị trí, kích thước, góc xoay, trạng thái lật và thứ tự lớp. Nút gợi ý ngẫu nhiên chọn tối đa 3 món thuộc các danh mục khác nhau để tạo bố cục khởi đầu.
3. **Xem thử:** ngay khi thả sản phẩm hoặc kéo xong, bản ghép tại chỗ hiển thị tức thì. Frontend tạo một ảnh hướng dẫn chứa **toàn bộ sản phẩm đang có trong phòng**, mask hợp nhất và ảnh tham chiếu ghép, rồi gửi đến backend. Người dùng có thể thêm mô tả ngắn tối đa 300 ký tự. [cloudflareImageService.js](server/src/services/cloudflareImageService.js) giữ tên cũ để tránh sửa lan rộng nhưng hiện điều phối chuỗi Pollinations → Cloudflare → Hugging Face theo các khóa có trong `.env`; thứ tự có thể đổi bằng cấu hình. Spinner và ảnh AI phải hiện trong chính khung ảnh phòng; ảnh dùng `contain`, không crop. AI lỗi không được làm mất bố cục tại chỗ; người dùng có thể thử lại.

Collection dùng trường chuẩn `resultImage` và lưu cả `placements`, `markedCorners`, `userPrompt`, model đã dùng và tọa độ chuẩn hóa. Mẫu công khai có page riêng và có thể được sao chép thành bản riêng để chỉnh tiếp.

**Trạng thái cần giữ:** không tự ý đổi thứ tự bốn điểm, crop ảnh, làm mất bản Canvas dự phòng hoặc bỏ chuỗi provider hiện có. Khi sửa Room Studio, phải kiểm tra lại cả ba bước, mở lại mẫu đã lưu và giao diện mobile.

## 3. Đăng nhập và Admin là backend thật

- Modal [LoginModal.jsx](client/src/components/auth/LoginModal.jsx) gọi `POST /api/auth/login` hoặc `POST /api/auth/register`.
- Backend [authController.js](server/src/controllers/authController.js) hash mật khẩu đăng ký bằng bcryptjs và trả JWT 7 ngày cùng thông tin user.
- Frontend lưu token ở khóa `accessToken`; [apiClient.js](client/src/services/apiClient.js) tự gắn Bearer token.
- Các API tạo/sửa/xóa sản phẩm ở [productRoutes.js](server/src/routes/productRoutes.js) bắt buộc JWT và role Admin. Route backend mới là lớp bảo vệ thật; kiểm tra role ở router chỉ là phản hồi UX.
- Tài khoản Admin phải là user thật trong MongoDB. Chỉ khi cần tạo/cập nhật bằng biến môi trường mới dùng `ADMIN_EMAIL`, `ADMIN_PASSWORD` rồi chạy `cd server` và `npm run seed`. Không hard-code tài khoản/mật khẩu và không tự tạo tài khoản giả trong localStorage.
- Local giữ nguyên startup contract hiện có: `JWT_SECRET` không bắt buộc để chạy bằng `.env` hiện tại. Khi deploy nên cấu hình secret riêng; không đọc, in hoặc commit giá trị thật của `.env`.

## 4. Dữ liệu sản phẩm và giá

- Dataset hiện tại có **57 sản phẩm**; 57 URL Shopee và 57 PNG local đã qua kiểm tra, không trùng ID/slug/URL. Hiện toàn bộ `price` vẫn là `0` và danh mục còn lệch nhiều về Kệ sách; khi thêm URL mới phải lưu giá tham khảo và ưu tiên các danh mục còn thiếu.
- [ProductContext.jsx](client/src/context/ProductContext.jsx) ưu tiên API, chỉ dùng `client/public/data_import/data_import.json` làm dữ liệu dự phòng khi backend chưa trả dữ liệu.
- Admin dùng [AdminPage.jsx](client/src/pages/AdminPage.jsx) để CRUD qua API; không coi localStorage là nguồn ghi dữ liệu chính.
- Giá cào từ Shopee có thể thay đổi. Hiện `price` chỉ là giá tham khảo/affiliate và `sourceUrl` là link mở sang nguồn. Chưa thêm cập nhật giá tự động cho đến khi có tool đáng tin cậy để Admin chạy hằng ngày hoặc bấm cập nhật và kiểm tra được kết quả.

## 5. Nguyên tắc code đơn giản

Viết code đơn giản, tuần tự và dễ hiểu như cách tổ chức trong thư mục local `pretest2/` nếu thư mục này có trong workspace, nhưng **không copy code** và không copy các quyết định bảo mật yếu của bài mẫu.

Giữ các nguyên tắc:

- route gọi controller, controller gọi model trực tiếp khi CRUD đơn giản;
- mỗi hàm làm một việc, tên biến rõ, ưu tiên luồng tuần tự dễ đọc;
- chỉ tạo service riêng khi có tích hợp bên ngoài hoặc logic dùng lại thật sự, như chuỗi provider tạo ảnh;
- comment giải thích mục đích và dữ liệu vào/ra, không comment lại câu lệnh hiển nhiên;
- không thêm Tailwind/Bootstrap/Three.js, không thêm tầng abstraction chỉ để tách file;
- với hình học/canvas, chấp nhận file dài hơn vì đó là thuật toán; ưu tiên test và chú thích rõ thay vì cắt nhỏ mù quáng.

Bản đồ từng file cốt lõi nằm ở [README.md](README.md), mục 7.

## 6. Ranh giới phần trình bày đồ án

Phần cốt lõi cần tập trung khi bảo vệ:

- `client/`: giao diện, Room Studio, Collection, auth modal;
- `server/`: API auth, product, preview và chuỗi provider tạo ảnh;
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

### 7.1. Cách AI trao đổi khi yêu cầu chưa rõ

- Ở phản hồi đầu tiên, nói ngắn gọn AI hiểu mục tiêu và phạm vi công việc là gì.
- Trước thay đổi có hậu quả, nếu điểm chưa rõ có thể làm đổi phạm vi, UX, dữ liệu, bảo mật, deploy, Git hoặc tài liệu review, hãy hỏi **một câu trọng tâm** rồi mới làm; không tự đoán ý người dùng.
- Không hỏi lại theo thủ tục nếu câu trả lời đã rõ trong code, README, START_HERE hoặc bằng chứng local. Hãy đọc bằng chứng trước rồi chỉ hỏi phần còn thiếu thật sự.
- Có thể đọc được file hoặc dùng được tool không có nghĩa là đã được phép push, deploy, dùng tài khoản, gửi dữ liệu ra ngoài hoặc làm lộ secret. Các hành động đó cần đúng phạm vi người dùng đã cho phép.

### 7.2. Chủ sở hữu thông tin

| Loại thông tin | Nguồn chính |
|---|---|
| Mục đích dự án, ranh giới ổn định và cách AI cộng tác | `START_HERE.md` |
| Cách nhóm cài đặt, chạy, dùng Git và deploy | `README.md` |
| Hành vi hệ thống đang chạy | code, route, model và cấu hình không chứa giá trị secret |
| Nội dung trình bày đồ án | file Review `.docx` mới nhất được người dùng chỉ định |
| Token, mật khẩu và giá trị môi trường thật | `.env` hoặc nơi lưu secret riêng; không ghi vào tài liệu và không commit |

File Review là tài liệu trình bày được đối chiếu từ hệ thống, không phải nguồn sự thật runtime và không phải nhật ký cho mọi thay đổi nhỏ. Chỉ cập nhật Review khi người dùng yêu cầu hoặc khi thay đổi đã được cho phép làm ảnh hưởng đến nội dung được trình bày như phạm vi, trang/route, luồng người dùng, chức năng, cấu trúc dữ liệu, yêu cầu thiết bị/trình duyệt, sơ đồ, wireframe hoặc phân công. Refactor, sửa comment, di chuyển file, cài lại dependency và lỗi nhỏ không đổi hành vi không bắt buộc sửa Review.

Trước khi sửa Review, đối chiếu với code và tài liệu nguồn chính; nếu hai nguồn mâu thuẫn thì báo rõ thay vì tự hòa giải. Chưa bổ sung phần giải thích code cụ thể của Review 3 cho đến khi project gần hoàn thành và người dùng yêu cầu.

## 8. Tiêu chí hoàn thành

- `npm run build` trong `client/` thành công.
- Backend có thể khởi động bằng `.env` hiện tại của nhóm với `MONGO_URI` và Cloudflare. Pollinations/Hugging Face là fallback tùy chọn; chỉ bật provider khi `.env` có đủ khóa tương ứng.
- Login/register và Admin CRUD dùng API thật, không dùng demo local.
- 57 sản phẩm và link nguồn không bị xóa nhầm.
- Room Studio chỉ dùng đúng 4 điểm sàn theo thứ tự đã ghi, hiển thị trọn ảnh bằng `contain`, và đặt spinner/kết quả AI trong cùng khung ảnh.
- Collection đọc được dữ liệu cũ; dữ liệu mới dùng `resultImage`, `placements`, `markedCorners`, `userPrompt` và tọa độ chuẩn hóa từ 0 đến 1.
- Người đăng nhập có thể đồng bộ thiết kế vào MongoDB, chủ động công khai/đặt riêng tư và sao chép một mẫu công khai để dùng lại. Khách vẫn có thể lưu trên thiết bị.
- README/START_HERE không chứa secret thật và liên kết tương đối trong repo hoạt động.
