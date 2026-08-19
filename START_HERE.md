# START HERE — furniture-store (FurneeHome)

> **Dành cho AI Agent & Lập trình viên:** Đây là tài liệu quy chuẩn quan trọng nhất. Bất kỳ AI nào khi bắt đầu phiên làm việc MỚI trên repository này PHẢI đọc và tuân thủ tuyệt đối các quy định dưới đây.

---

## 1. Bản chất dự án & Phạm vi chốt (Scope)

- **Mục tiêu:** FurneeHome là ứng dụng web hỗ trợ học sinh, sinh viên và người ở phòng nhỏ xem trước đồ nội thất đặt vào ảnh phòng thật bằng AI (Cloudflare Workers AI - Flux 2).
- **Định hướng sản phẩm:** **KHÔNG PHẢI web bán hàng truyền thống.**
  - ❌ KHÔNG có giỏ hàng, đặt hàng, thanh toán (Cart/Checkout/Order).
  - ❌ KHÔNG dùng 3D, Three.js, WebGL hay file mô hình 3D (`.glb`, `.gltf`).
  - ❌ KHÔNG dùng Tailwind CSS (đã chuẩn hóa 100% về CSS thuần + CSS variables).
  - ✅ Sản phẩm điều hướng người dùng xem/mua qua link tìm kiếm hoặc affiliate trên Shopee.
  - ✅ Quản lý đồ yêu thích và mẫu phòng AI qua **Bộ sưu tập (`CollectionPage`)**.

---

## 2. Luồng kỹ thuật cốt lõi: Phòng thử (Room Studio 2D + AI)

Luồng hoạt động của Room Studio được thiết kế theo cơ chế **"Một chạm" (One-touch)**:
1. **Frontend:** Người dùng tải ảnh phòng $\rightarrow$ Chọn sản phẩm $\rightarrow$ Chấm một vị trí đáy sản phẩm (`target: { x: 0..1, y: 0..1, anchor: 'bottom-center' }`).
2. **Crop & Guide:** [roomPreviewCanvas.js](file:///d:/mydata/my-project/furneehome/client/src/utils/roomPreviewCanvas.js) tự động tính toán và tạo một crop nhỏ (`editRegion`) quanh sản phẩm kèm ảnh sản phẩm tách nền PNG.
3. **Backend API:** [roomPreviewController.js](file:///d:/mydata/my-project/furneehome/server/src/controllers/roomPreviewController.js) nhận request và gọi [cloudflareImageService.js](file:///d:/mydata/my-project/furneehome/server/src/services/cloudflareImageService.js).
4. **AI Generation:** Gửi `input_image_0` (crop phòng) + `input_image_1` (sản phẩm PNG) tới Cloudflare Workers AI (`@cf/black-forest-labs/flux-2-klein-4b`).
5. **Composite:** Frontend nhận crop AI trả về $\rightarrow$ ghép (composite) lại vào ảnh phòng gốc $\rightarrow$ tự động lưu bản xem thử vào `CollectionContext`.

> **Quy tắc tọa độ:** Tọa độ vị trí LUÔN được lưu dạng số chuẩn hóa từ `0` đến `1` theo tỷ lệ ảnh gốc, gốc tọa độ `(0, 0)` ở góc trên bên trái ảnh.

---

## 3. Trạng thái dữ liệu & Cấu hình môi trường

- **Dữ liệu mẫu:** 10 sản phẩm mẫu trong `client/src/data/sampleProducts.js`.
- **Lưu trữ MVP:** Toàn bộ dữ liệu người dùng, đăng nhập thử và Bộ sưu tập hiện lưu trên `localStorage` trình duyệt.
- **Backend MongoDB:** Đã dựng sẵn Models/Controllers, giữ làm nền tảng kết nối khi có dữ liệu thật.
- **Biến môi trường (.env):** 
  - Chỉ duy nhất **1 file `.env` đặt tại thư mục gốc dự án** chứa `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGE_MODEL`, `MONGO_URI`.
  - Backend tự đọc `.env` ở root qua `server/src/config/env.js`.
  - Frontend `client` không cần `.env` (dùng fallback mặc định `http://localhost:5000/api`).

---

## 4. Công nghệ chuẩn hóa

- **Frontend:** React 19, Vite, React Router v7, CSS thuần ([theme.css](file:///d:/mydata/my-project/furneehome/client/src/styles/theme.css) + [global.css](file:///d:/mydata/my-project/furneehome/client/src/styles/global.css)).
- **Backend:** Node.js, Express 5, Mongoose, Cloudflare Workers AI SDK.
- **Khởi động:** Script [start-furneehome.bat](file:///d:/mydata/my-project/furneehome/start-furneehome.bat) chạy cả 2 server cùng lúc.

---

## 5. Các điều AI TUYỆT ĐỐI KHÔNG LÀM (Anti-patterns)

1. 🚫 **Không cài lại Tailwind CSS** hoặc các thư viện CSS utility lớn. Toàn bộ UI phải viết bằng CSS thuần trong `global.css` hoặc `theme.css`.
2. 🚫 **Không cài thêm Three.js, @react-three/fiber** hay cố gắng dựng lại phòng 3D.
3. 🚫 **Không tạo trang Đăng nhập/Đăng ký riêng** (Luôn dùng `components/auth/LoginModal.jsx`).
4. 🚫 **Không tự ý thêm nút xoay, co giãn, phóng to nhỏ sản phẩm** vào Room Studio.
5. 🚫 **Không lưu secret/token trực tiếp vào code** (Chỉ đọc từ `process.env` đã được cấu hình trong `server/src/config/env.js`).
6. 🚫 **Không bọc controller qua quá nhiều tầng service thừa:** Giữ code theo phong cách trực diện (nhận request $\rightarrow$ validate $\rightarrow$ thao tác Mongoose trực tiếp $\rightarrow$ trả `res.json()`), mỗi hàm 10-15 dòng.
7. 🚫 **Không tự ý chạy lệnh `git commit`, `git push`, `git merge`** nếu chủ dự án chưa yêu cầu trực tiếp.

---

## 6. Tiêu chí hoàn thành (Definition of Done) khi AI sửa code

1. Frontend build thành công: Chạy `npm run build` trong `client` không có bất kỳ lỗi nào (`exit code 0`).
2. Không làm hỏng các route hiện có trong `client/src/router.jsx`.
3. Nếu sửa backend: Đảm bảo route `/api/health` và các endpoint liên quan hoạt động đúng.
4. Giao diện chạy mượt mà trên cả Desktop lẫn Mobile.
5. Cập nhật `README.md` hoặc `START_HERE.md` nếu có thay đổi về luồng hoặc cấu hình.
