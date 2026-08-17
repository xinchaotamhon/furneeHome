# START HERE — furniture-store (FurneeHome)

Đây là file đầu tiên AI và thành viên phải đọc trước khi sửa project.

## 1. Mục tiêu đã chốt

FurneeHome giúp người dùng dễ quyết định chọn đồ nội thất cho phòng nhỏ. Người dùng tải ảnh phòng thật, chọn một sản phẩm quen thuộc, chấm vị trí muốn đặt sản phẩm rồi có thể dùng AI tạo bản xem chân thực hơn.

Project **không còn là website bán hàng truyền thống**, không có giỏ hàng và không dùng mô hình phòng 3D. Sản phẩm có thể dẫn người dùng sang trang tìm kiếm hoặc sản phẩm cụ thể trên Shopee.

## 2. Các màn hình và hành vi ổn định

- Trang chủ.
- Danh sách sản phẩm; tìm kiếm phải hỗ trợ tiếng Việt có dấu và không dấu.
- Bộ sưu tập: lưu sản phẩm yêu thích và lựa chọn vị trí trong phòng.
- Header có hai nút riêng: `Đăng nhập` và `Bắt đầu miễn phí`.
- Đăng nhập/đăng ký dùng chung modal trên trang hiện tại, không có page riêng.
- Phòng thử: tải ảnh, chọn sản phẩm, chấm một vị trí và kéo ghim để đổi vị trí.
- Ghim lưu tọa độ phần trăm theo ảnh gốc; không dùng lưới, kích thước phòng, phóng thu hoặc xoay sản phẩm.
- Trang quản trị chỉ dùng được với role `admin`.
- Trang 404.

## 3. Trạng thái dữ liệu

- 10 sản phẩm trong `client/src/data/sampleProducts.js` chỉ là **dữ liệu mẫu tạm thời**.
- Sản phẩm, đăng nhập thử và Bộ sưu tập đang được lưu bằng `localStorage`.
- Chưa ghi dữ liệu mẫu vào MongoDB.
- Giá và liên kết Shopee hiện là dữ liệu tham khảo, có thể thay đổi theo người bán.
- Backend MongoDB hiện được giữ làm nền để kết nối khi nhóm có dữ liệu thật.
- Krea API chưa được kết nối vì chưa có API key và chưa chốt model chỉnh sửa ảnh.

## 4. Công nghệ

- Frontend: React + Vite + Tailwind CSS và CSS thông thường.
- Backend: Node.js + Express.
- Database dự kiến: MongoDB + Mongoose.
- Role: `customer`, `admin`.

## 5. Quy tắc bắt buộc

1. Mỗi page tương ứng một route và một file trong `client/src/pages`.
2. Component dùng lại đặt trong `client/src/components` theo nhóm chức năng.
3. Login/register luôn dùng `components/auth/LoginModal.jsx`; không tạo page đăng nhập riêng.
4. Dữ liệu mẫu frontend đi qua Context; dữ liệu thật sau này gọi backend qua `client/src/services`.
5. Backend giữ luồng đơn giản: `route -> controller -> service -> model`.
6. Không đặt secret trong source. Krea API key và MongoDB URI chỉ được đặt trong `.env` của backend.
7. Không tự thêm chức năng, package hoặc kiến trúc lớn khi chưa được chủ dự án đồng ý.
8. Giao diện, trải nghiệm người dùng và quyết định thực tế phải do chủ dự án xem và chốt. AI phải hỏi khi có nhiều phương án ảnh hưởng rõ rệt đến kết quả.
9. Không commit, merge hoặc push nếu chủ dự án chưa yêu cầu.
10. Tọa độ vị trí phải được lưu chuẩn hóa từ `0` đến `1`, lấy góc trên bên trái ảnh làm gốc; không lưu theo kích thước màn hình.

## 6. Điều kiện hoàn thành khi sửa code

- Chức năng mới chạy được trên màn hình máy tính và điện thoại.
- Không làm hỏng các route hiện có.
- Chạy `npm run build` trong `client` thành công.
- Nếu sửa backend, kiểm tra `/api/health` và phần route liên quan.
- Cập nhật README hoặc START_HERE nếu phạm vi, route hoặc trạng thái dữ liệu thay đổi.

## 7. Thứ tự đọc

1. `START_HERE.md`
2. `README.md`
3. `client/src/router.jsx`
4. Page, component hoặc backend module liên quan đến nhiệm vụ.

Nếu tài liệu khác code chạy thật, phải báo lại trước khi tự sửa phạm vi lớn.
