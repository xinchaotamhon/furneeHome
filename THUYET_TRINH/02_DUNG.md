# Dũng — Giỏ hàng và Thanh toán

> **Vị trí:** phần 2/4, nhận từ Phúc và bàn giao đơn mới cho Triều. Chỉ trình bày `/cart` và `/checkout`.

## Thẻ liếc nhanh

- Tài khoản demo: `customer@furneehome.vn` / `user123456`, do Phúc bàn giao khi đã đăng nhập.
- Trình tự: mở giỏ → chọn món → sửa số lượng → kiểm tra phí → nhập địa chỉ → chọn COD/QR → đặt hàng.
- Kết quả cần chỉ: tổng tiền, phí vận chuyển, mã đơn và trạng thái thanh toán.
- Không nói frontend tự quyết định giá hoặc tồn kho.

## Bước 1 — Mở Giỏ hàng

### Thao tác

1. Từ header của `https://furneehome.pages.dev/`, bấm **Giỏ hàng** hoặc mở `/cart`.
2. Chỉ vào số loại sản phẩm, tổng số món và tạm tính.
3. Bỏ chọn một món, dấu hiệu đúng là tạm tính giảm; bấm lại **Chọn tất cả**, danh sách được chọn trở lại.

Component `CartPage` lấy `selectedItems` từ `CartContext`; context tính `selectedCount` và `selectedSubtotal`, sau đó React render lại phần tóm tắt.

API chỉ được gọi khi giỏ thuộc tài khoản đã đăng nhập. `CartContext` gọi `cartService.get/sync`, route cart chạy `authenticate`, rồi `cartController` đọc `Cart` và populate `Product` trong MongoDB.

### Nói ngắn

> “Giỏ cho phép chọn một phần đơn, nên khách không phải thanh toán toàn bộ cùng lúc. Số lượng và tạm tính đổi ngay ở giao diện, còn lúc đặt hàng backend sẽ kiểm tra lại.”

### Lưu ý khi trình bày

- Bỏ chọn món thì số món và tạm tính chỉ tính phần được chọn.
- Không có món nào được chọn thì nút **Mua hàng** bị khóa và hiện lời nhắc.
- Giỏ trống: trang đưa về nút **Xem sản phẩm**.

### Code — `CartPage()`

`client/src/pages/CartPage.jsx` — `CartPage`

```jsx
const {
  items, selectedItems, selectedCount, selectedSubtotal,
  isAllSelected, toggleItemSelection, toggleSelectAll,
} = useCart();
```

`client/src/pages/CartPage.jsx` — nút chuyển checkout

```jsx
{selectedCount > 0 ? (
  <Link className="button button-full" to="/checkout">
    Mua hàng ({selectedCount})
  </Link>
) : (
  <button className="button button-disabled" disabled>Mua hàng (0)</button>
)}
```

## Bước 2 — Sửa số lượng và xóa

### Thao tác

1. Ở ô số lượng của sản phẩm đầu tiên, đổi từ `1` thành `2` rồi bấm ra ngoài.
2. Nhập 0 hoặc bấm **Xóa** để xóa sản phẩm.
3. Bấm **Xóa mục đã chọn** nếu muốn xóa nhiều món, hoặc **Xóa tất cả** để làm trống giỏ. Dấu hiệu đúng: số loại sản phẩm và tổng tiền đổi ngay.

`CartContext.updateQuantity` cập nhật state trước để giao diện phản hồi nhanh, rồi `cartService.update` gọi API giỏ khi đã đăng nhập.

Sau request, `cartController.updateQuantity` đọc lại `Product.stock`; nếu vượt kho hoặc sản phẩm ngừng bán, controller trả lỗi và giao diện giữ thông báo lỗi.

### Phản biện

**Nếu nhập số lượng lớn hơn kho?**

> “Giao diện giới hạn theo tồn kho đang biết. API giỏ cũng đọc lại Product và trả lỗi nếu số lượng vượt kho. Khi đặt đơn, controller còn giữ kho bằng cập nhật có điều kiện.”

**Giỏ khách chưa đăng nhập có được thêm không?**

> “Theo yêu cầu mới, khách phải đăng nhập trước khi thêm vào giỏ. Nếu bấm từ trang sản phẩm khi chưa đăng nhập, hệ thống mở đăng nhập, không tạo giỏ mua hàng ẩn.”

**Giỏ tối đa 100 sản phẩm xử lý ở đâu?**

> “Giới hạn phải nằm ở cả giao diện và `cartController`, để người dùng không thể vượt giới hạn bằng cách gọi API trực tiếp. Em sẽ rà lại thông báo và status sau khi bản code mới được merge.”

### Code — `CartProvider.addToCart()`

`client/src/context/CartContext.jsx` — `addToCart`

```jsx
addToCart(product, quantity = 1) {
  const id = productId(product);
  const qty = Math.max(1, Number(quantity) || 1);
  if (!id || stockOf(product) < qty) return { ok: false };
  setItems((current) => {
    const existing = current.find((item) => productId(item.product) === id);
    if (!existing) return [...current, { product, quantity: qty }];
    return current.map((item) => productId(item.product) === id
      ? { ...item, quantity: item.quantity + qty } : item);
  });
  sync(() => cartService.add(id, qty));
}
```

Đoạn rút gọn trên giữ đúng logic hiện có. Khi mở code thật, chỉ vào toàn bộ phần `setItems` trong `addToCart` để cho thấy ảnh, tên, giá và `selected` cũng được lưu.

### Code — backend kiểm tra giỏ

`server/src/controllers/cartController.js` — `addToCart`, `updateQuantity`

```js
const cart = await refreshCart(await loadCart(req.user._id));
const product = await Product.findById(productId);
if (!isSellable(product)) throw createError('Sản phẩm đã hết hàng hoặc ngừng bán.', 409);
if (quantity > product.stock) {
  throw createError(`Sản phẩm chỉ còn ${product.stock} món trong kho.`);
}
```

## Bước 3 — Mở Thanh toán

### Thao tác

1. Tích ít nhất một món rồi bấm **Mua hàng (số món)**.
2. Kiểm tra chỉ các món đã chọn xuất hiện.
3. Chọn `TP. Hồ Chí Minh`, chờ quận tải xong, chọn một quận rồi chọn phường.
4. Nhập họ tên `Khách hàng demo`, số điện thoại hợp lệ dạng `09xxxxxxxx`, địa chỉ `12 Nguyễn Huệ`, ghi chú `Gọi trước khi giao`.
5. Chọn **COD** hoặc **Chuyển khoản QR**, rồi bấm **Đặt hàng**.
6. Dấu hiệu đúng: hiện “Đặt hàng thành công”, mã đơn và tổng gồm tiền hàng + phí ship.

### Nói ngắn

> “Checkout ghép địa chỉ cụ thể với tỉnh, quận và phường. Thông tin hồ sơ của `customer@furneehome.vn` đã lưu được nạp mặc định, nhưng khách vẫn có thể sửa cho đơn này.”

### Lưu ý khi trình bày

- Đổi tỉnh sẽ tải lại quận; đổi quận sẽ tải lại phường.
- Phí ship cập nhật theo tỉnh và backend tự tính lại khi tạo đơn.
- Thiếu họ tên, số điện thoại Việt Nam, quận/huyện, phường/xã hoặc địa chỉ cụ thể thì không gửi request.
- Chưa đăng nhập thì checkout hiện **Đăng nhập để thanh toán**.
- Free ship: nếu bản cuối có lựa chọn/điều kiện miễn phí vận chuyển, vẫn phải tạo đơn với đủ `shippingAddress`, chỉ `shippingFee` mới bằng 0. Không bỏ qua bước địa chỉ.

**Cơ chế:** `CheckoutPage` gom state form và gọi `orderService.createOrder`; route order chạy `authenticate`; `orderController.createOrder` làm sạch địa chỉ, tính phí, đọc giá/tồn kho từ `Product` rồi tạo `Order` trong MongoDB.

### Code — `CheckoutPage.submit()`

`client/src/pages/CheckoutPage.jsx` — `submit`

```jsx
const order = await orderService.createOrder({
  items: items.map((item) => ({
    productId: item.product._id || item.product.id,
    quantity: item.quantity,
  })),
  shippingAddress: { fullName, phone, address: fullAddress,
    provinceCode: selectedProvince, note },
  paymentMethod,
});
```

`client/src/pages/CheckoutPage.jsx` — kiểm tra đầu vào

```jsx
const phoneCheck = validateVietnamPhone(phone);
if (!phoneCheck.isValid) return setError(phoneCheck.message);
const addressCheck = validateSpecificAddress(specificAddress);
if (!addressCheck.isValid) return setError(addressCheck.message);
```

## Bước 4 — Phí vận chuyển và đặt đơn

### Cách nói

> “Con số hiển thị ở checkout giúp khách biết tổng tiền. Con số có giá trị quyết định nằm ở `orderController.createOrder`, nơi backend đọc lại sản phẩm, giữ kho và tính phí theo `provinceCode`.”

### Code — `calculateShippingFee()`

`server/src/controllers/orderController.js` — `calculateShippingFee`

```js
function calculateShippingFee(provinceCode) {
  const code = Number(provinceCode);
  if (!PROVINCE_CODES.has(code)) throw createError('Tỉnh hoặc thành phố không hợp lệ.');
  if (code === 79) return 30000;
  if (code >= 48) return 40000;
  return 60000;
}
```

Nếu bản chốt thay bằng miễn phí vận chuyển theo chương trình, mở đúng điều kiện mới và nói rõ điều kiện. Không tự đọc một mức phí cũ trên slide.

### Code — giữ kho và tạo order

`server/src/controllers/orderController.js` — `createOrder`

```js
const product = await Product.findOneAndUpdate(
  { _id: item.productId, isActive: true, price: { $gt: 0 }, stock: { $gte: item.qty } },
  { $inc: { stock: -item.qty } },
  { returnDocument: 'after' },
);
if (!product) throw createError('Có sản phẩm đã hết hàng.', 409);
```

### Kết quả đúng

- Có thông báo đặt hàng thành công và mã đơn.
- Sản phẩm đã mua bị xóa khỏi giỏ.
- COD có trạng thái chờ thanh toán; QR hiển thị mã chuyển khoản, Admin xác nhận sau.
- Nếu tạo đơn lỗi, stock đã giữ trước đó được hoàn lại.

Kết quả thành công đi từ JSON response của `createOrder` về `CheckoutPage.setResult`; context xóa các productId đã mua khỏi giỏ và MongoDB cũng pull các món đó khỏi `Cart`.

## Bước 5 — QR và bàn giao

### Thao tác

1. Nếu chọn QR, chỉ vào số tiền, ngân hàng, số tài khoản và nội dung chuyển khoản.
2. Không tự bấm **Xác nhận thanh toán** ở phía Admin trong lượt của Dũng.
3. Nói mã đơn để Triều mở **Đơn mua**.

`client/src/components/payment/QrPaymentCard.jsx` — `QrPaymentCard`

```jsx
const totalAmount = order.totalAmount ?? order.subtotal ?? 0;
const orderNumber = order.orderNumber || String(order._id).slice(-8).toUpperCase();
const qrUrl = getVietQrUrl(totalAmount, orderNumber);

return <img src={qrUrl} alt="Mã QR thanh toán" />;
```

`QrPaymentCard` chỉ tạo URL ảnh VietQR từ `totalAmount` và mã đơn. Xác nhận thanh toán vẫn do API Admin cập nhật `Order.paymentStatus`.

## Câu phản biện cuối phần

**Tại sao cần backend kiểm tra lại khi client đã tính tổng?**

> “Client có thể bị sửa bằng DevTools. Backend phải lấy giá và kho từ MongoDB, tính lại subtotal, phí và total trước khi lưu Order.”

**Miễn phí ship có làm bỏ qua tỉnh/thành không?**

> “Không. Địa chỉ vẫn bắt buộc để giao hàng và để Admin xem. Chỉ phí vận chuyển thay đổi thành 0 theo rule đã cấu hình.”

## Câu bàn giao cho Triều

> “Em đã tạo đơn có mã [đọc mã đơn], gồm [số món], địa chỉ và phương thức thanh toán. Mời Triều mở Đơn mua để trình bày trạng thái giao hàng, hủy/hoàn và đánh giá.”

## Checklist 30 giây

- [ ] Có đăng nhập trước khi vào giỏ/checkout.
- [ ] Bỏ chọn một món và chứng minh tổng tiền thay đổi.
- [ ] Nói đúng giới hạn 100 sản phẩm là rule cần kiểm tra ở backend.
- [ ] Nhập địa chỉ cụ thể, số điện thoại, ghi chú.
- [ ] Phân biệt phí hiển thị ở client và phí chốt ở backend.
- [ ] Nói QR chỉ tạo thông tin chuyển khoản, Admin mới xác nhận thanh toán.
