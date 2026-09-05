# START HERE — FurneeHome 🛋️✨

> **Dành cho AI Agent & lập trình viên:** đọc file này trước khi sửa code. Đây là bộ nhớ ổn định của dự án; trạng thái tạm thời, log thử nghiệm và các lỗi Room Studio chưa được mô tả không nên ghi vào đây.

## 1. Bản chất và ranh giới dự án

FurneeHome là website giúp học sinh, sinh viên và người ở phòng nhỏ xem trước đồ nội thất trên ảnh phòng thật bằng AI. Backend ưu tiên provider/model mạnh đã cấu hình và tự chuyển sang provider tiếp theo khi dịch vụ trước hết quota hoặc tạm lỗi.

- Đây **không phải** sàn thương mại điện tử: không giỏ hàng, checkout, thanh toán hay quản lý đơn hàng.
- Không dùng Three.js/WebGL hay mô hình 3D runtime. Phần camera là phép tính phối cảnh vanilla JavaScript để hỗ trợ ảnh 2D.
- Giao diện dùng React + Vite + CSS thuần; backend dùng Express + Mongoose theo Direct MVC.
- Sản phẩm ưng ý được mở qua link nguồn/Shopee; giá Shopee không được xem là dữ liệu cố định.

## 2. Hợp đồng chức năng Room Studio

Room Studio là một workspace vừa màn hình, không có footer hay bắt người dùng cuộn xuống để thấy ảnh kết quả. Công cụ chia tab, sản phẩm phân trang; ảnh phải hiển thị trọn vẹn và tọa độ kéo/chấm phải khớp vùng ảnh thật.

1. **Tải ảnh rồi chọn cách thử:** `Gợi ý AI` là nút hành động nổi bật trên thanh công cụ, không phải một tab có nội dung bên dưới. Bấm nút sẽ chọn ngẫu nhiên tối đa ba sản phẩm có ảnh tham chiếu thật, ưu tiên món gọn và khác công năng, rồi gửi ảnh phòng cùng từng ảnh sản phẩm riêng 511×511 theo đúng thứ tự product facts bằng `mode: inspiration`. Sản phẩm số 1 phải xuất hiện; sản phẩm 2–3 tùy không gian. Kết quả có nút nổi mở danh sách ba sản phẩm đã chọn, và danh sách này được giữ khi lưu hoặc mở lại collection. Không yêu cầu người dùng đặt vị trí hay chấm sàn.
2. **Tự đặt sản phẩm:** tìm/lọc trong danh sách phân trang, bấm một món để tạo placement ngay ở giữa/đáy ảnh. Placement được chọn có khung, kéo để di chuyển, kéo nút góc để phóng/thu, toolbar cạnh món để xoay/lật/đổi lớp và nút xóa nhỏ. Không tự gọi AI khi chọn, kéo hoặc resize; người dùng bấm **Tạo ảnh** khi sẵn sàng. **Tỷ lệ thật** là tùy chọn: chọn 60/80/120 cm hoặc nhập chiều dài, đặt đúng hai đầu của một cạnh/vật có số đo thật gần món, rồi dùng chiều rộng sản phẩm từ dữ liệu hoặc do người dùng nhập để căn tỷ lệ. `markedCorners` vẫn đọc/ghi để dữ liệu cũ không vỡ nhưng không còn UI căn sàn.
3. **Khai báo điều AI cần giữ:** form nhu cầu dùng các trường `purpose`, `style`, `keepClear`, `avoid`; dữ liệu từng món gồm `usageType`, `placementSurface`, kích thước cm nếu Shopee ghi rõ đơn vị và `aiDescription` được lấy hoặc suy ra tự động từ dữ liệu sản phẩm, không bắt người dùng nhập ở Room Studio. Không bịa kích thước khi thiếu dữ liệu. Thứ tự ưu tiên tạo ảnh là **kiến trúc phòng và đúng sản phẩm/công năng → vị trí, tỷ lệ, layer → phong cách**. Ví dụ bàn ngồi bệt phải giữ chân ngắn, mặt bàn thấp và không tự thêm ghế cao.
4. **Xem và lưu:** bản ghép Canvas xuất hiện trước, sau đó gửi ảnh gốc, guide **toàn bộ scene**, mask hợp nhất và sheet tham chiếu sản phẩm đến AI (`mode: placement`). Spinner và ảnh kết quả nằm ngay trong khung phòng; có thể quay lại bố cục. AI lỗi không được xóa scene hay kết quả trước. Nút Gợi ý AI tạo một kết quả `inspiration` riêng và không sửa danh sách món người dùng đang đặt thủ công.

[cloudflareImageService.js](server/src/services/cloudflareImageService.js) giữ tên cũ nhưng điều phối Pollinations → Cloudflare → Hugging Face theo khóa/cấu hình. Model không hỗ trợ hoặc bị giới hạn riêng thì thử model tiếp theo; lỗi khóa/rate limit toàn provider thì sang provider sau. Không fallback để vượt qua từ chối nội dung. Chỉ dùng quota có sẵn; không đảm bảo miễn phí vô hạn, dưới 1 giây hay bảo toàn kiến trúc tuyệt đối bởi model bên ngoài.

Collection lưu `designMode` (`placement`/`inspiration`), `resultImage`, ảnh gốc, `placements` cùng product facts, `scaleReference { points, lengthCm }`, `markedCorners` legacy, `designBrief`, `userPrompt`, model và thời gian tạo. Tọa độ lưu chuẩn hóa 0–1. Ý tưởng AI có thể có `placements: []`; không tạo sản phẩm giả. Mẫu công khai có page riêng; chỉ người đăng nhập mới được công khai hoặc dùng lại, và reuse luôn tạo một bản riêng tư mới.

Khách chưa đăng nhập được **một lần tạo ảnh thành công** theo IP đã băm HMAC. Request đang xử lý được giữ tạm để tránh gọi song song; nếu mọi provider lỗi thì lượt được trả lại. Người đã đăng nhập không dùng giới hạn khách. Đây là giới hạn dùng thử đơn giản: nhiều người chung Wi-Fi/NAT có thể dùng chung một IP.

**Trạng thái cần giữ:** không crop ảnh, không ép chấm góc, không mất bản ghép khi AI lỗi, không mất thông số khi lưu lên tài khoản. `phongtro.jpg` chỉ là một ảnh kiểm thử, không phải cấu trúc phòng mặc định. Gợi ý AI phải thích nghi với ảnh đã đầy đồ, phòng hẹp hoặc không đều, góc rộng, ít sàn, gác/bếp/WC/cầu thang; giữ nguyên kiến trúc, thiết bị lớn, vật cản và lối đi, nhưng có thể bỏ người/thú cưng và dọn đồ nhỏ trong ảnh thiết kế để đặt món chính. Khi sửa phải kiểm tra nhiều loại ảnh, cả hai chế độ, mở lại collection và màn hình nhỏ.

## 3. Đăng nhập và Admin là backend thật

- Modal [LoginModal.jsx](client/src/components/auth/LoginModal.jsx) gọi `POST /api/auth/login` hoặc `POST /api/auth/register`.
- Backend [authController.js](server/src/controllers/authController.js) hash mật khẩu đăng ký bằng bcryptjs và trả JWT 7 ngày cùng thông tin user.
- Frontend lưu token ở khóa `accessToken`; [apiClient.js](client/src/services/apiClient.js) tự gắn Bearer token.
- Các API tạo/sửa/xóa sản phẩm ở [productRoutes.js](server/src/routes/productRoutes.js) bắt buộc JWT và role Admin. Route backend mới là lớp bảo vệ thật; kiểm tra role ở router chỉ là phản hồi UX.
- Tài khoản Admin phải là user thật trong MongoDB. Script `bootstrapLocalAdmin.js` chỉ tạo tài khoản `localOnly`, từ chối production và không tự chạy khi khởi động. Trên bản deploy, dùng `ADMIN_USERNAME`, `ADMIN_EMAIL`, mật khẩu mạnh trong secret rồi chạy seed; không dùng mật khẩu demo ngắn cho production.
- Import URL Shopee chỉ chạy trên máy local: backend kiểm tra request loopback và không cho import khi chạy production. Backend đọc dữ liệu công khai từ API/trang Shopee, tự trích xuất kích thước khi có đơn vị rõ ràng và suy ra công năng bằng quy tắc cố định. Nếu Shopee chặn, hệ thống vẫn lưu URL cùng shop ID/item ID để sản phẩm xuất hiện trong danh sách và chờ Admin thêm ảnh, nhưng không bịa giá hay metadata còn thiếu. Dữ liệu import local được lưu vào MongoDB và đồng bộ sang JSON local; các thao tác Admin khác vẫn theo quyền của route hiện tại.
- Local giữ nguyên startup contract hiện có: `JWT_SECRET` không bắt buộc để chạy bằng `.env` hiện tại. Render phải có `NODE_ENV=production` và `JWT_SECRET`; backend cũng coi `RENDER=true` là production để không dùng fallback local nếu cấu hình thiếu. Không đọc, in hoặc commit giá trị thật của `.env`.

## 4. Dữ liệu sản phẩm và giá

- Dataset hiện tại có **70 sản phẩm**, 70 URL Shopee và 70 ID/slug riêng; toàn bộ `price` vẫn là `0`. Có 58 ảnh PNG local và 12 sản phẩm đang chờ Admin thêm ảnh. Giao diện phải hiện placeholder rõ ràng, đưa món có ảnh lên trước và không cho gửi món thiếu ảnh tham chiếu sang AI.
- [ProductContext.jsx](client/src/context/ProductContext.jsx) ưu tiên API, chỉ dùng `client/public/data_import/data_import.json` làm dữ liệu dự phòng khi backend chưa trả dữ liệu.
- Admin dùng [AdminPage.jsx](client/src/pages/AdminPage.jsx) để CRUD qua API, đọc shop ID/item ID từ URL Shopee, thêm tối đa 6 ảnh và tải JSON mới nhất. Riêng import URL Shopee chỉ chạy trên local và được lưu vào MongoDB cùng JSON local. Với URL `...i.<shopId>.<itemId>`, ảnh thêm ở local tự lưu đúng định dạng quản trị viên chọn: PNG lưu `/images/products/<itemId>.png` (ưu tiên ảnh tách nền trong suốt), JPG lưu `/images/products/<itemId>.jpg`, WebP lưu `/images/products/<itemId>.webp`; cần commit ảnh và JSON này khi cập nhật repo.
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

Tham khảo UX đã chọn từ CLOVER: [React Bits](https://github.com/DavidHDev/react-bits) cho hiệu ứng nhẹ, [Open Design](https://github.com/nexu-io/open-design) cho cách tổ chức vùng làm việc và [React Flow](https://reactflow.dev/examples/layout/dagre) cho cây học. Chỉ lấy ý tưởng, không thêm các repo/framework này làm dependency. `fourgether/` là cây học theo luồng riêng, dùng font hệ thống hỗ trợ tiếng Việt; tiến độ chỉ giữ trong phiên, không lưu bộ nhớ trình duyệt.

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
- 70 sản phẩm và link nguồn không bị xóa nhầm; 58 ảnh local hiện có vẫn phải đọc được, 12 món chờ ảnh không được hiện như ảnh hỏng hoặc gửi sang AI.
- Room Studio không bắt buộc đặt mốc tỷ lệ; nếu dùng chỉ có 2 điểm + chiều dài cm, hiển thị đoạn và nhãn ngay trên ảnh. Đo cả page và panel để không giấu nút ngoài màn hình; ảnh, spinner, kết quả cùng khung, không crop.
- Collection đọc được dữ liệu cũ; dữ liệu mới dùng `designMode`, `resultImage`, `placements` cùng product facts, `scaleReference`, `markedCorners` legacy, `designBrief`, `userPrompt` và tọa độ chuẩn hóa từ 0 đến 1.
- Người đăng nhập có thể đồng bộ thiết kế vào MongoDB, chủ động công khai/đặt riêng tư và sao chép một mẫu công khai để dùng lại. Khách vẫn có thể lưu trên thiết bị.
- Khách chỉ tiêu một lượt tạo ảnh sau khi provider thành công; request lỗi trả lại lượt. IP thô không được lưu. Khi deploy sau proxy phải cấu hình `TRUST_PROXY` đúng topology.
- README/START_HERE không chứa secret thật và liên kết tương đối trong repo hoạt động.
- Chạy `node --test tools/smoke-room.cjs tools/smoke-admin.cjs`: kiểm tra hai chế độ ảnh, prompt/fallback, quota khách, lưu/dùng lại collection, auth/Admin, ảnh và JSON bằng mock; không tiêu quota AI thật. Đây không phải bằng chứng chất lượng ảnh provider; phải phân biệt với kiểm thử giao diện và một lần gọi provider có chủ đích.
