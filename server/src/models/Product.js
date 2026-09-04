const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  categoryName: { type: String, default: '' },
  images: [{ type: String, trim: true }],
  image: { type: String, default: '' },
  transparentImage: { type: String, default: '' },
  sellerName: { type: String, default: '' },
  isOfficial: { type: Boolean, default: false },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  dimensions: {
    widthCm: { type: Number, min: 1 },
    depthCm: { type: Number, min: 1 },
    heightCm: { type: Number, min: 1 },
  },
  dimensionsCm: {
    width: { type: Number, min: 1 },
    depth: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
  },
  usageType: { type: String, enum: ['floor-seating', 'standard', 'unknown'], default: 'unknown' },
  placementSurface: { type: String, enum: ['floor', 'wall', 'tabletop', 'unknown'], default: 'unknown' },
  aiDescription: { type: String, default: '', trim: true, maxlength: 300 },
  colors: [{ type: String }],
  shopeeSearchUrl: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  sourcePlatform: { type: String, default: '', index: true },
  shopeeShopId: { type: String, default: '' },
  shopeeItemId: { type: String, default: '' },
  sourceImages: [{ type: String, trim: true }],
  sourceFetchedAt: { type: Date },
  importStatus: { type: String, enum: ['complete', 'needs-image-processing'], default: 'complete' },
  offers: [{
    id: String,
    name: String,
    displayPrice: String,
    url: String,
    image: String,
    sellerName: String,
    affiliateUrl: String,
  }],
  searchKeywords: [{ type: String }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', searchKeywords: 'text' });
productSchema.index(
  { sourcePlatform: 1, shopeeShopId: 1, shopeeItemId: 1 },
  { unique: true, partialFilterExpression: { sourcePlatform: 'shopee', shopeeShopId: { $type: 'string' }, shopeeItemId: { $type: 'string' } } },
);
module.exports = mongoose.model('Product', productSchema);
