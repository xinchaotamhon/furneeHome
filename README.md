# FurneeHome

Website giúp người dùng chọn nội thất và xem thử một sản phẩm trong ảnh phòng thật. Đây là bản chốt để nhóm trình bày và demo đồ án.

## 1. Chức năng

| Trang | Đường dẫn | Chức năng |
|---|---|---|
| Trang chủ | `/` | Giới thiệu FurneeHome và dẫn đến chức năng chính |
| Sản phẩm | `/products` | Tìm kiếm, lọc, sắp xếp, lưu và chọn sản phẩm để thử |
| Phòng thử | `/room-studio` | Tải ảnh phòng, đặt một sản phẩm, kéo vị trí, đổi kích thước, lật, tạo ảnh và lưu |
| Bộ sưu tập | `/collection` | Xem sản phẩm yêu thích và mở lại mẫu phòng đã lưu |
| Tài khoản | `/profile` | Thay đổi họ tên và ảnh đại diện |
| Góp ý | `/feedback` | Gửi góp ý hoặc báo nội dung sản phẩm xấu |
| Quản trị | `/admin` | CRUD sản phẩm, quản lý người dùng và xử lý phản hồi |

Xác thực gồm đăng ký, đăng nhập, đăng xuất và đặt lại mật khẩu bằng OTP email.

## 2. Quyền người dùng

- `customer`: dùng sản phẩm, Phòng thử, bộ sưu tập, hồ sơ và góp ý.
- `admin`: thêm, sửa, xóa sản phẩm; xem và xử lý phản hồi.
- `superadmin`: có toàn bộ quyền admin, đồng thời cấp quyền admin và khóa/mở khóa tài khoản. Superadmin không thể tự hạ quyền và không thể bị admin khác thay đổi.

## 3. Chạy dự án

Yêu cầu: Node.js, npm và MongoDB Atlas.

1. Cài thư viện:

```powershell
cd client
npm install
cd ..\server
npm install
```

2. Tạo một file `.env` ở thư mục gốc. Không đưa file này lên Git.

3. Chạy nhanh trên Windows bằng `start-furneehome.bat`, hoặc mở hai terminal:

```powershell
cd server
npm run dev
```

```powershell
cd client
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000`

Kiểm tra backend: `http://localhost:5000/api/health`

## 4. Biến môi trường

### Bắt buộc

| Biến | Mục đích |
|---|---|
| `MONGO_URI` | Kết nối MongoDB |
| `JWT_SECRET` | Ký token đăng nhập; production bắt buộc có |
| `CLIENT_URL` | URL frontend được phép gọi backend |

### Tạo ảnh

| Biến | Mục đích |
|---|---|
| `POLLINATIONS_API_KEY` | Khóa Pollinations |
| `POLLINATIONS_IMAGE_MODELS` | Model thử lần lượt, mặc định `gpt-image-2,gptimage-large` |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare |
| `CLOUDFLARE_API_TOKEN` | Token Workers AI |
| `CLOUDFLARE_IMAGE_MODEL` | Model Cloudflare |
| `ROOM_IMAGE_PROVIDER_ORDER` | Thứ tự gọi, mặc định `pollinations,cloudflare` |

Nếu dịch vụ AI lỗi hoặc hết lượt, Phòng thử vẫn tạo bản bố cục tại trình duyệt để buổi demo không bị dừng.

### Gửi OTP

| Biến | Mục đích |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Máy chủ gửi email |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Tài khoản gửi email |
| `AUTH_OTP_DEV_MODE` | Localhost có thể hiện OTP thử khi chưa cấu hình SMTP |

Với Gmail, dùng App Password, không dùng mật khẩu Gmail thông thường. Production không trả OTP về giao diện và bắt buộc cấu hình SMTP nếu muốn dùng quên mật khẩu.

### Tạo quản trị cao nhất

Đặt `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, rồi chạy:

```powershell
cd server
npm run seed
```

Lệnh seed chỉ thêm các sản phẩm chưa có từ JSON dự phòng và tạo/cập nhật `superadmin`. Mật khẩu production phải từ 12 ký tự.

## 5. Luồng quan trọng

### Đăng nhập

`LoginModal` → `authService` → route `/api/auth` → `authController` → model `User` → MongoDB → JWT → `AuthContext`.

### Phòng thử

Ảnh phòng + sản phẩm + vị trí → `createRoomPreviewImages` tạo ảnh hướng dẫn → `/api/room-previews` → `generateRoomPreview` thử Pollinations rồi Cloudflare → `compositeRoomPreview` ghép vùng sản phẩm → kết quả.

Điểm wow của dự án là sản phẩm luôn hiện đúng vị trí trước khi tạo; ảnh AI chỉ thay vùng sản phẩm, còn ảnh bố cục tại máy là phương án dự phòng.

### Lưu bộ sưu tập

- Khách chưa đăng nhập: lưu dữ liệu nhẹ trong `localStorage`.
- Người đã đăng nhập: lưu mẫu phòng trong MongoDB; nếu mạng lỗi, vẫn giữ bản local.
- Trạng thái đang chỉnh trong Phòng thử dùng `sessionStorage`; bấm **Làm lại** sẽ xóa trạng thái đó.

### Quản trị

Giao diện `/admin` → service tương ứng → middleware xác thực JWT và quyền → controller → MongoDB → tải lại danh sách.

## 6. Dữ liệu sản phẩm

- MongoDB là nguồn dùng chung khi backend hoạt động.
- `client/public/data_import/data_import.json` là dữ liệu dự phòng khi backend chưa bật.
- Ảnh sản phẩm tải từ trang quản trị được lưu cùng sản phẩm trong MongoDB.
- Admin nhập kích thước, cách sử dụng, bề mặt đặt và mô tả hình dạng để AI giữ sản phẩm gần đúng hơn.

## 7. Kiểm tra trước khi bảo vệ

```powershell
cd client
npm run build
```

Sau đó kiểm tra lần lượt:

1. Trang chủ và Sản phẩm tải được dữ liệu.
2. Đăng ký, đăng nhập, đăng xuất.
3. Quên mật khẩu nhận OTP và đổi được mật khẩu.
4. Sửa hồ sơ.
5. Phòng thử: tải ảnh → chọn món → kéo/chỉnh → tạo ảnh → so sánh → lưu.
6. Bộ sưu tập: xem, mở lại và xóa.
7. Góp ý và báo nội dung xấu.
8. Admin CRUD sản phẩm và xử lý phản hồi.
9. Superadmin cấp/hủy quyền admin và khóa/mở khóa người dùng.
10. Mở một URL sai để kiểm tra trang 404.

## 8. Git cho nhóm 4 người

Mỗi người làm trên một nhánh mới tạo từ `main`. Không tiếp tục dùng nhánh cũ đã lệch lịch sử.

Lấy bản mới và tạo nhánh:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/ten-thanh-vien-cong-viec
```

Lấy thay đổi mới từ `main` vào nhánh đang làm:

```powershell
git status
git switch main
git pull --ff-only origin main
git switch feature/ten-thanh-vien-cong-viec
git merge main
```

Đẩy phần đã làm:

```powershell
git add .
git status
git commit -m "feat: mo ta ngan gon"
git push -u origin feature/ten-thanh-vien-cong-viec
```

Nếu có conflict, chạy `git merge --abort` trước khi nhờ trưởng nhóm xử lý. Không dùng `git push --force`. Chỉ `.env` và các khóa bí mật phải gửi riêng; mã nguồn, package lock, JSON dự phòng và ảnh công khai của sản phẩm có thể đưa lên Git.

## 9. Cấu trúc

```text
furneehome - Copy/
├── .env                    # Bí mật, không commit
├── README.md               # Nhóm đọc
├── START_HERE.md           # AI đọc trước khi sửa
├── start-furneehome.bat
├── client/                 # React, HTML, CSS
│   ├── public/             # JSON và ảnh công khai
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       ├── services/
│       └── utils/
└── server/                 # Node.js, Express, MongoDB
    └── src/
        ├── config/
        ├── controllers/
        ├── middleware/
        ├── models/
        ├── routes/
        ├── services/
        └── utils/
```

Trang học và luyện bảo vệ nằm ở repo riêng [Fourgether](https://github.com/xinchaotamhon/fourgether).
