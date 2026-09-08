# FurneeHome

FurneeHome là website bán nội thất của nhóm 4 thành viên. Người dùng có thể mua hàng và thử một sản phẩm trong ảnh phòng bằng AI.

## Chức năng

| Trang | Chức năng |
|---|---|
| Trang chủ | Giới thiệu và dẫn tới sản phẩm, Phòng thử |
| Sản phẩm | Tìm kiếm, lọc, xem chi tiết, đánh giá |
| Giỏ hàng | Thêm, đổi số lượng, xóa sản phẩm |
| Thanh toán | Đặt hàng COD, kiểm tra lại giá và tồn kho |
| Đơn hàng | Xem trạng thái, hủy đơn chưa giao |
| Phòng thử | Tải ảnh phòng, chọn một sản phẩm, tạo ảnh AI, so sánh và lưu |
| Bộ sưu tập | Lưu sản phẩm và ảnh phòng đã tạo |
| Tài khoản | Đăng ký, đăng nhập, quên mật khẩu OTP, sửa hồ sơ |
| Hỗ trợ | Gửi góp ý hoặc báo nội dung xấu |
| Quản trị | Quản lý sản phẩm, tồn kho, đơn hàng, người dùng và phản hồi |

Quyền tài khoản:

- `customer`: mua hàng, dùng Phòng thử, bộ sưu tập và gửi phản hồi.
- `admin`: quản lý sản phẩm, đơn hàng và phản hồi.
- `superadmin`: có quyền admin và cấp quyền hoặc khóa tài khoản khác.

## Chạy trên máy

Yêu cầu Node.js, npm và MongoDB.

1. Cài thư viện:

```powershell
cd client
npm install
cd ..\server
npm install
```

2. Tạo file `.env` ở thư mục gốc.

3. Nạp dữ liệu mẫu:

```powershell
cd server
npm run seed
```

4. Chạy `start-furneehome.bat`, hoặc mở hai terminal:

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
- Kiểm tra API: `http://localhost:5000/api/health`

Tài khoản demo sau khi seed:

| Quyền | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Superadmin | `admin` | `admin123456` |
| Khách hàng | `customer` | `user123456` |

Có thể đổi tài khoản superadmin bằng `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` trước khi chạy seed.

## Biến môi trường

### Bắt buộc

| Biến | Mục đích |
|---|---|
| `MONGO_URI` | Kết nối MongoDB Atlas |
| `JWT_SECRET` | Ký token đăng nhập |
| `CLIENT_URL` | URL frontend được phép gọi API |

### OTP Gmail

| Biến | Mục đích |
|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Máy chủ SMTP |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Tài khoản gửi email |
| `AUTH_OTP_DEV_MODE` | Cho phép hiện OTP khi chạy local |

Gmail dùng App Password. Khi deploy, đặt `AUTH_OTP_DEV_MODE=false`.

### Tạo ảnh AI

| Biến | Mục đích |
|---|---|
| `POLLINATIONS_API_KEY` | Khóa Pollinations |
| `POLLINATIONS_IMAGE_MODELS` | Danh sách model theo thứ tự |
| `CLOUDFLARE_ACCOUNT_ID` | Account Cloudflare |
| `CLOUDFLARE_API_TOKEN` | Token Workers AI |
| `CLOUDFLARE_IMAGE_MODEL` | Model Cloudflare |
| `ROOM_IMAGE_PROVIDER_ORDER` | Thứ tự provider |

## Dữ liệu

- MongoDB là dữ liệu chung của nhóm.
- `client/public/data_import/data_import.json` chứa 101 sản phẩm dự phòng.
- `npm run seed` đồng bộ file JSON vào MongoDB.
- Ảnh sản phẩm nằm trong `client/public/images/products`.
- Hai sản phẩm chưa có ảnh được ẩn cho đến khi admin thêm ảnh.
- Giá và tồn kho của đơn hàng luôn được backend đọc lại từ MongoDB.
- Đơn hàng lưu tên, giá và ảnh tại thời điểm mua để lịch sử không đổi khi sản phẩm được sửa.

## Luồng chính

### Mua hàng

Chọn sản phẩm → thêm giỏ → đăng nhập → nhập địa chỉ → đặt COD → backend kiểm tra giá và tồn kho → trừ kho → tạo đơn → admin cập nhật trạng thái.

Khách chỉ hủy khi đơn đang `Pending` hoặc `Processing`. Khi hủy, tồn kho được hoàn lại một lần.

### Phòng thử

Tải ảnh phòng → chọn một sản phẩm → bấm **Tạo ảnh** → AI tạo kết quả → so sánh ảnh gốc → lưu Bộ sưu tập.

### Quên mật khẩu

Nhập email → server tạo OTP có hạn 10 phút → gửi email → nhập OTP và mật khẩu mới → server kiểm tra hash OTP → lưu mật khẩu đã hash.

## Kiểm tra trước khi bảo vệ

```powershell
cd client
npm run smoke
npm run build
```

```powershell
cd server
npm run test:commerce
```

Sau đó demo theo thứ tự:

1. Xem và lọc sản phẩm.
2. Mở chi tiết, thêm giỏ và đặt đơn COD.
3. Mở lịch sử, hủy một đơn mới.
4. Đăng nhập admin, sửa tồn kho và cập nhật đơn hàng.
5. Quên mật khẩu bằng OTP.
6. Phòng thử: tải ảnh, chọn món, tạo ảnh, so sánh và lưu.
7. Sửa hồ sơ, gửi phản hồi, xử lý phản hồi ở admin.

## Deploy

- Client: Cloudflare Pages, build trong `client`, lệnh `npm run build`, thư mục kết quả `dist`.
- Server: Render, root `server`, lệnh chạy `npm start`.
- Database: MongoDB Atlas.
- Secret chỉ đặt trong biến môi trường Cloudflare và Render, không đưa lên Git.

## Git cho nhóm

Tạo nhánh mới từ `main`:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/ten-thanh-vien-cong-viec
```

Cập nhật `main` vào nhánh đang làm:

```powershell
git status
git switch main
git pull --ff-only origin main
git switch feature/ten-thanh-vien-cong-viec
git merge main
```

Đẩy thay đổi:

```powershell
git add .
git status
git commit -m "feat: mo ta ngan gon"
git push -u origin feature/ten-thanh-vien-cong-viec
```

Nếu có conflict, dùng `git merge --abort` rồi nhờ trưởng nhóm xử lý. Không dùng `git push --force`. File `.env` và khóa bí mật gửi riêng; mã nguồn, package lock, JSON và ảnh sản phẩm được đưa lên Git.

Trang học của nhóm: [Fourgether](https://github.com/xinchaotamhon/fourgether).
