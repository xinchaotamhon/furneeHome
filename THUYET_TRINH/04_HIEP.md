# Hiệp — Phần 4/4: Kiến trúc, MongoDB, Phòng thử AI và kết luận

## Vai trò của Hiệp

Hiệp nói cuối và phụ trách phần khó nhất: kiến trúc, dữ liệu, logic quan trọng, điểm wow, triển khai, giới hạn và kết luận.

## 1. Kiến trúc tổng thể

Luồng chính:

`Trình duyệt → React → Axios → Express API → Controller → Mongoose → MongoDB Atlas → JSON response → React cập nhật giao diện`

Vai trò từng phần:

- React, HTML, CSS: hiển thị và nhận thao tác.
- Axios: gửi HTTP request tới API.
- Node.js và Express: định tuyến, xác thực và xử lý nghiệp vụ.
- Mongoose: định nghĩa cấu trúc dữ liệu và truy vấn MongoDB.
- MongoDB Atlas: lưu dữ liệu dùng chung cho cả nhóm và bản deploy.
- Pollinations/Cloudflare AI: nhận ảnh và prompt để tạo ảnh phòng thử.

Câu có thể bị hỏi:

**Tại sao không cho React truy cập MongoDB trực tiếp?**  
Vì sẽ lộ chuỗi kết nối và không có nơi đáng tin cậy để kiểm tra quyền, giá, tồn kho và trạng thái đơn.

**Business logic nằm ở đâu?**  
Chủ yếu trong `server/src/controllers`. Frontend chỉ thu thập dữ liệu và hiển thị kết quả.

**API trả dữ liệu theo dạng nào?**  
JSON với trạng thái thành công, thông báo và trường `data`.

## 2. MongoDB và các collection

Các collection đang dùng:

- `users`: tài khoản, email, mật khẩu băm, quyền và trạng thái khóa.
- `products`: tên, giá, tồn kho, ảnh, mô tả, danh mục và dữ liệu hỗ trợ AI.
- `categories`: danh mục sản phẩm.
- `carts`: giỏ hàng gắn với từng user.
- `orders`: sản phẩm đã mua, giá tại lúc mua, địa chỉ, thanh toán và trạng thái.
- `reviews`: điểm, bình luận, người viết và sản phẩm.
- `feedbacks`: báo nội dung và trạng thái xử lý.

`roomdesigns` là dữ liệu từ phiên bản cũ. Bản chốt không có Bộ sưu tập và không dùng collection này. Có thể giữ mà không ảnh hưởng; nếu muốn xóa thì sao lưu rồi xóa thủ công sau, không xóa ngay trước buổi bảo vệ.

Quan hệ chính:

- Một user có một cart và nhiều orders.
- Một product thuộc một category.
- Một order có nhiều `orderItems`.
- Một review nối một user với một product.
- Một feedback có thể gắn với product bị báo cáo.

Câu có thể bị hỏi:

**MongoDB là NoSQL thì quan hệ ở đâu?**  
Mongoose lưu ObjectId tham chiếu cho user, product và category; dữ liệu cần giữ lịch sử như tên/giá trong đơn được nhúng trực tiếp vào orderItems.

**Tại sao orderItems vừa có product ID vừa có tên và giá?**  
ID giúp truy vết sản phẩm, còn tên/giá là bản chụp lịch sử để đơn cũ không đổi khi catalog đổi.

**Tại sao cart tách thành collection?**  
Để giỏ dùng chung khi người dùng đăng nhập lại hoặc dùng thiết bị khác.

## 3. `data_import.json` và MongoDB

Đây là điểm phải nói thật rõ:

- `client/public/data_import/data_import.json` là **dữ liệu nhập ban đầu**.
- `seedProducts()` đọc JSON và dùng `slug` để nhận biết sản phẩm.
- `$setOnInsert` chỉ thêm sản phẩm chưa tồn tại.
- Tên, giá, tồn kho, mô tả và ảnh đã sửa trên MongoDB không bị seed ghi đè.
- Sau khi nạp, website đọc và ghi MongoDB; JSON không phải cơ sở dữ liệu đang chạy.
- Không có nút đồng bộ hai chiều vì sẽ tạo hai nguồn dữ liệu và có nguy cơ ghi đè giá thật.

Luồng:

`data_import.json → npm run seed → Chỉ thêm sản phẩm chưa có → MongoDB → Product API → Giao diện`

Trường hợp MongoDB tải chậm:

- Frontend hiển thị trạng thái tải.
- Trước buổi demo mở Render và website sớm để server hết cold start.
- Không hiển thị JSON cũ làm dữ liệu thay thế vì tốc độ nhanh nhưng có thể sai giá.

Code cần biết:

- `seedProducts()` — `server/src/utils/seedData.js`: nhập sản phẩm theo cơ chế chỉ thêm.
- `productData()` — cùng file: đổi một mục JSON thành dữ liệu Product.
- `connectDatabase()` — `server/src/config/db.js`: kết nối MongoDB.
- `fetchProducts()` — `client/src/context/ProductContext.jsx`: tải catalog thật qua API.

Câu có thể bị hỏi:

**Có cần nút Đồng bộ MongoDB không?**  
Không. MongoDB đã là nguồn vận hành. Nút đồng bộ từ JSON có thể đẩy dữ liệu cũ lên và làm mất giá Admin đã sửa.

**JSON có còn tác dụng gì sau seed?**  
Có: là bộ dữ liệu nhập ban đầu, giúp dựng database mới và giải thích nguồn catalog.

**Nếu sửa JSON thì website có đổi ngay không?**  
Không. Phải chạy seed, và seed chỉ thêm slug mới; sản phẩm hiện có vẫn lấy từ MongoDB.

## 4. Phòng thử AI — điểm wow

### Luồng người dùng

1. Bước 1: chọn từ một đến ba sản phẩm.
2. Mỗi ảnh đã chọn có tag số 1, 2 hoặc 3.
3. Bước 2: tải ảnh phòng JPG, PNG hoặc WebP.
4. Bước 3: nhập vị trí riêng cho từng số sản phẩm hoặc để trống.
5. Bấm **Tạo ảnh**.
6. Trong lúc xử lý, chính nút đổi thành **Ảnh đang được tạo, bạn đợi xíu nghen ^_^**.
7. Khi xong, ảnh tạo và ảnh gốc được hiển thị để so sánh; không có nút Xem ảnh gốc thừa.

### Dữ liệu gửi lên API

- Ảnh phòng.
- Ảnh tham chiếu của từng sản phẩm.
- ID và tên sản phẩm.
- Kích thước nếu có.
- Cách sử dụng và bề mặt đặt nếu có.
- Mô tả hình dạng nếu có.
- `desiredPosition` của đúng sản phẩm nếu người dùng nhập.

### Prompt xử lý thế nào

`productPrompt()` đánh số từng sản phẩm và biến vị trí người dùng thành yêu cầu `MANDATORY POSITION`.

`buildPrompt()` yêu cầu:

- Dùng ảnh phòng làm nền gốc.
- Giữ camera, tường, sàn, trần, cửa, cửa sổ, cầu thang, nhà vệ sinh và vật có sẵn.
- Không xóa, di chuyển, che, đổi kích thước hoặc thay thế vật có sẵn.
- Chỉ thêm sản phẩm đã chọn vào khoảng trống.
- Mỗi sản phẩm xuất hiện đúng một lần.
- Giữ hình dáng, màu, vật liệu, tỷ lệ và cấu tạo sản phẩm.
- Ưu tiên vị trí người dùng; nếu chỗ quá hẹp thì chọn khoảng trống gần nhất mà không thay đổi phòng.

### Thứ tự nhà cung cấp AI

`providerList()` đọc cấu hình. Mặc định thử Pollinations trước; nếu lỗi hoặc hết quota thì thử Cloudflare khi đã có key.

`generateRoomPreview()` lần lượt gọi từng provider và trả ảnh đầu tiên thành công.

Code cần biết:

- `generate()` — `client/src/pages/RoomStudioPage.jsx`: gom ảnh, sản phẩm và vị trí rồi gọi API.
- `validate()` — `server/src/controllers/roomPreviewController.js`: kiểm tra ảnh và số lượng tối đa ba.
- `productPrompt()` — `server/src/services/cloudflareImageService.js`: mô tả một sản phẩm và vị trí của nó.
- `buildPrompt()` — cùng file: tạo yêu cầu tổng cho AI.
- `providerList()` — cùng file: chọn các provider đã cấu hình.
- `generateRoomPreview()` — cùng file: gọi provider theo thứ tự và fallback.

Câu có thể bị hỏi:

**Vị trí người dùng có thật sự được gửi không?**  
Có. `RoomStudioPage.generate()` gắn `desiredPosition` theo ID sản phẩm; `productPrompt()` đưa nó vào prompt cùng số sản phẩm.

**Tại sao ghi gần cầu thang mà AI vẫn có thể đặt chưa chính xác?**  
Mô hình tạo ảnh mang tính xác suất. Prompt đã tăng mức ưu tiên nhưng không thể bảo đảm tọa độ từng pixel như phần mềm 3D. Nếu vị trí không có khoảng trống, AI được yêu cầu chọn chỗ gần nhất mà vẫn giữ phòng.

**Nếu ảnh tạo thay đồ trong phòng thì sao?**  
Prompt đã cấm thay thế vật có sẵn. Chất lượng còn phụ thuộc model; nhóm trình bày đây là giới hạn thực tế của generative AI, không nói quá khả năng.

**Tại sao gửi ảnh tham chiếu sản phẩm?**  
Chỉ tên sản phẩm không đủ để biết chính xác hình dáng. Ảnh, kích thước và mô tả giúp model giữ sản phẩm gần thực tế hơn.

**Nếu Pollinations hết quota?**  
Server bắt lỗi và thử Cloudflare. Nếu tất cả đều lỗi, API trả thông báo để người dùng thử lại.

**Có lưu ảnh phòng của khách không?**  
Bản chốt chỉ gửi ảnh để tạo kết quả và giữ phiên giao diện trong `sessionStorage`; không tạo collection lưu Bộ sưu tập.

**Tại sao chỉ tối đa ba sản phẩm?**  
Giảm dữ liệu gửi, giảm thời gian chờ và giúp model giữ đúng hình dáng tốt hơn.

## 5. Logic đơn hàng quan trọng

Nếu ban giám khảo hỏi sâu, trả lời theo ba trường hợp:

### Khách đang đặt hàng

1. Server đọc lại sản phẩm từ MongoDB.
2. Chỉ giảm tồn kho nếu sản phẩm đang bán, giá hợp lệ và tồn kho đủ.
3. Lưu bản chụp tên, giá, ảnh vào orderItems.
4. Tạo order `Pending`.
5. Nếu một bước lỗi, hoàn lại tồn kho đã giữ.

### Đơn bị hủy

1. Chỉ Pending hoặc Processing được hủy.
2. Đổi thành Cancelled.
3. Đặt `stockRestored=true`.
4. Cộng trả tồn kho đúng một lần.

### Đơn thành công

1. Admin chuyển lần lượt tới Delivered.
2. Admin xác nhận thanh toán.
3. Đơn hoàn tất khi `orderStatus=Delivered` và `paymentStatus=Paid`.

Hàm chính: `createOrder()`, `cancelOrder()`, `updateOrderStatus()` trong `server/src/controllers/orderController.js`.

## 6. Dữ liệu demo

- Tài khoản khách chính: `customer` / `user123456`.
- Tài khoản tạo đánh giá mẫu: `minhanh`, `hoangnam`, `thuha`; mật khẩu `user123456`.
- 6 đánh giá mẫu từ 3 đến 5 sao.
- Đơn mẫu có trạng thái đang xử lý, thành công và đã hủy.
- 4 tài khoản quản trị: `admin`, `phuc`, `trieu`, `dung`; mật khẩu `123`.

Dữ liệu này do `seedAccounts()` và `seedDemoContent()` trong `server/src/utils/seedData.js` tạo. Cơ chế upsert giúp chạy lại không tạo bản trùng và không sửa giá sản phẩm.

## 7. Bảo mật

- `.env` nằm trong `.gitignore` và không được push.
- Mật khẩu băm bằng bcrypt.
- OTP băm và có thời hạn.
- JWT xác định người dùng cho request.
- Middleware kiểm tra đăng nhập và quyền Admin.
- Server kiểm tra lại giá, tồn kho, dữ liệu nhập và trạng thái đơn.
- Secret khi deploy được đặt trong Environment Variables.

Câu có thể bị hỏi:

**Frontend ẩn nút Admin đã đủ chưa?**  
Chưa. Backend vẫn phải dùng `requireAdmin()`; nếu khách tự gọi API thì server từ chối.

**Có đưa Gmail App Password lên Git không?**  
Không. Chỉ đặt trong `.env` local và Environment Variables của Render.

**Tại sao phải kiểm tra lại dữ liệu ở server?**  
Người dùng có thể sửa request từ trình duyệt; chỉ server là nơi quyết định đáng tin cậy.

## 8. Deploy

- Frontend: Cloudflare Pages.
- Root directory: `client`.
- Build command: `npm run build`.
- Output: `dist`.
- Backend: Render, root `server`, lệnh `npm start`.
- Database: MongoDB Atlas.
- Cloudflare đặt `VITE_API_URL=https://ten-render.onrender.com/api`.
- Render đặt MongoDB, JWT, SMTP, Pollinations và Cloudflare key trong Environment Variables.

Câu có thể bị hỏi:

**Cloudflare Pages có chạy Express không?**  
Không. Pages chỉ chạy frontend tĩnh; Express chạy trên Render.

**Tại sao lần đầu mở API có thể chậm?**  
Render có thể cold start. Trước demo mở website và gọi API health trước.

## 9. Smoke test trước khi bảo vệ

Thực hiện đúng thứ tự:

1. Mở trang chủ và danh sách sản phẩm.
2. Đăng ký hoặc quên mật khẩu, xác nhận OTP Gmail.
3. Đăng nhập `customer` / `user123456`.
4. Thêm hai sản phẩm, chọn một phần giỏ và đặt hàng.
5. Mở lịch sử đơn và thử hủy một đơn hợp lệ.
6. Đánh giá một sản phẩm đã nhận.
7. Báo nội dung một sản phẩm.
8. Đăng nhập `admin` / `123`.
9. Kiểm tra Sản phẩm, Khách hàng, Đơn hàng, Báo nội dung và Quản trị admin.
10. Chuyển trạng thái đơn đúng thứ tự và xác nhận thanh toán.
11. Chọn ba sản phẩm, tải ảnh phòng, nhập vị trí và tạo ảnh.
12. Tải lại một URL sâu trên bản deploy để kiểm tra `_redirects`.

## 10. Kết luận để nói

> FurneeHome hoàn thiện luồng bán nội thất từ tìm kiếm đến sau mua. MongoDB là nguồn dữ liệu chung, backend giữ các quy tắc về tài khoản, tồn kho, đơn hàng và quyền quản trị. Phòng thử AI là điểm wow giúp khách hình dung sản phẩm trong phòng thật, nhưng nhóm vẫn trình bày rõ giới hạn của mô hình tạo ảnh. Mục tiêu của nhóm là một hệ thống đơn giản, dễ dùng, dễ bảo trì và đủ đầy đủ để vận hành một cửa hàng nội thất trực tuyến.

Sau đó mời ban giám khảo đặt câu hỏi.

## Tự kiểm tra trước khi bảo vệ

- Vẽ miệng được luồng React → Express → MongoDB.
- Nói rõ vai trò JSON và tại sao không đồng bộ hai chiều.
- Kể được bảy collection đang dùng.
- Trình bày được toàn bộ dữ liệu gửi cho Phòng thử.
- Trả lời trung thực giới hạn của AI.
- Nói được ba tình huống đơn: đang đặt, hủy và thành công.
- Nhớ kiến trúc deploy và vị trí secret.
- Thuộc đoạn kết luận.
