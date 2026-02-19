const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
  name: { type: String, required: true },
  price: { type: mongoose.Schema.Types.Decimal128, required: true },
  discountedPrice: { type: mongoose.Schema.Types.Decimal128 },
  isAvailable: { type: Boolean, default: true },
  productType: { type: String, enum: ['simple', 'variable'], default: 'simple' },
  images: [{
    url: String,
    isPrimary: Boolean
  }],
  variants: [{
    optionValues: [{
      optionName: String,
      value: String
    }],
    price: mongoose.Schema.Types.Decimal128
  }],
  extras: [{
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    price: mongoose.Schema.Types.Decimal128
  }],
  discount: {
    isActive: Boolean,
    percentage: Number,
    validFrom: Date,
    validUntil: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);

