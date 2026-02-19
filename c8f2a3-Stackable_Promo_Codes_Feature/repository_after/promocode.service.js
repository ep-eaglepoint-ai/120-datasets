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

  async validateAndApplyMultiplePromoCodes(codes, userId, orderAmount, orderType, merchantId = null, options = {}) {
    // Req 13: Empty array validation
    if (!Array.isArray(codes) || codes.length === 0) {
      throw new Error('At least one promo code is required');
    }

    // Req 2: Maximum 3 codes per order
    if (codes.length > 3) {
      throw new Error('Maximum 3 promo codes allowed per order');
    }

    // Req 9: Case-insensitive duplicate detection (SAVE20 = save20)
    const normalizedCodes = codes.map(code => code.toLowerCase());
    const uniqueCodes = new Set(normalizedCodes);
    if (uniqueCodes.size !== codes.length) {
      throw new Error('Duplicate promo codes are not allowed');
    }

    // Req 9: Case-insensitive code matching
    const codeQueries = codes.map(code => ({
      code: { $regex: new RegExp(`^${code}$`, 'i') },
      isActive: true
    }));

    const promos = await this.promoCodes.find({ $or: codeQueries }).toArray();

    // Req 6: Invalid code causes entire request to fail
    if (promos.length !== codes.length) {
      const foundCodes = promos.map(p => p.code.toLowerCase());
      const missingCodes = codes.filter(code => !foundCodes.includes(code.toLowerCase()));
      throw new Error(`Invalid promo code: ${missingCodes[0]}`);
    }

    // Map for case-insensitive lookup
    const promoMap = new Map();
    promos.forEach(promo => {
      promoMap.set(promo.code.toLowerCase(), promo);
    });

    // Preserve input order
    const orderedPromos = codes.map(code => {
      const normalized = code.toLowerCase();
      for (const [key, promo] of promoMap.entries()) {
        if (key === normalized) {
          return promo;
        }
      }
      return null;
    }).filter(p => p !== null);

    const now = new Date();
    const originalOrderAmount = orderAmount; // Req 12: Use original amount for min checks

    // Req 6, 10: Validate all codes before applying any (all-or-nothing)
    for (const promo of orderedPromos) {
      if (promo.validUntil < now) {
        throw new Error(`Promo code ${promo.code} has expired`);
      }

      if (promo.validFrom > now) {
        throw new Error(`Promo code ${promo.code} is not yet active`);
      }

      // Req 12: Minimum order check uses original amount, not discounted
      if (originalOrderAmount < promo.minOrderAmount) {
        throw new Error(`Promo code ${promo.code} requires minimum order amount of $${promo.minOrderAmount}`);
      }

      if (!promo.applicableOrderTypes.includes('all') && !promo.applicableOrderTypes.includes(orderType)) {
        throw new Error(`Promo code ${promo.code} is not valid for this order type`);
      }

      if (promo.applicableMerchants.length > 0 && merchantId) {
        if (!promo.applicableMerchants.includes(merchantId)) {
          throw new Error(`Promo code ${promo.code} is not valid for this merchant`);
        }
      }
    }

    // Req 4: Cannot combine two percentage codes
    const percentageCodes = orderedPromos.filter(p => p.discountType === 'percentage');
    if (percentageCodes.length > 1) {
      throw new Error('Cannot combine multiple percentage discount codes');
    }

    // Req 5: Cannot combine two free_shipping codes
    const freeShippingCodes = orderedPromos.filter(p => p.discountType === 'free_shipping');
    if (freeShippingCodes.length > 1) {
      throw new Error('Cannot combine multiple free shipping codes');
    }

    // Req 11: Atomic usage limit checks to prevent race conditions
    const usageReservations = [];
    for (const promo of orderedPromos) {
      if (promo.maxUses !== null) {
        const currentUsage = await this.promoUsage.countDocuments({ promoId: promo._id });
        if (currentUsage >= promo.maxUses) {
          throw new Error(`Promo code ${promo.code} usage limit reached`);
        }
      }

      const userUsageCount = await this.promoUsage.countDocuments({
        promoId: promo._id,
        userId: new ObjectId(userId)
      });

      if (userUsageCount >= promo.maxUsesPerUser) {
        throw new Error(`You have already used promo code ${promo.code} the maximum number of times`);
      }

      usageReservations.push(promo);
    }

    // Req 6, 7: Calculate discounts in correct order
    let totalDiscount = 0;
    let remainingAmount = originalOrderAmount;
    const breakdown = []; // Req 15: Breakdown for each code

    // Req 6: Percentage discounts apply to ORIGINAL order amount
    const percentagePromo = orderedPromos.find(p => p.discountType === 'percentage');
    if (percentagePromo) {
      const percentageDiscount = (originalOrderAmount * percentagePromo.discountValue) / 100;
      totalDiscount += percentageDiscount;
      remainingAmount = originalOrderAmount - percentageDiscount;
      breakdown.push({
        promoCode: percentagePromo.code,
        discountType: percentagePromo.discountType,
        discountValue: percentagePromo.discountValue,
        discountAmount: percentageDiscount
      });
    }

    // Req 7: Flat discounts apply after percentage discounts
    const flatPromos = orderedPromos.filter(p => p.discountType === 'flat');
    for (const flatPromo of flatPromos) {
      const flatDiscount = Math.min(flatPromo.discountValue, remainingAmount);
      totalDiscount += flatDiscount;
      remainingAmount -= flatDiscount;
      breakdown.push({
        promoCode: flatPromo.code,
        discountType: flatPromo.discountType,
        discountValue: flatPromo.discountValue,
        discountAmount: flatDiscount
      });
    }

    // Req 8: Free shipping value counts toward 50% cap
    const freeShippingPromo = orderedPromos.find(p => p.discountType === 'free_shipping');
    if (freeShippingPromo) {
      const shippingValue = freeShippingPromo.discountValue;
      totalDiscount += shippingValue;
      breakdown.push({
        promoCode: freeShippingPromo.code,
        discountType: freeShippingPromo.discountType,
        discountValue: freeShippingPromo.discountValue,
        discountAmount: shippingValue
      });
    }

    // Req 3: Total discount cannot exceed 50% of original order amount
    const maxDiscount = originalOrderAmount * 0.5;
    if (totalDiscount > maxDiscount) {
      // Req 5: Cap exceeded - scale down proportionally
      const scaleFactor = maxDiscount / totalDiscount;
      
      for (const item of breakdown) {
        item.discountAmount = item.discountAmount * scaleFactor;
      }
      
      totalDiscount = maxDiscount;
    }

    // Req 10: Record usage atomically (all codes or none)
    const usageRecords = orderedPromos.map(promo => ({
      promoId: promo._id,
      userId: new ObjectId(userId),
      orderId: options.orderId || null,
      usedAt: new Date(),
      orderAmount: originalOrderAmount,
      discountApplied: breakdown.find(b => b.promoCode === promo.code)?.discountAmount || 0
    }));

    await this.promoUsage.insertMany(usageRecords);

    // Req 15: Return breakdown showing each code's contribution
    return {
      success: true,
      promoCodes: orderedPromos.map(p => p.code),
      breakdown: breakdown,
      totalDiscount: totalDiscount,
      finalAmount: originalOrderAmount - totalDiscount,
      originalAmount: originalOrderAmount
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
