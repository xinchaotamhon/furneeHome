# FurneeHome 🛋️✨

> **Nền tảng AI hỗ trợ xem trước đồ nội thất trong căn phòng thật** (Dành cho học sinh, sinh viên và người ở phòng trọ nhỏ).

---

## ⚡ 1. Bật dự án nhanh (Chỉ 1 Click)

Dành cho Windows:
👉 **Click đúp vào file `start-furneehome.bat` ở thư mục gốc.**
*(File script sẽ tự động mở 2 cửa sổ terminal chạy cả Backend Port 5000 và Frontend Port 5173 cùng lúc).*

*(Nếu muốn chạy thủ công bằng terminal)*:
- **Frontend:** Mở terminal $\rightarrow$ `cd client` $\rightarrow$ `npm run dev` (chạy tại `http://localhost:5173`)
- **Backend:** Mở terminal $\rightarrow$ `cd server` $\rightarrow$ `npm run dev` (chạy tại `http://localhost:5000`)

---

## 🔑 2. Tài khoản thử nghiệm (Test Accounts)

Khi mở web, bấm nút **Đăng nhập** ở góc trên bên phải (hộp thoại Login Modal nhanh):
- **Khách hàng (Customer):** Bấm nút nhanh `Customer` trên hộp đăng nhập (hoặc nhập email bất kỳ).
- **Quản trị viên (Admin):** Bấm nút nhanh `Admin` (Email: `admin@furneehome.vn` | Mật khẩu: `admin123`).

---

## 🗺️ 3. Các trang và chức năng chính

| Trang | Đường dẫn (URL) | Chức năng chính |
|---|---|---|
| **Trang chủ** | `/` | Giới thiệu dự án, nút dẫn nhanh đến phòng thử One-touch |
| **Danh sách sản phẩm** | `/products` | Xem đồ nội thất, tìm kiếm có/không dấu, link mua Shopee |
| **Phòng thử (AI Studio)** | `/room-studio` | Tải ảnh phòng $\rightarrow$ Chấm điểm đặt $\rightarrow$ Cloudflare AI ghép phòng |
| **Bộ sưu tập** | `/collection` | Xem lại đồ đã thích và các mẫu phòng AI đã tạo |
| **Quản trị** | `/admin` | Thêm, sửa, xóa sản phẩm trong CSDL (dành cho Admin) |

---

## 🌿 4. Hướng dẫn làm việc với Git cho 4 thành viên nhóm

Mỗi thành viên làm việc trên **nhánh riêng** của mình (`feature/phuc`, `feature/trieu`, `feature/dung`), tuyệt đối không commit trực tiếp vào nhánh `main`.

### 0️⃣ Thiết lập lần đầu (Clone & Cài đặt thư viện):
```powershell
git clone https://github.com/xinchaotamhon/furneeHome.git
cd furneeHome
git fetch origin

# Chuyển sang nhánh riêng của bạn:
git switch --track origin/feature/phuc
git switch --track origin/feature/trieu
git switch --track origin/feature/dung

# Cài đặt thư viện chuẩn cho cả 2 bên:
cd client && npm ci
cd ..\server && npm ci
```

### 1️⃣ Trước khi bắt đầu code mỗi ngày (Lấy code mới nhất về):
```bash
git switch feature/ten-cua-ban
git pull origin main
```

### 2️⃣ Sau khi code xong (Đẩy code lên nhánh của mình):
```bash
git add .
git commit -m "Mô tả ngắn gọn tính năng bạn vừa làm"
git push origin feature/ten-cua-ban
```
*(Sau khi push xong, báo cho trưởng nhóm Hiệp để review và merge vào `main`).*

---

## 🛒 5. Hướng dẫn cào & Nạp sản phẩm từ Shopee vào Database

Dành cho các thành viên nhóm muốn thêm đồ nội thất mới vào trang web:

### 🔹 Bước 1: Dán link Shopee vào tool
Mở file [tools/importProducts.js](file:///d:/mydata/my-project/furneehome/tools/importProducts.js), thêm các link sản phẩm Shopee vào danh sách `DEFAULT_URLS` (dòng 20):

```javascript
const DEFAULT_URLS = [
  'https://shopee.vn/link-san-pham-1...',
  'https://shopee.vn/link-san-pham-2...',
];
```

### 🔹 Bước 2: Chạy lệnh tự động nạp dữ liệu
Mở terminal tại thư mục gốc và chạy:

```bash
node tools/importProducts.js
```

> **Tool sẽ tự động 100%:**
> 1. Đọc link và bóc tách: Tên, giá tiền, ảnh thumbnail, mô tả, shop bán.
> 2. Tự động phân loại danh mục (Bàn học, Ghế, Đèn, Tủ, Kệ sách...).
> 3. Kết nối MongoDB và lưu (`upsert: true`) vào collection `products`.
> 4. Tạo bản sao lưu offline tại `client/public/data_import/data_import.json`.

---

## ⚙️ 6. Cấu hình biến môi trường (`.env`)

- Dự án dùng **duy nhất 1 file `.env` đặt tại thư mục gốc**:
  - `PORT=5000`
  - `MONGO_URI=mongodb+srv://...`
  - `JWT_SECRET=furneehome-jwt-secret-key-2026`
  - `CLIENT_URL=*`
  - `CLOUDFLARE_ACCOUNT_ID=...`
  - `CLOUDFLARE_API_TOKEN=...`
  - `CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-4b`

---

## 📁 7. Cấu trúc thư mục dự án

```text
furneehome/
├── .env / .env.example      # Cấu hình biến môi trường duy nhất ở root
├── start-furneehome.bat     # Khởi động cả frontend + backend bằng 1 cú click
├── tools/
│   └── importProducts.js    # Tool cào Shopee & lưu vào MongoDB products
├── fourgether/              # Web ôn tập Flashcard 32 câu vấn đáp & chia việc 4 người
├── artifacts/               # Ảnh kết quả thử nghiệm AI
├── client/                  # Frontend React SPA (Vite + 100% CSS thuần)
│   ├── public/images/       # Ảnh tĩnh sản phẩm
│   └── src/
│       ├── components/      # Component dùng lại (auth, layout, product, common)
│       ├── context/         # AuthContext, CollectionContext
│       ├── data/            # 10 sản phẩm mẫu tạm thời (sampleProducts.js)
│       ├── pages/           # Mỗi file tương ứng 1 trang (HomePage, RoomStudioPage...)
│       ├── services/        # apiClient.js, roomPreviewService.js
│       ├── styles/          # theme.css (CSS variables) và global.css (Be Vietnam Pro font)
│       ├── utils/           # Canvas overlay, format giá VND, normalizeText
│       ├── App.jsx
│       ├── main.jsx
│       └── router.jsx
└── server/                  # Backend Node.js Express 5 (Direct MVC)
    └── src/
        ├── config/          # db.js (MongoDB), env.js (đọc .env root)
        ├── controllers/     # Điều phối trực diện (roomPreview, product, auth, roomDesign)
        ├── middleware/      # authMiddleware, errorHandler
        ├── models/          # Mongoose models (User, Product, RoomDesign)
        ├── routes/          # API endpoints (/auth, /products, /room-previews...)
        ├── services/        # cloudflareImageService.js (Cloudflare Workers AI Flux-2)
        ├── utils/           # seedData.js (tạo tài khoản admin mẫu)
        ├── app.js
        └── server.js
```

---

## 🚀 8. Triển khai Online (Deployment Architecture)

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

---

## 🎓 9. Ứng dụng Fourgether Ôn tập & Phân vai 4 thành viên

- Thư mục [fourgether/](file:///d:/mydata/my-project/furneehome/fourgether) là ứng dụng độc lập hỗ trợ 4 thành viên (**Hiệp, Phúc, Triệu, Dũng**) ôn tập bảo vệ đồ án:
  - **32 Thẻ Flashcard chuyên sâu:** Hỏi đáp vị trí source code, luồng xử lý AI và kiến trúc hệ thống.
  - **Lưu tiến độ cá nhân riêng biệt:** Từng thành viên tích thuộc câu nào thì hệ thống lưu riêng cho người đó trên điện thoại/máy tính.
  - **Checklist công việc:** Theo dõi nhiệm vụ của từng vai trò (Trưởng nhóm AI, Backend MongoDB, Frontend CSS, Shopee Tools).
  - **Deploy:** [https://github.com/xinchaotamhon/fourgether](https://github.com/xinchaotamhon/fourgether) (tự động deploy qua Cloudflare Pages).

---

## 📄 10. Tài liệu dự án

- `furniture-store.txt`: Bản phác thảo kiến trúc ý tưởng ban đầu của nhóm.
- `G5_furniture-store_Review_1_2_VI.docx`: Bản tiếng Việt để nhóm kiểm tra & nộp đồ án.
- `G5_furniture-store_Review_1_2_EN.docx`: Bản tiếng Anh dễ đọc, dễ thuyết trình.
