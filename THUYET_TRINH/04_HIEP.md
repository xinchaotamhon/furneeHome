# Hiệp — Phần 4/4: Kiến trúc, dữ liệu, AI và deploy

> **Vị trí:** nói cuối cùng và kết luận. **Luồng:** Kiến trúc → 7 collections → JSON và MongoDB → Phòng thử 3 bước → Prompt/Fallback → Deploy → giới hạn → kết luận.

## Thẻ liếc nhanh

- **Trang demo:** `/room-studio` và `https://furneehome.onrender.com/api/health`.
- **Ảnh phòng mẫu:** `client/public/images/home-room-1.webp`.
- **Từ khóa code:** `API_BASE_URL` · `connectDatabase` · `createRoomPreview` · `validate` · `buildPrompt` · `productPrompt` · `providerList` · `generateRoomPreview`.
- **Điểm quan trọng:** Phòng thử là ảnh tham khảo bằng AI, không phải phần mềm đo đạc CAD/3D.

## Bước 1 — Kiến trúc toàn hệ thống

### Nói

> “FurneeHome tách rõ ba tầng. React hiển thị và nhận thao tác; Express kiểm tra nghiệp vụ; MongoDB lưu dữ liệu chính thức. Frontend không kết nối thẳng database và không tự quyết định giá, quyền hay tồn kho.”

### Luồng một request

```text
Người dùng thao tác trên React
        ↓
Service ở client gọi HTTP API bằng Axios/fetch
        ↓
Express Route chọn Controller
        ↓
Middleware kiểm tra JWT/quyền nếu cần
        ↓
Controller validate và xử lý business logic
        ↓
Mongoose đọc/ghi MongoDB Atlas
        ↓
Server trả JSON → React cập nhật giao diện
```

### Ví dụ để nói

Khi khách tìm “bàn”:

1. `ProductListPage` cập nhật state tìm kiếm.
2. `productService.getPage()` gọi `GET /api/products?search=bàn&page=1&limit=12`.
3. `productController.list()` escape từ khóa và truy vấn MongoDB.
4. API trả `data`, `categories`, `pagination`.
5. React render lại danh sách.

### Nếu bị hỏi

**Tại sao React không nối thẳng MongoDB?**

Nếu làm vậy sẽ lộ chuỗi kết nối và bỏ qua kiểm tra giá, quyền, tồn kho. Mọi truy cập phải qua backend.

**Dạng phản hồi API là gì?**

Phần lớn API trả `success`, `message`, `data`; API danh sách sản phẩm có thêm `categories` và `pagination`.

**CORS dùng để làm gì?**

`app.js` chỉ cho frontend đã cấu hình và hai địa chỉ localhost gọi backend bằng trình duyệt.

## Bước 2 — Bảy collection MongoDB

| Collection | Dữ liệu chính | Liên hệ |
|---|---|---|
| `users` | tài khoản, role, trạng thái, hash mật khẩu và OTP | được Cart, Order, Review, Feedback tham chiếu |
| `categories` | tên và slug danh mục | Product tham chiếu |
| `products` | tên, giá, kho, ảnh, mô tả, trạng thái, dữ liệu hỗ trợ AI | Cart, Order, Review tham chiếu |
| `carts` | một giỏ cho một user, gồm product + quantity + giá cache | giá cuối vẫn đọc lại Product |
| `orders` | mã đơn, snapshot sản phẩm, địa chỉ, tiền, trạng thái | giữ lịch sử dù Product đổi |
| `reviews` | user, product, số sao, bình luận, trạng thái ẩn | unique theo user + product |
| `feedbacks` | nội dung báo cáo, đối tượng, người gửi, trạng thái | Admin xử lý |

### Cách thiết kế quan hệ

- Dùng `ObjectId ref` khi cần liên kết bản ghi, ví dụ Review → User và Product.
- Dùng dữ liệu nhúng trong `Order.orderItems` để chụp tên, giá, ảnh, số lượng lúc mua.
- Không có collection riêng cho ảnh kết quả Phòng thử trong bản chốt này; ảnh phòng và ảnh tạo không được lưu vào MongoDB.

### Nếu bị hỏi

**Tại sao Order vừa giữ productId vừa giữ tên và giá?**

productId giúp biết nguồn; snapshot giữ đúng lịch sử nếu sản phẩm đổi tên, giá hoặc ngừng bán.

**Tại sao không dùng SQL?**

MongoDB phù hợp dữ liệu sản phẩm có trường linh hoạt và mảng ảnh/thông số. Quan hệ quan trọng vẫn được kiểm soát bằng ObjectId và controller.

**Seed có cần chạy mỗi lần không?**

Không. Chỉ chạy khi database mới hoàn toàn. MongoDB đang có dữ liệu thì server kết nối và dùng ngay.

## Bước 3 — Vai trò thật của `data_import.json`

### Nói đúng

`client/public/data_import/data_import.json` là **bản chụp để hiện danh sách nhanh**, không phải database chính.

```text
Mở trang sản phẩm mặc định
        ↓
React đọc JSON tĩnh và hiện tối đa 12 món đầu
        ↓
Song song gọi API Render
        ↓
MongoDB trả dữ liệu chính thức
        ↓
React thay danh sách JSON bằng kết quả API
```

Mọi thao tác tìm kiếm, lọc, xem chi tiết, CRUD, giỏ hàng, đơn hàng và đánh giá đều đi qua API/MongoDB.

### Đồng bộ

- Nút **Đồng bộ JSON** chỉ xuất hiện khi chạy localhost.
- `productController.syncJson()` đọc toàn bộ Product từ MongoDB rồi ghi JSON.
- Chiều đồng bộ duy nhất: **MongoDB → JSON**.
- Sau khi JSON thay đổi, cần commit/push và rebuild frontend Cloudflare để bản deploy nhận snapshot mới.

### Nếu bị hỏi

**Sửa giá trong JSON rồi F5 có đổi giá chính thức không?**

Có thể thấy thoáng qua ở bản chụp ban đầu, nhưng API MongoDB sẽ thay thế; Cart và Order luôn dùng giá MongoDB. Không được sửa JSON để quản trị giá.

**Nếu Render đang ngủ?**

JSON vẫn giúp trang mặc định có sản phẩm sớm, còn chức năng động sẽ đợi API hoạt động.

**Tại sao production không tự ghi JSON?**

Frontend Cloudflare là file tĩnh và filesystem của dịch vụ deploy không phải nơi lưu dữ liệu chung. MongoDB mới là nguồn ghi chính thức.

## Bước 4 — Phòng thử AI: thao tác đủ ba bước

### Bước 4.1 — Chọn sản phẩm

1. Mở `/room-studio`.
2. Bấm **Chọn từ danh sách sản phẩm**.
3. Tích từ 1 đến 3 món có ảnh.
4. Bấm **Quay lại Phòng thử**.
5. Kiểm tra mỗi món chỉ hiện ảnh, số thứ tự 1–3 và nút × để bỏ.

Nếu thử chọn món thứ tư, lựa chọn không tăng quá 3.

### Bước 4.2 — Tải ảnh phòng

1. Bấm **Chọn ảnh phòng**.
2. Chọn JPG, PNG hoặc WebP dưới 10 MB.
3. Ảnh phòng xuất hiện trong Bước 2.

Nếu chưa có ảnh hoặc chưa có sản phẩm, nút **Tạo ảnh** bị khóa.

### Bước 4.3 — Nhập vị trí và tạo ảnh

1. Mỗi sản phẩm có một ô riêng: **Vị trí sản phẩm 1, 2, 3**.
2. Có thể để trống để AI tự bố trí.
3. Ví dụ nhập:
   - Sản phẩm 1: `trên sàn, sát tường bên trái`.
   - Sản phẩm 2: `trên sàn, ở khoảng trống giữa phòng`.
   - Sản phẩm 3: `gần cửa nhưng không che lối đi`.
4. Bấm **Tạo ảnh**.
5. Nút đổi thành **Ảnh đang được tạo, bạn đợi xíu nghen ^_^**.
6. Kết quả hiện ở **Ảnh tạo**, phía dưới là **Ảnh gốc** để so sánh.

### Kết quả kiểm tra thực tế

- Website đã nhận đủ 3 sản phẩm, ảnh WebP và 3 vị trí.
- Ảnh trả về sau khoảng 15 giây trong lần thử này.
- Cấu trúc chính của phòng được giữ khá tốt.
- Hai sản phẩm hiện rõ; sản phẩm thứ ba không rõ ràng. Vì vậy chỉ nói “AI tạo ảnh tham khảo”, không nói “luôn ghép chính xác 100%”.

## Bước 5 — Dữ liệu Phòng thử đi qua code thế nào

```text
RoomStudioPage
  roomImageDataUrl
  imageSize
  1–3 inspirationProducts
    ├─ productName
    ├─ image
    ├─ desiredPosition
    ├─ description/specifications
    ├─ dimensionsCm
    ├─ usageType
    └─ placementSurface
        ↓
POST /api/room-previews
        ↓
roomPreviewController.validate()
        ↓
cloudflareImageService.generateRoomPreview()
        ↓
Provider tạo ảnh → trả imageDataUrl
```

### Kiểm tra dữ liệu đầu vào

- Backend chỉ nhận 1–3 sản phẩm.
- Mỗi món phải có tên và ảnh.
- Vị trí từng món được cắt tối đa 160 ký tự.
- Tổng dung lượng ảnh phòng và ảnh sản phẩm không quá 15 MB.
- Đầu ra giữ tỷ lệ ảnh gốc và co cạnh lớn nhất về khoảng 1024 px để xử lý nhanh hơn.

### Nếu bị hỏi

**Vị trí người dùng có được gửi thật không?**

Có. `RoomStudioPage.generate()` gắn vị trí vào từng `inspirationProduct`; `cleanProduct()` giữ trường `desiredPosition`; `productPrompt()` đưa nó vào prompt đúng số sản phẩm.

**Ảnh phòng có lưu trong MongoDB không?**

Không. Client gửi ảnh cho backend để gọi dịch vụ AI rồi nhận kết quả. Bản chốt không tạo RoomDesign và không lưu ảnh này vào database.

**Người chưa đăng nhập có dùng được không?**

Có. Route dùng `optionalAuthenticate`, nên đăng nhập không phải điều kiện của bản Phòng thử hiện tại.

## Bước 6 — Prompt bảo vệ căn phòng và mô tả sản phẩm

### `productPrompt()` làm gì?

Với từng sản phẩm, prompt chứa:

- tên, danh mục, mô tả và thông số nếu có;
- kích thước cm nếu dữ liệu có;
- loại sử dụng, ví dụ bàn ngồi bệt phải thấp và không tự thêm ghế;
- bề mặt đặt: sàn, tường hoặc mặt bàn;
- vị trí người dùng yêu cầu, được đánh dấu ưu tiên cao nhất;
- yêu cầu giữ hình dáng, màu, vật liệu và tỷ lệ theo ảnh tham chiếu.

### `buildPrompt()` làm gì?

- Giữ camera, khung ảnh, tường, sàn, trần, cửa, cửa sổ, cầu thang, nhà vệ sinh và đồ cố định.
- Không mặc định nhét sản phẩm cạnh cầu thang.
- Sản phẩm không có vị trí chỉ được đặt vào khoảng trống.
- Sản phẩm có vị trí được ưu tiên; chỉ đồ di động đúng vị trí đó mới được thay.
- Mỗi sản phẩm chỉ xuất hiện một lần; không thêm sản phẩm ngoài lựa chọn.

### Nếu bị hỏi

**Nếu người dùng yêu cầu đặt vào tường chịu lực hoặc chắn cửa?**

Prompt ưu tiên yêu cầu nhưng vẫn cố giữ cấu trúc cố định và lối đi. Vì mô hình sinh ảnh có tính xác suất, kết quả có thể chọn cách gần nhất chứ không bảo đảm tuyệt đối.

**Tại sao dữ liệu sản phẩm đầy đủ quan trọng?**

Ảnh tham chiếu cho hình dạng; tên, mô tả, kích thước và cách đặt giúp AI hiểu đúng loại đồ. Thiếu dữ liệu làm tăng nguy cơ sai tỷ lệ hoặc biến dạng.

**Bố cục hay prompt quan trọng hơn?**

Cả hai. Ảnh phòng và ảnh sản phẩm là nền tảng trực quan; prompt ràng buộc cấu trúc, tỷ lệ và vị trí. Không có ảnh tham chiếu tốt thì prompt dài vẫn khó tạo đúng sản phẩm.

## Bước 7 — Fallback dịch vụ tạo ảnh

### Luồng

`providerList()` đọc thứ tự từ biến môi trường. Mặc định:

```text
Pollinations model 1
        ↓ nếu lỗi/timeout
Pollinations model 2
        ↓ nếu lỗi/timeout
Cloudflare Workers AI
        ↓
Nếu tất cả lỗi: “Các dịch vụ tạo ảnh đang bận.”
```

Mỗi lần gọi có timeout 45 giây. `generateRoomPreview()` thử tuần tự và trả cả provider, model, thời gian xử lý cùng ảnh cho backend.

### Nếu bị hỏi

**Có bảo đảm người dùng luôn được miễn phí không?**

Không thể hứa “luôn luôn”. Hệ thống tận dụng các API đã cấu hình và fallback khi một nguồn lỗi, nhưng vẫn phụ thuộc quota và điều khoản của nhà cung cấp.

**Nếu Pollinations hết quota?**

Vòng lặp bắt lỗi và thử Cloudflare nếu thông tin Cloudflare đã được cấu hình.

**Tại sao không gọi các provider song song?**

Gọi tuần tự tránh tiêu thụ quota nhiều nơi cho cùng một ảnh và giữ code đơn giản.

## Bước 8 — `sessionStorage` và bộ nhớ ảnh

- Chỉ `selectedIds` và `desiredPositions` được ghi vào `sessionStorage`.
- Ảnh phòng và ảnh kết quả chỉ giữ trong React state.
- Khi đi sang danh sách rồi quay lại, sản phẩm và vị trí vẫn còn.
- Khi F5, ảnh phòng và kết quả mất; người dùng phải tải ảnh lại.

### Nếu bị hỏi

**Tại sao không lưu Base64 vào sessionStorage?**

Ảnh lớn dễ vượt hạn mức storage của trình duyệt và gây `QuotaExceededError`. Lưu dữ liệu nhẹ giúp luồng ổn định hơn.

**Tại sao không cache kết quả?**

Bản chốt ưu tiên đơn giản và không lưu ảnh nhạy cảm của phòng. Nếu phát triển tiếp có thể dùng object storage có quyền truy cập rõ ràng.

## Bước 9 — Deploy Cloudflare, Render và MongoDB Atlas

### Kiến trúc deploy

```text
Người dùng
   ↓ HTTPS
Cloudflare Pages — React frontend
   ↓ /api qua URL cấu hình
Render Web Service — Express backend
   ↓ MONGO_URI
MongoDB Atlas

Render → SMTP Gmail
Render → Pollinations / Cloudflare Workers AI
```

### Cấu hình cần nhớ

- Cloudflare: root `client`, build `npm run build`, output `dist`.
- Render: root `server`, build `npm install`, start `npm start`, health `/api/health`.
- `apiClient.js` dùng `http://localhost:5000/api` ở local và `https://furneehome.onrender.com/api` trên bản deploy nếu không đặt `VITE_API_URL`.
- `client/public/_redirects` có `/* /index.html 200` để F5 URL sâu vẫn về React Router.
- `.env` và `.env.*` bị `.gitignore` loại khỏi Git; secret được đặt trên Render/Cloudflare.

### Kiểm tra thực tế

- `https://furneehome.onrender.com/api/health` trả `success: true`.
- API sản phẩm trả dữ liệu MongoDB và phân trang.
- Các URL sâu `/products/:id`, `/room-studio`, `/admin` mở trực tiếp được trên Cloudflare Pages.

### Nếu bị hỏi

**Tại sao mở domain Render gốc thấy JSON?**

Backend là REST API, không phải trang giao diện. Route `/`, `/api`, `/api/health` dùng để kiểm tra server; giao diện nằm trên Cloudflare Pages.

**Tại sao Cloudflare báo No Git connection?**

Project Direct Upload không tự rebuild khi GitHub có commit. Phải upload lại `client/dist`, hoặc tạo Pages project kết nối Git.

**Nếu Render cold start?**

Lần gọi đầu có thể chậm. Trước bảo vệ mở `/api/health`, chờ phản hồi rồi mới demo.

**Những biến nào không được đẩy Git?**

`MONGO_URI`, `JWT_SECRET`, SMTP password và các API key. Chỉ lưu trên máy cá nhân hoặc Environment Variables của dịch vụ.

## Bước 10 — Giới hạn và hướng phát triển

### Giới hạn phải nói trung thực

- AI có thể thiếu món, sai tỷ lệ hoặc không theo đúng vị trí trong một số ảnh.
- QR hiện tạo thông tin chuyển khoản; việc xác nhận thanh toán do Admin thực hiện, chưa có webhook ngân hàng tự động.
- Giỏ khách chưa đăng nhập chưa tự gộp vào giỏ tài khoản.
- Trang quản trị chưa có form tạo Admin mới; đang quản lý các tài khoản mẫu có sẵn.
- Hạ tầng miễn phí có thể chậm hoặc hết quota.

### Hướng phát triển

- Bổ sung queue/retry và theo dõi chất lượng ảnh AI.
- Chuẩn hóa thêm kích thước, vật liệu và ảnh nền trong của sản phẩm.
- Cho khách chọn có gộp giỏ khi đăng nhập.
- Tạo Admin mới bằng luồng Orchestra có audit log.
- Tích hợp webhook thanh toán và đơn vị vận chuyển thật.

## Lời kết

> “FurneeHome đã hoàn thành một luồng bán nội thất từ tìm kiếm, giỏ hàng, thanh toán, quản lý đơn, đánh giá đến quản trị. Điểm khác biệt là Phòng thử AI giúp khách hình dung sản phẩm trong phòng thật. Nhóm chọn kiến trúc React, Express và MongoDB rõ ràng, đồng thời giữ mã nguồn trực tiếp để bốn thành viên có thể hiểu và bảo trì. Nhóm xin cảm ơn Hội đồng và sẵn sàng trả lời câu hỏi.”

## Bản đồ code của Hiệp

| Nội dung | Hàm / file |
|---|---|
| Chọn API local/deploy | `client/src/services/apiClient.js` — `API_BASE_URL` |
| Route frontend | `client/src/router.jsx` |
| Khởi tạo Express/health/CORS | `server/src/app.js` |
| Gom route API | `server/src/routes/index.js` |
| Kết nối MongoDB | `server/src/config/db.js` — `connectDatabase()` |
| Schema dữ liệu | `server/src/models/*.js` |
| JSON hiện nhanh | `ProductListPage.loadProducts()` và `ProductProvider.showJsonSnapshot()` |
| Giao diện Phòng thử | `client/src/pages/RoomStudioPage.jsx` — `generate()` |
| Gọi API ảnh | `client/src/services/roomPreviewService.js` — `createRoomPreview()` |
| Làm sạch dữ liệu ảnh | `server/src/controllers/roomPreviewController.js` — `validate()`, `cleanProduct()` |
| Prompt từng sản phẩm | `server/src/services/cloudflareImageService.js` — `productPrompt()` |
| Prompt toàn phòng | cùng file — `buildPrompt()` |
| Danh sách provider | cùng file — `providerList()` |
| Fallback và trả ảnh | cùng file — `generateRoomPreview()` |
| SPA fallback | `client/public/_redirects` |

## Checklist 30 giây

- [ ] Mở `/api/health` để làm ấm Render.
- [ ] Có sẵn ảnh phòng và 1–3 sản phẩm có ảnh rõ.
- [ ] Nói đúng 7 collections, không nhắc RoomDesign trong bản chốt.
- [ ] Nói đúng JSON hiện nhanh nhưng MongoDB là nguồn chính thức.
- [ ] Nhập vị trí riêng cho từng sản phẩm và chỉ đúng số 1–3.
- [ ] Nếu AI thiếu món, thừa nhận giới hạn và giải thích ảnh tham khảo.
- [ ] Nói đúng fallback tuần tự, không hứa miễn phí vô hạn.
- [ ] Kết luận ngắn rồi mời Hội đồng đặt câu hỏi.
