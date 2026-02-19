const Cart = require("./models/Cart.model");
const MenuItem = require("./models/MenuItem.model");
const Merchant = require("./models/Merchant.model");
const HttpError = require("./utils/httpError");
const logger = require("./config/logger");

function decimalToNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toString === "function") return Number(value.toString());
  return Number(value);
}

function getPrimaryImageUrl(images) {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const primary = images.find((img) => img && img.isPrimary);
  return (primary && primary.url) || images[0]?.url;
}

function normalizeAddOns(addOns) {
  if (!Array.isArray(addOns) || addOns.length === 0) return [];
  return addOns.map((addOn) => {
    const addOnPrice = decimalToNumber(addOn.price);
    return { name: addOn.name, _id: addOn._id, price: addOnPrice };
  });
}

function recalculatePricing(cart) {
  let subtotal = 0;
  let totalItems = 0;

  for (const item of cart.items) {
    subtotal += decimalToNumber(item.subtotal);
    totalItems += item.quantity;
  }

  cart.pricing.subtotal = subtotal;
  cart.pricing.totalItems = totalItems;
}

function isDiscountActive(discount, now) {
  if (!discount || !discount.isActive) return false;
  const validFrom = discount.validFrom ? new Date(discount.validFrom) : null;
  const validUntil = discount.validUntil ? new Date(discount.validUntil) : null;
  return (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);
}

class CartService {
  async getCart(customerId) {
    try {
      const cart = await Cart.findOne({ customerId })
        .select("items pricing")
        .lean();

      if (!cart) {
        return {
          _id: null,
          items: [],
          pricing: { subtotal: 0, totalItems: 0 },
        };
      }

      const menuItemIds = [];
      for (const item of cart.items) {
        if (item?.menuItemId) menuItemIds.push(item.menuItemId);
      }

      // Bulk fetch menu items and merchants (avoid populate N+1).
      const menuItems = menuItemIds.length
        ? await MenuItem.find({ _id: { $in: menuItemIds } })
            .select("_id merchantId images")
            .lean()
        : [];

      const menuItemById = new Map();
      const merchantIds = [];
      for (const mi of menuItems) {
        menuItemById.set(String(mi._id), mi);
        if (mi?.merchantId) merchantIds.push(mi.merchantId);
      }

      const merchants = merchantIds.length
        ? await Merchant.find({ _id: { $in: merchantIds } })
            .select("businessName businessType isOpen rating _id")
            .lean()
        : [];

      const merchantById = new Map();
      for (const m of merchants) merchantById.set(String(m._id), m);

      const items = [];
      for (const item of cart.items) {
        const mi = item?.menuItemId ? menuItemById.get(String(item.menuItemId)) : null;
        const merchant = mi?.merchantId ? merchantById.get(String(mi.merchantId)) : null;
        if (!mi || !merchant) continue;

        const price = decimalToNumber(item.price);
        const subtotal = decimalToNumber(item.subtotal);
        const addOns = normalizeAddOns(item.addOns);

        items.push({
          _id: item._id,
          menuItemId: mi._id,
          name: item.name,
          image: getPrimaryImageUrl(mi.images),
          price,
          quantity: item.quantity,
          variations: item.variations,
          addOns,
          subtotal,
          merchantInfo: merchant,
        });
      }

      return {
        _id: cart._id,
        items,
        pricing: {
          subtotal: decimalToNumber(cart.pricing?.subtotal),
          totalItems: cart.pricing?.totalItems || 0,
        },
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

      // Independent fetches in parallel (cart is needed for write, menu item is read-only).
      const [menuItem, existingCart] = await Promise.all([
        MenuItem.findById(menuItemId)
          .select(
            "name merchantId price discountedPrice isAvailable productType images variants extras discount"
          )
          .lean(),
        Cart.findOne({ customerId }),
      ]);

      if (!menuItem) {
        throw new HttpError("Menu item not found", 404);
      }
      if (!menuItem.isAvailable) {
        throw new HttpError("This menu item is currently unavailable", 400);
      }

      if (existingCart && existingCart.merchantId && !existingCart.merchantId.equals(menuItem.merchantId)) {
        throw new HttpError("Cannot add items from multiple merchants", 400);
      }

      let variantPrice = null;
      if (menuItem.productType === "variable") {
        if (!variations || variations.length === 0) {
          throw new HttpError("Product options must be selected for this item.", 400);
        }
        const selectedVariant = menuItem.variants.find(
          (variant) =>
            variations.length === variant.optionValues.length &&
            variations.every((v) =>
              variant.optionValues.some(
                (opt) => opt.optionName === v.optionName && opt.value === v.value
              )
            )
        );
        if (!selectedVariant) {
          throw new HttpError("The selected product options are not a valid combination.", 400);
        }
        variantPrice = decimalToNumber(selectedVariant.price);
      }

      const now = new Date();
      let basePrice = variantPrice !== null ? variantPrice : decimalToNumber(menuItem.price);

      if (isDiscountActive(menuItem.discount, now) && menuItem.discountedPrice != null) {
        basePrice = decimalToNumber(menuItem.discountedPrice);
      }

      const addOnsWithPrices = Array.isArray(addOns)
        ? addOns
            .map((addOnFromClient) => {
              const addon = menuItem.extras.find((extra) => extra.name === addOnFromClient.name);
              if (!addon) return null;
              return { name: addon.name, price: decimalToNumber(addon.price), _id: addon._id };
            })
            .filter(Boolean)
        : [];

      const cart =
        existingCart ||
        new Cart({
          customerId,
          merchantId: menuItem.merchantId,
          items: [],
          pricing: { subtotal: 0, totalItems: 0 },
        });

      const existingItem = cart.items.find((item) => item.menuItemId.equals(menuItem._id));
      if (existingItem) {
        throw new HttpError("This exact item configuration is already in your cart.", 409);
      }

      let addOnsTotal = 0;
      for (const addon of addOnsWithPrices) addOnsTotal += addon.price;

      const singleItemPrice = basePrice + addOnsTotal;
      const subtotal = singleItemPrice * quantity;

      cart.items.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        price: basePrice,
        quantity,
        variations,
        addOns: addOnsWithPrices,
        subtotal,
      });

      recalculatePricing(cart);
      await cart.save(); // single persistence operation

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

      const itemIndex = cart.items.findIndex((item) => item._id.equals(itemId));
      if (itemIndex === -1) {
        throw new HttpError("Item not found in cart", 404);
      }

      const cartItem = cart.items[itemIndex];

      const menuItem = await MenuItem.findById(cartItem.menuItemId)
        .select("productType variants extras")
        .lean();

      if (!menuItem) {
        cart.items.splice(itemIndex, 1);
        recalculatePricing(cart);
        await cart.save(); // single persistence operation (even on this error path)
        throw new HttpError("The original menu item no longer exists.", 404);
      }

      let basePrice = decimalToNumber(cartItem.price);

      if (Array.isArray(variations) && variations.length > 0 && menuItem.productType === "variable") {
        const selectedVariant = menuItem.variants.find(
          (variant) =>
            variations.length === variant.optionValues.length &&
            variations.every((v) =>
              variant.optionValues.some(
                (opt) => opt.optionName === v.optionName && opt.value === v.value
              )
            )
        );
        if (!selectedVariant) {
          throw new HttpError("The updated product options are not valid.", 400);
        }
        basePrice = decimalToNumber(selectedVariant.price);
      }

      cartItem.price = basePrice;
      if (variations) cartItem.variations = variations;

      if (addOns !== undefined) {
        const addOnsWithPrices = Array.isArray(addOns)
          ? addOns
              .map((addonFromClient) => {
                const addon = menuItem.extras.find((extra) => extra._id.equals(addonFromClient._id));
                if (!addon) return null;
                return { name: addon.name, price: decimalToNumber(addon.price), _id: addon._id };
              })
              .filter(Boolean)
          : [];
        cartItem.addOns = addOnsWithPrices;
      }

      let addOnsTotal = 0;
      for (const addon of cartItem.addOns) addOnsTotal += decimalToNumber(addon.price);

      const effectiveQuantity = quantity || cartItem.quantity;
      cartItem.quantity = effectiveQuantity;
      cartItem.subtotal = (basePrice + addOnsTotal) * effectiveQuantity;

      recalculatePricing(cart);
      await cart.save(); // single persistence operation

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

      cart.items = cart.items.filter((item) => !item._id.equals(itemId));
      recalculatePricing(cart);
      await cart.save(); // single persistence operation

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
      cart.pricing.subtotal = 0;
      cart.pricing.totalItems = 0;
      await cart.save(); // single persistence operation

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

