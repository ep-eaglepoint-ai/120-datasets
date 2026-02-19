const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  businessType: { type: String },
  isOpen: { type: Boolean, default: true },
  rating: { type: Number, default: 0 },
  businessAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  contactInfo: {
    phone: String,
    email: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Merchant', merchantSchema);

