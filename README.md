# FurneeHome 🛋️✨

> **Website thử sắp xếp đồ nội thất trong phòng thật bằng AI** (Dành cho học sinh, sinh viên và người ở phòng nhỏ).

---

## ⚡ 1. Bật dự án nhanh (Chỉ 1 Click)

Dành cho Windows:
👉 **Click đúp vào file `start-furneehome.bat` ở thư mục gốc.**
*(File script sẽ tự mở cả Backend (Port 5000) và Frontend (Port 5173) cùng lúc).*

*(Nếu muốn chạy thủ công bằng terminal)*:
- **Frontend:** Mở terminal $\rightarrow$ `cd client` $\rightarrow$ `npm run dev` (mở tại `http://localhost:5173`)
- **Backend:** Mở terminal $\rightarrow$ `cd server` $\rightarrow$ `npm run dev` (chạy tại `http://localhost:5000`)

---

## 🔑 2. Tài khoản thử nghiệm (Test Accounts)

Khi mở web, bấm nút **Đăng nhập** ở góc trên bên phải:
- **Khách hàng (Customer):** Bấm nút nhanh `Customer` trên hộp đăng nhập (hoặc nhập email bất kỳ).
- **Quản trị viên (Admin):** Bấm nút nhanh `Admin` (Email: `admin@furneehome.vn` | Mật khẩu: `admin123`).

---

## 🗺️ 3. Các trang và chức năng chính

| Trang | Đường dẫn (URL) | Chức năng chính |
|---|---|---|
| **Trang chủ** | `/` | Giới thiệu dự án, nút dẫn nhanh đến phòng thử |
| **Danh sách sản phẩm** | `/products` | Xem đồ nội thất, tìm kiếm có/không dấu, link Shopee |
| **Phòng thử (AI)** | `/room-studio` | Tải ảnh phòng $\rightarrow$ Chấm vị trí $\rightarrow$ AI xem thử vào phòng |
| **Bộ sưu tập** | `/collection` | Xem lại đồ đã thích và các mẫu phòng AI đã tạo |
| **Quản trị** | `/admin` | Thêm, sửa, xóa dữ liệu sản phẩm mẫu (dành cho Admin) |

---

## 🌿 4. Hướng dẫn làm việc với Git cho thành viên nhóm

Mỗi bạn làm việc trên **nhánh riêng** của mình (ví dụ: `feature/phuc`, `feature/trieu`, `feature/dung`...), tuyệt đối không commit trực tiếp vào nhánh `main`.

### 0️⃣ Thiết lập lần đầu (Clone dự án & Cài đặt thư viện):
```powershell
git clone https://github.com/xinchaotamhon/furneeHome.git
cd furneeHome
git fetch origin

# Chuyển sang nhánh riêng của bạn (ae thay 'phuc' bằng tên của mình nhé):
git switch --track origin/feature/phuc
git switch --track origin/feature/trieu
git switch --track origin/feature/dung

# Cài đặt thư viện chuẩn theo package-lock.json cho cả 2 bên:
cd client
npm ci
cd ..\server
npm ci
```

### 1️⃣ Trước khi bắt đầu code mỗi ngày (Lấy code mới nhất về máy):
```bash
git switch feature/ten-cua-ban
git pull origin main
```

### 2️⃣ Sau khi code xong (Lưu và đẩy code lên nhánh của mình):
```bash
git add .
git commit -m "Mô tả ngắn gọn phần bạn vừa làm"
git push origin feature/ten-cua-ban
```
*(Sau khi push xong, báo cho trưởng nhóm để review và merge vào `main`).*

---

## 🛒 5. Hướng dẫn cào & Thêm sản phẩm từ Shopee vào Database

Dành cho các thành viên nhóm muốn thêm đồ nội thất mới vào trang web:

### 🔹 Bước 1: Dán link Shopee vào tool
Mở file [tools/importProducts.js](file:///d:/mydata/my-project/furneehome/tools/importProducts.js), thêm các đường link sản phẩm Shopee bạn tìm được vào danh sách `DEFAULT_URLS` (ở dòng 20):

```javascript
const DEFAULT_URLS = [
  'https://shopee.vn/link-san-pham-1...',
  'https://shopee.vn/link-san-pham-2...',
  'https://shopee.vn/link-san-pham-3...',
];
```

### 🔹 Bước 2: Chạy lệnh tự động nạp dữ liệu
Mở terminal tại thư mục gốc và chạy:

```bash
node tools/importProducts.js
```

> **Hệ thống sẽ tự động 100%:**
> 1. Đọc link và bóc tách: Tên, giá tiền, ảnh thumbnail, mô tả, shop bán.
> 2. Tự động phân loại danh mục (Bàn học, Ghế, Đèn, Tủ, Kệ sách...).
> 3. Kết nối MongoDB và lưu (upsert) thẳng vào collection `products`.
> 4. Tự tạo bản sao lưu offline tại `client/public/data_import/data_import.json`.

---

## ⚙️ 6. Cấu hình biến môi trường (`.env`)

- Dự án dùng **duy nhất 1 file `.env` đặt tại thư mục gốc** (đã được Git tự động ẩn để không bị lộ token).
- Cả Backend và Tool import Shopee đều dùng chung file cấu hình này:
  - `PORT=5000`
  - `CLIENT_URL=http://localhost:5173`
  - `CLOUDFLARE_ACCOUNT_ID=...`
  - `CLOUDFLARE_API_TOKEN=...`
  - `CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-4b`

---

## 📁 7. Cấu trúc thư mục dự án

```text
furneehome/
├── .env / .env.example      # Cấu hình biến môi trường (Cloudflare, MongoDB, Port)
├── start-furneehome.bat     # Khởi động cả frontend + backend bằng 1 cú click
├── tools/
│   └── importProducts.js    # 1-Click tool cào Shopee & lưu vào MongoDB products
├── fourgether/              # Web ôn tập Flashcard vấn đáp & phân vai nhóm (Deploy Cloudflare Pages)
├── artifacts/               # Ảnh kết quả thử nghiệm AI
├── client/                  # Frontend React SPA (Vite + CSS thuần)
│   ├── public/images/       # Ảnh tĩnh sản phẩm
│   └── src/
│       ├── components/      # Component dùng lại (auth, layout, product, common)
│       ├── context/         # Auth, sản phẩm mẫu, Bộ sưu tập (Collection)
│       ├── data/            # 10 sản phẩm mẫu tạm thời
│       ├── pages/           # Mỗi file tương ứng 1 trang (route)
│       ├── services/        # Nơi gọi API backend
│       ├── styles/          # theme.css (CSS variables) và global.css
│       ├── utils/           # Canvas overlay, format giá, chuẩn hóa text
│       ├── App.jsx
│       ├── main.jsx
│       └── router.jsx
└── server/                  # Backend Node.js + Express
    └── src/
        ├── config/          # Đọc .env từ root, kết nối DB
        ├── controllers/     # Điều phối request (roomPreview, product, auth...)
        ├── middleware/      # Auth và xử lý lỗi
        ├── models/          # Mongoose models (User, Product, RoomDesign...)
        ├── routes/          # API endpoints
        ├── services/        # cloudflareImageService.js (Cloudflare Workers AI)
        ├── utils/           # seedData.js (tạo tài khoản admin mẫu)
        ├── app.js
        └── server.js
```

---

## 📄 8. Tài liệu dự án

- `furniture-store.txt`: Bản phác thảo kiến trúc ý tưởng ban đầu của nhóm.
- `G5_furniture-store_Review_1_2_VI.docx`: Bản tiếng Việt để nhóm kiểm tra & nộp đồ án.
- `G5_furniture-store_Review_1_2_EN.docx`: Bản tiếng Anh dễ đọc, dễ thuyết trình.

---

## 🚀 9. Triển khai Online (Deployment Architecture)

Hệ thống được thiết kế tối ưu để deploy hoàn toàn miễn phí trên nền tảng đám mây:

1. **Frontend (`client/`) $\rightarrow$ Deploy lên Cloudflare Pages:**
   - **Framework Preset:** `None` (hoặc `Vite`)
   - **Build Command:** `cd client && npm install && npm run build`
   - **Output Directory:** `client/dist`
   - **Environment Variable:** `VITE_API_URL=https://<your-render-backend>/api`
   - *Tốc độ mở trang tức thì (~0.2s) nhờ mạng lưới CDN máy chủ tại Việt Nam.*

2. **Backend (`server/`) $\rightarrow$ Deploy lên Render.com (Web Service):**
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Environment Variables:** `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL=*`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`.

3. **Database $\rightarrow$ MongoDB Atlas Cloud:**
   - Cần cấu hình **Network Access** $\rightarrow$ `0.0.0.0/0` để Backend Render kết nối được.

