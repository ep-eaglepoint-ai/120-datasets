const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  isAvailable: { type: Boolean, default: true },
  images: [{ url: String, isPrimary: Boolean }],
  extras: [{ name: String, price: Number }],
  variants: [{ optionValues: [{ optionName: String, value: String }], price: Number }],
  productType: { type: String, enum: ['simple', 'variable'], default: 'simple' },
  discount: { isActive: Boolean, validFrom: Date, validUntil: Date },
  discountedPrice: Number
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);

