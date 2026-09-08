const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'noi-that';
}

const DEFAULT_CATEGORIES = [
  { name: 'Phòng khách', description: 'Sofa, bàn trà, kệ tivi và đồ bài trí phòng khách sang trọng' },
  { name: 'Phòng ngủ', description: 'Giường ngủ, tủ quần áo, tab đầu giường và bàn trang điểm' },
  { name: 'Bếp & Phòng ăn', description: 'Bộ bàn ăn, ghế ăn, tủ bếp và phụ kiện không gian ăn uống' },
  { name: 'Phòng làm việc', description: 'Bàn làm việc thông minh, ghế công thái học và giá sách' },
  { name: 'Trang trí & Đèn', description: 'Đèn cây đứng, thảm sàn, gương decor và tranh treo tường' },
];

const DEFAULT_PRODUCTS = [
  {
    name: 'Sofa Băng Nỉ Scandinavian Cao Cấp',
    categoryName: 'Phòng khách',
    price: 6800000,
    stock: 25,
    ratingAverage: 4.9,
    reviewCount: 18,
    dimensions: '200 x 85 x 75 cm',
    dimensionsCm: { width: 200, depth: 85, height: 75 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/sofa-scandinavian.png',
    transparentImage: '/images/products/sofa-scandinavian.png',
    description: 'Sofa phong cách Bắc Âu đệm mút D40 chống xẹp lún, khung gỗ thông tự nhiên đã qua tẩm sấy chống mối mọt.',
  },
  {
    name: 'Bàn Trà Tròn Đôi Khung Kim Loại Mặt Đá Ceramic',
    categoryName: 'Phòng khách',
    price: 3200000,
    stock: 40,
    ratingAverage: 4.8,
    reviewCount: 12,
    dimensions: '70 x 70 x 45 cm',
    dimensionsCm: { width: 70, depth: 70, height: 45 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/ban-tra-mat-da.png',
    transparentImage: '/images/products/ban-tra-mat-da.png',
    description: 'Bàn trà lồng đôi tiết kiệm không gian, mặt đá ceramic chống trầy xước và chịu nhiệt cực tốt.',
  },
  {
    name: 'Kệ Tivi Gỗ Sồi Hiện Đại Phối Cánh Trắng',
    categoryName: 'Phòng khách',
    price: 4500000,
    stock: 15,
    ratingAverage: 4.7,
    reviewCount: 9,
    dimensions: '180 x 40 x 48 cm',
    dimensionsCm: { width: 180, depth: 40, height: 48 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/ke-tivi-go-soi.png',
    transparentImage: '/images/products/ke-tivi-go-soi.png',
    description: 'Kệ tivi thiết kế tối giản với 3 ngăn kéo rộng rãi, chân kim loại sơn tĩnh điện chống rỉ sét.',
  },
  {
    name: 'Ghế Armchair Thư Giãn Bọc Da Bò Ý',
    categoryName: 'Phòng khách',
    price: 5200000,
    stock: 10,
    ratingAverage: 5.0,
    reviewCount: 7,
    dimensions: '80 x 78 x 82 cm',
    dimensionsCm: { width: 80, depth: 78, height: 82 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/ghe-armchair.png',
    transparentImage: '/images/products/ghe-armchair.png',
    description: 'Ghế bành đơn thư giãn phong cách Retro, tựa lưng ôm sát công thái học tạo cảm giác êm ái khi đọc sách.',
  },
  {
    name: 'Giường Ngủ Gỗ Sồi Tự Nhiên Khung Nâng Tiện Ích',
    categoryName: 'Phòng ngủ',
    price: 11500000,
    stock: 8,
    ratingAverage: 4.9,
    reviewCount: 22,
    dimensions: '180 x 200 x 95 cm',
    dimensionsCm: { width: 180, depth: 200, height: 95 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/giuong-go-soi.png',
    transparentImage: '/images/products/giuong-go-soi.png',
    description: 'Giường ngủ hiện đại tích hợp hộc chứa đồ nâng piston trợ lực thủy lực dưới dát giường cực kỳ tiện lợi.',
  },
  {
    name: 'Tủ Quần Áo Cánh Lùa Kịch Trần Gỗ MDF Chống Ẩm',
    categoryName: 'Phòng ngủ',
    price: 8900000,
    stock: 12,
    ratingAverage: 4.8,
    reviewCount: 15,
    dimensions: '160 x 60 x 220 cm',
    dimensionsCm: { width: 160, depth: 60, height: 220 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/tu-quan-ao-canh-lua.png',
    transparentImage: '/images/products/tu-quan-ao-canh-lua.png',
    description: 'Tủ áo thiết kế cửa lùa êm ái, phủ melamine vân gỗ sồi kết hợp trắng chống trầy và kháng nước tối ưu.',
  },
  {
    name: 'Tab Đầu Giường 2 Ngăn Kéo Gỗ Tự Nhiên',
    categoryName: 'Phòng ngủ',
    price: 1250000,
    stock: 50,
    ratingAverage: 4.6,
    reviewCount: 14,
    dimensions: '45 x 40 x 45 cm',
    dimensionsCm: { width: 45, depth: 40, height: 45 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/tab-dau-giuong.png',
    transparentImage: '/images/products/tab-dau-giuong.png',
    description: 'Tủ đầu giường nhỏ gọn tiện dụng, ray trượt giảm chấn êm ái thích hợp để đèn ngủ và vật dụng cá nhân.',
  },
  {
    name: 'Bàn Trang Điểm Đèn LED Cảm Ứng Kèm Ghế Bọc Nỉ',
    categoryName: 'Phòng ngủ',
    price: 4200000,
    stock: 20,
    ratingAverage: 4.9,
    reviewCount: 30,
    dimensions: '100 x 45 x 130 cm',
    dimensionsCm: { width: 100, depth: 45, height: 130 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/ban-trang-diem.png',
    transparentImage: '/images/products/ban-trang-diem.png',
    description: 'Gương tròn tích hợp đèn LED 3 chế độ sáng (Trắng, Vàng, Trung tính), ngăn chia mỹ phẩm thông minh.',
  },
  {
    name: 'Bộ Bàn Ăn 6 Ghế Mặt Đá Cẩm Thạch Chân Chữ X',
    categoryName: 'Bếp & Phòng ăn',
    price: 9800000,
    stock: 14,
    ratingAverage: 5.0,
    reviewCount: 16,
    dimensions: '160 x 80 x 75 cm',
    dimensionsCm: { width: 160, depth: 80, height: 75 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/bo-ban-an-6-ghe.png',
    transparentImage: '/images/products/bo-ban-an-6-ghe.png',
    description: 'Bàn ăn gia đình mặt đá cẩm thạch bóng mờ chống ố kèm 6 ghế Monet bọc da micro fiber chống bám bẩn.',
  },
  {
    name: 'Ghế Ăn Bọc Nệm Chân Kim Loại Phong Cách Ý',
    categoryName: 'Bếp & Phòng ăn',
    price: 850000,
    stock: 80,
    ratingAverage: 4.7,
    reviewCount: 25,
    dimensions: '45 x 48 x 85 cm',
    dimensionsCm: { width: 45, depth: 48, height: 85 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/ghe-an-y.png',
    transparentImage: '/images/products/ghe-an-y.png',
    description: 'Ghế ăn thiết kế lưng cong nâng đỡ cột sống, chân sắt sơn tĩnh điện mạ vàng điểm nhấn tinh tế.',
  },
  {
    name: 'Tủ Rượu Mini Phòng Bếp Gỗ Cao Su Cánh Kính',
    categoryName: 'Bếp & Phòng ăn',
    price: 3600000,
    stock: 18,
    ratingAverage: 4.8,
    reviewCount: 8,
    dimensions: '80 x 40 x 110 cm',
    dimensionsCm: { width: 80, depth: 40, height: 110 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/tu-ruou-mini.png',
    transparentImage: '/images/products/tu-ruou-mini.png',
    description: 'Tủ để rượu kết hợp kệ ly và đồ uống, kính cường lực trong suốt tạo điểm nhấn cho phòng ăn.',
  },
  {
    name: 'Bàn Làm Việc Công Thái Học Nâng Hạ Điện Tự Động',
    categoryName: 'Phòng làm việc',
    price: 5900000,
    stock: 30,
    ratingAverage: 5.0,
    reviewCount: 42,
    dimensions: '140 x 70 x 72-118 cm',
    dimensionsCm: { width: 140, depth: 70, height: 75 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/ban-nang-ha.png',
    transparentImage: '/images/products/ban-nang-ha.png',
    description: 'Động cơ kép nâng hạ êm ái tốc độ 30mm/s, bộ nhớ 4 vị trí độ cao, chống kẹt an toàn thông minh.',
  },
  {
    name: 'Ghế Công Thái Học Lưới Toàn Thần ErgoMax',
    categoryName: 'Phòng làm việc',
    price: 3850000,
    stock: 35,
    ratingAverage: 4.9,
    reviewCount: 38,
    dimensions: '65 x 65 x 115-125 cm',
    dimensionsCm: { width: 65, depth: 65, height: 120 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/ghe-cong-thai-hoc.png',
    transparentImage: '/images/products/ghe-cong-thai-hoc.png',
    description: 'Lưới Wintex Hàn Quốc thoáng khí, đệm đỡ thắt lưng điều chỉnh đa chiều, ngả lưng 135 độ khóa 3 vị trí.',
  },
  {
    name: 'Kệ Sách Cây Đứng 5 Tầng Khung Thép Gỗ MDF',
    categoryName: 'Phòng làm việc',
    price: 1450000,
    stock: 45,
    ratingAverage: 4.7,
    reviewCount: 19,
    dimensions: '60 x 28 x 160 cm',
    dimensionsCm: { width: 60, depth: 28, height: 160 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/ke-sach-5-tang.png',
    transparentImage: '/images/products/ke-sach-5-tang.png',
    description: 'Kệ sách dạng ziczac độc đáo, khả năng chịu lực 20kg mỗi tầng, phù hợp để tài liệu và đồ trang trí.',
  },
  {
    name: 'Đèn Cây Đứng Phòng Khách Chao Vải Chân Gỗ 3 Chạc',
    categoryName: 'Trang trí & Đèn',
    price: 1150000,
    stock: 25,
    ratingAverage: 4.8,
    reviewCount: 20,
    dimensions: '40 x 40 x 150 cm',
    dimensionsCm: { width: 40, depth: 40, height: 150 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/den-cay-dung.png',
    transparentImage: '/images/products/den-cay-dung.png',
    description: 'Đèn sàn trang trí ánh sáng vàng dịu mắt, đui E27 tiêu chuẩn, thân gỗ tự nhiên chắc chắn.',
  },
  {
    name: 'Thảm Trải Sàn Lông Ngắn Họa Tiết Trừu Tượng',
    categoryName: 'Trang trí & Đèn',
    price: 1850000,
    stock: 20,
    ratingAverage: 4.9,
    reviewCount: 15,
    dimensions: '160 x 230 x 1.2 cm',
    dimensionsCm: { width: 160, depth: 230, height: 2 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/tham-trai-san.png',
    transparentImage: '/images/products/tham-trai-san.png',
    description: 'Thảm dệt sợi polypropylene mềm mại chống bám bụi, đế cao su chống trơn trượt an toàn cho trẻ nhỏ.',
  },
  {
    name: 'Gương Toàn Thân Viền Gỗ Uốn Cong Decor Cao Cấp',
    categoryName: 'Trang trí & Đèn',
    price: 1950000,
    stock: 18,
    ratingAverage: 5.0,
    reviewCount: 26,
    dimensions: '60 x 4 x 170 cm',
    dimensionsCm: { width: 60, depth: 4, height: 170 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/guong-toan-than.png',
    transparentImage: '/images/products/guong-toan-than.png',
    description: 'Gương bạc phôi Bỉ tráng 8 lớp siêu nét chân thật, khung gỗ tần bì uốn nhiệt công nghệ cao.',
  },
  {
    name: 'Kệ Treo Tường Tổ Ong Gỗ Thông Decor Nghệ Thuật',
    categoryName: 'Trang trí & Đèn',
    price: 680000,
    stock: 60,
    ratingAverage: 4.6,
    reviewCount: 11,
    dimensions: '30 x 15 x 26 cm',
    dimensionsCm: { width: 30, depth: 15, height: 26 },
    usageType: 'standard',
    placementSurface: 'wall',
    image: '/images/products/ke-to-ong.png',
    transparentImage: '/images/products/ke-to-ong.png',
    description: 'Bộ 3 kệ lục giác treo tường linh hoạt bố trí, phụ kiện giấu chân tinh tế không lộ ốc vít.',
  },
  {
    name: 'Bàn Bệt Kiểu Nhật Gỗ Cao Su Tự Nhiên Gấp Gọn',
    categoryName: 'Phòng khách',
    price: 750000,
    stock: 50,
    ratingAverage: 4.8,
    reviewCount: 33,
    dimensions: '90 x 50 x 32 cm',
    dimensionsCm: { width: 90, depth: 50, height: 32 },
    usageType: 'floor-seating',
    placementSurface: 'floor',
    image: '/images/products/ban-bet-nhat.png',
    transparentImage: '/images/products/ban-bet-nhat.png',
    description: 'Bàn ngồi bệt chân gập gọn gàng tiện ích cho căn hộ studio và phòng trọ diện tích nhỏ.',
  },
  {
    name: 'Đôn Sofa Tròn Nỉ Nhung Chân Mạ Vàng',
    categoryName: 'Phòng khách',
    price: 490000,
    stock: 70,
    ratingAverage: 4.7,
    reviewCount: 28,
    dimensions: '35 x 35 x 40 cm',
    dimensionsCm: { width: 35, depth: 35, height: 40 },
    usageType: 'standard',
    placementSurface: 'floor',
    image: '/images/products/don-sofa.png',
    transparentImage: '/images/products/don-sofa.png',
    description: 'Ghế đôn tròn nhỏ xinh ngồi thay giày hoặc làm ghế phụ phòng khách, đệm êm ái nhiều màu sắc.',
  },
];

async function seedCategories() {
  const map = {};
  for (const item of DEFAULT_CATEGORIES) {
    const itemSlug = slug(item.name);
    const cat = await Category.findOneAndUpdate(
      { slug: itemSlug },
      { $set: { name: item.name, slug: itemSlug, description: item.description, isActive: true } },
      { upsert: true, new: true },
    );
    map[item.name] = cat;
  }
  return map;
}

async function seedProducts(categoryMap) {
  let count = 0;
  for (const item of DEFAULT_PRODUCTS) {
    const category = categoryMap[item.categoryName] || categoryMap['Phòng khách'];
    const itemSlug = `${slug(item.name)}-${count + 1}`;
    await Product.findOneAndUpdate(
      { name: item.name },
      {
        $set: {
          name: item.name,
          slug: itemSlug,
          category: category._id,
          categoryName: category.name,
          price: item.price,
          stock: item.stock,
          ratingAverage: item.ratingAverage,
          reviewCount: item.reviewCount,
          dimensions: item.dimensions,
          dimensionsCm: item.dimensionsCm,
          usageType: item.usageType,
          placementSurface: item.placementSurface,
          image: item.image,
          images: [item.image],
          transparentImage: item.transparentImage,
          description: item.description,
          isActive: true,
        },
      },
      { upsert: true },
    );
    count += 1;
  }
  return count;
}

async function seedAccounts() {
  const adminPasswordHash = await bcrypt.hash('admin123456', 10);
  await User.findOneAndUpdate(
    { email: 'admin@furneehome.vn' },
    {
      $set: {
        name: 'Quản trị viên FurneeHome',
        email: 'admin@furneehome.vn',
        username: 'admin',
        password: adminPasswordHash,
        role: 'superadmin',
        emailVerified: true,
        isActive: true,
      },
    },
    { upsert: true },
  );

  const customerPasswordHash = await bcrypt.hash('user123456', 10);
  await User.findOneAndUpdate(
    { email: 'customer@furneehome.vn' },
    {
      $set: {
        name: 'Nguyễn Văn Khách Hàng',
        email: 'customer@furneehome.vn',
        username: 'customer',
        password: customerPasswordHash,
        role: 'customer',
        emailVerified: true,
        isActive: true,
      },
    },
    { upsert: true },
  );
}

async function seedCoupons() {
  const coupons = [
    { code: 'WELCOME10', discountPercent: 10, maxDiscount: 200000, minOrder: 500000, isActive: true },
    { code: 'FURNEE20', discountPercent: 20, maxDiscount: 500000, minOrder: 2000000, isActive: true },
    { code: 'SALE50K', discountPercent: 5, maxDiscount: 50000, minOrder: 500000, isActive: true },
  ];

  for (const c of coupons) {
    await Coupon.findOneAndUpdate(
      { code: c.code },
      { $set: c },
      { upsert: true },
    );
  }
}

async function seed() {
  await connectDatabase();
  const categoryMap = await seedCategories();
  const productCount = await seedProducts(categoryMap);
  await seedAccounts();
  await seedCoupons();
  console.log(`Đã nạp thành công ${productCount} sản phẩm, danh mục, tài khoản mẫu và mã giảm giá.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = { seed };
