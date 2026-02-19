const mongoose = require('mongoose');
const { Schema } = mongoose;

const userCouponUsageSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    couponId: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon',
        required: true
    },
    usageCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Compound unique index on userId + couponId
userCouponUsageSchema.index({ userId: 1, couponId: 1 }, { unique: true });

module.exports = mongoose.model('UserCouponUsage', userCouponUsageSchema);
