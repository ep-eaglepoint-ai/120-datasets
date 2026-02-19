const Cart = require("./models/Cart.model");
const MenuItem = require("./models/MenuItem.model");
const Merchant = require("./models/Merchant.model");
const HttpError = require("./utils/httpError");
const logger = require("./config/logger");

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
          pricing: { subtotal: 0, totalItems: 0 },
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

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new HttpError("Quantity must be a positive integer", 400);
      }

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
          variations.every(v =>
            variant.optionValues.some(opt => opt.optionName === v.optionName && opt.value === v.value)
          )
        );
        if (!selectedVariant) {
            throw new HttpError("The selected product options are not a valid combination.", 400);
        }
        variantPrice = parseFloat(selectedVariant.price.toString());
      }
      
      let basePrice = variantPrice !== null ? variantPrice : parseFloat(menuItem.price.toString());
      
      if (menuItem.discount && menuItem.discount.isActive) {
        const now = new Date();
        const validFrom = menuItem.discount.validFrom ? new Date(menuItem.discount.validFrom) : null;
        const validUntil = menuItem.discount.validUntil ? new Date(menuItem.discount.validUntil) : null;
        
        const isWithinDateRange = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);
        if (isWithinDateRange && menuItem.discountedPrice) {
          basePrice = parseFloat(menuItem.discountedPrice.toString());
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

      const addOnsTotal = addOnsWithPrices.reduce((total, addon) => total + addon.price, 0);
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

      // Use atomic operation to prevent duplicates and validate merchant
      let result = await Cart.findOneAndUpdate(
        {
          customerId,
          'items.menuItemId': { $ne: menuItem._id },
          $or: [
            { merchantId: menuItem.merchantId },
            { merchantId: { $exists: false } },
            { merchantId: null }
          ]
        },
        {
          $set: { merchantId: menuItem.merchantId },
          $push: { items: newItem },
          $inc: { 'pricing.subtotal': subtotal, 'pricing.totalItems': quantity }
        },
        { new: true }
      );

      // If no cart was updated, either no cart exists or conditions failed
      if (!result) {
        const existingCart = await Cart.findOne({ customerId });
        if (existingCart) {
          // Cart exists but update failed - check why
          if (existingCart.items.some(item => item.menuItemId.toString() === menuItem._id.toString())) {
            throw new HttpError("This exact item configuration is already in your cart.", 409);
          }
          if (existingCart.merchantId && existingCart.items.length > 0 &&
              existingCart.merchantId.toString() !== menuItem.merchantId.toString()) {
            throw new HttpError("Cannot add items from different merchants to the same cart", 400);
          }
        }
        // No cart exists, create new one
        const newCart = new Cart({
          customerId,
          merchantId: menuItem.merchantId,
          items: [newItem],
          pricing: { subtotal, totalItems: quantity }
        });
        try {
          result = await newCart.save();
        } catch (err) {
          // Race condition - another request created the cart
          if (err.code === 11000) {
            throw new HttpError("This exact item configuration is already in your cart.", 409);
          }
          throw err;
        }
      }

      await result.populate({
        path: 'items.menuItemId',
        populate: {
            path: 'merchantId', 
            model: 'Merchant',
            select: 'businessName businessType isOpen rating _id'
        }
      });

      return result;
    } catch (error) {
      logger.error(`Error adding to cart: ${error.message}`);
      throw error;
    }
  }

  async updateCartItem(customerId, itemId, updateData) {
    try {
      const { quantity, addOns, variations } = updateData;

      if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 0)) {
        throw new HttpError("Quantity must be a non-negative integer", 400);
      }

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
          throw new HttpError("The original menu item no longer exists.", 404);
        }

        let basePrice = parseFloat(cartItem.price.toString());

        if (Array.isArray(variations) && variations.length > 0 && menuItem.productType === 'variable') {
            const selectedVariant = menuItem.variants.find(variant =>
                variations.length === variant.optionValues.length &&
                variations.every(v =>
                    variant.optionValues.some(opt => opt.optionName === v.optionName && opt.value === v.value)
                )
            );
            if (!selectedVariant) {
                throw new HttpError("The updated product options are not valid.", 400);
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

      // Recalculate cart pricing
      cart.pricing.subtotal = cart.items.reduce((sum, item) => sum + parseFloat(item.subtotal.toString()), 0);
      cart.pricing.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

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

      cart.items = cart.items.filter(
        (item) => item._id.toString() !== itemId
      );

      // Recalculate cart pricing
      cart.pricing.subtotal = cart.items.reduce((sum, item) => sum + parseFloat(item.subtotal.toString()), 0);
      cart.pricing.totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

      await cart.save();
      return cart;
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
      return cart;
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
}

module.exports = new CartService();

