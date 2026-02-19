const { ObjectId } = require('mongodb');

class PromoCodeService {
  constructor(db) {
    this.db = db;
    this.promoCodes = db.collection('promo_codes');
    this.promoUsage = db.collection('promo_usage');
    this.users = db.collection('users');
  }

  async createPromoCode(promoData, adminId) {
    const promoCode = {
      code: promoData.code,
      discountType: promoData.discountType,
      discountValue: promoData.discountValue,
      maxUses: promoData.maxUses || null,
      maxUsesPerUser: promoData.maxUsesPerUser || 1,
      minOrderAmount: promoData.minOrderAmount || 0,
      validFrom: new Date(promoData.validFrom),
      validUntil: new Date(promoData.validUntil),
      applicableOrderTypes: promoData.applicableOrderTypes || ['all'],
      applicableMerchants: promoData.applicableMerchants || [],
      isActive: true,
      createdBy: adminId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.promoCodes.insertOne(promoCode);
    return { ...promoCode, _id: result.insertedId };
  }

  async validateAndApplyPromoCode(code, userId, orderAmount, orderType, merchantId = null, options = {}) {
    const promo = await this.promoCodes.findOne({ code: code, isActive: true });
    
    if (!promo) {
      throw new Error('Invalid promo code');
    }

    const now = new Date();
    if (promo.validUntil < now) {
      throw new Error('Promo code has expired');
    }

    if (promo.validFrom > now) {
      throw new Error('Promo code is not yet active');
    }

    const totalUsageCount = await this.promoUsage.countDocuments({ promoId: promo._id });
    const userUsageCount = await this.promoUsage.countDocuments({ 
      promoId: promo._id, 
      userId: new ObjectId(userId) 
    });

    if (promo.maxUses !== null && totalUsageCount >= promo.maxUses) {
      throw new Error('Promo code usage limit reached');
    }

    if (userUsageCount >= promo.maxUsesPerUser) {
      throw new Error('You have already used this promo code the maximum number of times');
    }

    if (orderAmount < promo.minOrderAmount) {
      throw new Error(`Minimum order amount of $${promo.minOrderAmount} required`);
    }

    if (!promo.applicableOrderTypes.includes('all') && !promo.applicableOrderTypes.includes(orderType)) {
      throw new Error('Promo code not valid for this order type');
    }

    if (promo.applicableMerchants.length > 0 && merchantId) {
      if (!promo.applicableMerchants.includes(merchantId)) {
        throw new Error('Promo code not valid for this merchant');
      }
    }

    const usageRecord = {
      promoId: promo._id,
      userId: new ObjectId(userId),
      orderId: options.orderId || null,
      usedAt: new Date(),
      orderAmount: orderAmount,
      discountApplied: this.calculateDiscount(promo, orderAmount)
    };
    
    await this.promoUsage.insertOne(usageRecord);

    const discount = this.calculateDiscount(promo, orderAmount);

    return {
      success: true,
      promoCode: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount: discount,
      finalAmount: orderAmount - discount
    };
  }

  calculateDiscount(promo, orderAmount) {
    switch (promo.discountType) {
      case 'percentage':
        return (orderAmount * promo.discountValue) / 100;
      case 'flat':
        return Math.min(promo.discountValue, orderAmount);
      case 'free_shipping':
        return 0;
      default:
        return 0;
    }
  }

  async getPromoCodeByCode(code) {
    return await this.promoCodes.findOne({ code: code });
  }

  async deactivatePromoCode(promoId, adminId) {
    const result = await this.promoCodes.updateOne(
      { _id: new ObjectId(promoId) },
      { 
        $set: { 
          isActive: false, 
          deactivatedBy: adminId,
          deactivatedAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );

    return result.modifiedCount > 0;
  }

  async getAllActivePromoCodes() {
    return await this.promoCodes.find({ isActive: true }).toArray();
  }
}

module.exports = PromoCodeService;

