const path = require('path');
const basePath = process.env.BASE_PATH || '../repository_after';
const absoluteBasePath = path.resolve(__dirname, basePath);

// Ensure we use the exact same mongoose instance that models will use
const mongoose = require(path.join(absoluteBasePath, 'node_modules/mongoose'));
const assert = require('assert');

const CartService = require(path.join(absoluteBasePath, 'cartService'));
const Cart = require(path.join(absoluteBasePath, 'models/Cart.model'));
const MenuItem = require(path.join(absoluteBasePath, 'models/MenuItem.model'));
const Merchant = require(path.join(absoluteBasePath, 'models/Merchant.model'));

// The following models are expected in the 'after' version
let Coupon, UserCouponUsage;
try {
    Coupon = require(path.join(absoluteBasePath, 'models/Coupon.model'));
    UserCouponUsage = require(path.join(absoluteBasePath, 'models/UserCouponUsage.model'));
} catch (e) {
    // If these models don't exist, we're likely testing the 'before' version
    Coupon = null;
    UserCouponUsage = null;
}

describe('CartService Advanced Coupon System Tests', () => {
    let customerId = new mongoose.Types.ObjectId();
    let merchantId = new mongoose.Types.ObjectId();
    let categoryId = new mongoose.Types.ObjectId();

    before(async () => {
        const url = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cart_test';
        console.log('Connecting to MongoDB:', url.replace(/\/\/.*@/, '//****:****@')); // Hide credentials
        try {
            await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
            console.log('Connected successfully to MongoDB');
        } catch (err) {
            console.error('MongoDB connection error:', err);
            throw err;
        }
    });

    after(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await Cart.deleteMany({});
        await MenuItem.deleteMany({});
        await Merchant.deleteMany({});
        if (Coupon) await Coupon.deleteMany({});
        if (UserCouponUsage) await UserCouponUsage.deleteMany({});

        // Setup basic merchant and items
        await Merchant.create({
            _id: merchantId,
            businessName: 'Test Merchant',
            isOpen: true
        });

        await MenuItem.create({
            _id: new mongoose.Types.ObjectId(),
            name: 'Pizza',
            price: 50,
            merchantId,
            categoryId,
            isAvailable: true
        });
    });

    async function setupCart() {
        const item = await MenuItem.findOne({ name: 'Pizza' });
        return await CartService.addToCart(customerId, {
            menuItemId: item._id,
            quantity: 2
        });
    }

    describe('Schema Design', () => {
        it('should have Coupon model with required fields (After only)', async () => {
            if (!Coupon) return; // Skip if testing 'before'

            const coupon = new Coupon({
                code: 'DISCOUNT10',
                discountType: 'percentage',
                discountValue: 10,
                minOrderAmount: 100,
                perUserUsageLimit: 1,
                validFrom: new Date(),
                validUntil: new Date(Date.now() + 86400000)
            });
            await coupon.save();
            assert.strictEqual(coupon.code, 'DISCOUNT10');
        });

        it('should have UserCouponUsage with unique compound index (After only)', async () => {

            const usage1 = new UserCouponUsage({ userId: customerId, couponId: new mongoose.Types.ObjectId(), usageCount: 1 });
            await usage1.save();

            const usage2 = new UserCouponUsage({ userId: customerId, couponId: usage1.couponId, usageCount: 1 });
            try {
                await usage2.save();
                assert.fail('Should have thrown unique index error');
            } catch (err) {
                assert.ok(err.message.includes('duplicate key error'));
            }
        });

        it('should have Cart model updated with appliedCoupons and pricing (After only)', async () => {
            const cart = await setupCart();
            if (cart.appliedCoupons) {
                assert.ok(Array.isArray(cart.appliedCoupons));
                assert.ok('discount' in cart.pricing);
                assert.ok('total' in cart.pricing);
            } else {
                if (basePath.includes('after')) {
                    assert.fail('Cart model missing appliedCoupons in repository_after');
                }
            }
        });
    });

    describe('Service Implementation - Validation', () => {
        it('should normalize coupon code', async () => {
            await Coupon.create({
                code: 'SAVE-20',
                discountType: 'fixed',
                discountValue: 20,
                minOrderAmount: 0,
                perUserUsageLimit: 5,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });

            const cart = await setupCart(); // Subtotal is 100 (50 * 2)
            const result = await CartService.validateCoupon(customerId, ' save-20 ');
            assert.strictEqual(result.code, 'SAVE20'); // Expected normalization: uppercase, trim, remove hyphens
        });

        it('should fail if coupon is inactive', async () => {
            await Coupon.create({
                code: 'INACTIVE',
                discountType: 'fixed',
                discountValue: 10,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: false
            });
            try {
                await CartService.validateCoupon(customerId, 'INACTIVE');
                assert.fail('Should have failed');
            } catch (err) {
                assert.strictEqual(err.statusCode, 400);
            }
        });

        it('should fail if current date is outside range', async () => {
            await Coupon.create({
                code: 'EXPIRED',
                discountType: 'percentage',
                discountValue: 10,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 200000),
                validUntil: new Date(Date.now() - 100000),
                isActive: true
            });
            try {
                await CartService.validateCoupon(customerId, 'EXPIRED');
                assert.fail('Should have failed');
            } catch (err) {
                assert.strictEqual(err.statusCode, 400);
            }
        });

        it('should fail if minOrderAmount is not met', async () => {
            await Coupon.create({
                code: 'HIGHMIN',
                discountType: 'fixed',
                discountValue: 10,
                minOrderAmount: 500,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await setupCart(); // 100
            try {
                await CartService.validateCoupon(customerId, 'HIGHMIN');
                assert.fail('Should have failed');
            } catch (err) {
                assert.ok(err.message.includes('Minimum order amount'));
            }
        });
    });

    describe('Service Implementation - Application & Stacking', () => {
        it('should apply coupon and calculate discount', async () => {
            await Coupon.create({
                code: 'PROMO10',
                discountType: 'percentage',
                discountValue: 10,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });

            await setupCart(); // 100
            const cart = await CartService.applyCoupon(customerId, 'PROMO10');
            assert.strictEqual(cart.pricing.discount, 10);
            assert.strictEqual(cart.pricing.total, 90);
            assert.strictEqual(cart.appliedCoupons.length, 1);
        });

        it('should allow stacking 1 percentage + 1 fixed if both are stackable', async () => {
            const c1 = await Coupon.create({
                code: 'PERC10',
                discountType: 'percentage',
                discountValue: 10,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isStackable: true,
                isActive: true
            });
            const c2 = await Coupon.create({
                code: 'FIXED5',
                discountType: 'fixed',
                discountValue: 5,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isStackable: true,
                isActive: true
            });

            await setupCart(); // 100
            await CartService.applyCoupon(customerId, 'PERC10');
            const cart = await CartService.applyCoupon(customerId, 'FIXED5');


            assert.strictEqual(cart.pricing.discount, 15);
            assert.strictEqual(cart.pricing.total, 85);
            assert.strictEqual(cart.appliedCoupons.length, 2);
        });

        it('should block stacking two of the same type', async () => {
            await Coupon.create({
                code: 'PERC1',
                discountType: 'percentage',
                discountValue: 10,
                minOrderAmount: 0,
                isStackable: true,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await Coupon.create({
                code: 'PERC2',
                discountType: 'percentage',
                discountValue: 5,
                minOrderAmount: 0,
                isStackable: true,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });

            await setupCart();
            await CartService.applyCoupon(customerId, 'PERC1');
            try {
                await CartService.applyCoupon(customerId, 'PERC2');
                assert.fail('Should have blocked same type stacking');
            } catch (err) {
                assert.ok(err.message.includes('already have a percentage discount applied'));
            }
        });
    });

    describe('Cart Integration', () => {
        it('should auto-remove coupon if subtotal drops below minOrderAmount', async () => {
            await Coupon.create({
                code: 'MIN150',
                discountType: 'fixed',
                discountValue: 20,
                minOrderAmount: 150,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });

            const item = await MenuItem.findOne({ name: 'Pizza' });
            await CartService.addToCart(customerId, { menuItemId: item._id, quantity: 4 }); // 200

            await CartService.applyCoupon(customerId, 'MIN150');
            let cart = await CartService.getCart(customerId);
            assert.strictEqual(cart.appliedCoupons.length, 1);

            // Reduce quantity to drop subtotal to 100
            const cartItem = cart.items[0];
            await CartService.updateCartItem(customerId, cartItem._id, { quantity: 2 });

            cart = await CartService.getCart(customerId);
            assert.strictEqual(cart.appliedCoupons.length, 0, 'Coupon should have been auto-removed');
            assert.strictEqual(cart.pricing.discount, 0);
        });

        it('should manually remove a coupon', async () => {
            await Coupon.create({
                code: 'MANUAL',
                discountType: 'fixed',
                discountValue: 10,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await setupCart();
            let cart = await CartService.applyCoupon(customerId, 'MANUAL');
            assert.strictEqual(cart.appliedCoupons.length, 1);

            const couponId = cart.appliedCoupons[0].couponId;
            cart = await CartService.removeCoupon(customerId, couponId);
            assert.strictEqual(cart.appliedCoupons.length, 0);
            assert.strictEqual(cart.pricing.discount, 0);
        });

        it('should remove all coupons', async () => {
            await Coupon.create({
                code: 'C1', discountType: 'percentage', discountValue: 10, minOrderAmount: 0,
                perUserUsageLimit: 5, validFrom: new Date(Date.now() - 100000), validUntil: new Date(Date.now() + 100000),
                isActive: true, isStackable: true
            });
            await Coupon.create({
                code: 'C2', discountType: 'fixed', discountValue: 5, minOrderAmount: 0,
                perUserUsageLimit: 5, validFrom: new Date(Date.now() - 100000), validUntil: new Date(Date.now() + 100000),
                isActive: true, isStackable: true
            });
            await setupCart();
            await CartService.applyCoupon(customerId, 'C1');
            await CartService.applyCoupon(customerId, 'C2');

            let cart = await CartService.removeAllCoupons(customerId);
            assert.strictEqual(cart.appliedCoupons.length, 0);
            assert.strictEqual(cart.pricing.discount, 0);
        });

        it('should fail if merchant does not match', async () => {
            const otherMerchantId = new mongoose.Types.ObjectId();
            await Coupon.create({
                code: 'WRONGMERCH',
                discountType: 'fixed',
                discountValue: 10,
                minOrderAmount: 0,
                merchantId: otherMerchantId, // Restricted to another merchant
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await setupCart(); // Restricted to merchantId
            try {
                await CartService.validateCoupon(customerId, 'WRONGMERCH');
                assert.fail('Should have failed merchant check');
            } catch (err) {
                assert.ok(err.message.includes('not valid for this merchant'));
            }
        });

        it('should fail if category does not match', async () => {
            const otherCategoryId = new mongoose.Types.ObjectId();
            await Coupon.create({
                code: 'WRONGCAT',
                discountType: 'fixed',
                discountValue: 10,
                minOrderAmount: 0,
                categoryIds: [otherCategoryId],
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await setupCart(); // Pizza has categoryId
            try {
                await CartService.validateCoupon(customerId, 'WRONGCAT');
                assert.fail('Should have failed category check');
            } catch (err) {
                assert.ok(err.message.includes('This coupon is not valid for any items in your cart'));
            }
        });

        it('should fail if outside of valid hours', async () => {

            await Coupon.create({
                code: 'NIGHTONLY',
                discountType: 'fixed',
                discountValue: 10,
                minOrderAmount: 0,
                validHoursStart: '00:00',
                validHoursEnd: '01:00',
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });

            // We need to be careful with time zones, but usually this will fail
            const now = new Date();
            const currentHour = now.getHours();
            if (currentHour !== 0) {
                try {
                    await CartService.validateCoupon(customerId, 'NIGHTONLY');
                    assert.fail('Should have failed time check');
                } catch (err) {
                    assert.ok(err.message.includes('Coupon is only valid between'));
                }
            }
        });

        it('should enforce per-user usage limit', async () => {
            await Coupon.create({
                code: 'ONCE',
                discountType: 'fixed',
                discountValue: 10,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await setupCart();
            await CartService.applyCoupon(customerId, 'ONCE');

            // Try applying second time
            try {
                await CartService.applyCoupon(customerId, 'ONCE');
                assert.fail('Should have failed usage limit');
            } catch (err) {
                assert.ok(err.message.includes('usage limit'));
            }
        });

        it('should enforce maxDiscount for percentage coupons', async () => {
            await Coupon.create({
                code: 'CAP5',
                discountType: 'percentage',
                discountValue: 50, // 50%
                maxDiscount: 5,   // Cap at 5
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await setupCart(); // Subtotal 100. 50% is 50, but cap is 5.
            const cart = await CartService.applyCoupon(customerId, 'CAP5');
            assert.strictEqual(cart.pricing.discount, 5);
        });

        it('should ensure total never goes below zero (discount capped by subtotal)', async () => {
            await Coupon.create({
                code: 'HUGE',
                discountType: 'fixed',
                discountValue: 1000,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await setupCart(); // 100
            const cart = await CartService.applyCoupon(customerId, 'HUGE');
            assert.strictEqual(cart.pricing.discount, 100);
            assert.strictEqual(cart.pricing.total, 0);
        });

        it('should apply percentage discount only to eligible items in specific categories', async () => {
            const pizzaCategory = categoryId;
            const drinkCategory = new mongoose.Types.ObjectId();

            // Item 1: Pizza (eligible) - 50 x 2 = 100
            await setupCart();

            // Item 2: Soda (not eligible) - 10 x 2 = 20
            const soda = await MenuItem.create({
                _id: new mongoose.Types.ObjectId(),
                name: 'Soda',
                price: 10,
                merchantId,
                categoryId: drinkCategory,
                isAvailable: true
            });
            await CartService.addToCart(customerId, { menuItemId: soda._id, quantity: 2 });

            await Coupon.create({
                code: 'PIZZA20',
                discountType: 'percentage',
                discountValue: 20, // 20% of 100 is 20. (Total subtotal 120)
                categoryIds: [pizzaCategory],
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });

            const cart = await CartService.applyCoupon(customerId, 'PIZZA20');
            assert.strictEqual(cart.pricing.subtotal, 120);
            assert.strictEqual(cart.pricing.discount, 20); // 20% of 100, not 120.
        });

        it('should block applying a non-stackable coupon if others exist', async () => {
            await Coupon.create({
                code: 'STACK',
                discountType: 'fixed',
                discountValue: 5,
                isStackable: true,
                perUserUsageLimit: 5,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            await Coupon.create({
                code: 'SOLO',
                discountType: 'percentage',
                discountValue: 10,
                isStackable: false, // Cannot be combined
                perUserUsageLimit: 5,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });

            await setupCart();
            await CartService.applyCoupon(customerId, 'STACK');

            try {
                await CartService.applyCoupon(customerId, 'SOLO');
                assert.fail('Should have blocked non-stackable');
            } catch (err) {
                assert.ok(err.message.includes('cannot be combined'));
            }
        });

        it('should recalculate pricing after removing an item', async () => {
            await Coupon.create({
                code: 'FIXED10',
                discountType: 'fixed',
                discountValue: 10,
                minOrderAmount: 0,
                perUserUsageLimit: 1,
                validFrom: new Date(Date.now() - 100000),
                validUntil: new Date(Date.now() + 100000),
                isActive: true
            });
            const cart = await setupCart(); // 100
            await CartService.applyCoupon(customerId, 'FIXED10');

            const itemId = cart.items[0]._id;
            await CartService.removeFromCart(customerId, itemId);

            const updatedCart = await CartService.getCart(customerId);
            assert.strictEqual(updatedCart.pricing.subtotal, 0);
            assert.strictEqual(updatedCart.pricing.discount, 0);
            assert.strictEqual(updatedCart.pricing.total, 0);
        });
    });
});
