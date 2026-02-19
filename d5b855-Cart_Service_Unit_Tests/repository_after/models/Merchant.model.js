const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  businessType: String,
  isOpen: { type: Boolean, default: true },
  rating: Number,
  businessAddress: String,
  contactInfo: String
}, { timestamps: true });

module.exports = mongoose.model('Merchant', merchantSchema);

