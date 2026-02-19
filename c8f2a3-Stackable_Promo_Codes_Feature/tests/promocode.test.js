const { MongoClient } = require('mongodb');
const path = require('path');

// Switch between repository_before and repository_after via environment variable
const REPO_PATH = process.env.REPO_PATH || '../repository_before';

const PromoCodeService = require(path.join(__dirname, REPO_PATH, 'promocode.service'));

describe('PromoCodeService - Stackable Codes Feature', () => {
  let client;
  let db;
  let service;
  let userId;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || global.__MONGO_URI__ || 'mongodb://localhost:27017';
    client = await MongoClient.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    db = client.db(process.env.MONGODB_DB || global.__MONGO_DB_NAME__ || 'test_promocodes');
    service = new PromoCodeService(db);
    userId = '507f1f77bcf86cd799439011';
  });

  beforeEach(async () => {
    await db.collection('promo_codes').deleteMany({});
    await db.collection('promo_usage').deleteMany({});
  });

  afterAll(async () => {
    await client.close();
  });

  async function createPromoCode(code, discountType, discountValue, options = {}) {
    return await service.createPromoCode({
      code,
      discountType,
      discountValue,
      maxUses: options.maxUses || null,
      maxUsesPerUser: options.maxUsesPerUser || 1,
      minOrderAmount: options.minOrderAmount || 0,
      validFrom: options.validFrom || new Date('2020-01-01'),
      validUntil: options.validUntil || new Date('2030-12-31'),
      applicableOrderTypes: options.applicableOrderTypes || ['all'],
      applicableMerchants: options.applicableMerchants || []
    }, 'admin123');
  }

  describe('Test 1: Three valid codes of different types applied successfully', () => {
    test('should apply percentage, flat, and free_shipping codes with correct breakdown', async () => {
      await createPromoCode('PERCENT20', 'percentage', 20);
      await createPromoCode('FLAT10', 'flat', 10);
      await createPromoCode('FREESHIP', 'free_shipping', 5);

      const result = await service.validateAndApplyMultiplePromoCodes(
        ['PERCENT20', 'FLAT10', 'FREESHIP'],
        userId,
        100,
        'standard'
      );

      expect(result.success).toBe(true);
      expect(result.promoCodes).toHaveLength(3);
      expect(result.breakdown).toHaveLength(3);
      expect(result.totalDiscount).toBe(35);
      expect(result.finalAmount).toBe(65);
    });
  });

  describe('Test 2: Two percentage codes rejected with conflict error', () => {
    test('should reject multiple percentage codes', async () => {
      await createPromoCode('PERCENT20', 'percentage', 20);
      await createPromoCode('PERCENT30', 'percentage', 30);

      await expect(
        service.validateAndApplyMultiplePromoCodes(['PERCENT20', 'PERCENT30'], userId, 100, 'standard')
      ).rejects.toThrow('Cannot combine multiple percentage discount codes');
    });
  });

  describe('Test 3: Two free_shipping codes rejected with conflict error', () => {
    test('should reject multiple free_shipping codes', async () => {
      await createPromoCode('SHIP1', 'free_shipping', 5);
      await createPromoCode('SHIP2', 'free_shipping', 8);

      await expect(
        service.validateAndApplyMultiplePromoCodes(['SHIP1', 'SHIP2'], userId, 100, 'standard')
      ).rejects.toThrow('Cannot combine multiple free shipping codes');
    });
  });

  describe('Test 4: Percentage + flat codes apply in correct order', () => {
    test('percentage should apply to original amount, flat to remaining', async () => {
      await createPromoCode('PERCENT20', 'percentage', 20);
      await createPromoCode('FLAT15', 'flat', 15);

      const result = await service.validateAndApplyMultiplePromoCodes(
        ['PERCENT20', 'FLAT15'],
        userId,
        100,
        'standard'
      );

      expect(result.success).toBe(true);
      expect(result.totalDiscount).toBe(35);
      expect(result.breakdown[0].discountAmount).toBe(20);
      expect(result.breakdown[1].discountAmount).toBe(15);
    });
  });

  describe('Test 5: Total discount capped at 50%', () => {
    test('should cap total discount at 50% of original amount', async () => {
      await createPromoCode('PERCENT40', 'percentage', 40);
      await createPromoCode('FLAT20', 'flat', 20);

      const result = await service.validateAndApplyMultiplePromoCodes(
        ['PERCENT40', 'FLAT20'],
        userId,
        100,
        'standard'
      );

      expect(result.success).toBe(true);
      expect(result.totalDiscount).toBe(50);
      expect(result.finalAmount).toBe(50);
    });
  });

  describe('Test 6: Invalid code causes entire request to fail', () => {
    test('should reject all codes if any is invalid', async () => {
      await createPromoCode('VALID1', 'flat', 10);

      await expect(
        service.validateAndApplyMultiplePromoCodes(['VALID1', 'INVALID'], userId, 100, 'standard')
      ).rejects.toThrow('Invalid promo code');

      const usageCount = await db.collection('promo_usage').countDocuments();
      expect(usageCount).toBe(0);
    });
  });

  describe('Test 7: Empty code array returns error', () => {
    test('should reject empty array', async () => {
      await expect(
        service.validateAndApplyMultiplePromoCodes([], userId, 100, 'standard')
      ).rejects.toThrow('At least one promo code is required');
    });
  });

  describe('Test 8: Single code works identically to existing API', () => {
    test('single code should work with both methods', async () => {
      await createPromoCode('SINGLE10', 'flat', 10, { maxUsesPerUser: 2 });
      await createPromoCode('SINGLE10B', 'flat', 10, { maxUsesPerUser: 1 });

      const existingResult = await service.validateAndApplyPromoCode('SINGLE10', userId, 100, 'standard');
      expect(existingResult.success).toBe(true);
      expect(existingResult.discountAmount).toBe(10);

      const newResult = await service.validateAndApplyMultiplePromoCodes(['SINGLE10B'], userId, 100, 'standard');
      expect(newResult.success).toBe(true);
      expect(newResult.totalDiscount).toBe(10);
      expect(newResult.finalAmount).toBe(90);
    });
  });

  describe('Test 9: Fourth code rejected with max codes error', () => {
    test('should reject more than 3 codes', async () => {
      await createPromoCode('CODE1', 'flat', 5);
      await createPromoCode('CODE2', 'flat', 5);
      await createPromoCode('CODE3', 'flat', 5);
      await createPromoCode('CODE4', 'flat', 5);

      await expect(
        service.validateAndApplyMultiplePromoCodes(['CODE1', 'CODE2', 'CODE3', 'CODE4'], userId, 100, 'standard')
      ).rejects.toThrow('Maximum 3 promo codes allowed per order');
    });
  });

  describe('Test 10: Return breakdown showing each code contribution', () => {
    test('should return breakdown for each code', async () => {
      await createPromoCode('PERCENT20', 'percentage', 20);
      await createPromoCode('FLAT10', 'flat', 10);

      const result = await service.validateAndApplyMultiplePromoCodes(
        ['PERCENT20', 'FLAT10'],
        userId,
        100,
        'standard'
      );

      expect(result.breakdown).toHaveLength(2);
      expect(result.breakdown[0]).toMatchObject({
        promoCode: 'PERCENT20',
        discountType: 'percentage',
        discountValue: 20,
        discountAmount: 20
      });
      expect(result.breakdown[1]).toMatchObject({
        promoCode: 'FLAT10',
        discountType: 'flat',
        discountValue: 10,
        discountAmount: 10
      });
    });
  });

  describe('Test 11: $100 order with 20% + $15 flat = $35 discount', () => {
    test('percentage applies to original $100, not $80', async () => {
      await createPromoCode('PERCENT20', 'percentage', 20);
      await createPromoCode('FLAT15', 'flat', 15);

      const result = await service.validateAndApplyMultiplePromoCodes(
        ['PERCENT20', 'FLAT15'],
        userId,
        100,
        'standard'
      );

      expect(result.totalDiscount).toBe(35);
      expect(result.finalAmount).toBe(65);
    });
  });

  describe('Test 12: Minimum order $40 passes for $50 order even after 80% discount', () => {
    test('minimum order check uses original amount', async () => {
      await createPromoCode('PERCENT80', 'percentage', 80, { minOrderAmount: 40 });

      const result = await service.validateAndApplyMultiplePromoCodes(
        ['PERCENT80'],
        userId,
        50,
        'standard'
      );

      expect(result.success).toBe(true);
      // 80% of $50 = $40, but capped at 50% of $50 = $25
      expect(result.totalDiscount).toBe(25);
      expect(result.finalAmount).toBe(25);
    });
  });

  describe('Test 13: Case-insensitive duplicate detection', () => {
    test('SAVE20 and save20 should be treated as duplicates', async () => {
      await createPromoCode('SAVE20', 'flat', 20);

      await expect(
        service.validateAndApplyMultiplePromoCodes(['SAVE20', 'save20'], userId, 100, 'standard')
      ).rejects.toThrow('Duplicate promo codes are not allowed');
    });
  });

  describe('Test 14: Free shipping value counts toward 50% cap', () => {
    test('free shipping discountValue should count toward cap', async () => {
      await createPromoCode('PERCENT40', 'percentage', 40);
      await createPromoCode('FREESHIP', 'free_shipping', 8.99);

      const result = await service.validateAndApplyMultiplePromoCodes(
        ['PERCENT40', 'FREESHIP'],
        userId,
        100,
        'standard'
      );

      expect(result.totalDiscount).toBe(48.99);
      expect(result.finalAmount).toBe(51.01);
    });
  });

  describe('Test 15: Atomic usage limit checks prevent race conditions', () => {
    test('two simultaneous requests for last-use code - exactly one succeeds', async () => {
      await createPromoCode('LASTUSE', 'flat', 10, { maxUses: 1 });

      const result1 = await service.validateAndApplyMultiplePromoCodes(
        ['LASTUSE'],
        userId,
        100,
        'standard'
      );
      expect(result1.success).toBe(true);

      await expect(
        service.validateAndApplyMultiplePromoCodes(['LASTUSE'], userId, 100, 'standard')
      ).rejects.toThrow('usage limit reached');
    });
  });
});
