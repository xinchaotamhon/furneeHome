# FurneeHome

FurneeHome là website bán nội thất và trang trí dành cho sinh viên, học sinh, công nhân và gia đình phổ thông. Đây là đồ án tốt nghiệp của nhóm 4 thành viên.

## Đặt vấn đề

Người mua thường chỉ thấy ảnh, kích thước và giá sản phẩm nhưng khó hình dung món đồ có phù hợp với căn phòng thật hay không. Việc lựa chọn sai có thể làm tốn thời gian, chi phí và diện tích sử dụng.

## Mục tiêu

- Xây dựng website bán nội thất dễ hiểu và dễ sử dụng.
- Hỗ trợ tìm kiếm, lọc, xem chi tiết, đánh giá và đặt hàng COD hoặc chuyển khoản QR.
- Cho phép người dùng thử tối đa 3 sản phẩm trên ảnh phòng bằng AI.
- Quản lý sản phẩm, khách hàng, đơn hàng và báo nội dung trong một trang quản trị riêng.
- Giữ mã nguồn đơn giản để nhóm có thể học, trình bày và bảo trì.

## Người sử dụng

- Khách: xem và tìm sản phẩm.
- Khách hàng: mua hàng, theo dõi đơn, đánh giá, sửa hồ sơ, báo nội dung và dùng Phòng thử.
- Admin: quản lý sản phẩm, khách hàng, đơn hàng và báo nội dung.
- Orchestra Admin: có toàn bộ quyền admin và được phân quyền admin cấp dưới.

## Chức năng chính

- Đăng ký bằng OTP email, đăng nhập, ghi nhớ tên đăng nhập và đặt lại mật khẩu.
- Danh sách sản phẩm, tìm kiếm, lọc danh mục và xem chi tiết.
- Giỏ hàng, thanh toán COD hoặc chuyển khoản QR, lịch sử đơn và hủy đơn chưa giao.
- Đánh giá sản phẩm và báo nội dung xấu.
- Phòng thử AI: chọn 1–3 sản phẩm, tải ảnh phòng, nhập vị trí từng món và tạo ảnh.
- Quản trị sản phẩm, ảnh, tồn kho, khách hàng, đơn hàng, liên hệ và quyền admin.

## Công nghệ

- Frontend: React, HTML, CSS.
- Backend: Node.js, Express.
- Database: MongoDB.
- Tạo ảnh: Pollinations và Cloudflare Workers AI.
- Gửi OTP: SMTP Gmail.

## Tải và chạy

Yêu cầu: Node.js, npm và MongoDB.

```powershell
git clone https://github.com/xinchaotamhon/furneeHome.git
cd furneeHome
cd client
npm install
cd ..\server
npm install
```

Tạo file `.env` ở thư mục gốc:

```env
MONGO_URI=mongodb_connection_string 
JWT_SECRET=random_secret
CLIENT_URL=http://localhost:5173

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=gmail_address
SMTP_PASS=gmail_app_password
EMAIL_FROM=gmail_address

POLLINATIONS_API_KEY=api_key
CLOUDFLARE_ACCOUNT_ID=account_id
CLOUDFLARE_API_TOKEN=api_token

ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@furneehome.vn
ADMIN_PASSWORD=123
TEAM_ADMIN_PASSWORD=123
```

Nếu MongoDB đang có dữ liệu thì không cần chạy `npm run seed`. Chỉ dùng lệnh sau một lần khi tạo database hoàn toàn mới:

```powershell
cd server
npm run seed
```

`data_import.json` chỉ là bản chụp sản phẩm để danh sách hiện nhanh lúc mới mở trang. Sau đó website luôn lấy lại dữ liệu chính thức từ MongoDB. Mọi thao tác thêm, sửa, ngừng bán, xóa, đặt hàng và đánh giá đều xử lý trên MongoDB.

Khi chạy localhost, Orchestra Admin hoặc Admin có thể bấm **Đồng bộ JSON** trong trang Quản trị sản phẩm. Nút này chỉ sao chép một chiều từ MongoDB sang `data_import.json`, không ghi ngược vào MongoDB nên không làm mất tên, giá hoặc tồn kho đã sửa.

Lệnh seed cũng tạo tài khoản mẫu, đánh giá 3–5 sao và ba đơn minh họa: đang xử lý, đã giao thành công và đã hủy.

Sau đó mở hai terminal:

```powershell
cd server
npm run dev
```

```powershell
cd client
npm run dev
```

- Website: `http://localhost:5173`
- API: `http://localhost:5000`

## Tài khoản mẫu

| Quyền | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Orchestra Admin | `admin` | `123` |
| Admin | `phuc` | `123` |
| Admin | `trieu` | `123` |
| Admin | `dung` | `123` |
| Khách hàng | `customer` | `user123456` |

Có thể đổi mật khẩu quản trị bằng `ADMIN_PASSWORD` và `TEAM_ADMIN_PASSWORD` trước khi chạy seed.

## Deploy

- Frontend Cloudflare Pages: nhánh `main`, thư mục gốc `client`, lệnh build `npm run build`, thư mục kết quả `dist`.
- Backend Render: nhánh `main`, thư mục gốc `server`, lệnh build `npm install`, lệnh chạy `npm start`, Health Check Path `/api/health`.
- Database: MongoDB Atlas.
- Frontend tự dùng `http://localhost:5000/api` khi chạy local và `https://furneehome.onrender.com/api` khi deploy. Có thể đặt `VITE_API_URL` trên Cloudflare nếu muốn dùng backend khác.
- Project Cloudflare tạo bằng Direct Upload phải build lại rồi tải thư mục `client/dist` lên sau mỗi lần sửa. Muốn tự deploy khi push Git thì tạo một Pages project mới và kết nối repository GitHub.
- Chỉ lưu `.env` và API key trong máy cá nhân hoặc biến môi trường của dịch vụ deploy.

## Liên hệ

- Địa chỉ: 71/5 Huỳnh Tấn Phát, Ấp 31, Xã Nhà Bè, TP.HCM
- Điện thoại và Zalo: 0372 208 100
- Email: furneehome@gmail.com
