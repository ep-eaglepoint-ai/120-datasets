const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');

// Determine which repository to test based on environment variable
const REPO = process.env.TEST_REPO || 'repository_after';
console.log(`Testing repository: ${REPO}`);

// Models - dynamic import based on repo
const Cart = require(`../${REPO}/models/Cart.model`);
const MenuItem = require(`../${REPO}/models/MenuItem.model`);
const Merchant = require(`../${REPO}/models/Merchant.model`);

// Mock logger dynamically for the selected repo
const loggerPath = path.resolve(__dirname, '..', REPO, 'config', 'logger');
jest.doMock(loggerPath, () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

// Import the service after mocking
const CartService = require(`../${REPO}/cartService`);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Cart.deleteMany({});
  await MenuItem.deleteMany({});
  await Merchant.deleteMany({});
});

describe('CartService', () => {
  let merchant1, merchant2, menuItem1, menuItem2, menuItemWithDiscount;
  const customerId = new mongoose.Types.ObjectId();

  beforeEach(async () => {
    // Create merchants
    merchant1 = await Merchant.create({
      businessName: 'Pizza Palace',
      businessType: 'restaurant',
      isOpen: true,
      rating: 4.5
    });

    merchant2 = await Merchant.create({
      businessName: 'Burger Barn',
      businessType: 'restaurant',
      isOpen: true,
      rating: 4.2
    });

    // Create menu items
    menuItem1 = await MenuItem.create({
      merchantId: merchant1._id,
      name: 'Pepperoni Pizza',
      price: mongoose.Types.Decimal128.fromString('15.99'),
      isAvailable: true,
      productType: 'simple',
      extras: [{ name: 'Extra Cheese', price: mongoose.Types.Decimal128.fromString('2.00') }]
    });

    menuItem2 = await MenuItem.create({
      merchantId: merchant2._id,
      name: 'Cheeseburger',
      price: mongoose.Types.Decimal128.fromString('10.99'),
      isAvailable: true,
      productType: 'simple',
      extras: []
    });

    menuItemWithDiscount = await MenuItem.create({
      merchantId: merchant1._id,
      name: 'Margherita Pizza',
      price: mongoose.Types.Decimal128.fromString('12.99'),
      discountedPrice: mongoose.Types.Decimal128.fromString('10.39'),
      isAvailable: true,
      productType: 'simple',
      discount: {
        isActive: true,
        validFrom: new Date(Date.now() - 86400000),
        validUntil: new Date(Date.now() + 86400000)
      },
      extras: []
    });
  });

  describe('Bug 1: Mixed merchant items', () => {
    it('should throw error when adding item from different merchant', async () => {
      await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 1
      });

      await expect(
        CartService.addToCart(customerId, {
          menuItemId: menuItem2._id.toString(),
          quantity: 1
        })
      ).rejects.toThrow(/different merchants|Cannot add items from different merchants/i);
    });

    it('should allow adding items from same merchant', async () => {
      await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 1
      });

      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItemWithDiscount._id.toString(),
        quantity: 1
      });

      expect(cart.items).toHaveLength(2);
    });
  });

  describe('Bug 2: Invalid quantities', () => {
    it('should reject quantity of 0', async () => {
      await expect(
        CartService.addToCart(customerId, {
          menuItemId: menuItem1._id.toString(),
          quantity: 0
        })
      ).rejects.toThrow(/quantity|positive/i);
    });

    it('should reject negative quantity', async () => {
      await expect(
        CartService.addToCart(customerId, {
          menuItemId: menuItem1._id.toString(),
          quantity: -5
        })
      ).rejects.toThrow(/quantity|positive/i);
    });

    it('should reject non-integer quantity', async () => {
      await expect(
        CartService.addToCart(customerId, {
          menuItemId: menuItem1._id.toString(),
          quantity: 1.5
        })
      ).rejects.toThrow(/quantity|positive|integer/i);
    });

    it('should accept valid positive integer quantity', async () => {
      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 3
      });

      expect(cart.items[0].quantity).toBe(3);
    });
  });

  describe('Bug 3: Duplicate items on rapid clicks', () => {
    it('should prevent duplicate items with atomic operation', async () => {
      // First add should succeed
      await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 1
      });

      // Second add of same item should fail
      await expect(
        CartService.addToCart(customerId, {
          menuItemId: menuItem1._id.toString(),
          quantity: 1
        })
      ).rejects.toThrow(/already in your cart/i);

      const cart = await Cart.findOne({ customerId });
      expect(cart.items).toHaveLength(1);
    });
  });

  describe('Bug 4: Discounts not applied', () => {
    it('should apply discounted price when discount is active', async () => {
      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItemWithDiscount._id.toString(),
        quantity: 1
      });

      const item = cart.items[0];
      const price = parseFloat(item.price.toString());
      
      expect(price).toBeCloseTo(10.39, 2);
    });

    it('should use full price when discount is not active', async () => {
      const noDiscountItem = await MenuItem.create({
        merchantId: merchant1._id,
        name: 'Hawaiian Pizza',
        price: mongoose.Types.Decimal128.fromString('14.99'),
        isAvailable: true,
        productType: 'simple',
        discount: { isActive: false },
        extras: []
      });

      const cart = await CartService.addToCart(customerId, {
        menuItemId: noDiscountItem._id.toString(),
        quantity: 1
      });

      const item = cart.items[0];
      const price = parseFloat(item.price.toString());
      expect(price).toBeCloseTo(14.99, 2);
    });
  });

  describe('Bug 5: Remove gives no feedback', () => {
    it('should return updated cart after removing item', async () => {
      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 2
      });

      const itemId = cart.items[0]._id.toString();
      const updatedCart = await CartService.removeFromCart(customerId, itemId);

      expect(updatedCart).not.toBeNull();
      expect(updatedCart.items).toHaveLength(0);
    });
  });

  describe('Bug 6: Cart totals wrong after update', () => {
    it('should recalculate pricing.subtotal after quantity update', async () => {
      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 2
      });

      const itemId = cart.items[0]._id.toString();
      const updatedCart = await CartService.updateCartItem(customerId, itemId, {
        quantity: 5
      });

      const itemSubtotal = parseFloat(updatedCart.items[0].subtotal.toString());
      const cartSubtotal = parseFloat(updatedCart.pricing.subtotal.toString());
      
      expect(cartSubtotal).toBeCloseTo(itemSubtotal, 2);
      expect(updatedCart.pricing.totalItems).toBe(5);
    });

    it('should recalculate pricing.totalItems after update', async () => {
      await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 2
      });

      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItemWithDiscount._id.toString(),
        quantity: 3
      });

      const itemId = cart.items[0]._id.toString();
      const updatedCart = await CartService.updateCartItem(customerId, itemId, {
        quantity: 5
      });

      expect(updatedCart.pricing.totalItems).toBe(8);
    });

    it('should recalculate pricing after removeFromCart', async () => {
      await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 2
      });

      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItemWithDiscount._id.toString(),
        quantity: 3
      });

      const itemId = cart.items[0]._id.toString();
      const updatedCart = await CartService.removeFromCart(customerId, itemId);

      expect(updatedCart.pricing.totalItems).toBe(3);
    });
  });

  describe('Edge cases', () => {
    it('should handle cart with items but no merchantId set', async () => {
      await Cart.create({
        customerId,
        items: [],
        pricing: { subtotal: 0, totalItems: 0 }
      });

      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 1
      });

      expect(cart.merchantId.toString()).toBe(merchant1._id.toString());
    });

    it('should correctly convert Decimal128 prices', async () => {
      const cart = await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 2
      });

      const subtotal = parseFloat(cart.items[0].subtotal.toString());
      expect(typeof subtotal).toBe('number');
      expect(subtotal).toBeCloseTo(31.98, 2);
    });
  });

  describe('getCart', () => {
    it('should return empty cart structure when no cart exists', async () => {
      const result = await CartService.getCart(customerId);
      
      expect(result._id).toBeNull();
      expect(result.items).toEqual([]);
      expect(result.pricing.subtotal).toBe(0);
      expect(result.pricing.totalItems).toBe(0);
    });
  });

  describe('clearCart', () => {
    it('should return cart with zeroed pricing', async () => {
      await CartService.addToCart(customerId, {
        menuItemId: menuItem1._id.toString(),
        quantity: 2
      });

      const clearedCart = await CartService.clearCart(customerId);

      expect(clearedCart).not.toBeNull();
      expect(clearedCart.items).toHaveLength(0);
      expect(parseFloat(clearedCart.pricing.subtotal.toString())).toBe(0);
      expect(clearedCart.pricing.totalItems).toBe(0);
    });
  });
});

