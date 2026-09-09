# Hiệp — Phần 4/4: Kiến trúc, dữ liệu và Phòng thử AI

Hiệp nói cuối. Mỗi bước: **Nói · Demo · Thành công · Lỗi/thay đổi · Hỏi đáp · Hàm + đường dẫn**.

## Bước 1 — Kiến trúc tổng thể

- **Nói:** Luồng đi: `React → Axios/fetch → Express route → Controller → Mongoose → MongoDB Atlas`; luồng về: `MongoDB → Controller trả JSON → React cập nhật giao diện`. Frontend hiển thị; backend giữ quyền, giá, tồn kho và nghiệp vụ.
- **Demo:** Mở website → tạo một thao tác tìm sản phẩm hoặc thêm giỏ; nếu có thể chỉ Network/API và kết quả JSON.
- **Thành công:** Một request đi qua đúng client, API, controller, database rồi cập nhật giao diện.
- **Lỗi/thay đổi:** Nếu MongoDB hoặc API chậm, giao diện báo đang tải/lỗi; không để React truy cập MongoDB trực tiếp và không dùng dữ liệu cũ để che lỗi.
- **Hỏi đáp:** *Tại sao không nối React thẳng MongoDB?* Sẽ lộ chuỗi kết nối và bỏ qua kiểm tra quyền/giá/tồn kho. *JSON API có dạng gì?* `success`, `message`, `data` và pagination khi danh sách có phân trang.
- **Hàm + đường dẫn:** `app` — `server/src/app.js`: Express, CORS, JSON limit và `/api`; `router` — `server/src/routes/index.js`: nối route; `connectDatabase()` — `server/src/config/db.js`: kết nối Atlas; `getPage()`/`getById()` — `client/src/services/productService.js`: tải theo trang hoặc ID; `ProductProvider()`/`refreshProducts()` — `client/src/context/ProductContext.jsx`: chỉ tải toàn catalog khi Admin hoặc Phòng thử cần.

## Bước 2 — MongoDB và bản chụp JSON

- **Nói:** Collection vận hành gồm `users`, `products`, `categories`, `carts`, `orders`, `reviews`, `feedbacks`. MongoDB là nguồn thật cho mọi truy vấn và thay đổi. `data_import.json` chỉ là bản chụp để danh sách hiện nhanh trước khi API trả về.
- **Demo:** Mở trang Sản phẩm để thấy bản chụp hiện trước rồi dữ liệu API thay thế; vào quản trị sửa một món, tải lại để chứng minh dữ liệu chính thức lấy từ MongoDB; khi chạy localhost bấm **Đồng bộ JSON**.
- **Thành công:** Nút đồng bộ sao chép đúng 101 sản phẩm một chiều từ MongoDB sang JSON, không ghi ngược nên không làm mất tên, giá, tồn kho hoặc ảnh đã sửa. Nếu MongoDB đã có dữ liệu thì không cần chạy seed.
- **Lỗi/thay đổi:** Sửa JSON không thay đổi MongoDB. Trên website deploy, CRUD vẫn cập nhật MongoDB; muốn cập nhật bản chụp cho lần build sau thì đồng bộ ở localhost, commit JSON rồi rebuild Cloudflare.
- **Hỏi đáp:** *Quan hệ NoSQL ở đâu?* Mongoose dùng ObjectId; `orderItems` nhúng tên/giá để giữ lịch sử. *`roomdesigns` có dùng không?* Không dùng trong bản chốt, không trình bày Bộ sưu tập; để lại collection cũ không ảnh hưởng hệ thống và chỉ xóa khi đã sao lưu.
- **Hàm + đường dẫn:** `list()` — `server/src/controllers/productController.js`: truy vấn MongoDB; `buildJsonProducts()`/`syncJson()` — cùng file: xuất bản chụp một chiều; `ProductListPage()` — `client/src/pages/ProductListPage.jsx`: hiện JSON trước rồi thay bằng kết quả MongoDB; API `GET /api/products`, `POST /api/products/sync-json`.

## Bước 3 — Tính toàn vẹn đơn và đánh giá

- **Nói:** Khi tạo đơn, server đọc lại sản phẩm, cập nhật kho có điều kiện, chụp tên/giá/ảnh vào `orderItems`, tính phí theo tỉnh rồi tạo `Pending`. Khi hủy, hoàn kho có cờ chống lặp.
- **Demo:** Dùng checkout tạo đơn → vào admin chuyển trạng thái; thử hủy đơn hợp lệ; mở sản phẩm có đánh giá và ẩn một đánh giá bằng admin nếu có thời gian.
- **Thành công:** Không âm kho, đơn cũ giữ đúng giá, chỉ món vừa mua bị xóa khỏi cart; đánh giá ẩn không còn tính `ratingAverage`/`reviewCount`.
- **Lỗi/thay đổi:** Nếu một sản phẩm hết hàng hoặc dữ liệu sai, cả đơn bị từ chối và kho đã giữ được khôi phục. Nếu hủy hai lần, điều kiện `stockRestored` chặn lần hai.
- **Hỏi đáp:** *Phí có thể bị sửa từ client không?* Không, server tính lại từ `provinceCode`. *Tại sao giá vừa hiển thị khác giá đơn?* Server dùng giá mới nhất lúc mua; đơn sau đó giữ bản chụp của mình. *Ai quyết định đánh giá hiển thị?* `isHidden` ở server.
- **Hàm + đường dẫn:** `createOrder()`, `calculateShippingFee()`, `cancelOrder()`, `updateOrderStatus()` — `server/src/controllers/orderController.js`: tạo, tính phí, hủy và chuyển đơn; `refreshRating()`/`moderateReview()` — `server/src/controllers/reviewController.js`: tính điểm công khai và kiểm duyệt.

## Bước 4 — Phòng thử AI: chọn sản phẩm và vị trí

- **Nói:** `/room-studio` cho chọn 1–3 sản phẩm, tải JPG/PNG/WebP dưới 10 MB, nhập vị trí tùy chọn cho từng số rồi tạo ảnh. Session chỉ giữ `selectedIds` và `desiredPositions`; không lưu ảnh base64.
- **Demo:** Mở `/room-studio` → **Chọn từ danh sách sản phẩm** → chọn tối đa 3 → quay lại → tải ảnh phòng → nhập “gần cửa sổ” cho món số 1 → bấm **Tạo ảnh**.
- **Thành công:** Ba bước hiện rõ; nút chuyển sang “Ảnh đang được tạo…”; kết quả hiển thị cạnh ảnh gốc; quay lại danh sách vẫn giữ ID và vị trí đã chọn.
- **Lỗi/thay đổi:** Chưa có ảnh hoặc chưa chọn sản phẩm thì nút bị khóa; ảnh sai định dạng/quá lớn hoặc quá 3 món thì báo lỗi. Xóa/đổi sản phẩm sẽ xóa vị trí liên quan và kết quả cũ.
- **Hỏi đáp:** *Session lưu gì?* Chỉ `selectedIds` và `desiredPositions`; ảnh phòng, ảnh sản phẩm và ảnh kết quả không được ghi vào `sessionStorage`. *Tại sao không lưu base64?* Một ảnh có thể vài MB, dễ vượt giới hạn trình duyệt và gây `QuotaExceededError`. *Tại sao tối đa 3?* Giảm payload, thời gian chờ và nhầm lẫn giữa các ảnh tham chiếu.
- **Hàm + đường dẫn:** `RoomStudioPage()`/`generate()` — `client/src/pages/RoomStudioPage.jsx`: chọn, gom dữ liệu và gọi API; `writeSession()` — cùng file: chỉ lưu ID/vị trí; `createRoomPreview()` — `client/src/services/roomPreviewService.js`: gọi `POST /api/room-previews`; `validate()`/`readProducts()` — `server/src/controllers/roomPreviewController.js`: kiểm tra 1–3 sản phẩm.

## Bước 5 — Prompt, fallback và giới hạn AI

- **Nói:** Server gửi ảnh phòng làm ảnh nền và ảnh tham chiếu từng sản phẩm. Prompt đánh số món, ưu tiên `desiredPosition`, giữ nguyên camera/phòng/vật có sẵn và yêu cầu mỗi món xuất hiện đúng một lần.
- **Demo:** Nhập vị trí khác nhau cho món 1–3 → tạo ảnh → so sánh ảnh gốc/kết quả; nếu provider đầu lỗi, quan sát thông báo hoặc fallback khi môi trường có key.
- **Thành công:** Ảnh đầu tiên tạo được trả về; Pollinations được thử trước, Cloudflare thử tiếp nếu cấu hình và provider trước lỗi/hết quota.
- **Lỗi/thay đổi:** AI là mô hình xác suất, không bảo đảm tọa độ pixel; nếu chỗ quá hẹp có thể chọn khoảng trống gần nhất. Tất cả provider lỗi thì báo thử lại; không nói quá thành công.
- **Hỏi đáp:** *Vị trí có thật sự gửi không?* Có, `desiredPosition` đi theo đúng `productId` và vào prompt. *Ảnh có lưu thành bộ sưu tập không?* Không, bản chốt không có collection Bộ sưu tập. *Vì sao gửi ảnh tham chiếu?* Để giữ hình dáng/màu/vật liệu gần sản phẩm thật hơn.
- **Hàm + đường dẫn:** `productPrompt()`/`buildPrompt()` — `server/src/services/cloudflareImageService.js`: mô tả món và tạo prompt; `providerList()` — cùng file: đọc provider đã cấu hình; `generateRoomPreview()` — cùng file: thử provider theo thứ tự và trả ảnh đầu tiên thành công.

## Bước 6 — Bảo mật, triển khai và kết luận

- **Nói:** Secret nằm trong `.env`/Environment Variables; mật khẩu/OTP băm; JWT và middleware bảo vệ API. Frontend deploy Cloudflare Pages (`client`, `npm run build`, `dist`), backend Render (`server`, `npm start`), DB MongoDB Atlas.
- **Demo:** Mở health API trước → website → đăng nhập → thử catalog, đơn, admin và Phòng thử; kiểm tra URL sâu như `/products/...` trên bản deploy.
- **Thành công:** API health trả thành công; frontend gọi đúng `VITE_API_URL`; các luồng chính chạy sau cold start; URL sâu không rơi 404 nhờ cấu hình redirect.
- **Lỗi/thay đổi:** Render có thể cold start, nên mở website/API sớm. Thiếu SMTP hoặc key AI thì luồng tương ứng báo cấu hình; không đưa secret lên Git.
- **Hỏi đáp:** *Cloudflare Pages chạy Express không?* Không, Pages chạy frontend tĩnh; Express chạy Render. *Tại sao kiểm tra lại ở backend?* Request trên trình duyệt có thể bị sửa. *Giới hạn thực tế?* AI sinh ảnh không phải phần mềm 3D; vị trí và chi tiết cần kiểm tra bằng mắt.
- **Hàm + đường dẫn:** `authenticate()`/`requireAdmin()` — `server/src/middleware/authMiddleware.js`: bảo vệ API; `errorHandler` — `server/src/middleware/errorHandler.js`: trả lỗi thống nhất; `app` — `server/src/app.js`: health/CORS/API.

**Kết luận để nói:** “FurneeHome hoàn thiện luồng bán nội thất từ tìm kiếm đến sau mua. MongoDB là nguồn dữ liệu chung; backend giữ quy tắc về tài khoản, tồn kho, đơn hàng và quyền. Phòng thử AI giúp khách hình dung sản phẩm trong phòng thật, đồng thời nhóm trình bày rõ giới hạn của ảnh sinh. Mục tiêu là hệ thống đơn giản, dễ dùng, dễ bảo trì và đủ đầy đủ cho một cửa hàng nội thất trực tuyến. Nhóm xin mời ban giám khảo đặt câu hỏi.”

## Phản biện nhanh cuối phần

1. **MongoDB là gì trong dự án?** Database NoSQL lưu document; Mongoose định nghĩa cấu trúc và kết nối Node.js với MongoDB.
2. **Tại sao vẫn có `data_import.json`?** Để sản phẩm hiện nhanh lúc mở danh sách; MongoDB vẫn là dữ liệu chính thức cho mọi nghiệp vụ.
3. **Nếu sửa JSON rồi F5?** Có thể thấy bản chụp trong chốc lát, nhưng kết quả MongoDB sẽ thay thế; JSON không thể sửa database.
4. **Tại sao chi tiết gọi API riêng?** Danh sách chỉ tải 12 món/trang; `getById()` tải đúng món khi mở URL mà không cần tải toàn catalog.
5. **Phòng thử gửi gì?** Ảnh phòng, 1–3 ảnh sản phẩm, tên, đặc điểm và `desiredPosition` của từng món.
6. **Vị trí người dùng nhập nằm ở đâu?** `generate()` đưa vào `inspirationProducts`; `productPrompt()` ghép thành yêu cầu vị trí cho model.
7. **Nếu AI đầu tiên hết quota?** `generateRoomPreview()` thử provider tiếp theo trong `providerList()` nếu đã cấu hình.
8. **Tại sao kết quả có thể chưa đúng vị trí?** AI sinh ảnh có tính xác suất; prompt là ràng buộc ngôn ngữ chứ không phải tọa độ 3D tuyệt đối.
9. **Tại sao không lưu ảnh vào sessionStorage?** Base64 dễ vượt khoảng lưu trữ trình duyệt; session chỉ giữ ID sản phẩm và vị trí nhẹ.
10. **Secret ở đâu khi deploy?** Trong Environment Variables của Cloudflare/Render; `.env` chỉ dùng local và bị Git bỏ qua.
11. **Nếu Render vừa ngủ?** API có cold start; mở health API trước khi demo và chờ server kết nối MongoDB.
12. **Nếu MongoDB mất kết nối?** Backend không trả dữ liệu giả; giao diện báo tải/lỗi để tránh hiển thị sai giá và tồn kho.

### Tự kiểm tra

- Vẽ miệng được `React → Express → MongoDB`.
- Nói đúng vai trò JSON và 7 collection vận hành.
- Nhớ session Room Studio chỉ có `selectedIds`/`desiredPositions`, không có ảnh base64.
- Trả lời được fallback AI, giới hạn mô hình, secret và cold start.
