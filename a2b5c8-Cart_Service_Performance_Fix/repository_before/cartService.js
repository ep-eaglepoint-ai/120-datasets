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

      let subtotal = 0;
      for (const item of cart.items) {
        subtotal += parseFloat(item.subtotal.toString());
      }
      
      let totalItems = 0;
      for (const item of cart.items) {
        totalItems += item.quantity;
      }

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

      if (!quantity || quantity < 1) {
        throw new HttpError("Quantity must be at least 1", 400);
      }

      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem) {
        throw new HttpError("Menu item not found", 404);
      }
      if (!menuItem.isAvailable) {
        throw new HttpError("This menu item is currently unavailable", 400);
      }

      let cart = await Cart.findOne({ customerId });

      if (cart && cart.merchantId && cart.merchantId.toString() !== menuItem.merchantId.toString()) {
        throw new HttpError("Cannot add items from multiple merchants", 400);
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
        const validFrom = menuItem.discount.validFrom ? new Date(menuItem.discount.validFrom) : null;
        const validUntil = menuItem.discount.validUntil ? new Date(menuItem.discount.validUntil) : null;
        if ((!validFrom || new Date() >= validFrom) && (!validUntil || new Date() <= validUntil)) {
          if (menuItem.discountedPrice) {
            basePrice = parseFloat(menuItem.discountedPrice.toString());
          }
        }
      }

      const addOnsWithPrices = addOns.map(addOnFromClient => {
        const addon = menuItem.extras.find(extra => extra.name === addOnFromClient.name);
        if (!addon) return null;
        return {
          name: addon.name,
          price: parseFloat(addon.price.toString()),
          _id: addon._id
        };
      }).filter(Boolean);

      let existingCart = await Cart.findOne({ customerId });
      if (!existingCart) {
        existingCart = new Cart({
          customerId,
          merchantId: menuItem.merchantId,
          items: [],
          pricing: { subtotal: 0, totalItems: 0 }
        });
      }

      const existingItem = existingCart.items.find(item => 
        item.menuItemId.toString() === menuItem._id.toString()
      );

      if (existingItem) {
        throw new HttpError("This exact item configuration is already in your cart.", 409);
      }

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

      existingCart.items.push(newItem);
      await existingCart.save();

      const updatedCart = await Cart.findOne({ customerId });
      let cartSubtotal = 0;
      for (const item of updatedCart.items) {
        cartSubtotal += parseFloat(item.subtotal.toString());
      }
      updatedCart.pricing.subtotal = cartSubtotal;

      let cartTotalItems = 0;
      for (const item of updatedCart.items) {
        cartTotalItems += item.quantity;
      }
      updatedCart.pricing.totalItems = cartTotalItems;

      await updatedCart.save();

      return this.getCart(customerId);
    } catch (error) {
      logger.error(`Error adding to cart: ${error.message}`);
      throw error;
    }
  }

  async updateCartItem(customerId, itemId, updateData) {
    try {
      const { quantity, addOns, variations } = updateData;

      if (quantity !== undefined && quantity < 1) {
        throw new HttpError("Quantity must be at least 1", 400);
      }

      const cart = await Cart.findOne({ customerId });
      if (!cart) {
        throw new HttpError("Cart not found", 404);
      }

      const itemIndex = cart.items.findIndex((item) => item._id.toString() === itemId);
      if (itemIndex === -1) {
        throw new HttpError("Item not found in cart", 404);
      }

      const cartItem = cart.items[itemIndex];
      const menuItem = await MenuItem.findById(cartItem.menuItemId);

      if (!menuItem) {
        const cartToUpdate = await Cart.findOne({ customerId });
        cartToUpdate.items.splice(itemIndex, 1);
        await cartToUpdate.save();
        
        const cartForPricing = await Cart.findOne({ customerId });
        let newSubtotal = 0;
        for (const item of cartForPricing.items) {
          newSubtotal += parseFloat(item.subtotal.toString());
        }
        cartForPricing.pricing.subtotal = newSubtotal;
        
        let newTotalItems = 0;
        for (const item of cartForPricing.items) {
          newTotalItems += item.quantity;
        }
        cartForPricing.pricing.totalItems = newTotalItems;
        await cartForPricing.save();
        
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
      }

      const cartToModify = await Cart.findOne({ customerId });
      cartToModify.items[itemIndex].price = basePrice;
      if (variations) cartToModify.items[itemIndex].variations = variations;
      await cartToModify.save();

      if (addOns !== undefined) {
        const cartForAddons = await Cart.findOne({ customerId });
        const addOnsWithPrices = addOns.map(addonFromClient => {
          const addon = menuItem.extras.find(extra => extra._id.toString() === addonFromClient._id);
          if (!addon) return null;
          return {
            name: addon.name,
            price: parseFloat(addon.price.toString()),
            _id: addon._id
          };
        }).filter(Boolean);
        cartForAddons.items[itemIndex].addOns = addOnsWithPrices;
        await cartForAddons.save();
      }

      const cartForQuantity = await Cart.findOne({ customerId });
      const itemForQuantity = cartForQuantity.items[itemIndex];
      const addOnsTotal = itemForQuantity.addOns.reduce((total, addon) => total + parseFloat(addon.price.toString()), 0);
      const newSubtotal = (basePrice + addOnsTotal) * (quantity || itemForQuantity.quantity);

      itemForQuantity.quantity = quantity || itemForQuantity.quantity;
      itemForQuantity.subtotal = newSubtotal;
      await cartForQuantity.save();

      const cartForPricing = await Cart.findOne({ customerId });
      let cartSubtotal = 0;
      for (const item of cartForPricing.items) {
        cartSubtotal += parseFloat(item.subtotal.toString());
      }
      cartForPricing.pricing.subtotal = cartSubtotal;
      
      let cartTotalItems = 0;
      for (const item of cartForPricing.items) {
        cartTotalItems += item.quantity;
      }
      cartForPricing.pricing.totalItems = cartTotalItems;
      await cartForPricing.save();

      return this.getCart(customerId);
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

      const cartForPricing = await Cart.findOne({ customerId });
      let subtotal = 0;
      for (const item of cartForPricing.items) {
        subtotal += parseFloat(item.subtotal.toString());
      }
      cartForPricing.pricing.subtotal = subtotal;
      
      let totalItems = 0;
      for (const item of cartForPricing.items) {
        totalItems += item.quantity;
      }
      cartForPricing.pricing.totalItems = totalItems;
      await cartForPricing.save();

      return this.getCart(customerId);
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
      await cart.save();

      const cartForPricing = await Cart.findOne({ customerId });
      cartForPricing.pricing.subtotal = 0;
      cartForPricing.pricing.totalItems = 0;
      await cartForPricing.save();

      return this.getCart(customerId);
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

