const mongoose = require('mongoose');

const roomDesignSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  room: {
    widthM: Number,
    lengthM: Number,
    heightM: Number,
  },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    position: { x: Number, y: Number, z: Number },
    rotationY: { type: Number, default: 0 },
    color: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('RoomDesign', roomDesignSchema);
