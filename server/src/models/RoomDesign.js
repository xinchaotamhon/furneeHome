const mongoose = require('mongoose');

const normalizedPointSchema = new mongoose.Schema({
  x: { type: Number, required: true, min: 0, max: 1 },
  y: { type: Number, required: true, min: 0, max: 1 },
}, { _id: false });

const placementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true, trim: true },
  image: { type: String, default: '' },
  transparentImage: { type: String, default: '' },
  productFacts: {
    usageType: { type: String, enum: ['unknown', 'floor-seating', 'standard'], default: 'unknown' },
    placementSurface: { type: String, enum: ['unknown', 'floor', 'wall', 'tabletop'], default: 'unknown' },
    dimensionsCm: { width: Number, depth: Number, height: Number },
    aiDescription: { type: String, maxlength: 300, default: '' },
  },
  target: {
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
    anchor: { type: String, default: 'bottom-center' },
  },
  scale: { type: Number, default: 1, min: 0.1, max: 4 },
  rotation: { type: Number, default: 0, min: -180, max: 180 },
  isFlipped: { type: Boolean, default: false },
  zIndex: { type: Number, default: 0, min: 0, max: 100 },
}, { _id: false });

const roomDesignSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },

  // Giữ các trường một sản phẩm để đọc được dữ liệu cũ.
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, default: '' },
  productImage: { type: String, default: '' },
  photo: { type: String, default: '' },
  target: {
    x: { type: Number, min: 0, max: 1 },
    y: { type: Number, min: 0, max: 1 },
    anchor: { type: String, default: 'bottom-center' },
  },
  resultImage: { type: String, default: '' },
  resultMatchesLayout: { type: Boolean, default: true },
  designMode: { type: String, enum: ['placement', 'inspiration'], default: 'placement' },
  userPrompt: { type: String, default: '', trim: true, maxlength: 300 },
  designBrief: { purpose: String, style: String, keepClear: String, avoid: String },
  model: { type: String, default: '' },
  elapsedMs: Number,
  scale: { type: Number, default: 1, min: 0.1, max: 4 },
  rotation: { type: Number, default: 0, min: -180, max: 180 },
  flip: { type: Boolean, default: false },
  imageSize: {
    width: Number,
    height: Number,
  },

  placements: { type: [placementSchema], default: [] },
  markedCorners: { type: [normalizedPointSchema], default: [] },
  roomImage: { type: String, default: '' },
  visibility: { type: String, enum: ['private', 'public'], default: 'private' },
  shareSlug: { type: String, trim: true, unique: true, sparse: true },
  creatorName: { type: String, default: '', trim: true },
  reusedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomDesign' },
  reuseCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('RoomDesign', roomDesignSchema);
