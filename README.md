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

- **Khách hàng:** bấm **Đăng ký** trong modal để tạo tài khoản thật qua API; có thể đăng nhập bằng tên đăng nhập hoặc email.
- **Admin deploy:** tài khoản phải tồn tại trong collection `users` của MongoDB. Cấu hình `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` bằng secret của Render rồi chạy seed một lần. Production yêu cầu mật khẩu tối thiểu 12 ký tự.
- **Admin local:** script `server/src/utils/bootstrapLocalAdmin.js` chỉ tạo tài khoản `localOnly` để demo trên chính máy đó và luôn từ chối production. Không dùng tài khoản/mật khẩu demo ngắn cho website công khai.
- Token đăng nhập được lưu ở trình duyệt dưới khóa `accessToken`; quyền thật vẫn được kiểm tra lại ở backend bằng JWT và middleware Admin.

> Không ghi mật khẩu admin thật vào README, source code hoặc Git. Xem mục 6 để cấu hình biến môi trường.

---

## 🗺️ 3. Các trang và chức năng chính

| Trang | Đường dẫn (URL) | Chức năng chính |
|---|---|---|
| **Trang chủ** | `/` | Giới thiệu dự án, danh mục nổi bật, dẫn nhanh đến phòng thử |
| **Danh sách sản phẩm** | `/products` | 68 sản phẩm thuộc các nhóm Ghế, Bàn học, Tủ, Kệ sách và Nội thất; mở link Shopee để xem nguồn |
| **Phòng thử (Room Studio)** | `/room-studio` | Tải ảnh → AI gợi ý cả phòng, hoặc chọn món rồi bấm vị trí để tự đặt. Khách có một lượt tạo ảnh thành công; chấm một ô sàn thật chỉ là tùy chọn |
| **Bộ sưu tập** | `/collection` | Lưu ảnh gốc/kết quả, loại ý tưởng, vị trí/kích thước/xoay/lật/layer, điểm tham chiếu và mô tả; mở lại hoặc chủ động chia sẻ |
| **Mẫu công khai** | `/collections/public` | Xem các mẫu được chủ sở hữu công khai; đăng nhập để công khai hoặc dùng lại thành bản sao riêng tư |
| **Quản trị** | `/admin` | Dán URL Shopee, CRUD sản phẩm, thêm ảnh vào MongoDB và tải JSON fallback mới nhất (dành cho Admin) |

---

## 🌿 4. Hướng dẫn làm việc với Git cho 4 thành viên nhóm

Mỗi thành viên làm trên nhánh riêng (`feature/phuc-next`, `feature/trieu`, `feature/dung`). Trưởng nhóm review rồi mới merge vào `main`.

### 0️⃣ Thiết lập lần đầu
```powershell
git clone https://github.com/xinchaotamhon/furneeHome.git
cd furneeHome
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/phuc-next          # đổi thành tên nhánh mới của bạn
git push -u origin feature/phuc-next

cd client
npm install
cd ..\server
npm install
```

### 1️⃣ Sửa riêng lỗi nhánh của Phúc

`origin/phuc` và `origin/feature/phuc` đều được tạo từ lịch sử cũ. Các commit cần thiết đã được trưởng nhóm merge vào `main`; không pull `main` trực tiếp vào hai nhánh cũ này. Phúc giữ chúng làm bản lưu và tạo nhánh mới từ `main`:

```powershell
git fetch origin
git switch -c feature/phuc-next origin/main
git push -u origin feature/phuc-next
```

Từ lần sau Phúc làm việc và push trên `feature/phuc-next`; không cần force-push hoặc xóa nhánh cũ.

### 2️⃣ Lấy code mới từ `main` về nhánh cá nhân

Commit phần đang làm dở trước, rồi chạy:

```powershell
git switch main
git pull --ff-only origin main
git switch feature/phuc-next   # đổi thành nhánh của bạn
git merge main
```

Nếu Git báo conflict và bạn chưa biết xử lý, chạy `git merge --abort` rồi báo cho Hiệp. Không chạy `git pull origin main` ngay trên nhánh cá nhân và không dùng `git push --force`.

### 3️⃣ Đẩy phần đã làm lên GitHub
```powershell
git add .
git status
git commit -m "feat: mô tả ngắn gọn nội dung bạn vừa làm"
git push
```

*(Sau khi push xong, báo cho trưởng nhóm Hiệp để review và merge vào `main`.)*

---

## 🛒 5. Hướng dẫn cào & Nạp sản phẩm từ Shopee vào Database

Để thêm đồ nội thất Shopee mới vào trang web và phòng thử AI:

- **Cách nhanh trên website deploy:** Admin mở `/admin`, dán URL Shopee hợp lệ, hoàn thiện tên/danh mục/giá rồi bấm thêm. Chọn lại sản phẩm để tải ảnh; trình duyệt nén WebP trước khi backend lưu vào MongoDB. Nút tải JSON tạo bản fallback **nhẹ, không nhúng ảnh base64** để nhóm kiểm tra và commit khi cần; ảnh upload đầy đủ vẫn nằm trong MongoDB.
- **Cách theo lô trong repo:** dùng ba bước dưới đây khi nhóm đã chuẩn bị nhiều ảnh PNG và muốn cập nhật MongoDB cùng JSON local.

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
node tools/importProducts.js --dry-run
node tools/importProducts.js
```

Lệnh `--dry-run` chỉ kiểm tra URL, ID, slug, PNG, danh mục, giá và dữ liệu trùng; không kết nối MongoDB và không ghi file. Chỉ chạy lệnh import thật sau khi kiểm tra đạt.

> **Cơ chế tự động của Tool:**
> 1. **Kiểm tra MongoDB:** Nếu link hoặc mã sản phẩm **ĐÃ CÓ TRÊN MONGODB**, tool sẽ **TỪ CHỐI nạp ngay lập tức** và in cảnh báo chi tiết để tránh trùng lặp.
> 2. **Chưa có trong DB:** Tool tự động liên kết với file ảnh tách nền tương ứng trong `client/public/images/products/`, thêm sản phẩm mới vào MongoDB và sao lưu ra `client/public/data_import/data_import.json`.


### 🔹 Quyết định về giá

Hiện dữ liệu có **68 sản phẩm** và 68 URL Shopee riêng; 57 món đã có PNG local, 11 món mới đang chờ Admin tải ảnh. Room Studio đưa món có ảnh lên trước và khóa món thiếu ảnh để không gửi reference giả sang AI. `price` của cả 68 món vẫn đang bằng `0`. Giá Shopee có thể thay đổi nên không xem giá đã cào là giá bán hiện tại. Trong giai đoạn này:

- `price` chỉ là giá tham khảo; có thể để `0` nếu sản phẩm đi theo hướng affiliate.
- `sourceUrl`/link Shopee là đường dẫn người dùng mở để xem giá và mua.
- Chưa tích hợp cập nhật giá tự động. Chỉ thêm khi có một tool đáng tin cậy để Admin bấm cập nhật hoặc chạy cập nhật hằng ngày và có thể kiểm tra lỗi; nếu chưa có thì giữ mô hình affiliate.

---

## ⚙️ 6. Cấu hình biến môi trường (`.env`)

Dự án dùng **một file `.env` duy nhất ở thư mục gốc**. Giữ nguyên file `.env` hiện có của nhóm; không cần tạo thêm file môi trường để chạy local.

| Biến | Mục đích |
|---|---|
| `NODE_ENV` | Đặt `production` trên Render để bật toàn bộ kiểm tra bảo mật production. Backend cũng tự nhận `RENDER=true` để không rơi về chế độ local nếu quên biến này |
| `PORT` | Cổng backend, mặc định `5000` |
| `CLIENT_URL` | Địa chỉ frontend được phép gọi API, thường là `http://localhost:5173` khi chạy máy cá nhân |
| `MONGO_URI` | Chuỗi kết nối MongoDB Atlas |
| `JWT_SECRET` | Secret tùy chọn; nếu không có, local hiện giữ fallback cũ để không phá cách chạy của nhóm. Khi deploy nên cấu hình secret riêng |
| `ANONYMOUS_QUOTA_SALT` | Secret HMAC dùng băm IP cho một lượt tạo ảnh của khách; khi deploy nên đặt chuỗi riêng, không commit |
| `TRUST_PROXY` | Cách Express tin proxy để đọc đúng IP. Local để trống/`false`; Render gọi trực tiếp có thể dùng `1`; nếu thêm proxy khác phải cấu hình lại đúng topology |
| `ADMIN_USERNAME` | Tên đăng nhập Admin dùng khi chạy seed; không đưa vào Git nếu muốn giữ riêng |
| `ADMIN_EMAIL` | Email dùng để tạo/cập nhật tài khoản Admin khi chạy seed |
| `ADMIN_PASSWORD` | Mật khẩu Admin dùng khi chạy seed; không đưa vào Git |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID của Cloudflare Workers AI |
| `CLOUDFLARE_API_TOKEN` | Token gọi Cloudflare Workers AI; chỉ backend đọc |
| `CLOUDFLARE_IMAGE_MODEL` | Model tạo ảnh, mặc định là Flux-2 Klein |
| `ROOM_IMAGE_PROVIDER_ORDER` | Thứ tự provider tùy chọn; mặc định `pollinations,cloudflare,huggingface` để thử nhóm model mạnh trước |
| `POLLINATIONS_API_KEY` | Khóa Pollinations tùy chọn; có khóa thì mới bật fallback này |
| `POLLINATIONS_IMAGE_MODELS` | Danh sách model Pollinations từ mạnh đến nhẹ, phân cách bằng dấu phẩy |
| `HF_TOKEN` | Token Hugging Face tùy chọn |
| `HUGGINGFACE_IMAGE_MODEL` | Model image-to-image được `hf-inference` hỗ trợ; phải có cùng `HF_TOKEN` mới bật fallback |

Chỉ cần các biến Cloudflare hiện có là Room Studio vẫn chạy như trước. Khi thêm khóa Pollinations hoặc Hugging Face, backend sẽ tự chuyển provider nếu nơi đang dùng hết quota, timeout hoặc tạm lỗi. Free quota do từng nhà cung cấp quyết định và có thể thay đổi; không provider nào được coi là miễn phí vô hạn.

### Thêm JWT_SECRET cho xác thực backend

Khi dùng đăng nhập thật, hãy thêm biến `JWT_SECRET` vào chính file `.env` ở thư mục gốc và đặt một chuỗi ngẫu nhiên riêng dài ít nhất 32 ký tự.

- Có thể giữ nguyên .env hiện tại và chỉ thêm một dòng này; không cần sửa start-furneehome.bat.
- Sau khi thêm hoặc thay secret, hãy khởi động lại backend; các token cũ sẽ hết hiệu lực và người dùng cần đăng nhập lại.
- Không commit hoặc gửi giá trị secret qua chat.

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
│   │   │   └── data_import.json      # Backup nhẹ của 68 sản phẩm khi API chưa sẵn sàng
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
│       │   └── CollectionContext.jsx # Lưu local và đồng bộ mẫu phòng của tài khoản
│       ├── hooks/
│       │   └── useDebounce.js        # Trì hoãn tìm kiếm khi người dùng gõ
│       │
│       ├── pages/
│       │   ├── HomePage.jsx           # Trang giới thiệu
│       │   ├── ProductListPage.jsx    # Tìm kiếm và xem 68 sản phẩm
│       │   ├── RoomStudioPage.jsx     # Chọn điểm, đặt đồ, xem thử AI
│       │   ├── CollectionPage.jsx     # Xem, mở lại và chia sẻ mẫu đã lưu
│       │   ├── PublicCollectionsPage.jsx # Danh sách mẫu phòng công khai
│       │   ├── PublicCollectionDetailPage.jsx # Xem và dùng lại một mẫu công khai
│       │   ├── AdminPage.jsx          # CRUD sản phẩm qua API
│       │   └── NotFoundPage.jsx       # URL không tồn tại
│       │
│       ├── services/
│       │   ├── apiClient.js           # Axios client và Bearer token
│       │   ├── authService.js         # API login/register
│       │   ├── productService.js      # API đọc/thêm/sửa/xóa sản phẩm
│       │   ├── roomPreviewService.js  # API tạo preview AI
│       │   └── roomDesignService.js   # API lưu/chia sẻ/dùng lại mẫu phòng
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
│       │   ├── Product.js             # Sản phẩm, gallery ảnh, giá, link nguồn
│       │   ├── Category.js            # Danh mục
│       │   ├── RoomDesign.js          # Thiết kế phòng của user
│       │   └── AnonymousGenerationQuota.js # Lượt tạo ảnh khách theo IP đã băm
│       ├── routes/
│       │   ├── index.js              # Gom route dưới /api
│       │   ├── authRoutes.js         # /auth/login, /auth/register
│       │   ├── productRoutes.js      # GET công khai, CRUD cần Admin
│       │   ├── roomPreviewRoutes.js  # /room-previews
│       │   ├── roomDesignRoutes.js   # /room-designs
│       │   └── adminRoutes.js        # /admin/users
│       ├── services/
│       │   ├── cloudflareImageService.js # Prompt và chuỗi provider ảnh
│       │   ├── anonymousGenerationQuotaService.js # Reserve/use/release lượt khách
│       │   └── productCatalogService.js # Kiểm tra URL, ảnh và export JSON
│       └── utils/
│           ├── seedData.js           # Seed Category/Admin deploy khi cần
│           └── bootstrapLocalAdmin.js # Tạo admin chỉ dùng trên máy local
│
├── tools/                            # Script dữ liệu, không phải runtime website
│   ├── importProducts.js             # Import sản phẩm từ Shopee
│   ├── syncMongoToJson.js            # Đồng bộ MongoDB về JSON frontend
│   ├── fixProductCategories.js       # Chuẩn hóa danh mục
│   ├── smoke-room.cjs                # Smoke test Room Studio, prompt, quota
│   └── smoke-admin.cjs               # Smoke test auth, Admin, ảnh, JSON
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

2. **Backend (`server/`) $\rightarrow$ Deploy lên Render.com (Web Service):**
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Environment Variables chính:** `NODE_ENV=production`, `MONGO_URI`, `CLIENT_URL`, `JWT_SECRET`, `ANONYMOUS_QUOTA_SALT`, `TRUST_PROXY=1`. Nếu dùng Cloudflare làm provider, thêm `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGE_MODEL`.
   - **Fallback ảnh tùy chọn:** `ROOM_IMAGE_PROVIDER_ORDER`, `POLLINATIONS_API_KEY`, `POLLINATIONS_IMAGE_MODELS`, `HF_TOKEN`, `HUGGINGFACE_IMAGE_MODEL`. Thêm `ADMIN_USERNAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` chỉ khi chạy seed Admin.
   - `TRUST_PROXY=1` phù hợp khi người dùng gọi trực tiếp một Render Web Service. Nếu đặt backend sau thêm Cloudflare/proxy khác, phải xác định lại số hop hoặc allowlist; cấu hình sai có thể làm giới hạn khách nhận nhầm IP.

3. **Database $\rightarrow$ MongoDB Atlas Cloud:**
   - Cần cấu hình **Network Access** $\rightarrow$ `0.0.0.0/0` để Backend Render kết nối được.

---

## 🎓 9. Ứng dụng Fourgether Ôn tập & Phân vai 4 thành viên

- `fourgether/` là ứng dụng tĩnh để **Hiệp, Phúc, Triều, Dũng** cùng ôn toàn bộ đồ án:
  - Trang đầu là cây kiến thức theo luồng người dùng → frontend → backend/AI → dữ liệu/deploy → câu hỏi bảo vệ; không chia kiến thức theo độ khó hay thành viên.
  - Bấm một nhánh để mở thẻ ngay; hỗ trợ tìm kiếm, thu/phóng nhánh, lật thẻ và phím tắt.
  - Mọi người học toàn bộ luồng; phân công công việc của nhóm không làm thay đổi nội dung phải biết.
  - Tiến độ chỉ giữ trong phiên hiện tại, không lưu cache ứng dụng hay dữ liệu trình duyệt; tải lại là một phiên học mới.
  - Repo độc lập có thể deploy trực tiếp lên Cloudflare Pages.
