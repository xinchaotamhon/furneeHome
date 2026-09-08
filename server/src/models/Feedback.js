const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, default: '', trim: true, maxlength: 80 },
  email: { type: String, default: '', trim: true, maxlength: 150 },
  type: { type: String, enum: ['suggestion', 'report'], required: true },
  targetType: { type: String, enum: ['general', 'product'], default: 'general' },
  targetId: { type: String, default: '', trim: true, maxlength: 100 },
  targetName: { type: String, default: '', trim: true, maxlength: 200 },
  content: { type: String, required: true, trim: true, maxlength: 2_000 },
  status: { type: String, enum: ['new', 'reviewed', 'resolved'], default: 'new' },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
