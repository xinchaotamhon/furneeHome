# FurneeHome

FurneeHome là website bán nội thất và đồ trang trí cho sinh viên, học sinh,
công nhân và gia đình phổ thông. Đây là đồ án tốt nghiệp của nhóm 4 người.

## 1. Dự án giải quyết vấn đề gì?

Khách hàng thường khó biết một món đồ có hợp với căn phòng thật hay không.
FurneeHome có hai phần chính:

1. Bán hàng: xem sản phẩm, giá, tồn kho, giỏ hàng, thanh toán, đơn mua và đánh giá.
2. Phòng thử: chọn tối đa 3 sản phẩm và tạo ảnh tham khảo sản phẩm trong ảnh phòng.

Phòng thử là điểm nổi bật của đồ án. Phần bán hàng vẫn là luồng nghiệp vụ chính.

## 2. Chức năng chính

- Đăng ký bằng email có mã OTP và đăng nhập chỉ bằng email.
- Quên mật khẩu hoặc đổi mật khẩu bằng mã OTP gửi qua email.
- Guest được thêm sản phẩm vào giỏ local; khi đăng nhập, giỏ guest được gộp vào giỏ tài khoản.
- Xem sản phẩm, tìm kiếm, lọc theo danh mục, xem chi tiết và báo nội dung.
- Giỏ hàng, voucher phí vận chuyển, COD và thanh toán QR.
- Theo dõi, hủy đơn trước khi giao, xem lịch sử mua và đánh giá sản phẩm đã nhận.
- Cập nhật hồ sơ với tỉnh, quận/huyện, phường/xã và ghi chú giao hàng tùy chọn.
- Phòng thử AI với ảnh phòng, mô tả sản phẩm và vị trí mong muốn.
- Trang quản trị sản phẩm, khách hàng, đơn hàng, feedback và admin cấp dưới.

## 3. Công nghệ

- Frontend: React, HTML, CSS, Vite.
- Backend: Node.js, Express.
- Cơ sở dữ liệu: MongoDB/Mongoose.
- Xác thực: JWT và bcrypt.
- Email OTP: SMTP Gmail App Password.
- Tạo ảnh: Pollinations và Cloudflare AI theo thứ tự cấu hình.

## 4. Cấu trúc thư mục

```text
client/
  public/data_import/data_import.json  bản chụp sản phẩm để hiện nhanh
  public/images/                       ảnh giao diện và ảnh sản phẩm
  src/components/                      Header, đăng nhập, sản phẩm, thanh toán...
  src/context/                         Auth, Product, Cart
  src/pages/                           các trang của website
  src/services/                        các lời gọi API
  src/styles/                          CSS
  src/router.jsx                       đường dẫn frontend

server/
  src/server.js                        khởi động server
  src/app.js                           CORS, JSON, health và route
  src/routes/                          URL API
  src/controllers/                     xử lý nghiệp vụ
  src/models/                          schema MongoDB
  src/middleware/                      JWT và quyền admin
  src/services/                        dịch vụ tạo ảnh
  src/utils/                           tiện ích và seed dữ liệu mẫu

THUYET_TRINH/                          tài liệu học và thuyết trình theo 4 người
README.md                              tài liệu tổng quan này
```

## 5. Dữ liệu và cách hoạt động

MongoDB là nguồn dữ liệu chính. Các sản phẩm trong
`client/public/data_import/data_import.json` chỉ là snapshot để danh sách hiện
nhanh trong lúc chờ API. Frontend vẫn gọi API và thay bằng dữ liệu MongoDB.

Giá, tồn kho, tài khoản, giỏ hàng, đơn hàng và đánh giá đều phải được kiểm tra
ở backend. Frontend không ghi trực tiếp vào MongoDB.

Khi tạo đơn, server đọc lại giá và tồn kho, lưu tên/ảnh/giá tại thời điểm mua vào
`Order`, rồi xóa đúng các sản phẩm đã mua khỏi `Cart`. Sản phẩm đã có lịch sử nên
dùng **Ngừng bán** thay vì xóa tùy tiện.

FurneeHome áp dụng chính sách **Đồng kiểm** (cho phép người mua mở hộp xem hàng khi nhận):
- Khách nhận và thanh toán $\rightarrow$ Đơn chuyển sang `Delivered` (Đã giao) + `Paid` (Đã thanh toán).
- Khách từ chối nhận khi xem hàng $\rightarrow$ Shipper chuyển về, Admin chọn `Returned` (Hoàn hàng). Hệ thống tự động khôi phục tồn kho sản phẩm.
- **Quy trình hoàn tiền an toàn (Chống mã QR độc hại/lừa đảo):**
  - Hệ thống **tuyệt đối không quét ảnh mã QR do khách hàng gửi** để tránh nguy cơ mã độc, giả mạo.
  - Khách hàng cung cấp trực tiếp thông tin văn bản: **Ngân hàng, Số tài khoản, Tên chủ tài khoản** trên website.
  - Admin chuyển khoản hoàn lại tiền với cú pháp chuẩn: `HOAN TIEN [Mã đơn hàng]`. Hệ thống hỗ trợ nút sao chép nhanh và tự sinh mã VietQR an toàn từ thông tin khách cung cấp để Admin quét trực tiếp.
  - Sau khi chuyển tiền xong, Admin bấm **Xác nhận đã hoàn tiền** $\rightarrow$ Trạng thái chuyển thành `Refunded` (Đã hoàn tiền). Với đơn COD, trạng thái thanh toán là `Cancelled` (chưa thu tiền).

## 6. Chạy ở máy local

Yêu cầu: Node.js, npm và MongoDB Atlas hoặc MongoDB local.

```powershell
git clone https://github.com/xinchaotamhon/furneeHome.git
cd furneeHome
cd client
npm install
cd ..\server
npm install
```

Tạo file `.env` ở thư mục gốc. File này chỉ để local và không commit lên Git:

```env
MONGO_URI=mongodb_connection_string
JWT_SECRET=your_secret
CLIENT_URL=http://localhost:5173
PORT=5000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=your_gmail

POLLINATIONS_API_KEY=your_key
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_IMAGE_MODEL=your_model
ROOM_IMAGE_PROVIDER_ORDER=pollinations,cloudflare
POLLINATIONS_IMAGE_MODELS=gpt-image-2,gptimage-large

ADMIN_EMAIL=admin@furneehome.local
ADMIN_PASSWORD=123
TEAM_ADMIN_PASSWORD=123
```

Mở hai terminal:

```powershell
cd server
npm run dev
```

```powershell
cd client
npm run dev
```

Website chạy ở `http://localhost:5173`. Kiểm tra backend tại
`http://localhost:5000/api/health`.

Không chạy `npm run seed` trên database đang có dữ liệu. Lệnh này chỉ dùng cho
database mới hoàn toàn.

Ở localhost, admin có thể dùng **Đồng bộ JSON** để chép dữ liệu từ MongoDB sang
`data_import.json`. Đây chỉ là chiều MongoDB → JSON, không dùng JSON để ghi đè
MongoDB.

## 7. Tài khoản demo

Đăng nhập bằng email, không dùng username:

| Quyền | Email | Mật khẩu |
|---|---|---|
| Orchestra Admin | `admin@furneehome.local` | `123` |
| Admin Phúc | `phuc@furneehome.vn` | `123` |
| Admin Triều | `trieu@furneehome.vn` | `123` |
| Admin Dũng | `dung@furneehome.vn` | `123` |
| Khách hàng demo | `customer@furneehome.vn` | `user123456` |

Mật khẩu deploy có thể khác nếu biến môi trường trên Render đã được đổi.

Orchestra Admin có quyền quản lý admin con, khóa/mở khóa tài khoản khách hàng và xóa vĩnh viễn sản phẩm khỏi database. Admin thường quản lý sản phẩm (sửa, ngừng bán), xem hồ sơ khách hàng, xử lý đơn hàng và feedback theo quyền được cấp.

## 8. Deploy

### Cloudflare Pages

- Kết nối repository hoặc tải thư mục `client`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Đặt `VITE_API_URL=https://furneehome.onrender.com/api` trong biến môi trường.

### Render Web Service

- Root directory: `server`.
- Build command: `npm install`.
- Start command: `npm start`.
- Health path: `/api/health`.
- Đặt `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` và các biến SMTP/AI trong phần Environment.

MongoDB Atlas lưu dữ liệu. Cloudflare phục vụ frontend; Render chạy API và
business logic. Không tải `.env` lên Git hoặc lên thư mục public.

## 9. Giới hạn hiện tại

- Ảnh Phòng thử phụ thuộc tốc độ, hạn mức và độ chính xác của API AI; ảnh chỉ là
  kết quả tham khảo.
- Ảnh lớn chỉ được giữ trong phiên làm việc của trình duyệt, nên không nên đóng
  tab giữa chừng.
- API sản phẩm có phân trang khi truyền `page` và `limit`. Nếu dữ liệu tăng rất
  lớn, màn quản trị cần thêm phân trang và tìm kiếm theo từng trang.
- OTP khi deploy cần SMTP Gmail App Password hợp lệ.
- Nếu website có doanh thu thật, có thể mở rộng bằng lưu ảnh R2/S3, hàng đợi tạo
  ảnh, cổng thanh toán thật và log vận hành.

## 10. Tài liệu học và thuyết trình

Đọc `THUYET_TRINH/00_HUONG_DAN_CHUNG.md` trước để hiểu nguyên lý chung, sau đó
đọc lần lượt:

1. `01_PHUC.md` — tài khoản và phân quyền.
2. `02_DUNG.md` — giỏ hàng và thanh toán.
3. `03_TRIEU.md` — chi tiết sản phẩm, đơn mua và đánh giá.
4. `04_HIEP.md` — danh sách sản phẩm, Phòng thử và quản trị.

## Liên hệ

- Địa chỉ: 71/5 Huỳnh Tấn Phát, Ấp 31, Xã Nhà Bè, TP.HCM
- Điện thoại và Zalo: 0372 208 100
- Email: furneehome@gmail.com
