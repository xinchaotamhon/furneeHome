# Dũng — Giỏ hàng và Thanh toán

> **Vị trí:** phần 2/4, nhận từ Phúc và bàn giao đơn mới cho Triều. Chỉ trình bày `/cart` và `/checkout`.

## Thẻ liếc nhanh

- **Logo thương hiệu mới:** `furneehome-logo.png` hiển thị đồng bộ trên Header.
- **Tài khoản demo:** `customer@furneehome.vn` / `user123456`, do Phúc bàn giao khi đã đăng nhập.
- **Trình tự:** mở giỏ → phân trang (7 món/trang) → chọn món → sửa số lượng (bảo toàn sản phẩm) → mở thanh toán → kiểm tra danh sách phân trang → áp voucher vận chuyển (`VoucherModal`) → kiểm tra phí → nhập địa chỉ → chọn COD/QR → đặt hàng.
- **Kết quả cần chỉ:** tổng tiền, voucher giảm phí ship, phí vận chuyển thực tế, mã đơn và trạng thái thanh toán.
- **Nguyên tắc cốt lõi:** Không nói frontend tự quyết định giá hoặc tồn kho; backend luôn thẩm định lại.

## Bước 1 — Mở Giỏ hàng

### Thao tác

1. Từ header của `https://furneehome.pages.dev/`, chỉ vào **Logo FurneeHome mới**, bấm **Giỏ hàng** hoặc mở `/cart`.
2. Chỉ vào số loại sản phẩm, tổng số món và tạm tính.
3. Bỏ chọn một món, kết quả cần thấy là tạm tính giảm; bấm lại **Chọn tất cả**, danh sách được chọn trở lại.
4. Nếu giỏ có nhiều món (trên 7 món), chỉ vào thanh phân trang bên dưới: bấm **Sau →** hoặc **← Trước** để duyệt các trang sản phẩm mà không làm tràn giao diện.

Component `CartPage` lấy `selectedItems` từ `CartContext`; context tính `selectedCount` và `selectedSubtotal`, sau đó React render lại phần tóm tắt. Danh sách sản phẩm hiển thị được phân trang 7 sản phẩm/trang (`Math.ceil(items.length / 7)`).

API chỉ được gọi khi giỏ thuộc tài khoản đã đăng nhập. `CartContext` gọi `cartService.get/sync`, route cart chạy `authenticate`, rồi `cartController` đọc `Cart` và populate `Product` trong MongoDB.

### Nói ngắn

> “Giỏ cho phép chọn một phần đơn, hỗ trợ phân trang 7 món/trang khi giỏ nhiều đồ, giúp giao diện luôn gọn gàng và tải mượt. Số lượng và tạm tính đổi ngay ở giao diện, còn lúc đặt hàng backend sẽ kiểm tra lại toàn bộ.”

### Lưu ý khi trình bày

- Bỏ chọn món thì số món và tạm tính chỉ tính phần được chọn.
- Danh sách dài được phân trang 7 món/trang mượt mà.
- Không có món nào được chọn thì nút **Mua hàng** bị khóa và hiện lời nhắc cảnh báo.
- Giỏ trống: trang đưa về nút **Xem sản phẩm**.

### Code — `CartPage()`

`client/src/pages/CartPage.jsx` — Phân trang và context giỏ

```jsx
const {
  items, selectedItems, selectedCount, selectedSubtotal,
  isAllSelected, maxSelectedCount, toggleItemSelection, toggleSelectAll,
} = useCart();

const totalPages = Math.max(1, Math.ceil(items.length / 7));
const page = Math.min(currentPage, totalPages);
const visibleItems = items.slice((page - 1) * 7, page * 7);
```

`client/src/pages/CartPage.jsx` — Nút chuyển checkout

```jsx
{selectedCount > 0 ? (
  user ? (
    <button className="button button-full" type="button" onClick={continueToCheckout}>
      Mua hàng ({selectedCount})
    </button>
  ) : (
    <button className="button button-full" type="button" onClick={() => openLogin('login')}>
      Đăng nhập để mua hàng
    </button>
  )
) : (
  <button className="button button-full button-disabled" disabled>
    Mua hàng (0)
  </button>
)}
```

## Bước 2 — Sửa số lượng và xóa

### Thao tác

1. Ở ô số lượng của sản phẩm đầu tiên, đổi từ `1` thành `2` rồi bấm ra ngoài. Nếu đang xóa ô nhập để gõ số mới, hệ thống bảo toàn sản phẩm trong giỏ (không tự xóa nhầm).
2. Nhập 0 hoặc bấm **Xóa** để xóa sản phẩm.
3. Bấm **Xóa mục đã chọn** nếu muốn xóa nhiều món, hoặc **Xóa tất cả** để làm trống giỏ. Kết quả cần thấy: số loại sản phẩm và tổng tiền đổi ngay.

`CartContext.updateQuantity` cập nhật state trước để giao diện phản hồi nhanh, kiểm tra giá trị số hợp lệ trước khi gọi `cartService.update`.

Sau request, `cartController.updateQuantity` đọc lại `Product.stock`; nếu vượt kho hoặc sản phẩm ngừng bán, controller trả lỗi và giao diện giữ thông báo lỗi.

### Phản biện

**Nếu nhập số lượng lớn hơn kho?**

> “Giao diện giới hạn theo tồn kho đang biết. API giỏ cũng đọc lại Product và trả lỗi nếu số lượng vượt kho. Khi đặt đơn, controller còn giữ kho bằng cập nhật có điều kiện.”

**Giỏ khách chưa đăng nhập có được thêm không?**

> “Khách có thể thêm sản phẩm vào giỏ local để xem trước. Khi bấm mua hoặc thanh toán thì phải đăng nhập; sau khi đăng nhập, giỏ local được cộng vào giỏ MongoDB của tài khoản.”

**Giỏ tối đa 100 sản phẩm xử lý ở đâu?**

> “Giới hạn nằm ở cả giao diện (`MAX_SELECTED_COUNT = 100`) và `cartController`, đảm bảo người dùng không thể vượt giới hạn bằng cách gọi API trực tiếp.”

### Code — `CartProvider.addToCart()` và bảo toàn số lượng

`client/src/context/CartContext.jsx` — `addToCart` & `updateQuantity`

```jsx
addToCart(product, quantity = 1) {
  const id = productId(product);
  const stock = stockOf(product);
  const qty = Math.min(stock, Math.max(1, Number(quantity) || 1));
  setItems((current) => {
    const existing = current.find((item) => productId(item.product) === id);
    if (!existing) {
      return [...current, { product, quantity: qty, price: Number(product.price) || 0, name: product.name, image: product.image || '', selected: true }];
    }
    return current.map((item) => productId(item.product) === id
      ? { ...item, product, quantity: Math.min(stock, item.quantity + qty), price: Number(product.price) || 0, selected: true }
      : item);
  });
  sync(() => cartService.add(id, qty));
}

updateQuantity(id, quantity) {
  const qty = Number(quantity);
  // Không xóa đột ngột khi người dùng đang xóa ô để gõ số mới
  if (!Number.isFinite(qty) || qty <= 0) return;
  setItems((current) => current.map((item) => {
    if (productId(item.product) !== String(id)) return item;
    const nextQuantity = Math.min(stockOf(item.product), qty);
    return { ...item, quantity: nextQuantity };
  }));
  sync(() => cartService.update(id, qty));
}
```

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

## Bước 3 — Mở Thanh toán và Voucher

### Thao tác

1. Tích ít nhất một món trong giỏ rồi bấm **Mua hàng (số món)**.
2. Kiểm tra chỉ các món đã chọn xuất hiện ở trang thanh toán (cũng được phân trang 7 món/trang nếu danh sách dài).
3. Chọn `TP. Hồ Chí Minh`, chờ quận tải xong, chọn một quận rồi chọn phường.
4. Bấm **Chọn voucher** để mở popup `VoucherModal`, chọn voucher phù hợp (ví dụ: `SHIP20K` giảm 20.000₫ cho đơn từ 100k). Kết quả cần thấy: phần tóm tắt đơn hiển thị dòng giảm giá voucher và tiền ship được trừ trực tiếp.
5. Nhập họ tên `Khách hàng demo`, số điện thoại hợp lệ dạng `09xxxxxxxx`, địa chỉ `12 Nguyễn Huệ`, ghi chú `Gọi trước khi giao`.
6. Chọn **COD** hoặc **Chuyển khoản QR**, rồi bấm **Đặt hàng**.
7. Kết quả cần thấy: hiện “Đặt hàng thành công”, mã đơn và tổng gồm (tiền hàng + phí ship - giảm giá voucher).

### Nói ngắn

> “Checkout tự động nạp hồ sơ đã lưu của khách, hỗ trợ phân trang danh sách mua và áp voucher giảm phí vận chuyển theo khu vực. Thông tin phí và giảm giá được backend kiểm tra và tính lại độc lập khi tạo đơn.”

### Lưu ý khi trình bày

- Đổi tỉnh sẽ tải lại quận; đổi quận sẽ tải lại phường.
- Danh sách sản phẩm thanh toán phân trang 7 món/trang.
- Voucher vận chuyển kiểm tra điều kiện đơn hàng tối thiểu (`minOrder`) trước khi áp dụng.
- Phí ship cập nhật theo tỉnh và backend tự tính lại khi tạo đơn.
- Thiếu họ tên, số điện thoại Việt Nam, quận/huyện, phường/xã hoặc địa chỉ cụ thể thì không gửi request.
- Chưa đăng nhập thì checkout hiện **Đăng nhập để thanh toán**.

**Cơ chế:** `CheckoutPage` gom state form và gọi `orderService.createOrder`; route order chạy `authenticate`; `orderController.createOrder` làm sạch địa chỉ, tính phí, đọc giá/tồn kho từ `Product` rồi tạo `Order` trong MongoDB.

### Code — `CheckoutPage.submit()` & Voucher

`client/src/components/checkout/VoucherModal.jsx` — Danh sách voucher vận chuyển

```jsx
export const SHIP_VOUCHERS = [
  { id: 'ship_hcm_20k', labelVi: 'Giảm 20.000₫ phí vận chuyển', discount: 20000, minOrder: 100000, code: 'SHIP20K' },
  { id: 'ship_south_30k', labelVi: 'Giảm 30.000₫ phí vận chuyển', discount: 30000, minOrder: 200000, code: 'SHIP30K' },
  { id: 'ship_north_35k', labelVi: 'Giảm 35.000₫ phí vận chuyển', discount: 35000, minOrder: 300000, code: 'SHIP35K' },
];
```

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

### Kết quả cần thấy

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

**Miễn phí ship / voucher ship có làm bỏ qua tỉnh/thành không?**

> “Không. Địa chỉ vẫn bắt buộc để giao hàng và để Admin xem. Voucher chỉ giảm trừ vào phí vận chuyển theo đúng điều kiện cấu hình.”

**Tại sao cần phân trang 7 món trong Giỏ hàng và Thanh toán?**

> “Khách hàng mua nhiều đồ nội thất (bàn, ghế, tủ, đèn trang trí...) danh sách giỏ hàng sẽ rất dài. Phân trang 7 sản phẩm/trang giúp trang tải gọn, không gây giật cuộn trên thiết bị di động và kiểm soát tích chọn trực quan hơn.”

## Câu bàn giao cho Triều

> “Em đã tạo đơn có mã [đọc mã đơn], gồm [số món], địa chỉ và phương thức thanh toán. Mời Triều mở Đơn mua để trình bày trạng thái giao hàng, hủy/hoàn và đánh giá.”

## Checklist 30 giây

- [ ] Chỉ logo mới FurneeHome trên Header.
- [ ] Có thể thêm giỏ guest, đăng nhập rồi kiểm tra giỏ được cộng; checkout yêu cầu đăng nhập.
- [ ] Bỏ chọn một món và chứng minh tổng tiền thay đổi.
- [ ] Chỉ thanh phân trang 7 món/trang trong Giỏ hàng và trang Thanh toán.
- [ ] Thử sửa số lượng, chứng minh sản phẩm không bị xóa nhầm khi đang gõ dở.
- [ ] Mở modal voucher vận chuyển và áp mã giảm phí ship.
- [ ] Nhập địa chỉ cụ thể, số điện thoại, ghi chú.
- [ ] Phân biệt phí hiển thị ở client và phí chốt ở backend.
- [ ] Nói QR chỉ tạo thông tin chuyển khoản, Admin mới xác nhận thanh toán.
