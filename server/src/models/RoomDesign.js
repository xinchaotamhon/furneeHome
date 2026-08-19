const mongoose = require('mongoose');

const roomDesignSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, default: '' },
  target: {
    x: { type: Number, min: 0, max: 1 },
    y: { type: Number, min: 0, max: 1 },
    anchor: { type: String, default: 'bottom-center' },
  },
  resultImage: { type: String, default: '' },
  model: { type: String, default: '' },
  elapsedMs: Number,
  imageSize: {
    width: Number,
    height: Number,
  },
}, { timestamps: true });

module.exports = mongoose.model('RoomDesign', roomDesignSchema);
