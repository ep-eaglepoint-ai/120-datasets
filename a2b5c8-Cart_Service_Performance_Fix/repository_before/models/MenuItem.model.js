const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: String,
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
  price: mongoose.Schema.Types.Decimal128,
  discountedPrice: mongoose.Schema.Types.Decimal128,
  isAvailable: Boolean,
  productType: String,
  images: Array,
  variants: Array,
  extras: Array,
  discount: {
    isActive: Boolean,
    validFrom: Date,
    validUntil: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);

