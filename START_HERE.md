# START HERE — FurneeHome 🛋️✨

> **Dành cho AI Agent & Lập trình viên:** Đây là tài liệu quy chuẩn quan trọng nhất của dự án FurneeHome. Bất kỳ lập trình viên hay AI Agent nào khi bắt đầu phiên làm việc MỚI trên repository này **PHẢI đọc và tuân thủ tuyệt đối** các quy định kiến trúc dưới đây.

---

## 1. Bản chất dự án & Phạm vi chốt (Scope)

- **Mục tiêu:** FurneeHome là nền tảng web AI hỗ trợ học sinh, sinh viên và người ở phòng nhỏ xem trước đồ nội thất đặt vào ảnh căn phòng thật của mình thông qua AI (Cloudflare Workers AI - model Flux-2).
- **Định hướng sản phẩm:** **KHÔNG PHẢI sàn thương mại điện tử.**
  - ❌ **KHÔNG** có giỏ hàng, đặt hàng, thanh toán trực tuyến (Cart/Checkout/Order).
  - ❌ **KHÔNG** dùng 3D, Three.js, WebGL hay các file mô hình 3D phức tạp (`.glb`, `.gltf`).
  - ❌ **KHÔNG** dùng Tailwind CSS (chuẩn hóa 100% về CSS thuần + Design tokens).
  - ✅ Sản phẩm xem thử ưng ý sẽ điều hướng mua trực tiếp qua link Shopee giá sinh viên.
  - ✅ Quản lý đồ yêu thích và mẫu phòng AI đã tạo qua **Bộ sưu tập (`/collection`)**.

---

## 2. Luồng kỹ thuật cốt lõi: Phòng thử AI (Room Studio 2D)

Luồng hoạt động của Room Studio được thiết kế theo cơ chế **"Một chạm" (One-touch)**:
1. **Frontend:** Người dùng tải ảnh phòng $\rightarrow$ Chọn sản phẩm nội thất $\rightarrow$ Chấm một vị trí đáy sản phẩm (`target: { x: 0..1, y: 0..1, anchor: 'bottom-center' }`).
2. **Crop & Guide:** [roomPreviewCanvas.js](file:///d:/mydata/my-project/furneehome/client/src/utils/roomPreviewCanvas.js) tự động tính toán và tạo một crop nhỏ (`editRegion`) quanh sản phẩm kèm ảnh sản phẩm tách nền PNG.
3. **Backend API:** [roomPreviewController.js](file:///d:/mydata/my-project/furneehome/server/src/controllers/roomPreviewController.js) nhận request `multipart/form-data` và gọi [cloudflareImageService.js](file:///d:/mydata/my-project/furneehome/server/src/services/cloudflareImageService.js).
4. **AI Generation:** Gửi `input_image_0` (crop phòng) + `input_image_1` (sản phẩm PNG) tới Cloudflare Workers AI (`@cf/black-forest-labs/flux-2-klein-4b`).
5. **Composite:** Frontend nhận crop AI trả về $\rightarrow$ ghép (composite) đè lại vào ảnh phòng gốc $\rightarrow$ tự động lưu bản xem thử vào `CollectionContext` (localStorage).
6. **Fallback Offline:** Nếu mất mạng hoặc lỗi API, hệ thống tự động hiển thị Canvas 2D overlay để trải nghiệm không bị gián đoạn.

> **Quy tắc tọa độ:** Tọa độ vị trí LUÔN được lưu dạng số chuẩn hóa từ `0.0` đến `1.0` theo tỷ lệ ảnh gốc, gốc tọa độ `(0, 0)` ở góc trên bên trái ảnh.

---

## 3. Cấu hình môi trường & Dữ liệu

- **Biến môi trường (.env):** Duy nhất **1 file `.env` đặt tại thư mục gốc dự án** chứa `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGE_MODEL`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`.
- **Backend MongoDB:** Kết nối MongoDB Atlas Cloud qua `server/src/config/db.js`.
- **Tool Shopee:** [tools/importProducts.js](file:///d:/mydata/my-project/furneehome/tools/importProducts.js) bóc tách JSON-LD từ Shopee $\rightarrow$ upsert vào MongoDB collection `products` $\rightarrow$ backup ra `client/public/data_import/data_import.json`.
- **Typography:** Toàn bộ hệ thống dùng font Google Font **`Be Vietnam Pro`** hỗ trợ 100% tiếng Việt có dấu, tuyệt đối không dùng font hệ thống `Georgia` để tránh lỗi vỡ dấu thanh.

---

## 4. Công nghệ & Kiến trúc chuẩn hóa

- **Frontend:** React 19, Vite, React Router v7, 100% CSS thuần ([theme.css](file:///d:/mydata/my-project/furneehome/client/src/styles/theme.css) + [global.css](file:///d:/mydata/my-project/furneehome/client/src/styles/global.css)).
- **Backend:** Node.js Express 5 theo mô hình **Direct MVC** (Controller gọi trực tiếp Mongoose Model, code ngắn gọn 10-15 dòng/hàm, không bọc qua nhiều tầng service thừa).
- **Khởi động 1-Click:** Script [start-furneehome.bat](file:///d:/mydata/my-project/furneehome/start-furneehome.bat) chạy song song Frontend (Port 5173) và Backend (Port 5000).
- **Triển khai Online:** Frontend trên Cloudflare Pages + Backend trên Render.com + Database trên MongoDB Atlas.
- **Ứng dụng phụ trợ:** Thư mục [fourgether/](file:///d:/mydata/my-project/furneehome/fourgether) chứa ứng dụng Flashcard 32 câu hỏi vấn đáp và phân chia công việc cho 4 thành viên (Hiệp, Phúc, Triều, Dũng).

---

## 5. Các điều AI & Lập trình viên TUYỆT ĐỐI KHÔNG LÀM (Anti-patterns)

1. 🚫 **Không cài lại Tailwind CSS, Bootstrap** hay các thư viện utility CSS lớn.
2. 🚫 **Không cài lại Three.js, @react-three/fiber** hay cố gắng phục hồi mô hình 3D.
3. 🚫 **Không tạo trang Đăng nhập/Đăng ký riêng dạng full page** (Luôn dùng modal popup `components/auth/LoginModal.jsx`).
4. 🚫 **Không tự ý thêm nút xoay 3D, co giãn phức tạp** vào màn hình Room Studio.
5. 🚫 **Không lưu secret/token trực tiếp vào code** (Chỉ đọc qua `server/src/config/env.js`).
6. 🚫 **Không tạo các tầng service trung gian thừa thãi** cho các thao tác Mongoose CRUD cơ bản.
7. 🚫 **Không tạo các file `.env` rải rác** trong `client/` hoặc `server/` (chỉ dùng duy nhất 1 file `.env` ở root).

---

## 6. Tiêu chí hoàn thành (Definition of Done)

1. **Frontend build sạch:** Chạy `npm run build` trong thư mục `client` phải thành công (`exit code 0`).
2. **Backend chạy sạch:** `node server/src/server.js` khởi động thành công và kết nối MongoDB an toàn.
3. **Responsive:** Giao diện hiển thị sắc nét trên cả màn hình máy tính và điện thoại.
4. **Tài liệu đồng bộ:** Khi có thay đổi kiến trúc, luôn cập nhật cả `README.md` và `START_HERE.md`.
