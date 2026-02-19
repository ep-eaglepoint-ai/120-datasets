const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  price: { type: mongoose.Schema.Types.Decimal128, required: true },
  quantity: { type: Number, required: true, min: 1 },
  variations: [{
    optionName: String,
    value: String
  }],
  addOns: [{
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    price: mongoose.Schema.Types.Decimal128
  }],
  subtotal: { type: mongoose.Schema.Types.Decimal128, required: true }
});

const cartSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
  items: [cartItemSchema],
  pricing: {
    subtotal: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    totalItems: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);

