const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: String,
  price: mongoose.Schema.Types.Decimal128,
  quantity: Number,
  variations: Array,
  addOns: Array,
  subtotal: mongoose.Schema.Types.Decimal128
});

const cartSchema = new mongoose.Schema({
  customerId: { type: String, required: true, index: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
  items: [cartItemSchema],
  pricing: {
    subtotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    totalItems: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);

