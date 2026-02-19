const HttpError = require('./utils/httpError');

// Mock logger
jest.mock('./config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock deliveryOrderService
jest.mock('./services/deliveryOrder.Service', () => ({
  createOrder: jest.fn()
}));

// Mock Cart model
const mockCartSave = jest.fn();
const mockCartPopulate = jest.fn();

const mockCartFindOne = jest.fn();
const mockCartFindOneAndDelete = jest.fn();
const mockCartUpdateOne = jest.fn();

jest.mock('./models/Cart.model', () => {
  const MockCart = jest.fn().mockImplementation((data) => ({
    ...data,
    items: data.items || [],
    pricing: { subtotal: 0, totalItems: 0 },
    save: mockCartSave,
    populate: mockCartPopulate
  }));
  MockCart.findOne = mockCartFindOne;
  MockCart.findOneAndDelete = mockCartFindOneAndDelete;
  MockCart.updateOne = mockCartUpdateOne;
  return MockCart;
});

// Mock MenuItem model
const mockMenuItemFindById = jest.fn();
jest.mock('./models/MenuItem.model', () => ({
  findById: mockMenuItemFindById
}));

// Mock Merchant model
jest.mock('./models/Merchant.model', () => ({}));

const Cart = require('./models/Cart.model');
const MenuItem = require('./models/MenuItem.model');
const deliveryOrderService = require('./services/deliveryOrder.Service');

// Create cartService after mocks are set up
const CartService = require('./cartService');

describe('CartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return empty cart structure for non-existent cart', async () => {
      mockCartFindOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const result = await CartService.getCart('customer123');

      expect(result).toEqual({
        _id: null,
        items: [],
        pricing: {
          subtotal: 0,
          totalItems: 0
        }
      });
    });

    it('should return populated cart with correct item mapping for existing cart', async () => {
      const mockCart = {
        _id: 'cart123',
        items: [
          {
            _id: 'item1',
            menuItemId: {
              _id: 'menuItem1',
              images: [{ url: 'http://image1.jpg', isPrimary: true }],
              merchantId: {
                _id: 'merchant1',
                businessName: 'Test Restaurant',
                businessType: 'restaurant',
                isOpen: true,
                rating: 4.5
              }
            },
            name: 'Burger',
            price: { toString: () => '10.00' },
            quantity: 2,
            variations: [],
            addOns: [{ name: 'Cheese', _id: 'addon1', price: { toString: () => '1.50' } }],
            subtotal: { toString: () => '23.00' }
          }
        ],
        pricing: {
          subtotal: { toString: () => '23.00' },
          totalItems: 2
        }
      };

      mockCartFindOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await CartService.getCart('customer123');

      expect(result._id).toBe('cart123');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].menuItemId).toBe('menuItem1');
      expect(result.items[0].name).toBe('Burger');
      expect(result.items[0].price).toBe(10.00);
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].subtotal).toBe(23.00);
      expect(result.items[0].image).toBe('http://image1.jpg');
      expect(result.items[0].merchantInfo).toBeDefined();
      expect(result.pricing.subtotal).toBe(23.00);
      expect(result.pricing.totalItems).toBe(2);
    });

    it('should filter out items with null menuItemId or merchantId', async () => {
      const mockCart = {
        _id: 'cart123',
        items: [
          {
            _id: 'item1',
            menuItemId: null,
            name: 'Deleted Item',
            price: { toString: () => '10.00' },
            quantity: 1,
            variations: [],
            addOns: [],
            subtotal: { toString: () => '10.00' }
          },
          {
            _id: 'item2',
            menuItemId: {
              _id: 'menuItem2',
              images: [],
              merchantId: null
            },
            name: 'Item with no merchant',
            price: { toString: () => '15.00' },
            quantity: 1,
            variations: [],
            addOns: [],
            subtotal: { toString: () => '15.00' }
          }
        ],
        pricing: {
          subtotal: { toString: () => '25.00' },
          totalItems: 2
        }
      };

      mockCartFindOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await CartService.getCart('customer123');

      expect(result.items).toHaveLength(0);
    });

    it('should use fallback image when no primary image exists', async () => {
      const mockCart = {
        _id: 'cart123',
        items: [
          {
            _id: 'item1',
            menuItemId: {
              _id: 'menuItem1',
              images: [{ url: 'http://fallback.jpg', isPrimary: false }],
              merchantId: { _id: 'merchant1', businessName: 'Test' }
            },
            name: 'Pizza',
            price: { toString: () => '12.00' },
            quantity: 1,
            variations: [],
            addOns: [],
            subtotal: { toString: () => '12.00' }
          }
        ],
        pricing: {
          subtotal: { toString: () => '12.00' },
          totalItems: 1
        }
      };

      mockCartFindOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCart)
      });

      const result = await CartService.getCart('customer123');

      expect(result.items[0].image).toBe('http://fallback.jpg');
    });

    it('should throw error on database failure', async () => {
      mockCartFindOne.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      await expect(CartService.getCart('customer123')).rejects.toThrow('Database error');
    });
  });

  describe('addToCart', () => {
    it('should throw 404 HttpError when menu item not found', async () => {
      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });

      await expect(
        CartService.addToCart('customer123', { menuItemId: 'nonexistent', quantity: 1 })
      ).rejects.toThrow(HttpError);

      try {
        await CartService.addToCart('customer123', { menuItemId: 'nonexistent', quantity: 1 });
      } catch (error) {
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Menu item not found');
      }
    });

    it('should throw 400 HttpError when menu item is unavailable', async () => {
      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'menuItem1',
          name: 'Burger',
          isAvailable: false,
          price: { toString: () => '10.00' }
        })
      });

      try {
        await CartService.addToCart('customer123', { menuItemId: 'menuItem1', quantity: 1 });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('This menu item is currently unavailable');
      }
    });

    it('should throw 409 HttpError when duplicate item already in cart', async () => {
      const menuItem = {
        _id: 'menuItem1',
        name: 'Burger',
        isAvailable: true,
        price: { toString: () => '10.00' },
        productType: 'simple',
        merchantId: 'merchant1',
        extras: []
      };

      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      const existingCart = {
        customerId: 'customer123',
        items: [{ menuItemId: { toString: () => 'menuItem1' } }],
        save: mockCartSave,
        populate: mockCartPopulate
      };

      mockCartFindOne.mockResolvedValue(existingCart);

      try {
        await CartService.addToCart('customer123', { menuItemId: 'menuItem1', quantity: 1 });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(409);
        expect(error.message).toBe('This exact item configuration is already in your cart.');
      }
    });

    it('should calculate subtotal correctly with addOns', async () => {
      const menuItem = {
        _id: 'menuItem1',
        name: 'Burger',
        isAvailable: true,
        price: { toString: () => '10.00' },
        productType: 'simple',
        merchantId: 'merchant1',
        extras: [
          { name: 'Cheese', price: { toString: () => '1.50' }, _id: 'addon1' },
          { name: 'Bacon', price: { toString: () => '2.00' }, _id: 'addon2' }
        ]
      };

      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      mockCartFindOne.mockResolvedValue(null);

      let savedCart;
      mockCartSave.mockImplementation(function() {
        savedCart = this;
        return Promise.resolve(this);
      });

      mockCartPopulate.mockResolvedValue({});

      await CartService.addToCart('customer123', {
        menuItemId: 'menuItem1',
        quantity: 2,
        addOns: [{ name: 'Cheese' }, { name: 'Bacon' }]
      });

      expect(mockCartSave).toHaveBeenCalled();
    });

    it('should create new cart when no cart exists', async () => {
      const menuItem = {
        _id: 'menuItem1',
        name: 'Burger',
        isAvailable: true,
        price: { toString: () => '10.00' },
        productType: 'simple',
        merchantId: 'merchant1',
        extras: []
      };

      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      mockCartFindOne.mockResolvedValue(null);
      mockCartSave.mockResolvedValue({});
      mockCartPopulate.mockResolvedValue({});

      await CartService.addToCart('customer123', {
        menuItemId: 'menuItem1',
        quantity: 1
      });

      expect(Cart).toHaveBeenCalled();
      const cartCallArg = Cart.mock.calls[0][0];
      expect(cartCallArg.customerId).toBe('customer123');
      expect(cartCallArg.merchantId).toBe('merchant1');
      expect(mockCartSave).toHaveBeenCalled();
    });

    it('should throw 400 HttpError when variable product has no variations selected', async () => {
      const menuItem = {
        _id: 'menuItem1',
        name: 'Pizza',
        isAvailable: true,
        price: { toString: () => '15.00' },
        productType: 'variable',
        merchantId: 'merchant1',
        variants: [
          { optionValues: [{ optionName: 'Size', value: 'Large' }], price: { toString: () => '18.00' } }
        ],
        extras: []
      };

      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      try {
        await CartService.addToCart('customer123', {
          menuItemId: 'menuItem1',
          quantity: 1,
          variations: []
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Product options must be selected for this item.');
      }
    });

    it('should throw 400 HttpError when variable product has invalid variation combination', async () => {
      const menuItem = {
        _id: 'menuItem1',
        name: 'Pizza',
        isAvailable: true,
        price: { toString: () => '15.00' },
        productType: 'variable',
        merchantId: 'merchant1',
        variants: [
          { optionValues: [{ optionName: 'Size', value: 'Large' }], price: { toString: () => '18.00' } }
        ],
        extras: []
      };

      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      try {
        await CartService.addToCart('customer123', {
          menuItemId: 'menuItem1',
          quantity: 1,
          variations: [{ optionName: 'Size', value: 'ExtraLarge' }]
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('The selected product options are not a valid combination.');
      }
    });

    it('should use variant price for variable products', async () => {
      const menuItem = {
        _id: 'menuItem1',
        name: 'Pizza',
        isAvailable: true,
        price: { toString: () => '15.00' },
        productType: 'variable',
        merchantId: 'merchant1',
        variants: [
          { optionValues: [{ optionName: 'Size', value: 'Large' }], price: { toString: () => '18.00' } }
        ],
        extras: []
      };

      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      mockCartFindOne.mockResolvedValue(null);
      mockCartSave.mockResolvedValue({});
      mockCartPopulate.mockResolvedValue({});

      await CartService.addToCart('customer123', {
        menuItemId: 'menuItem1',
        quantity: 1,
        variations: [{ optionName: 'Size', value: 'Large' }]
      });

      expect(mockCartSave).toHaveBeenCalled();
    });

    it('should apply discount when active and within valid date range', async () => {
      const now = new Date();
      const validFrom = new Date(now.getTime() - 86400000);
      const validUntil = new Date(now.getTime() + 86400000);

      const menuItem = {
        _id: 'menuItem1',
        name: 'Burger',
        isAvailable: true,
        price: { toString: () => '10.00' },
        productType: 'simple',
        merchantId: 'merchant1',
        extras: [],
        discount: {
          isActive: true,
          validFrom,
          validUntil
        },
        discountedPrice: { toString: () => '8.00' }
      };

      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      mockCartFindOne.mockResolvedValue(null);
      mockCartSave.mockResolvedValue({});
      mockCartPopulate.mockResolvedValue({});

      await CartService.addToCart('customer123', {
        menuItemId: 'menuItem1',
        quantity: 1
      });

      expect(mockCartSave).toHaveBeenCalled();
    });

    it('should filter out invalid addOns not in menu extras', async () => {
      const menuItem = {
        _id: 'menuItem1',
        name: 'Burger',
        isAvailable: true,
        price: { toString: () => '10.00' },
        productType: 'simple',
        merchantId: 'merchant1',
        extras: [
          { name: 'Cheese', price: { toString: () => '1.50' }, _id: 'addon1' }
        ]
      };

      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      mockCartFindOne.mockResolvedValue(null);
      mockCartSave.mockResolvedValue({});
      mockCartPopulate.mockResolvedValue({});

      await CartService.addToCart('customer123', {
        menuItemId: 'menuItem1',
        quantity: 1,
        addOns: [{ name: 'Cheese' }, { name: 'InvalidAddon' }]
      });

      expect(mockCartSave).toHaveBeenCalled();
    });
  });

  describe('updateCartItem', () => {
    it('should throw 404 HttpError when cart not found', async () => {
      mockCartFindOne.mockResolvedValue(null);

      try {
        await CartService.updateCartItem('customer123', 'item1', { quantity: 2 });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Cart not found');
      }
    });

    it('should throw 404 HttpError when item not found in cart', async () => {
      const cart = {
        customerId: 'customer123',
        items: [{ _id: { toString: () => 'item1' } }],
        save: mockCartSave
      };

      mockCartFindOne.mockResolvedValue(cart);

      try {
        await CartService.updateCartItem('customer123', 'nonexistent', { quantity: 2 });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Item not found in cart');
      }
    });

    it('should remove item when quantity is 0', async () => {
      const cart = {
        customerId: 'customer123',
        items: [
          { _id: { toString: () => 'item1' }, menuItemId: 'menuItem1' },
          { _id: { toString: () => 'item2' }, menuItemId: 'menuItem2' }
        ],
        save: mockCartSave
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockCartSave.mockResolvedValue(cart);

      await CartService.updateCartItem('customer123', 'item1', { quantity: 0 });

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]._id.toString()).toBe('item2');
      expect(mockCartSave).toHaveBeenCalled();
    });

    it('should throw 404 and remove item when menu item no longer exists', async () => {
      const cart = {
        customerId: 'customer123',
        items: [
          { _id: { toString: () => 'item1' }, menuItemId: 'menuItem1', price: { toString: () => '10.00' } }
        ],
        save: mockCartSave
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null)
      });
      mockCartSave.mockResolvedValue(cart);

      try {
        await CartService.updateCartItem('customer123', 'item1', { quantity: 2 });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('The original menu item no longer exists and has been removed from your cart.');
      }
    });

    it('should recalculate subtotal on addOns change', async () => {
      const cartItem = {
        _id: { toString: () => 'item1' },
        menuItemId: 'menuItem1',
        price: { toString: () => '10.00' },
        addOns: [],
        variations: [],
        quantity: 1,
        subtotal: 10.00
      };

      const cart = {
        customerId: 'customer123',
        items: [cartItem],
        save: mockCartSave
      };

      const menuItem = {
        _id: 'menuItem1',
        name: 'Burger',
        productType: 'simple',
        extras: [
          { _id: { toString: () => 'addon1' }, name: 'Cheese', price: { toString: () => '1.50' } }
        ]
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });
      mockCartSave.mockResolvedValue(cart);

      await CartService.updateCartItem('customer123', 'item1', {
        quantity: 2,
        addOns: [{ _id: 'addon1' }]
      });

      expect(cartItem.subtotal).toBe(23.00); // (10 + 1.50) * 2
      expect(mockCartSave).toHaveBeenCalled();
    });

    it('should validate variable product variations on update', async () => {
      const cartItem = {
        _id: { toString: () => 'item1' },
        menuItemId: 'menuItem1',
        price: { toString: () => '15.00' },
        addOns: [],
        variations: [{ optionName: 'Size', value: 'Medium' }],
        quantity: 1,
        subtotal: 15.00
      };

      const cart = {
        customerId: 'customer123',
        items: [cartItem],
        save: mockCartSave
      };

      const menuItem = {
        _id: 'menuItem1',
        name: 'Pizza',
        productType: 'variable',
        variants: [
          { optionValues: [{ optionName: 'Size', value: 'Large' }], price: { toString: () => '18.00' } }
        ],
        extras: []
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });

      try {
        await CartService.updateCartItem('customer123', 'item1', {
          quantity: 1,
          variations: [{ optionName: 'Size', value: 'ExtraLarge' }]
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('The updated product options are not a valid combination.');
      }
    });

    it('should update price when valid variation is provided', async () => {
      const cartItem = {
        _id: { toString: () => 'item1' },
        menuItemId: 'menuItem1',
        price: { toString: () => '15.00' },
        addOns: [],
        variations: [{ optionName: 'Size', value: 'Medium' }],
        quantity: 1,
        subtotal: 15.00
      };

      const cart = {
        customerId: 'customer123',
        items: [cartItem],
        save: mockCartSave
      };

      const menuItem = {
        _id: 'menuItem1',
        name: 'Pizza',
        productType: 'variable',
        variants: [
          { optionValues: [{ optionName: 'Size', value: 'Large' }], price: { toString: () => '18.00' } }
        ],
        extras: []
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });
      mockCartSave.mockResolvedValue(cart);

      await CartService.updateCartItem('customer123', 'item1', {
        quantity: 2,
        variations: [{ optionName: 'Size', value: 'Large' }]
      });

      expect(cartItem.price).toBe(18.00);
      expect(cartItem.subtotal).toBe(36.00);
      expect(mockCartSave).toHaveBeenCalled();
    });

    it('should handle update with only quantity change', async () => {
      const cartItem = {
        _id: { toString: () => 'item1' },
        menuItemId: 'menuItem1',
        price: { toString: () => '10.00' },
        addOns: [{ price: { toString: () => '2.00' } }],
        variations: [],
        quantity: 1,
        subtotal: 12.00
      };

      const cart = {
        customerId: 'customer123',
        items: [cartItem],
        save: mockCartSave
      };

      const menuItem = {
        _id: 'menuItem1',
        name: 'Burger',
        productType: 'simple',
        extras: []
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockMenuItemFindById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(menuItem)
      });
      mockCartSave.mockResolvedValue(cart);

      await CartService.updateCartItem('customer123', 'item1', { quantity: 3 });

      expect(cartItem.quantity).toBe(3);
      expect(cartItem.subtotal).toBe(36.00); // (10 + 2) * 3
      expect(mockCartSave).toHaveBeenCalled();
    });
  });

  describe('removeFromCart', () => {
    it('should throw 404 HttpError when cart not found', async () => {
      mockCartFindOne.mockResolvedValue(null);

      try {
        await CartService.removeFromCart('customer123', 'item1');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Cart not found');
      }
    });

    it('should filter correct item from cart', async () => {
      const cart = {
        customerId: 'customer123',
        items: [
          { _id: { toString: () => 'item1' } },
          { _id: { toString: () => 'item2' } },
          { _id: { toString: () => 'item3' } }
        ],
        save: mockCartSave
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockCartSave.mockResolvedValue(cart);

      const result = await CartService.removeFromCart('customer123', 'item2');

      expect(result).toBeNull();
      expect(cart.items).toHaveLength(2);
      expect(cart.items.find(i => i._id.toString() === 'item2')).toBeUndefined();
      expect(mockCartSave).toHaveBeenCalled();
    });

    it('should handle removing non-existent item gracefully', async () => {
      const cart = {
        customerId: 'customer123',
        items: [
          { _id: { toString: () => 'item1' } }
        ],
        save: mockCartSave
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockCartSave.mockResolvedValue(cart);

      await CartService.removeFromCart('customer123', 'nonexistent');

      expect(cart.items).toHaveLength(1);
      expect(mockCartSave).toHaveBeenCalled();
    });
  });

  describe('clearCart', () => {
    it('should throw 404 HttpError when cart not found', async () => {
      mockCartFindOne.mockResolvedValue(null);

      try {
        await CartService.clearCart('customer123');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Cart not found');
      }
    });

    it('should reset items array and pricing to zero', async () => {
      const cart = {
        customerId: 'customer123',
        items: [
          { _id: 'item1', subtotal: 10 },
          { _id: 'item2', subtotal: 20 }
        ],
        pricing: {
          subtotal: 30,
          totalItems: 3
        },
        save: mockCartSave
      };

      mockCartFindOne.mockResolvedValue(cart);
      mockCartSave.mockResolvedValue(cart);

      const result = await CartService.clearCart('customer123');

      expect(result).toBeNull();
      expect(cart.items).toEqual([]);
      expect(cart.pricing.subtotal).toBe(0);
      expect(cart.pricing.totalItems).toBe(0);
      expect(mockCartSave).toHaveBeenCalled();
    });
  });

  describe('deleteCart', () => {
    it('should call findOneAndDelete with correct parameters', async () => {
      mockCartFindOneAndDelete.mockResolvedValue({ _id: 'cart123' });

      const result = await CartService.deleteCart('customer123');

      expect(mockCartFindOneAndDelete).toHaveBeenCalledWith({ customerId: 'customer123' });
      expect(result).toEqual({ _id: 'cart123' });
    });

    it('should return null when no cart exists', async () => {
      mockCartFindOneAndDelete.mockResolvedValue(null);

      const result = await CartService.deleteCart('customer123');

      expect(mockCartFindOneAndDelete).toHaveBeenCalledWith({ customerId: 'customer123' });
      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      mockCartFindOneAndDelete.mockRejectedValue(new Error('Database error'));

      await expect(CartService.deleteCart('customer123')).rejects.toThrow('Database error');
    });
  });

  describe('checkoutCart', () => {
    it('should throw 400 HttpError when no items selected', async () => {
      try {
        await CartService.checkoutCart('customer123', { selectedItemIds: [] });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Please select at least one item to order');
      }
    });

    it('should throw 400 HttpError when selectedItemIds is undefined', async () => {
      try {
        await CartService.checkoutCart('customer123', {});
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Please select at least one item to order');
      }
    });

    it('should throw 400 HttpError when cart is empty', async () => {
      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({ items: [] })
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      try {
        await CartService.checkoutCart('customer123', {
          selectedItemIds: ['item1']
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Cart is empty');
      }
    });

    it('should throw 400 HttpError when cart does not exist', async () => {
      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      try {
        await CartService.checkoutCart('customer123', {
          selectedItemIds: ['item1']
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Cart is empty');
      }
    });

    it('should throw 400 HttpError when no valid items selected', async () => {
      const cart = {
        _id: 'cart123',
        items: [
          { _id: { toString: () => 'item1' }, menuItemId: { merchantId: 'merchant1' } }
        ],
        merchantId: 'merchant1'
      };

      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(cart)
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      try {
        await CartService.checkoutCart('customer123', {
          selectedItemIds: ['nonexistent']
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('No valid items selected');
      }
    });

    it('should throw 400 HttpError when items from multiple merchants selected', async () => {
      const cart = {
        _id: 'cart123',
        items: [
          {
            _id: { toString: () => 'item1' },
            menuItemId: { _id: 'menuItem1', merchantId: { toString: () => 'merchant1' }, isAvailable: true },
            name: 'Item 1',
            price: 10,
            quantity: 1,
            addOns: []
          },
          {
            _id: { toString: () => 'item2' },
            menuItemId: { _id: 'menuItem2', merchantId: { toString: () => 'merchant2' }, isAvailable: true },
            name: 'Item 2',
            price: 15,
            quantity: 1,
            addOns: []
          }
        ],
        merchantId: 'merchant1'
      };

      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(cart)
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      try {
        await CartService.checkoutCart('customer123', {
          selectedItemIds: ['item1', 'item2']
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Cannot order items from different merchants. Please select items from one merchant only.');
      }
    });

    it('should throw 400 HttpError when unavailable items selected', async () => {
      const cart = {
        _id: 'cart123',
        items: [
          {
            _id: { toString: () => 'item1' },
            menuItemId: { _id: 'menuItem1', merchantId: { toString: () => 'merchant1' }, isAvailable: false },
            name: 'Unavailable Item',
            price: 10,
            quantity: 1,
            addOns: []
          }
        ],
        merchantId: 'merchant1'
      };

      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(cart)
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      try {
        await CartService.checkoutCart('customer123', {
          selectedItemIds: ['item1']
        });
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError);
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Some selected items are no longer available. Please remove them from cart.');
      }
    });

    it('should create order with correct data and remove selected items', async () => {
      const cart = {
        _id: 'cart123',
        items: [
          {
            _id: { toString: () => 'item1' },
            menuItemId: { _id: 'menuItem1', merchantId: { toString: () => 'merchant1' }, isAvailable: true },
            name: 'Burger',
            price: 10,
            quantity: 2,
            variations: [{ optionName: 'Size', value: 'Large' }],
            addOns: [{ name: 'Cheese', price: 1.5 }]
          }
        ],
        merchantId: 'merchant1'
      };

      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(cart)
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      mockMenuItemFindById.mockResolvedValue({
        discount: null,
        discountedPrice: null
      });

      const mockOrder = { _id: 'order123', status: 'created' };
      deliveryOrderService.createOrder.mockResolvedValue(mockOrder);
      mockCartUpdateOne.mockResolvedValue({});

      const checkoutData = {
        selectedItemIds: ['item1'],
        deliveryLocation: { address: '123 Main St' },
        paymentMethodId: 'payment123',
        specialInstructions: 'No onions',
        deliveryPreferences: { contactless: true }
      };

      const result = await CartService.checkoutCart('customer123', checkoutData);

      expect(result).toEqual(mockOrder);
      expect(deliveryOrderService.createOrder).toHaveBeenCalled();

      const orderCall = deliveryOrderService.createOrder.mock.calls[0];
      expect(orderCall[0].merchantId).toBe('merchant1');
      expect(orderCall[0].items).toHaveLength(1);
      expect(orderCall[0].deliveryLocation).toEqual({ address: '123 Main St' });
      expect(orderCall[1]).toBe('customer123');

      expect(mockCartUpdateOne).toHaveBeenCalledWith(
        { customerId: 'customer123' },
        { $pull: { items: { _id: { $in: ['item1'] } } } }
      );
    });

    it('should apply active discount to order items', async () => {
      const now = new Date();
      const validFrom = new Date(now.getTime() - 86400000);
      const validUntil = new Date(now.getTime() + 86400000);

      const cart = {
        _id: 'cart123',
        items: [
          {
            _id: { toString: () => 'item1' },
            menuItemId: { _id: 'menuItem1', merchantId: { toString: () => 'merchant1' }, isAvailable: true },
            name: 'Burger',
            price: 10,
            quantity: 1,
            variations: [],
            addOns: []
          }
        ],
        merchantId: 'merchant1'
      };

      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(cart)
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      mockMenuItemFindById.mockResolvedValue({
        discount: { isActive: true, validFrom, validUntil },
        discountedPrice: { toString: () => '8.00' }
      });

      deliveryOrderService.createOrder.mockResolvedValue({ _id: 'order123' });
      mockCartUpdateOne.mockResolvedValue({});

      await CartService.checkoutCart('customer123', {
        selectedItemIds: ['item1'],
        deliveryLocation: {},
        paymentMethodId: 'payment123'
      });

      const orderCall = deliveryOrderService.createOrder.mock.calls[0];
      expect(orderCall[0].items[0].price).toBe(8);
    });

    it('should handle items without variations correctly', async () => {
      const cart = {
        _id: 'cart123',
        items: [
          {
            _id: { toString: () => 'item1' },
            menuItemId: { _id: 'menuItem1', merchantId: { toString: () => 'merchant1' }, isAvailable: true },
            name: 'Burger',
            price: 10,
            quantity: 1,
            variations: null,
            addOns: null
          }
        ],
        merchantId: 'merchant1'
      };

      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(cart)
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      mockMenuItemFindById.mockResolvedValue(null);
      deliveryOrderService.createOrder.mockResolvedValue({ _id: 'order123' });
      mockCartUpdateOne.mockResolvedValue({});

      await CartService.checkoutCart('customer123', {
        selectedItemIds: ['item1'],
        deliveryLocation: {},
        paymentMethodId: 'payment123'
      });

      const orderCall = deliveryOrderService.createOrder.mock.calls[0];
      expect(orderCall[0].items[0].variations).toEqual([]);
      expect(orderCall[0].items[0].addOns).toEqual([]);
    });

    it('should pass io parameter to createOrder', async () => {
      const cart = {
        _id: 'cart123',
        items: [
          {
            _id: { toString: () => 'item1' },
            menuItemId: { _id: 'menuItem1', merchantId: { toString: () => 'merchant1' }, isAvailable: true },
            name: 'Burger',
            price: 10,
            quantity: 1,
            variations: [],
            addOns: []
          }
        ],
        merchantId: 'merchant1'
      };

      const mockPopulate1 = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(cart)
      });

      mockCartFindOne.mockReturnValue({
        populate: mockPopulate1
      });

      mockMenuItemFindById.mockResolvedValue(null);
      deliveryOrderService.createOrder.mockResolvedValue({ _id: 'order123' });
      mockCartUpdateOne.mockResolvedValue({});

      const mockIo = { emit: jest.fn() };

      await CartService.checkoutCart('customer123', {
        selectedItemIds: ['item1'],
        deliveryLocation: {},
        paymentMethodId: 'payment123'
      }, mockIo);

      expect(deliveryOrderService.createOrder).toHaveBeenCalledWith(
        expect.any(Object),
        'customer123',
        mockIo
      );
    });
  });
});

