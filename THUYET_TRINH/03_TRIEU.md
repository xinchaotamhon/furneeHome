# Triều — Chi tiết sản phẩm, Đơn mua và Đánh giá

> **Vị trí:** phần 3/4, nhận đơn từ Dũng và bàn giao dữ liệu đơn/đánh giá cho Hiệp. Trang chính: `/products/:id`, `/orders`, `/orders/:orderId/review`.

## Thẻ liếc nhanh

- Bắt đầu từ **Chi tiết một sản phẩm**, không trình bày cả danh sách.
- Sau đó mở **Đơn mua**, chọn đúng trạng thái để minh họa hủy, hoàn và đánh giá.
- Chỉ khách đã nhận hàng (`Delivered`) mới được gửi đánh giá.
- **Đánh giá gắn với đơn hàng:** Compound unique index `{ user: 1, product: 1, order: 1 }` cho phép khách mua lại sản phẩm ở các đơn khác nhau được quyền đánh giá độc lập cho từng giao dịch.
- **Xóa đánh giá:** Khách hàng sở hữu đánh giá (`isOwner`) có thể trực tiếp xóa đánh giá tại trang chi tiết sản phẩm; hệ thống áp dụng soft-delete và lập tức cập nhật lại điểm sao trung bình.

### Dữ liệu demo

Đăng nhập bằng `customer@furneehome.vn` / `user123456`. Dùng đơn đã seed ở trạng thái `Pending`, `Delivered` và `Cancelled`; nếu cần tạo lại, Dũng tạo đơn trước rồi Admin đổi trạng thái theo luồng. Chọn sản phẩm đầu tiên trong đơn `Delivered` để mở đánh giá.

## Bước 1 — Chi tiết một sản phẩm

### Thao tác

1. Mở `https://furneehome.pages.dev/products`, chọn sản phẩm đầu tiên đang bán, bấm ảnh hoặc tên sản phẩm.
2. Chỉ vào tên, danh mục, giá, mô tả, tồn kho, ảnh và điểm đánh giá.
3. Chọn số lượng rồi bấm **Thêm vào giỏ**.
4. Chỉ vào **Mua ngay**, **Thử trong phòng** và **Báo nội dung**. Kết quả cần thấy: URL thành `/products/<id>` và nút phản hồi đúng sản phẩm.
5. Cuộn tới phần đánh giá đã có: chỉ vào sao, nhận xét của khách và nút **Xóa đánh giá** (chỉ hiện với đánh giá do chính tài khoản đang đăng nhập viết).

### Nói ngắn

> “Trang chi tiết gom thông tin đủ để khách quyết định mua. Giá và tồn kho chỉ là dữ liệu hiển thị; khi tạo đơn, backend đọc lại Product.”

### Lưu ý khi trình bày

- URL có dạng `/products/:id` và đúng sản phẩm được chọn.
- Hết hàng hoặc sản phẩm ngừng bán không cho thêm giỏ/mua ngay.
- ID không hợp lệ hoặc sản phẩm không tồn tại thì hiện lỗi, không render dữ liệu rỗng.
- Bấm **Báo nội dung** sẽ mang sản phẩm sang form báo cáo để Admin xử lý.

**Cơ chế:** `ProductDetailPage` lấy `id` từ URL, gọi `productService.getById` và `reviewService.getReviews`; controller lọc `Product`/`Review` trong MongoDB rồi trả JSON để React render.

### Code — `ProductDetailPage()`

`client/src/pages/ProductDetailPage.jsx` — `ProductDetailPage`

```jsx
const { id } = useParams();
const { addToCart } = useCart();
const [product, setProduct] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  productService.getById(id).then(setProduct)
    .catch(() => setProduct(null)).finally(() => setLoading(false));
}, [id]);
if (loading) return <div>Đang tải sản phẩm…</div>;
if (!product) return <div>Không tìm thấy sản phẩm</div>;
```

### Code — API chi tiết

`server/src/controllers/productController.js` — `getById`

```js
checkId(req.params.id);
const canSeeInactive = ['admin', 'superadmin'].includes(req.user?.role);
const filter = canSeeInactive
  ? { _id: req.params.id }
  : { _id: req.params.id, isActive: true, price: { $gt: 0 } };
const product = await Product.findOne(filter).populate('category', 'name slug');
if (!product) throw createError('Không tìm thấy sản phẩm.', 404);
```

## Bước 2 — Mở Đơn mua

### Thao tác

1. Bấm **Tài khoản** trên header rồi chọn **Đơn mua**, hoặc mở `/orders` khi đang đăng nhập customer.
2. Chỉ vào mã đơn, ngày tạo, sản phẩm, tổng tiền, thanh toán và trạng thái.
3. Mở đơn `Pending` hoặc `Processing`, bấm **Hủy đơn**, xác nhận hộp thoại. Kết quả cần thấy: trạng thái thành **Đã hủy**.
4. Mở đơn `Shipped`, kiểm tra nút **Hủy đơn** bị khóa hoặc không xuất hiện.
5. Mở đơn `Delivered`, bấm **Đánh giá** để sang `/orders/<orderId>/review`.

### Các trạng thái phải nói

`Pending` → `Processing` → `Shipped` → `Delivered`.

Khách chỉ hủy ở `Pending` hoặc `Processing`. Khi đơn đã `Shipped`, nút hủy bị chặn vì hàng đã rời kho. `Delivered` không hủy.

**Cơ chế:** `OrderHistoryPage` gọi `orderService.getMyOrders`; `getMyOrders` lọc theo `req.user._id`. Khi bấm hủy, service gửi orderId, `cancelOrder` kiểm tra trạng thái và cờ hoàn kho rồi cập nhật `Order`/`Product`.

### Code — lấy đơn của khách

`server/src/controllers/orderController.js` — `getMyOrders`

```js
async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json({ success: true, message: 'Đã tải danh sách đơn hàng.', data: orders });
  } catch (error) { return next(error); }
}
```

### Code — chặn hủy sau khi giao

`server/src/controllers/orderController.js` — `cancelOrder`

```js
const CUSTOMER_CANCELLABLE = ['Pending', 'Processing'];
const existing = await Order.findOne({
  _id: orderId, ...extraFilter,
  orderStatus: { $in: CUSTOMER_CANCELLABLE },
  stockRestored: false,
});
if (!existing) throw createError('Đơn hàng không còn có thể hủy.', 409);
```

### Phản biện thường gặp

**Khách sửa request để hủy đơn `Shipped` thì sao?**

> “Backend vẫn lọc `orderStatus` trong danh sách được hủy. Ẩn nút chỉ là trải nghiệm; rule thật nằm ở controller.”

**Hủy đơn hoàn kho thế nào?**

> “Controller cập nhật trạng thái và dùng cờ `stockRestored` để hoàn kho đúng một lần. Đơn giữ snapshot sản phẩm để lịch sử không đổi.”

## Bước 3 — Hoàn trả hàng

### Thao tác trình bày

1. Ở đơn đã giao, bấm **Yêu cầu hoàn trả**.
2. Chọn lý do `Sản phẩm lỗi/không đúng mô tả`, nhập ghi chú ngắn rồi bấm **Gửi yêu cầu**.
3. Kết quả cần thấy: đơn chuyển trạng thái yêu cầu hoàn và Admin nhìn thấy trạng thái riêng đó.
4. Với đơn đã xem hàng và đã thanh toán, thử bấm lại để chứng minh hệ thống từ chối theo quy định nhóm.

### Nói ngắn

> “Hoàn trả là trạng thái nghiệp vụ riêng, không gộp vào hủy đơn. Admin cần thấy trạng thái hoàn để duyệt hoặc từ chối. Khi khách đã xem hàng và thanh toán, nhóm đặt rule không cho hoàn theo yêu cầu đã thống nhất.”

**Cơ chế:** nút customer gọi `orderService` đến controller đơn; controller kiểm tra người sở hữu đơn và trạng thái thanh toán/xem hàng, sau đó lưu trạng thái hoàn trong `Order`. Admin đọc cùng `Order` qua `getAllOrders`.

## Bước 4 — Mở trang Đánh giá và Quản lý Đánh giá

### Thao tác

1. Từ đơn `Delivered`, bấm **Đánh giá**.
2. Trang `/orders/:orderId/review` liệt kê từng sản phẩm trong đơn.
3. Ở sản phẩm đầu tiên, chọn `5` sao, nhập `Sản phẩm đúng mô tả`, bấm **Gửi đánh giá**. Kết quả cần thấy: hiện thông báo thành công và chuyển về xem sản phẩm với điểm sao tăng.
4. Gửi lại đúng món đó trong cùng đơn. Kết quả cần thấy: hiện lỗi **Bạn đã đánh giá sản phẩm này trong đơn hàng này**.
5. Với đơn mua lại cùng sản phẩm ở đơn khác: mở đơn mới và bấm **Đánh giá**, hệ thống cho phép đánh giá theo giao dịch mới độc lập (nhờ unique index `{ user, product, order }`).
6. Mở trang chi tiết sản phẩm `/products/:id`, tại phần đánh giá của chính mình, bấm **Xóa đánh giá**, xác nhận hộp thoại cảnh báo: *"Sau khi xóa, bạn sẽ không thể đánh giá lại sản phẩm này trong đơn hàng này. Bạn có chắc chắn muốn xóa đánh giá không?"*. Kết quả cần thấy: review biến mất và điểm sao trung bình của sản phẩm được tính lại ngay.

### Kết quả cần thấy

- Đơn chưa `Delivered` không mở được form đánh giá.
- Sản phẩm không thuộc đơn bị backend từ chối.
- Đánh giá trùng trong cùng một đơn hàng bị chặn.
- Khách mua lại sản phẩm ở các đơn hàng khác nhau được phép đánh giá lại cho từng đơn.
- Khách hàng có thể tự xóa đánh giá của mình; hệ thống thực hiện soft-delete và lập tức cập nhật lại `ratingAverage` và `reviewCount` của sản phẩm.

**Cơ chế:** `OrderReviewPage` gửi `orderId` và `productId`; `createOrderReview` kiểm tra đơn thuộc user và đã `Delivered`, rồi ghi `Review` với trường `order`. Unique index `{ user: 1, product: 1, order: 1 }` đảm bảo mỗi đơn chỉ đánh giá 1 lần nhưng cho phép đánh giá lại ở đơn sau. Khi xóa, `deleteReview` gắn cờ `isDeleted: true` và gọi `refreshRating`.

### Code — kiểm tra đã giao và liên kết đơn hàng

`server/src/controllers/reviewController.js` — `createOrderReview`

```js
const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
if (!order) throw createError('Không tìm thấy đơn hàng.', 404);
if (order.orderStatus !== 'Delivered') {
  throw createError('Chỉ đơn hàng đã giao mới có thể đánh giá.', 403);
}
const belongsToOrder = order.orderItems.some(
  (item) => String(item.product) === String(req.body.productId),
);
if (!belongsToOrder) throw createError('Sản phẩm không thuộc đơn hàng này.', 400);
```

### Code — Index gắn theo đơn và tính lại điểm sao

`server/src/models/Review.js` — Compound unique index

```js
reviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true });
```

`server/src/controllers/reviewController.js` — `refreshRating`

```js
const reviews = await Review.find({
  product: productId,
  isHidden: { $ne: true },
  isDeleted: { $ne: true },
});
const total = reviews.reduce((sum, review) => sum + review.rating, 0);
await Product.findByIdAndUpdate(productId, {
  ratingAverage: reviews.length ? Number((total / reviews.length).toFixed(1)) : 0,
  reviewCount: reviews.length,
});
```

### Code — Xóa đánh giá (Soft-delete & tính lại sao)

`server/src/controllers/reviewController.js` — `deleteReview`

```js
const review = await Review.findById(req.params.id);
if (!review) throw createError('Không tìm thấy đánh giá.', 404);

// Cho phép tác giả hoặc admin xóa
const isOwner = String(review.user) === String(req.user._id);
const isAdmin = ['admin', 'superadmin'].includes(req.user?.role);
if (!isOwner && !isAdmin) throw createError('Không có quyền xóa đánh giá này.', 403);

review.isDeleted = true;
review.deletedAt = new Date();
await review.save();

await refreshRating(review.product);
return res.json({ success: true, message: 'Đã xóa đánh giá.', data: null });
```

`client/src/pages/ProductDetailPage.jsx` — Nút xóa đánh giá cho chủ sở hữu

```jsx
{isOwner && (
  <button type="button" className="button button-text" disabled={working} onClick={() => onDelete(review._id)}>
    Xóa đánh giá
  </button>
)}
```

## Câu phản biện

**Tại sao chỉ khách đã nhận hàng mới được đánh giá?**

> “Đánh giá phải dựa trên trải nghiệm nhận hàng thực tế. Controller kiểm tra đơn thuộc sở hữu của user, trạng thái bắt buộc là `Delivered`, và sản phẩm nằm trong danh sách mua của đơn.”

**Khách mua lại sản phẩm ở đơn khác có được đánh giá không?**

> “Có. Model `Review` sử dụng compound index `{ user: 1, product: 1, order: 1 }`. Nhờ gắn chặt với mã đơn `order`, mỗi lần mua thành công khách đều có quyền đánh giá chất lượng sản phẩm của lần giao dịch đó mà không bị xung đột.”

**Khách tự xóa đánh giá thì hệ thống xử lý thế nào?**

> “Khách hàng có thể bấm 'Xóa đánh giá' ngay tại trang chi tiết sản phẩm. Backend áp dụng soft-delete (`isDeleted: true`), giữ lại vết dữ liệu để tránh khách xóa đi tạo lại liên tục trong cùng 1 đơn, đồng thời gọi `refreshRating` để loại trừ các review đã xóa và cập nhật điểm sao ngay lập tức.”

## Câu bàn giao cho Hiệp

> “Em đã đi từ một sản phẩm cụ thể đến Đơn mua, đã chứng minh chặn hủy khi đang giao, phân tách rõ hoàn trả hàng và cơ chế đánh giá/xóa đánh giá gắn liền với từng đơn hàng. Mời Hiệp kiểm tra lại sản phẩm, Phòng thử và các tab quản trị.”

## Checklist 30 giây

- [ ] Mở đúng một `/products/:id`, không trình bày lan sang cả danh sách.
- [ ] Có đơn `Pending/Processing`, `Shipped`, `Delivered` để chỉ đúng điều kiện.
- [ ] Nói hoàn trả là trạng thái riêng, không nhầm với hủy.
- [ ] Gửi một review đúng, gửi trùng trong cùng đơn để chứng minh bị chặn.
- [ ] Giải thích rõ mua lại ở đơn khác được đánh giá mới nhờ index `{ user, product, order }`.
- [ ] Thử bấm 'Xóa đánh giá', xác nhận cảnh báo và giải thích cơ chế soft-delete + tính lại sao.
