# Hiệp — Danh sách sản phẩm, Phòng thử và toàn bộ Trang quản trị

> **Vị trí:** phần 4/4, nhận từ Triều. Trình bày `/products`, `/room-studio` rồi `/admin` theo từng tab. Kết thúc bằng kiến trúc request và checklist rà trước khi bảo vệ.

## Thẻ liếc nhanh

- Trang sản phẩm: tìm kiếm, lọc, sắp xếp, phân trang, chọn món cho Phòng thử.
- Phòng thử: tối đa 3 sản phẩm → ảnh phòng → vị trí tùy chọn → ảnh AI.
- Trang quản trị: Sản phẩm → Khách hàng → Đơn hàng → Báo nội dung → Quản trị admin (chỉ Orchestra Admin).
- Bản hiện tại đã có: hóa đơn popup/tải xuống, hồ sơ khách popup, trạng thái đủ hồ sơ và hồ sơ giao hàng nạp mặc định vào checkout. Khi demo, chỉ cần kiểm tra dữ liệu trả về có đủ trường.

### Tài khoản và đầu vào demo

- Admin: `phuc@furneehome.vn` / `123`. Mở `/admin`, có các tab Sản phẩm, Khách hàng, Đơn hàng và Báo nội dung.
- Orchestra Admin: `admin@furneehome.vn` / `123`. Mở `/admin`, có thêm tab **Quản trị admin**.
- Danh sách: tìm `bàn`, chọn một danh mục đang có, chọn **Giá thấp đến cao**.
- Phòng thử: dùng `client/public/images/home-room-1.webp` và chọn 1–3 sản phẩm có ảnh.

## Bước 1 — Danh sách sản phẩm

### Thao tác

1. Mở `https://furneehome.pages.dev/products`.
2. Gõ `bàn` vào ô **Tìm tên sản phẩm**. Dấu hiệu đúng: danh sách và số lượng kết quả đổi.
3. Chọn danh mục đang có, chọn **Giá thấp đến cao**. Dấu hiệu đúng: giá tăng dần.
4. Bấm **Sau**, rồi **Trước** nếu có nhiều trang.
5. Bấm **Thử trong phòng** trên một thẻ, URL chuyển sang `/room-studio`.
6. Bấm **Chọn từ danh sách sản phẩm**, tích món 1, 2, 3, rồi bấm **Quay lại Phòng thử**. Dấu hiệu đúng: bộ đếm là `3/3` và không tích được món thứ tư.

### Nói ngắn

> “Danh sách dùng API cho kết quả chính thức, hỗ trợ tìm kiếm, danh mục, giá và phân trang. Khi mở mặc định, JSON tĩnh có thể hiện trước để trang không trống trong lúc Render thức dậy.”

### Lưu ý khi trình bày

- Danh sách cập nhật theo từ khóa, danh mục và thứ tự giá.
- Chỉ sản phẩm còn bán và giá hợp lệ hiện với khách.
- Không có kết quả thì hiện hướng dẫn đổi bộ lọc.
- Chế độ Phòng thử chỉ nhận sản phẩm có ảnh, không vượt quá 3 món.

### Code — `ProductListPage` tải dữ liệu

`client/src/pages/ProductListPage.jsx` — `loadProducts`

```jsx
const params = { page, limit: 12 };
if (keyword) params.search = keyword;
if (category !== 'Tất cả') params.category = category;
if (sort !== 'default') params.sort = sort;
const result = await productService.getPage(params);
setProducts(result.products);
setPagination(result.pagination);
```

### Code — giới hạn chọn Phòng thử

`client/src/pages/ProductListPage.jsx` — `toggleRoomProduct`

```jsx
if (!hasImage(product)) return;
const id = String(product._id || product.id || '');
setSelectedForRoom((current) => {
  if (current.includes(id)) return current.filter((value) => value !== id);
  if (current.length >= MAX_ROOM_PRODUCTS) return current;
  return [...current, id];
});
```

### Code — lọc ở backend

`server/src/controllers/productController.js` — `list`

```js
const baseFilter = ['admin', 'superadmin'].includes(req.user?.role)
  ? {} : { isActive: true, price: { $gt: 0 } };
const filter = { ...baseFilter };
if (search) {
  const keyword = escapeRegex(String(search).trim());
  filter.$or = [{ name: { $regex: keyword, $options: 'i' } },
    { categoryName: { $regex: keyword, $options: 'i' } }];
}
const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
```

Đoạn rút gọn bỏ phần slug/description để dễ nói. Khi mở code thật, chỉ vào `filter.$or` đầy đủ trong `list`.

## Bước 2 — Phòng thử AI

### Thao tác tuần tự

1. Mở `/room-studio`.
2. Ở **Bước 1**, bấm chọn sản phẩm, tích từ 1 đến 3 món có ảnh.
3. Ở **Bước 2**, tải JPG/PNG/WebP dưới 10 MB.
4. Ở **Bước 3**, nhập vị trí riêng cho sản phẩm 1, 2, 3 hoặc để trống.
5. Bấm **Tạo ảnh**, chờ trạng thái xử lý và so sánh **Ảnh tạo** với **Ảnh gốc**.

### Lưu ý khi trình bày

- Chưa có ảnh phòng hoặc chưa chọn sản phẩm: nút tạo bị khóa.
- Chọn sản phẩm thứ tư: danh sách vẫn chỉ có 3.
- Ảnh sai định dạng/quá 10 MB: hiện lỗi tại bước tải ảnh.
- Vị trí trống: AI tự bố trí trong khoảng trống.
- Nếu AI trả ảnh thiếu món hoặc sai tỷ lệ, nói đây là kết quả tham khảo có tính xác suất.

### Code — `RoomStudioPage.generate`

`client/src/pages/RoomStudioPage.jsx` — `generate`

```jsx
if (!roomImage) return setMessage('Bạn cần tải ảnh phòng ở Bước 2 trước khi gửi.');
if (!selectedProducts.length) return setMessage('Hãy chọn ít nhất một sản phẩm ở Bước 1.');
setGenerating(true);
const inspirationProducts = await Promise.all(selectedProducts.map(async (product) => ({
  productId: idOf(product), productName: product.name,
  image: await imageUrlToDataUrl(productImage(product)),
  desiredPosition: desiredPositions[idOf(product)] || '', ...productFacts(product),
})));
```

`client/src/pages/RoomStudioPage.jsx` — gọi service

```jsx
const data = await createRoomPreview({
  roomImageDataUrl: roomImage, imageSize: roomImageSize,
  mode: 'inspiration', inspirationProducts,
});
const generated = data?.imageDataUrl || data?.resultImage || data?.imageUrl;
if (!generated) throw new Error('AI chưa trả về ảnh.');
setResultImage(generated);
```

### Code — kiểm tra request ở server

`server/src/controllers/roomPreviewController.js` — `validate`

```js
if (!Array.isArray(body.inspirationProducts)
    || body.inspirationProducts.length < 1
    || body.inspirationProducts.length > 3) {
  throw createError('Chọn từ 1 đến 3 sản phẩm.');
}
for (const product of body.inspirationProducts) {
  if (!product.productName || !product.image) throw createError('Sản phẩm thiếu tên hoặc ảnh.');
  product.desiredPosition = String(product.desiredPosition || '').slice(0, 160);
}
```

### Phản biện

**Ảnh phòng có lưu vào MongoDB không?**

> “Không lưu ảnh lớn vào MongoDB hay sessionStorage. Client giữ ảnh trong React state của tab, chỉ lưu `selectedIds` và vị trí nhẹ để quay lại bước chọn món.”

**Vì sao giới hạn 3?**

> “Request nhẹ hơn, người dùng dễ kiểm tra vị trí 1–3 và AI ít nhầm các món hơn.”

**Vì sao cần mô tả và kích thước sản phẩm?**

> “Ảnh giúp nhận diện hình dáng, còn dữ liệu mô tả, loại sử dụng và kích thước giúp prompt giữ đúng tỷ lệ và cách đặt.”

## Bước 3 — Tab Sản phẩm trong Trang quản trị

### Thao tác

1. Đăng xuất customer nếu còn phiên, đăng nhập `phuc@furneehome.vn` / `123`, mở `/admin`.
2. Ở tab **Sản phẩm**, tìm theo tên/danh mục.
3. Bấm **Sửa**, thay giá hoặc tồn kho, bấm **Cập nhật**.
4. Bấm **Ngừng bán**, xác nhận hộp thoại, kiểm tra nhãn đổi trạng thái; bấm **Bán lại** để khôi phục.
5. Không bấm **Xóa vĩnh viễn** trên dữ liệu thật.

### Nói đúng

- Ngừng bán đổi `isActive = false`, giữ lịch sử đơn.
- Xóa vĩnh viễn là thao tác nguy hiểm và backend phải chặn nếu sản phẩm đã phát sinh đơn.
- **Đồng bộ JSON** chỉ hiện ở localhost, chiều đồng bộ MongoDB → JSON.

### Code — `AdminPage.saveProduct`

`client/src/pages/AdminPage.jsx` — `saveProduct`

```jsx
async function saveProduct(event) {
  event.preventDefault();
  setWorking(true); setError('');
  try {
    const payload = productFromForm(form);
    if (editingId) await updateProduct(editingId, payload);
    else await addProduct(payload);
    setNotice(editingId ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.');
    resetForm();
  } finally { setWorking(false); }
}
```

Đây là rút gọn của `saveProduct` hiện tại; phần `try/catch` thật còn gọi `messageFrom` để hiển thị lỗi.

### Code — ngừng bán / xóa

`server/src/controllers/productController.js` — `remove`, `permanentRemove`

```js
const product = await Product.findByIdAndUpdate(
  req.params.id, { $set: { isActive: false } }, { returnDocument: 'after' },
);
if (!product) throw createError('Không tìm thấy sản phẩm.', 404);
return res.json({ success: true, message: 'Đã ngừng bán sản phẩm.', data: null });
```

## Bước 4 — Tab Khách hàng

### Thao tác

1. Bấm **Khách hàng**, gõ `customer@furneehome.vn` vào ô tìm kiếm nếu có.
2. Chỉ vào email, số điện thoại, địa chỉ, ghi chú và trạng thái tài khoản.
3. Bấm **Xem hồ sơ** để mở popup. Dấu hiệu đúng: popup hiển thị đủ thông tin giao hàng.
4. Chỉ vào nhãn **Đã đủ thông tin** hoặc **Chưa đủ thông tin**.
5. Bấm **Khóa**, xác nhận, rồi bấm **Mở khóa** để trả dữ liệu demo về trạng thái cũ.

### Nói ngắn

> “Admin cần nhìn nhanh khách đã đủ dữ liệu giao hàng chưa. Popup cho phép xem chi tiết mà không rời danh sách; trạng thái đủ hồ sơ lấy từ các trường bắt buộc, không do người dùng tự gõ.”

### Code hiện tại — tải khách hàng

`client/src/pages/AdminPage.jsx` — `loadUsers`

```jsx
async function loadUsers(scope = tab === 'admins' ? 'admins' : 'customers') {
  setWorking(true); setError('');
  try {
    const data = await userService.listAdmin(scope);
    setUsers(Array.isArray(data) ? data : []);
  } catch (loadError) { setError(messageFrom(loadError)); }
  finally { setWorking(false); }
}
```

`server/src/controllers/adminController.js` — `listUsers`

```js
const filter = {};
if (req.query.scope === 'customers') filter.role = 'customer';
const users = await User.find(filter)
  .select('name username email avatarUrl phone address provinceCode districtCode districtName wardCode wardName deliveryNote role isActive createdAt')
  .sort({ createdAt: -1 });
const data = users.map((user) => ({ ...user.toObject(),
  profileComplete: Boolean(user.phone && user.address && user.provinceCode
    && user.districtCode && user.wardCode),
}));
return res.json({ success: true, message: 'Đã tải người dùng.', data });
```

`userService.listAdmin` trả dữ liệu hồ sơ gồm `phone`, `address`, `provinceCode`, `districtCode`, `districtName`, `wardCode`, `wardName`, `deliveryNote`; popup dùng đúng các trường này để hiển thị hồ sơ và tính trạng thái đủ thông tin. Ghi chú giao hàng chỉ là tùy chọn.

### Code — popup và trạng thái hồ sơ

`client/src/pages/AdminPage.jsx` — `profileIsComplete`, `CustomerModal`

```jsx
function profileIsComplete(account) {
  return Boolean(account.phone && account.address
    && account.provinceCode && account.districtCode && account.wardCode);
}
```

`client/src/pages/AdminPage.jsx` — `CustomerModal`

```jsx
function CustomerModal({ account, onClose }) {
  if (!account) return null;
  return <section className="modal-dialog" role="dialog">
    <h2>Hồ sơ khách hàng</h2>
    <p>{account.phone || 'Chưa cập nhật'}</p>
    <p>{profileIsComplete(account) ? 'Đã đủ thông tin' : 'Chưa đủ thông tin'}</p>
  </section>;
}
```

## Bước 5 — Tab Đơn hàng và hóa đơn

### Thao tác

1. Bấm **Đơn hàng**, tải lại danh sách.
2. Chỉ vào mã đơn, khách, sản phẩm, tổng tiền, phương thức và trạng thái.
3. Đổi trạng thái theo luồng hợp lệ.
4. Mở **Hóa đơn** dạng popup.
5. Bấm **Tải hóa đơn** và kiểm tra file `hoa-don-<mã>.html` chứa mã đơn, người nhận, sản phẩm, phí ship, tổng tiền và thanh toán.
6. Với đơn hoàn trả, hiển thị trạng thái hoàn riêng và không cho chuyển sai trạng thái.

### Lưu ý khi trình bày

- Admin thường cập nhật đơn theo transition được phép.
- Orchestra Admin có thể sửa trạng thái hiệu chỉnh theo quyền đã cấp.
- Chỉ khi backend xác nhận thanh toán mới đổi `paymentStatus`; đơn đã hủy nhưng chưa thanh toán hiển thị **Đã hủy**, không còn **Chờ thanh toán**.
- Popup hóa đơn không được làm mất dữ liệu khi đóng; tải xuống phải tạo từ snapshot của Order.

### Câu hỏi về hóa đơn và quy mô

**Vì sao nhóm xuất hóa đơn dạng HTML?**

> “Bản demo chạy thuần trình duyệt nên tạo một file HTML từ snapshot của đơn hàng, không phải cài thêm thư viện. File mở được ngay và giữ đúng giá tại thời điểm đặt đơn.”

**Có thể xuất PDF không?**

> “Có. Người dùng có thể mở file HTML rồi chọn Print → Save as PDF. Nếu triển khai tự động ở backend, nhóm có thể thêm trình kết xuất như Puppeteer; bản bảo vệ giữ HTML để code ngắn và dễ kiểm tra.”

**Nếu có hàng trăm hoặc hàng nghìn đơn thì sao?**

> “Bản đồ án tải danh sách hiện tại để dễ trình bày. Khi có doanh thu thật, cần thêm phân trang, tìm kiếm theo mã đơn, index MongoDB và xử lý theo từng trang. Đây là phần mở rộng hiệu năng, không thay đổi nghiệp vụ của đơn hàng.”

### Code — cập nhật đơn hiện tại

`client/src/pages/AdminPage.jsx` — `updateOrder`

```jsx
async function updateOrder(id, changes) {
  setWorking(true); setError('');
  try {
    const saved = await orderService.updateOrderStatus(id, changes);
    setOrders((current) => current.map((order) => (
      order._id === id ? saved : order
    )));
  } catch (updateError) { setError(messageFrom(updateError)); }
  finally { setWorking(false); }
}
```

### Code — backend lấy toàn bộ đơn

`server/src/controllers/orderController.js` — `getAllOrders`

```js
const orders = await Order.find(filter)
  .populate('user', 'name email').sort({ createdAt: -1 });
return res.json({
  success: true, message: 'Đã tải toàn bộ đơn hàng.', data: orders,
});
```

Popup hóa đơn và nút tải đã có trong `AdminPage.jsx`. File tải xuống dùng snapshot `Order` vừa API trả về, nên không phụ thuộc giá sản phẩm hiện tại.

### Code — hóa đơn popup và tải xuống

`client/src/pages/AdminPage.jsx` — `InvoiceModal`, `downloadInvoice`

```jsx
function InvoiceModal({ order, onClose }) {
  if (!order) return null;
  const orderCode = order.orderNumber || String(order._id).slice(-8).toUpperCase();
  return <section className="modal-dialog" role="dialog">
    <h2>Hóa đơn {orderCode}</h2>
    <p>{order.shippingAddress?.fullName}</p>
    <p>{formatPrice(order.totalAmount)}</p>
    <button type="button" onClick={() => downloadInvoice(order)}>Tải hóa đơn</button>
  </section>;
}
```

`client/src/pages/AdminPage.jsx` — `downloadInvoice`

```jsx
const url = URL.createObjectURL(
  new Blob([html], { type: 'text/html;charset=utf-8' }),
);
const link = document.createElement('a');
link.href = url;
link.download = `hoa-don-${orderCode}.html`;
link.click();
setTimeout(() => URL.revokeObjectURL(url), 1000);
```

## Bước 6 — Tab Báo nội dung

### Thao tác

1. Bấm **Báo nội dung**.
2. Chọn một báo cáo, đọc sản phẩm và nội dung.
3. Đổi trạng thái `Mới` → `Đã xem` → `Đã xử lý`.

`server/src/controllers/adminController.js` — `updateFeedback`

```js
if (!['new', 'reviewed', 'resolved'].includes(req.body.status)) {
  return res.status(400).json({
    success: false, message: 'Trạng thái phản hồi không hợp lệ.', data: null,
  });
}
const feedback = await Feedback.findByIdAndUpdate(
  req.params.id, { status: req.body.status }, { returnDocument: 'after', runValidators: true },
);
```

## Bước 7 — Tab Quản trị admin của Orchestra Admin

### Thao tác

1. Đăng xuất Admin thường, đăng nhập Orchestra Admin.
2. Mở tab **Quản trị admin**.
3. Tìm theo tên, username hoặc email.
4. Khóa/mở khóa Admin cấp dưới.
5. Thử truy cập tab bằng Admin thường để chứng minh tab không hiển thị.

### Code — hiển thị theo role

`client/src/pages/AdminPage.jsx` — `isSuperadmin`

```jsx
const isSuperadmin = user?.role === 'superadmin';
const adminAccounts = users.filter(
  (account) => ['admin', 'superadmin'].includes(account.role),
);
```

`server/src/controllers/adminController.js` — `updateUser`

```js
if (req.body.role !== undefined && req.user.role !== 'superadmin') {
  return res.status(403).json({
    success: false, message: 'Chỉ quản trị cao nhất được thay đổi quyền.', data: null,
  });
}
if (String(req.user._id) === req.params.id) {
  return res.status(400).json({ success: false, message: 'Không thể thay đổi quyền của chính bạn.', data: null });
}
```

## Luồng dữ liệu cần nói khi bị hỏi sâu

```text
ProductListPage / RoomStudioPage / AdminPage
        ↓ service gọi HTTP
Route + authenticate/requireAdmin
        ↓
Controller kiểm tra dữ liệu, quyền, trạng thái
        ↓
Mongoose đọc/ghi Product, User, Order, Review, Feedback
        ↓
JSON response → React cập nhật màn hình
```

**Tại sao có JSON sản phẩm?**

> “`data_import.json` chỉ là snapshot để hiện nhanh. MongoDB là nguồn chính thức cho giá, tồn kho, đơn và quản trị. Nút đồng bộ chỉ chạy localhost và đi từ MongoDB sang JSON.”

## Checklist rà trước khi bảo vệ

Rà tám mục này trên code và bản deploy trước buổi bảo vệ. Các chức năng đã có giao diện/luồng; việc rà giúp xác nhận đúng dữ liệu, quyền và tên route:

1. **Hóa đơn đơn hàng:** xác nhận `InvoiceModal`, `downloadInvoice`, file `hoa-don-<mã>.html` mở được và đủ snapshot đơn.
2. **Hồ sơ khách hàng popup:** xác nhận `CustomerModal` nhận đủ địa chỉ, số điện thoại, ghi chú và chỉ Admin/Orchestra được xem.
3. **Trạng thái đủ hồ sơ:** xác nhận `profileIsComplete` dùng đủ `phone`, `address`, `provinceCode`, `districtCode`, `wardCode`; ghi chú không bắt buộc.
4. **Lời chào tài khoản:** xác nhận `ProfilePage` hiển thị `Xin chào!` kèm tên người dùng, không hiển thị nhầm email.
5. **Hồ sơ → checkout:** xác nhận các field được lưu trong User, nạp mặc định vào `CheckoutPage`, vẫn cho sửa theo đơn.
6. **Xác nhận mật khẩu:** xác nhận trang tài khoản gửi email OTP rồi mới đổi, đồng thời chặn `confirmPassword` không khớp.
7. **Hoàn trả hàng:** xác nhận trạng thái trong `Order`, nút customer và select Admin cùng tên; khóa hoàn sau khi khách đã xem hàng và thanh toán theo rule nhóm.
8. **Đăng nhập email-only và tài khoản bị khóa:** kiểm tra dữ liệu hiển thị đúng trong tab Khách hàng/Admin sau khi Phúc merge phần xác thực.

## Câu kết

> “Em đã trình bày danh sách sản phẩm, Phòng thử với tối đa ba món và toàn bộ Trang quản trị. Sản phẩm, khách hàng, đơn hàng và phản hồi đều được API kiểm tra trước khi lưu. Nhóm đã có popup hóa đơn, hồ sơ khách và trạng thái đủ hồ sơ; parent rà lại dữ liệu trên bản deploy trước khi bảo vệ.”

## Checklist 30 giây

- [ ] Tìm `bàn`, lọc, sắp xếp, phân trang.
- [ ] Chọn tối đa 3 món, tải ảnh phòng và nhập vị trí.
- [ ] Nói trung thực giới hạn AI.
- [ ] Đi đủ tab Sản phẩm, Khách hàng, Đơn hàng, Báo nội dung, Quản trị admin.
- [ ] Không xóa dữ liệu thật.
- [ ] Mở đúng `AdminPage`, `productController`, `adminController`, `orderController` khi bị hỏi.
- [ ] Rà đủ 8 mục trên trước khi chốt file trình bày.
