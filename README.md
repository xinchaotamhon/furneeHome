# FurneeHome 🛋️✨

> **Nền tảng AI hỗ trợ xem trước đồ nội thất trong căn phòng thật** (Dành cho học sinh, sinh viên và người ở phòng trọ nhỏ).

---

## ⚡ 1. Bật dự án nhanh (Chỉ 1 Click)

Dành cho Windows:
👉 **Sau khi cấu hình `.env` theo mục 6, click đúp vào file `start-furneehome.bat` ở thư mục gốc.**
*(File script sẽ tự động mở 2 cửa sổ terminal chạy cả Backend Port 5000 và Frontend Port 5173 cùng lúc).*

*(Nếu muốn chạy thủ công bằng terminal)*:
- **Frontend:** Mở terminal $\rightarrow$ `cd client` $\rightarrow$ `npm run dev` (chạy tại `http://localhost:5173`)
- **Backend:** Mở terminal $\rightarrow$ `cd server` $\rightarrow$ `npm run dev` (chạy tại `http://localhost:5000`)

---

## 🔑 2. Đăng nhập thật và tài khoản Admin

Đăng nhập/đăng ký hiện dùng backend Express, MongoDB và JWT; không còn tài khoản thử được tạo trực tiếp trong trình duyệt.

- **Khách hàng:** bấm **Đăng ký** trong modal để tạo tài khoản thật qua API.
- **Admin:** tài khoản phải tồn tại trong collection `users` của MongoDB. Nếu cần tạo/cập nhật tài khoản từ biến môi trường thì mới dùng `ADMIN_EMAIL`, `ADMIN_PASSWORD` rồi chạy `cd server` và `npm run seed`; các biến này không cần để backend local khởi động.
- Token đăng nhập được lưu ở trình duyệt dưới khóa `accessToken`; quyền thật vẫn được kiểm tra lại ở backend bằng JWT và middleware Admin.

> Không ghi mật khẩu admin thật vào README, source code hoặc Git. Xem mục 6 để cấu hình biến môi trường.

---

## 🗺️ 3. Các trang và chức năng chính

| Trang | Đường dẫn (URL) | Chức năng chính |
|---|---|---|
| **Trang chủ** | `/` | Giới thiệu dự án, danh mục nổi bật, dẫn nhanh đến phòng thử |
| **Danh sách sản phẩm** | `/products` | 50 sản phẩm chuẩn hóa (Bàn học, Ghế, Tủ, Kệ sách, Đèn, Decor), link Shopee |
| **Phòng thử (Room Studio)** | `/room-studio` | **3 bước trực quan:** 1. Chấm góc phòng $\rightarrow$ 2. Chọn đồ & bấm góc muốn kê $\rightarrow$ 3. Xem thử AI |
| **Bộ sưu tập** | `/collection` | Xem lại đồ yêu thích và các ảnh phòng AI đã tạo (có cơ chế chống tràn Storage) |
| **Quản trị** | `/admin` | Thêm, sửa, xóa sản phẩm trong CSDL MongoDB Atlas (dành cho Admin) |

---

## 🌿 4. Hướng dẫn làm việc với Git cho 4 thành viên nhóm

Mỗi thành viên làm việc trên **nhánh riêng** của mình (`feature/phuc`, `feature/trieu`, `feature/dung`), hoặc pull trực tiếp từ nhánh `main`.

### 0️⃣ Thiết lập lần đầu (Clone & Cài đặt thư viện):
```powershell
git clone https://github.com/xinchaotamhon/furneeHome.git
cd furneeHome
git fetch origin

# Chuyển sang nhánh riêng của bạn (hoặc ở lại main):
git switch feature/phuc   # (hoặc feature/trieu / feature/dung)

# Cài đặt thư viện cho cả Frontend và Backend:
cd client && npm install
cd ..\server && npm install
```

### 1️⃣ Khi muốn lấy code mới nhất từ `main` về nhánh của bạn (Chỉ 1 lệnh duy nhất):
> Đang ở nhánh của bạn (ví dụ `feature/phuc`), chỉ cần chạy lệnh này để gộp code mới nhất từ `main` vào nhánh của mình:

```powershell
git pull origin main
```

### 2️⃣ Sau khi làm xong tính năng (Đẩy code lên GitHub):
```powershell
git add .
git commit -m "feat: mô tả ngắn gọn nội dung bạn vừa làm"
git push origin feature/ten-cua-ban
```
*(Sau khi push xong, báo cho trưởng nhóm Hiệp để review và merge vào `main`).*

---

## 🛒 5. Hướng dẫn cào & Nạp sản phẩm từ Shopee vào Database

Để thêm đồ nội thất Shopee mới vào trang web và phòng thử AI:

### 🔹 Bước 1: Lưu ảnh tách nền (PNG)
1. Lấy mã số **Item ID** ở cuối link Shopee (Ví dụ: `https://shopee.vn/...-i.1709649747.`**`52663854319`**).
2. Lưu file ảnh tách nền vào thư mục:
   👉 **`client/public/images/products/52663854319.png`**

### 🔹 Bước 2: Dán link Shopee vào tool
Mở file [tools/importProducts.js](tools/importProducts.js), thêm link sản phẩm vào mảng `DEFAULT_PRODUCTS`:

```javascript
const DEFAULT_PRODUCTS = [
  'https://shopee.vn/link-san-pham-shopee-1...',
  'https://shopee.vn/link-san-pham-shopee-2...',
];
```

### 🔹 Bước 3: Chạy lệnh tự động nạp dữ liệu
Mở terminal tại thư mục gốc `furneehome` và chạy:

```bash
node tools/importProducts.js
```

> **Cơ chế tự động của Tool:**
> 1. **Kiểm tra MongoDB:** Nếu link hoặc mã sản phẩm **ĐÃ CÓ TRÊN MONGODB**, tool sẽ **TỪ CHỐI nạp ngay lập tức** và in cảnh báo chi tiết để tránh trùng lặp.
> 2. **Chưa có trong DB:** Tool tự động liên kết với file ảnh tách nền tương ứng trong `client/public/images/products/`, thêm sản phẩm mới vào MongoDB và sao lưu ra `client/public/data_import/data_import.json`.


### 🔹 Quyết định về giá

Hiện dữ liệu đúng là **50 sản phẩm**. Giá Shopee có thể thay đổi nên không xem giá đã cào là giá bán hiện tại. Trong giai đoạn này:

- `price` chỉ là giá tham khảo; có thể để `0` nếu sản phẩm đi theo hướng affiliate.
- `sourceUrl`/link Shopee là đường dẫn người dùng mở để xem giá và mua.
- Chưa tích hợp cập nhật giá tự động. Chỉ thêm khi có một tool đáng tin cậy để Admin bấm cập nhật hoặc chạy cập nhật hằng ngày và có thể kiểm tra lỗi; nếu chưa có thì giữ mô hình affiliate.

---

## ⚙️ 6. Cấu hình biến môi trường (`.env`)

Dự án dùng **một file `.env` duy nhất ở thư mục gốc**. Giữ nguyên file `.env` hiện có của nhóm; không cần tạo thêm file môi trường để chạy local.

| Biến | Mục đích |
|---|---|
| `PORT` | Cổng backend, mặc định `5000` |
| `CLIENT_URL` | Địa chỉ frontend được phép gọi API, thường là `http://localhost:5173` khi chạy máy cá nhân |
| `MONGO_URI` | Chuỗi kết nối MongoDB Atlas |
| `JWT_SECRET` | Secret tùy chọn; nếu không có, local hiện giữ fallback cũ để không phá cách chạy của nhóm. Khi deploy nên cấu hình secret riêng |
| `ADMIN_EMAIL` | Email dùng để tạo/cập nhật tài khoản Admin khi chạy seed |
| `ADMIN_PASSWORD` | Mật khẩu Admin dùng khi chạy seed; không đưa vào Git |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID của Cloudflare Workers AI |
| `CLOUDFLARE_API_TOKEN` | Token gọi Cloudflare Workers AI; chỉ backend đọc |
| `CLOUDFLARE_IMAGE_MODEL` | Model tạo ảnh, mặc định là Flux-2 Klein |

### Thêm JWT_SECRET cho xác thực backend

Khi dùng đăng nhập thật, nên thêm một secret riêng vào chính file .env ở thư mục gốc:

~~~
JWT_SECRET=tu-chuoi-ngau-nhien-dai-it-nhat-32-ky-tu
~~~

- Có thể giữ nguyên .env hiện tại và chỉ thêm một dòng này; không cần sửa start-furneehome.bat.
- Sau khi thêm hoặc thay secret, hãy khởi động lại backend; các token cũ sẽ hết hiệu lực và người dùng cần đăng nhập lại.
- Không dùng đúng chuỗi ví dụ trên, không commit và không gửi secret qua chat.

Nếu cần tạo hoặc cập nhật tài khoản Admin từ biến môi trường, chạy:

```
cd server
npm run seed
```

Không commit `.env`, không dán giá trị secret vào tài liệu, và không tạo thêm `.env` bên trong `client/` hoặc `server/`.


## 📁 7. Cấu trúc thư mục dự án

Đây là cấu trúc dạng cây để nhóm dễ nhìn khi thuyết trình. Những file có cùng vai trò được đặt cạnh nhau; các folder phụ trợ được tách ở cuối cây.

~~~text
furneehome/
├── .env                              # Cấu hình MongoDB, Cloudflare và tùy chọn JWT; không commit
├── README.md                         # Hướng dẫn chạy, chức năng, dữ liệu và cấu trúc dự án
├── START_HERE.md                     # Quy tắc để AI/lập trình viên đọc trước khi sửa
├── start-furneehome.bat              # Mở backend và frontend trên Windows
├── G5_furniture-store_Review_1_2_VI.docx
├── G5_furniture-store_Review_1_2_EN.docx
│
├── client/                           # Frontend React + Vite
│   ├── package.json                  # Thư viện và lệnh chạy frontend
│   ├── package-lock.json             # Khóa phiên bản thư viện frontend
│   ├── index.html                    # HTML shell của Vite
│   ├── vite.config.js                # Cấu hình Vite và React plugin
│   │
│   ├── public/
│   │   ├── favicon.ico               # Biểu tượng trình duyệt
│   │   ├── data_import/
│   │   │   └── data_import.json      # Backup 50 sản phẩm khi API chưa sẵn sàng
│   │   └── images/
│   │       ├── README.md             # Quy ước đặt ảnh sản phẩm
│   │       └── products/
│   │           └── *.png             # Ảnh sản phẩm tách nền theo Item ID
│   │
│   └── src/
│       ├── main.jsx                  # Điểm khởi động React và nạp CSS
│       ├── App.jsx                   # Bọc Auth, Product, Collection Provider và Router
│       ├── router.jsx                # Khai báo URL và khu vực Admin
│       │
│       ├── components/
│       │   ├── auth/
│       │   │   └── LoginModal.jsx    # Modal đăng nhập/đăng ký qua backend
│       │   ├── common/
│       │   │   └── Button.jsx        # Nút dùng lại
│       │   ├── layout/
│       │   │   ├── MainLayout.jsx    # Khung trang chung
│       │   │   ├── Header.jsx        # Điều hướng, user và link Admin
│       │   │   └── Footer.jsx        # Footer chung
│       │   └── product/
│       │       ├── ProductArtwork.jsx # Ảnh hoặc placeholder sản phẩm
│       │       ├── ProductCard.jsx    # Thẻ một sản phẩm
│       │       └── ProductGrid.jsx    # Lưới sản phẩm
│       │
│       ├── context/
│       │   ├── AuthContext.jsx       # Login/register thật, JWT và logout
│       │   ├── ProductContext.jsx     # Tải sản phẩm và gọi CRUD Admin
│       │   └── CollectionContext.jsx # Lưu yêu thích/mẫu phòng ở localStorage
│       ├── hooks/
│       │   └── useDebounce.js        # Trì hoãn tìm kiếm khi người dùng gõ
│       │
│       ├── pages/
│       │   ├── HomePage.jsx           # Trang giới thiệu
│       │   ├── ProductListPage.jsx    # Tìm kiếm và xem 50 sản phẩm
│       │   ├── RoomStudioPage.jsx     # Chọn điểm, đặt đồ, xem thử AI
│       │   ├── CollectionPage.jsx     # Xem sản phẩm/mẫu phòng đã lưu
│       │   ├── AdminPage.jsx          # CRUD sản phẩm qua API
│       │   └── NotFoundPage.jsx       # URL không tồn tại
│       │
│       ├── services/
│       │   ├── apiClient.js           # Axios client và Bearer token
│       │   ├── authService.js         # API login/register
│       │   ├── productService.js      # API đọc/thêm/sửa/xóa sản phẩm
│       │   └── roomPreviewService.js  # API tạo preview AI
│       │
│       ├── styles/
│       │   ├── theme.css              # Màu, font và design token
│       │   └── global.css             # Layout và CSS responsive
│       │
│       └── utils/
│           ├── cameraSolver.js        # Điểm tụ, tiêu cự, ma trận camera
│           ├── roomPreviewCanvas.js   # Crop, tỷ lệ, phối cảnh, bóng, composite
│           ├── formatPrice.js         # Định dạng tiền VND
│           └── normalizeText.js       # Tìm kiếm/so sánh không dấu
│
├── server/                           # Backend Node.js + Express + MongoDB
│   ├── package.json                  # Thư viện và lệnh chạy backend
│   ├── package-lock.json             # Khóa phiên bản thư viện backend
│   └── src/
│       ├── app.js                    # Express app, CORS, JSON và routes
│       ├── server.js                 # Kết nối MongoDB và mở port 5000
│       │
│       ├── config/
│       │   ├── db.js                 # Kết nối MongoDB Atlas
│       │   └── env.js                # Đọc .env root
│       ├── controllers/
│       │   ├── authController.js     # Login, register, bcrypt và JWT
│       │   ├── productController.js  # List và CRUD sản phẩm
│       │   ├── roomPreviewController.js # Kiểm tra request preview
│       │   ├── roomDesignController.js  # Lưu/đọc thiết kế phòng
│       │   └── adminController.js    # API quản trị user
│       ├── middleware/
│       │   ├── authMiddleware.js     # Xác thực JWT và role Admin
│       │   └── errorHandler.js       # Format lỗi API
│       ├── models/
│       │   ├── User.js               # User và role customer/admin
│       │   ├── Product.js             # Sản phẩm, ảnh, giá, link nguồn
│       │   ├── Category.js            # Danh mục
│       │   └── RoomDesign.js          # Thiết kế phòng của user
│       ├── routes/
│       │   ├── index.js              # Gom route dưới /api
│       │   ├── authRoutes.js         # /auth/login, /auth/register
│       │   ├── productRoutes.js      # GET công khai, CRUD cần Admin
│       │   ├── roomPreviewRoutes.js  # /room-previews
│       │   ├── roomDesignRoutes.js   # /room-designs
│       │   └── adminRoutes.js        # /admin/users
│       ├── services/
│       │   └── cloudflareImageService.js # Prompt và gọi Cloudflare AI
│       └── utils/
│           └── seedData.js           # Seed Category/Admin khi cần
│
├── tools/                            # Script dữ liệu, không phải runtime website
│   ├── importProducts.js             # Import sản phẩm từ Shopee
│   ├── syncMongoToJson.js            # Đồng bộ MongoDB về JSON frontend
│   └── fixProductCategories.js       # Chuẩn hóa danh mục
│
├── fSpy_3d-matching/                 # Repo tham khảo cho camera matching
├── fourgether/                       # Flashcard/checklist ôn bảo vệ
└── artifacts/                        # Ảnh và kết quả thử nghiệm
~~~

### Cách hiểu khi thuyết trình

- Phần chính cần trình bày: client, server, tools, data_import và ảnh sản phẩm.
- fSpy_3d-matching chỉ là repo tham khảo; frontend runtime dùng cameraSolver.js.
- fourgether và artifacts phục vụ làm việc/ôn tập, không phải dependency để website chạy.
- roomPreviewCanvas.js dài hơn các file khác vì chứa phép tính canvas và phối cảnh; không nên đơn giản hóa bằng cách xóa bớt logic hình học.


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
   - **Environment Variables:** `MONGO_URI`, `CLIENT_URL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGE_MODEL`; thêm `JWT_SECRET` khi deploy và thêm `ADMIN_EMAIL`/`ADMIN_PASSWORD` nếu cần chạy seed.

3. **Database $\rightarrow$ MongoDB Atlas Cloud:**
   - Cần cấu hình **Network Access** $\rightarrow$ `0.0.0.0/0` để Backend Render kết nối được.

---

## 🎓 9. Ứng dụng Fourgether Ôn tập & Phân vai 4 thành viên

- Thư mục [fourgether/](fourgether) là ứng dụng độc lập hỗ trợ 4 thành viên (**Hiệp, Phúc, Triều, Dũng**) ôn tập bảo vệ đồ án:
  - **32 Thẻ Flashcard chuyên sâu:** Hỏi đáp vị trí source code, luồng xử lý AI và kiến trúc hệ thống.
  - **Lưu tiến độ cá nhân riêng biệt:** Từng thành viên tích thuộc câu nào thì hệ thống lưu riêng cho người đó trên điện thoại/máy tính.
  - **Checklist công việc:** Theo dõi nhiệm vụ của từng vai trò (Trưởng nhóm AI, Backend MongoDB, Frontend CSS, Shopee Tools).
  - **Deploy:** [https://github.com/xinchaotamhon/fourgether](https://github.com/xinchaotamhon/fourgether) (tự động deploy qua Cloudflare Pages).
