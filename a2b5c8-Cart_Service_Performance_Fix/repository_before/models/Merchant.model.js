const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema({
  businessName: String,
  businessType: String,
  isOpen: Boolean,
  rating: Number
}, { timestamps: true });

module.exports = mongoose.model('Merchant', merchantSchema);

