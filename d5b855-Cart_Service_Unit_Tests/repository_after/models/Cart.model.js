const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartSchema = new Schema({
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  merchantId: {
    type: Schema.Types.ObjectId,
    ref: 'Merchant'
  },
  items: [{
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    variations: [{
      optionName: String,
      value: String,
      priceModifier: Number
    }],
    addOns: [{
      _id: Schema.Types.ObjectId,
      name: String,
      price: Number
    }],
    subtotal: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  pricing: {
    subtotal: {
      type: Number,
      default: 0,
      min: 0
    },
    totalItems: {
      type: Number,
      default: 0,
      min: 0
    }
  }
}, { timestamps: true });

cartSchema.pre('save', function(next) {
  this.pricing.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.pricing.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  next();
});

module.exports = mongoose.model('Cart', cartSchema);

