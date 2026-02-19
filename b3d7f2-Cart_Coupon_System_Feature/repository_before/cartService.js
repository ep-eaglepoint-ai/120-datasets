const Cart = require("./models/Cart.model");
const MenuItem = require("./models/MenuItem.model");
const Merchant = require("./models/Merchant.model");
const HttpError = require("./utils/httpError");
const logger = require("./config/logger");
const deliveryOrderService = require("./services/deliveryOrder.Service");

class CartService {
  async getCart(customerId) {
    try {
      const cart = await Cart.findOne({ customerId })
        .populate({
          path: 'items.menuItemId',
          populate: {
            path: 'merchantId',
            model: 'Merchant',
            select: 'businessName businessType isOpen rating _id'
          }
        });

      if (!cart) {
        return {
          _id: null,
          items: [],
          pricing: {
            subtotal: 0,
            totalItems: 0,
          },
        };
      }

      const items = cart.items.map(item => {
        if (!item.menuItemId || !item.menuItemId.merchantId) {
          return null;
        }
        return {
          _id: item._id,
          menuItemId: item.menuItemId._id,
          name: item.name,
          image: item.menuItemId.images?.find(img => img.isPrimary)?.url || item.menuItemId.images?.[0]?.url,
          price: parseFloat(item.price.toString()),
          quantity: item.quantity,
          variations: item.variations,
          addOns: item.addOns.map(addOn => ({
            name: addOn.name,
            _id: addOn._id,
            price: parseFloat(addOn.price.toString())
          })),
          subtotal: parseFloat(item.subtotal.toString()),
          merchantInfo: item.menuItemId.merchantId,
        };
      }).filter(item => item !== null);

      return {
        _id: cart._id,
        items,
        pricing: {
          subtotal: parseFloat(cart.pricing.subtotal.toString()),
          totalItems: cart.pricing.totalItems
        }
      };
    } catch (error) {
      logger.error(`Error getting cart: ${error.message}`);
      throw error;
    }
  }

  async addToCart(customerId, itemData) {
    try {
      const { menuItemId, quantity, variations = [], addOns = [] } = itemData;

      const menuItem = await MenuItem.findById(menuItemId).lean();
      if (!menuItem) {
        throw new HttpError("Menu item not found", 404);
      }

      if (!menuItem.isAvailable) {
        throw new HttpError("This menu item is currently unavailable", 400);
      }

      let variantPrice = null;
      if (menuItem.productType === 'variable') {
        if (!variations || variations.length === 0) {
          throw new HttpError("Product options must be selected for this item.", 400);
        }
        const selectedVariant = menuItem.variants.find(variant =>
          variations.length === variant.optionValues.length &&
          variations.every(v => variant.optionValues.some(opt => opt.optionName === v.optionName && opt.value === v.value))
        );
        if (!selectedVariant) {
          throw new HttpError("The selected product options are not a valid combination.", 400);
        }
        variantPrice = parseFloat(selectedVariant.price.toString());
      }

      let basePrice = variantPrice !== null ? variantPrice : parseFloat(menuItem.price.toString());

      if (variantPrice === null && menuItem.discount && menuItem.discount.isActive) {
        const now = new Date();
        const validFrom = menuItem.discount.validFrom ? new Date(menuItem.discount.validFrom) : null;
        const validUntil = menuItem.discount.validUntil ? new Date(menuItem.discount.validUntil) : null;
        if ((!validFrom || now >= validFrom) && (!validUntil || now <= validUntil)) {
          if (menuItem.discountedPrice) {
            const discountedPrice = parseFloat(menuItem.discountedPrice.toString());
            if (!isNaN(discountedPrice) && discountedPrice > 0) {
              basePrice = discountedPrice;
            }
          }
        }
      }

      const addOnsWithPrices = addOns.map(addOnFromClient => {
        const addon = menuItem.extras.find(extra => extra.name === addOnFromClient.name);
        if (!addon) return null;
        return {
          name: addon.name,
          price: parseFloat(addon.price.toString()),
          _id: addon?._id
        };
      }).filter(Boolean);

      let cart = await Cart.findOne({ customerId });
      if (!cart) {
        cart = new Cart({ customerId, merchantId: menuItem.merchantId, items: [] });
      }

      const existingItem = cart.items.find(item => {
        const isSameMenuItem = item.menuItemId.toString() === menuItem._id.toString();
        return isSameMenuItem;
      });

      if (existingItem) {
        throw new HttpError("This exact item configuration is already in your cart.", 409);
      }

      const addOnsTotal = addOnsWithPrices?.reduce((total, addon) => total + addon.price, 0);
      const singleItemPrice = basePrice + addOnsTotal;
      const subtotal = singleItemPrice * quantity;

      const newItem = {
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: basePrice,
        quantity,
        variations,
        addOns: addOnsWithPrices,
        subtotal,
      };

      cart.items.push(newItem);
      await cart.save();

      await cart.populate({
        path: 'items.menuItemId',
        populate: {
          path: 'merchantId',
          model: 'Merchant',
          select: 'businessName businessType isOpen rating _id'
        }
      });

      return cart;
    } catch (error) {
      logger.error(`Error adding to cart: ${error.message}`);
      throw error;
    }
  }

  async updateCartItem(customerId, itemId, updateData) {
    try {
      const { quantity, addOns, variations } = updateData;

      const cart = await Cart.findOne({ customerId });
      if (!cart) {
        throw new HttpError("Cart not found", 404);
      }

      const itemIndex = cart.items.findIndex((item) => item._id.toString() === itemId);
      if (itemIndex === -1) {
        throw new HttpError("Item not found in cart", 404);
      }

      if (quantity === 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        const cartItem = cart.items[itemIndex];
        const menuItem = await MenuItem.findById(cartItem.menuItemId).lean();
        if (!menuItem) {
          cart.items.splice(itemIndex, 1);
          await cart.save();
          throw new HttpError("The original menu item no longer exists and has been removed from your cart.", 404);
        }

        let basePrice = parseFloat(cartItem.price.toString());

        if (Array.isArray(variations) && variations.length > 0 && menuItem.productType === 'variable') {
          const selectedVariant = menuItem.variants.find(variant =>
            variations.length === variant.optionValues.length &&
            variations.every(v => variant.optionValues.some(opt => opt.optionName === v.optionName && opt.value === v.value))
          );
          if (!selectedVariant) {
            throw new HttpError("The updated product options are not a valid combination.", 400);
          }
          basePrice = parseFloat(selectedVariant.price.toString());
          cartItem.price = basePrice;
          cartItem.variations = variations;
        }

        if (addOns !== undefined) {
          const addOnsWithPrices = addOns.map(addonFromClient => {
            const addon = menuItem.extras.find(extra => extra._id.toString() === addonFromClient._id);
            if (!addon) return null;
            return {
              name: addon.name,
              price: parseFloat(addon.price.toString()),
              _id: addon?._id
            };
          }).filter(Boolean);
          cartItem.addOns = addOnsWithPrices;
        }

        const addOnsTotal = cartItem.addOns.reduce((total, addon) => total + parseFloat(addon.price.toString()), 0);
        const newSubtotal = (basePrice + addOnsTotal) * quantity;
        cartItem.quantity = quantity;
        cartItem.subtotal = newSubtotal;
      }

      await cart.save();
      return cart;
    } catch (error) {
      logger.error(`Error updating cart item: ${error.message}`);
      throw error;
    }
  }

  async removeFromCart(customerId, itemId) {
    try {
      const cart = await Cart.findOne({ customerId });
      if (!cart) {
        throw new HttpError("Cart not found", 404);
      }

      cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
      await cart.save();

      return null;
    } catch (error) {
      logger.error(`Error removing from cart: ${error.message}`);
      throw error;
    }
  }

  async clearCart(customerId) {
    try {
      const cart = await Cart.findOne({ customerId });
      if (!cart) {
        throw new HttpError("Cart not found", 404);
      }

      cart.items = [];
      cart.pricing.subtotal = 0;
      cart.pricing.totalItems = 0;
      await cart.save();

      return null;
    } catch (error) {
      logger.error(`Error clearing cart: ${error.message}`);
      throw error;
    }
  }

  async deleteCart(customerId) {
    try {
      const result = await Cart.findOneAndDelete({ customerId });
      return result;
    } catch (error) {
      logger.error(`Error deleting cart: ${error.message}`);
      throw error;
    }
  }

  async checkoutCart(customerId, checkoutData, io = null) {
    try {
      const { deliveryLocation, paymentMethodId, specialInstructions, deliveryPreferences, selectedItemIds } = checkoutData;

      if (!selectedItemIds || selectedItemIds.length === 0) {
        throw new HttpError("Please select at least one item to order", 400);
      }

      const cart = await Cart.findOne({ customerId })
        .populate("items.menuItemId", "merchantId name price discountedPrice isAvailable discount")
        .populate("merchantId", "businessName businessAddress contactInfo");

      if (!cart || cart.items.length === 0) {
        throw new HttpError("Cart is empty", 400);
      }

      const selectedItems = cart.items.filter(item => selectedItemIds.includes(item._id.toString()));
      if (selectedItems.length === 0) {
        throw new HttpError("No valid items selected", 400);
      }

      const merchants = [...new Set(selectedItems.map(item => item.menuItemId.merchantId.toString()))];
      if (merchants.length > 1) {
        throw new HttpError("Cannot order items from different merchants. Please select items from one merchant only.", 400);
      }

      const unavailableItems = selectedItems.filter(item => !item.menuItemId.isAvailable);
      if (unavailableItems.length > 0) {
        throw new HttpError("Some selected items are no longer available. Please remove them from cart.", 400);
      }

      const orderItems = await Promise.all(selectedItems.map(async (item) => {
        const menuItem = await MenuItem.findById(item.menuItemId._id);
        let itemPrice = parseFloat(item.price);

        if (menuItem) {
          if (menuItem.discount && menuItem.discount.isActive) {
            const now = new Date();
            const validFrom = menuItem.discount.validFrom ? new Date(menuItem.discount.validFrom) : null;
            const validUntil = menuItem.discount.validUntil ? new Date(menuItem.discount.validUntil) : null;
            if ((!validFrom || now >= validFrom) && (!validUntil || now <= validUntil)) {
              if (menuItem.discountedPrice) {
                const discountedPrice = parseFloat(menuItem.discountedPrice.toString());
                if (!isNaN(discountedPrice) && discountedPrice > 0) {
                  itemPrice = discountedPrice;
                }
              }
            }
          }
        }

        const addOnsTotal = (item.addOns || []).reduce((total, addon) => total + parseFloat(addon.price || 0), 0);
        const subtotal = (itemPrice + addOnsTotal) * item.quantity;

        return {
          menuItemId: item.menuItemId._id,
          name: item.name,
          price: itemPrice,
          quantity: item.quantity,
          variations: item.variations && item.variations.length > 0
            ? item.variations
              .filter(v => v.optionName && v.value)
              .map(v => ({
                name: v.optionName,
                selectedOption: v.value,
                priceModifier: v.priceModifier || 0
              }))
            : [],
          addOns: item.addOns || [],
          subtotal: subtotal
        };
      }));

      const orderData = {
        merchantId: merchants[0],
        items: orderItems,
        deliveryLocation,
        paymentMethodId,
        specialInstructions,
        deliveryPreferences
      };

      const order = await deliveryOrderService.createOrder(orderData, customerId, io);

      await Cart.updateOne(
        { customerId },
        { $pull: { items: { _id: { $in: selectedItemIds } } } }
      );

      return order;
    } catch (error) {
      logger.error(`Error checking out cart: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new CartService();

