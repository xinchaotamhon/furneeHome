const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  x: { type: Number, required: true, min: 0, max: 1 },
  y: { type: Number, required: true, min: 0, max: 1 },
}, { _id: false });

const placementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, default: '', trim: true },
  image: { type: String, default: '' },
  transparentImage: { type: String, default: '' },
  target: { type: pointSchema, required: true },
  scale: { type: Number, default: 1, min: 0.1, max: 4 },
  isFlipped: { type: Boolean, default: false },
}, { _id: false });

const roomDesignSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, default: '', trim: true, maxlength: 200 },
  productImage: { type: String, default: '' },
  roomImage: { type: String, default: '' },
  resultImage: { type: String, default: '' },
  previewImage: { type: String, default: '' },
  target: { type: pointSchema },
  scale: { type: Number, default: 1, min: 0.1, max: 4 },
  flip: { type: Boolean, default: false },
  placements: { type: [placementSchema], default: [] },
  imageSize: {
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
  },
  userPrompt: { type: String, default: '', trim: true, maxlength: 300 },
  designBrief: {
    desiredPosition: { type: String, default: '', trim: true, maxlength: 120 },
    avoid: { type: String, default: '', trim: true, maxlength: 120 },
  },
  model: { type: String, default: '', trim: true, maxlength: 100 },
  elapsedMs: { type: Number, min: 0, max: 600_000 },
  resultMatchesLayout: { type: Boolean, default: true },
}, { timestamps: true });

roomDesignSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('RoomDesign', roomDesignSchema);
