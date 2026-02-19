const mongoose = require('mongoose');
const { Schema } = mongoose;

const couponSchema = new Schema({
    code: {
        type: String,
        unique: true,
        required: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    minOrderAmount: {
        type: Number,
        required: true,
        default: 0
    },
    maxDiscount: {
        type: Number,
        min: 0
    },
    merchantId: {
        type: Schema.Types.ObjectId,
        ref: 'Merchant'
    },
    categoryIds: [{
        type: Schema.Types.ObjectId,
        ref: 'Category'
    }],
    perUserUsageLimit: {
        type: Number,
        required: true,
        default: 1
    },
    validFrom: {
        type: Date,
        required: true
    },
    validUntil: {
        type: Date,
        required: true
    },
    validHoursStart: {
        type: String, // e.g., "11:00"
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    validHoursEnd: {
        type: String, // e.g., "14:00"
        match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    },
    isStackable: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

couponSchema.pre('save', function (next) {
    if (this.isModified('code')) {
        this.code = this.code.trim().toUpperCase().replace(/-/g, '');
    }
    next();
});

module.exports = mongoose.model('Coupon', couponSchema);
