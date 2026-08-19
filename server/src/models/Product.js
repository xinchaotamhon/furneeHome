const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, default: 0, min: 0 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  images: [{ type: String, trim: true }],
  transparentImage: { type: String, default: '' },
  dimensions: {
    widthCm: { type: Number, min: 1 },
    depthCm: { type: Number, min: 1 },
    heightCm: { type: Number, min: 1 },
  },
  colors: [{ type: String }],
  shopeeSearchUrl: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
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
module.exports = mongoose.model('Product', productSchema);
