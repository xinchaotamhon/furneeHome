# Triều — Chi tiết sản phẩm, Đơn mua và Đánh giá

> **Vị trí:** phần 3/4, nhận đơn từ Dũng và bàn giao dữ liệu đơn/đánh giá cho Hiệp. Trang chính: `/products/:id`, `/orders`, `/orders/:orderId/review`.

## Thẻ liếc nhanh

- Bắt đầu từ **Chi tiết một sản phẩm**, không trình bày cả danh sách.
- Sau đó mở **Đơn mua**, chọn đúng trạng thái để minh họa hủy, hoàn và đánh giá.
- Chỉ khách đã nhận hàng mới đánh giá.
- Đánh giá không trùng trong cùng đơn; nếu khách mua lại sản phẩm ở đơn khác, bản chốt phải cho đánh giá theo giao dịch mới sau khi kiểm tra rule.

### Dữ liệu demo

Đăng nhập bằng `customer@furneehome.vn` / `user123456`. Dùng đơn đã seed ở trạng thái `Pending`, `Delivered` và `Cancelled`; nếu cần tạo lại, Dũng tạo đơn trước rồi Admin đổi trạng thái theo luồng. Chọn sản phẩm đầu tiên trong đơn `Delivered` để mở đánh giá.

## Bước 1 — Chi tiết một sản phẩm

### Thao tác

1. Mở `https://furneehome.pages.dev/products`, chọn sản phẩm đầu tiên đang bán, bấm ảnh hoặc tên sản phẩm.
2. Chỉ vào tên, danh mục, giá, mô tả, tồn kho, ảnh và điểm đánh giá.
3. Chọn số lượng rồi bấm **Thêm vào giỏ**.
4. Chỉ vào **Mua ngay**, **Thử trong phòng** và **Báo nội dung**. Kết quả cần thấy: URL thành `/products/<id>` và nút phản hồi đúng sản phẩm.
5. Cuộn tới phần đánh giá đã có.

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

### Điểm cần kiểm tra sau merge

- Tên trạng thái: thống nhất `ReturnRequested`, `Returning`, `Returned` hoặc tên tiếng Việt đã chọn.
- Điều kiện gửi yêu cầu và điều kiện khóa khi `paymentStatus = Paid` sau khi khách xác nhận xem hàng.
- Nút và API customer, select trạng thái ở `AdminPage`.

**Cơ chế:** nút customer gọi `orderService` đến controller đơn; controller kiểm tra người sở hữu đơn và trạng thái thanh toán/xem hàng, sau đó lưu trạng thái hoàn trong `Order`. Admin đọc cùng `Order` qua `getAllOrders`.

## Bước 4 — Mở trang Đánh giá

### Thao tác

1. Từ đơn `Delivered`, bấm **Đánh giá**.
2. Trang `/orders/:orderId/review` liệt kê từng sản phẩm trong đơn.
3. Ở sản phẩm đầu tiên, chọn `5` sao, nhập `Sản phẩm đúng mô tả`, bấm **Gửi đánh giá**. Kết quả cần thấy: hiện tên người đánh giá và điểm sao tăng.
4. Gửi lại đúng món đó trong cùng đơn. Kết quả cần thấy: hiện lỗi **Bạn đã đánh giá sản phẩm này**.
5. Với đơn mua lại cùng sản phẩm, mở đơn mới và bấm **Đánh giá**. Bản chốt phải cho đánh giá theo giao dịch mới.
6. Bấm **Xóa đánh giá**, xác nhận, rồi tải lại danh sách. Kết quả cần thấy: review biến mất và điểm sao được tính lại.

### Kết quả cần thấy

- Đơn chưa `Delivered` không mở được form.
- Sản phẩm không thuộc đơn bị backend từ chối.
- Đánh giá trùng trong cùng đơn bị chặn.
- Xóa đánh giá làm điểm sao và số lượng đánh giá cập nhật lại.
- Đơn mua lại không bị coi là cùng một giao dịch. Nếu thiết kế cuối vẫn giới hạn một đánh giá cho mỗi cặp user/sản phẩm, phải nói rõ đó là giới hạn hiện tại và báo parent rà lại yêu cầu.

**Cơ chế:** `OrderReviewPage` gửi `orderId` và `productId`; `createOrderReview` kiểm tra đơn thuộc user và đã `Delivered`, rồi `saveReview` ghi `Review` và `refreshRating` cập nhật `Product`. Rule mua lại phải gắn đúng với từng đơn.

### Code — kiểm tra đã giao

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
```

### Code — không trùng và cập nhật sao

`server/src/controllers/reviewController.js` — `saveReview`, `refreshRating`

```js
const review = await Review.create({ user: userId, product: productId, ...data });
await refreshRating(productId);
return review;
```

```js
const reviews = await Review.find({ product: productId, isHidden: { $ne: true } });
const total = reviews.reduce((sum, review) => sum + review.rating, 0);
await Product.findByIdAndUpdate(productId, {
  ratingAverage: reviews.length ? Number((total / reviews.length).toFixed(1)) : 0,
  reviewCount: reviews.length,
});
```

Unique index hoặc rule tạo review phải phân biệt rõ “trùng trong một giao dịch” với “mua lại”. Tên index trong model cần được mở kiểm tra cùng parent trước khi chốt slide.

### Code — xóa đánh giá

`server/src/controllers/reviewController.js` — `deleteReview`

```js
const review = await Review.findByIdAndDelete(req.params.id);
if (!review) throw createError('Không tìm thấy đánh giá.', 404);
await refreshRating(review.product);
return res.json({ success: true, message: 'Đã xóa đánh giá.', data: null });
```

## Câu phản biện

**Tại sao chỉ khách đã nhận hàng mới được đánh giá?**

> “Đánh giá phải dựa trên trải nghiệm nhận hàng. Controller tìm đơn của chính user, yêu cầu `Delivered`, rồi kiểm tra sản phẩm thuộc đơn.”

**Admin có xóa đánh giá của khách được không?**

> “Admin có thể kiểm duyệt ẩn/hiện theo quyền. Khi ẩn hoặc xóa, `refreshRating` tính lại điểm từ các review đang hiển thị.”

**Cho mua lại đánh giá lại có làm trùng không?**

> “Không nếu dữ liệu gắn với giao dịch/đơn mua. Đây là điểm phải kiểm thử sau merge vì model hiện tại có thể đang unique theo user và product.”

## Câu bàn giao cho Hiệp

> “Em đã đi từ một sản phẩm cụ thể đến Đơn mua, đã chứng minh chặn hủy khi đang giao và chỉ đơn đã giao mới mở đánh giá. Mời Hiệp kiểm tra lại sản phẩm, Phòng thử và các tab quản trị.”

## Checklist 30 giây

- [ ] Mở đúng một `/products/:id`, không trình bày lan sang cả danh sách.
- [ ] Có đơn `Pending/Processing`, `Shipped`, `Delivered` để chỉ đúng điều kiện.
- [ ] Nói hoàn trả là trạng thái riêng, không nhầm với hủy.
- [ ] Gửi một review đúng, gửi trùng để chứng minh bị chặn.
- [ ] Xóa review và nói điểm sao được tính lại.
- [ ] Xác nhận với parent rule đánh giá lại khi mua sản phẩm ở đơn khác.
