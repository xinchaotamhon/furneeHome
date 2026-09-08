const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  categoryName: { type: String, required: true, trim: true },
  // FurneeHome sells in whole Vietnamese dong; a sellable product never has a placeholder price.
  price: { type: Number, required: true, min: 1, validate: Number.isInteger },
  stock: { type: Number, default: 50, min: 0, validate: Number.isInteger },
  ratingAverage: { type: Number, default: 5.0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0, min: 0 },
  dimensions: { type: String, default: '', trim: true },
  description: { type: String, default: '', trim: true },
  image: { type: String, default: '' },
  images: [{ type: String }],
  transparentImage: { type: String, default: '' },
  sourceImages: [{ type: String }],
  specifications: [{ name: { type: String, trim: true }, value: { type: String, trim: true } }],
  dimensionsCm: {
    width: { type: Number, min: 1 },
    depth: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
  },
  usageType: { type: String, enum: ['floor-seating', 'standard', 'unknown'], default: 'unknown' },
  placementSurface: { type: String, enum: ['floor', 'wall', 'tabletop', 'unknown'], default: 'unknown' },
  aiDescription: { type: String, default: '', trim: true, maxlength: 300 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
