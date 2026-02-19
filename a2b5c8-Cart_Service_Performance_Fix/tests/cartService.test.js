const assert = require("assert");
const path = require("path");

function makeQuery(result, calls) {
  const q = {
    select(fields) {
      calls.select = fields;
      return q;
    },
    lean() {
      calls.lean = true;
      return Promise.resolve(result);
    },
    populate() {
      calls.populate = (calls.populate || 0) + 1;
      return q;
    },
    exec() {
      return Promise.resolve(result);
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return q;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function patchSingleNowDate() {
  const RealDate = global.Date;
  let nowCtorCalls = 0;
  global.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        nowCtorCalls += 1;
        if (nowCtorCalls > 1) {
          throw new Error("Multiple Date() constructions detected (non-single time reference)");
        }
      }
      super(...args);
    }
  };
  return () => {
    global.Date = RealDate;
  };
}

function decimalWithCounter(strValue) {
  let calls = 0;
  return {
    toString() {
      calls += 1;
      return strValue;
    },
    getCalls() {
      return calls;
    },
  };
}

function run(testName, fn) {
  return Promise.resolve()
    .then(fn)
    .then(
      () => ({ name: testName, ok: true }),
      (err) => ({ name: testName, ok: false, err })
    );
}

async function runCartServiceTests({ repoRoot }) {
  const mongoose = require("mongoose");
  const ObjectId = mongoose.Types.ObjectId;

  const Cart = require(path.join(repoRoot, "models/Cart.model.js"));
  const MenuItem = require(path.join(repoRoot, "models/MenuItem.model.js"));
  const Merchant = require(path.join(repoRoot, "models/Merchant.model.js"));
  const CartService = require(path.join(repoRoot, "cartService.js"));

  const results = [];

  results.push(
    await run("getCart uses lean() and bulk $in fetches (no populate)", async () => {
      const cartCalls = {};
      const menuCalls = {};
      const merchCalls = {};

      const itemPrice = decimalWithCounter("9.50");
      const itemSubtotal = decimalWithCounter("19.00");
      const cartSubtotal = decimalWithCounter("19.00");

      const menuItemId = new ObjectId();
      const merchantId = new ObjectId();
      const cartId = new ObjectId();

      Cart.findOne = () =>
        makeQuery(
          {
            _id: cartId,
            items: [
              {
                _id: new ObjectId(),
                menuItemId,
                name: "Burger",
                price: itemPrice,
                quantity: 2,
                variations: [],
                addOns: [{ _id: new ObjectId(), name: "Cheese", price: decimalWithCounter("1.00") }],
                subtotal: itemSubtotal,
              },
            ],
            pricing: { subtotal: cartSubtotal, totalItems: 2 },
          },
          cartCalls
        );

      MenuItem.find = (query) => {
        assert.deepStrictEqual(Object.keys(query), ["_id"]);
        assert.ok(query._id && query._id.$in && Array.isArray(query._id.$in));
        assert.strictEqual(query._id.$in.length, 1);
        return makeQuery([{ _id: menuItemId, merchantId, images: [{ url: "x", isPrimary: true }] }], menuCalls);
      };

      Merchant.find = (query) => {
        assert.deepStrictEqual(Object.keys(query), ["_id"]);
        assert.ok(query._id && query._id.$in && Array.isArray(query._id.$in));
        return makeQuery(
          [{ _id: merchantId, businessName: "M1", businessType: "Fast", isOpen: true, rating: 4.2 }],
          merchCalls
        );
      };

      const out = await CartService.getCart("cust-1");

      assert.strictEqual(cartCalls.lean, true, "Cart query must use lean()");
      assert.ok(!cartCalls.populate, "populate() must not be used");
      assert.strictEqual(menuCalls.lean, true, "MenuItem query must use lean()");
      assert.strictEqual(merchCalls.lean, true, "Merchant query must use lean()");

      // Field limiting is enforced via select() calls.
      assert.ok(
        typeof menuCalls.select === "string" && menuCalls.select.includes("_id") && menuCalls.select.includes("merchantId"),
        "MenuItem query must select required fields"
      );
      assert.ok(
        typeof merchCalls.select === "string" && merchCalls.select.includes("businessName") && merchCalls.select.includes("_id"),
        "Merchant query must select required fields"
      );

      assert.strictEqual(out._id.toString(), cartId.toString());
      assert.strictEqual(out.items.length, 1);
      assert.strictEqual(out.items[0].merchantInfo.businessName, "M1");

      // Repeated Decimal128 conversions should not occur (each field converted once).
      assert.strictEqual(itemPrice.getCalls(), 1);
      assert.strictEqual(itemSubtotal.getCalls(), 1);
      assert.strictEqual(cartSubtotal.getCalls(), 1);
    })
  );

  results.push(
    await run("addToCart fetches menuItem + cart in parallel", async () => {
      const cartFindCalls = { count: 0 };
      const menuDef = deferred();

      // Must support BOTH styles:
      // - before: await MenuItem.findById(id)
      // - after:  await MenuItem.findById(id).select(...).lean()
      MenuItem.findById = () => {
        const calls = {};
        const q = makeQuery(null, calls);
        q.select = () => q;
        q.lean = () => menuDef.promise;
        // await q should also work for "before" by returning the same promise
        q.then = (resolve, reject) => menuDef.promise.then(resolve, reject);
        return q;
      };

      Cart.findOne = () => {
        cartFindCalls.count += 1;
        return null;
      };

      Cart.prototype.save = async function () {
        return this;
      };
      const originalGetCart = CartService.getCart.bind(CartService);
      CartService.getCart = async () => ({ ok: true });

      const addPromise = CartService.addToCart("cust-1", { menuItemId: new ObjectId(), quantity: 1 }).catch(() => null);
      // Allow microtasks to run; sequential implementations won't have invoked Cart.findOne yet.
      await Promise.resolve();
      await Promise.resolve();

      assert.strictEqual(cartFindCalls.count, 1, "Cart.findOne must be invoked without awaiting menu item first");

      menuDef.resolve({
        _id: new ObjectId(),
        name: "Burger",
        merchantId: new ObjectId(),
        price: decimalWithCounter("10.00"),
        discountedPrice: null,
        isAvailable: true,
        productType: "simple",
        images: [],
        variants: [],
        extras: [],
        discount: null,
      });

      await addPromise;
      CartService.getCart = originalGetCart;
    })
  );

  results.push(
    await run("addToCart uses ObjectId.equals() for merchant and item comparisons", async () => {
      const evilToStringId = {
        equals(other) {
          return String(other) === "same";
        },
        toString() {
          throw new Error("toString() comparison used (must use equals())");
        },
      };

      const cartDoc = {
        merchantId: evilToStringId,
        items: [{ menuItemId: evilToStringId, _id: new ObjectId() }],
        pricing: { subtotal: 0, totalItems: 0 },
        save: async () => cartDoc,
      };

      Cart.findOne = async () => cartDoc;

      const menuItem = {
        _id: "same",
        name: "Burger",
        merchantId: "same",
        price: "10",
        discountedPrice: null,
        isAvailable: true,
        productType: "simple",
        images: [],
        variants: [],
        extras: [],
        discount: null,
      };
      MenuItem.findById = () => {
        const calls = {};
        const q = makeQuery(menuItem, calls);
        q.select = () => q;
        q.lean = async () => menuItem;
        return q;
      };

      await assert.rejects(
        () => CartService.addToCart("cust-1", { menuItemId: "same", quantity: 1 }),
        (err) => err && err.name === "HttpError" && err.statusCode === 409
      );
    })
  );

  results.push(
    await run("addToCart performs a single save() and does not refetch cart", async () => {
      let findOneCalls = 0;
      let saveCalls = 0;
      let currentCart = null;

      Cart.findOne = async () => {
        findOneCalls += 1;
        return currentCart;
      };

      Cart.prototype.save = async function () {
        saveCalls += 1;
        currentCart = this;
        return this;
      };

      const menuItem = {
        _id: new ObjectId(),
        name: "Burger",
        merchantId: new ObjectId(),
        price: "10",
        discountedPrice: null,
        isAvailable: true,
        productType: "simple",
        images: [],
        variants: [],
        extras: [],
        discount: null,
      };
      MenuItem.findById = () => {
        const calls = {};
        const q = makeQuery(menuItem, calls);
        q.select = () => q;
        q.lean = async () => menuItem;
        return q;
      };

      // Stub getCart to avoid depending on getCart wiring in this test.
      const originalGetCart = CartService.getCart.bind(CartService);
      CartService.getCart = async () => ({ ok: true });

      try {
        await CartService.addToCart("cust-1", { menuItemId: new ObjectId(), quantity: 2 });
      } finally {
        CartService.getCart = originalGetCart;
      }

      assert.strictEqual(findOneCalls, 1, "Cart must be fetched once per addToCart");
      assert.strictEqual(saveCalls, 1, "Only one persistence operation (save) per addToCart");
    })
  );

  results.push(
    await run("addToCart uses a single Date() 'now' reference for discount logic", async () => {
      const restoreDate = patchSingleNowDate();
      try {
        Cart.findOne = async () => null;
        Cart.prototype.save = async function () {
          return this;
        };

        const menuItem = {
          _id: new ObjectId(),
          name: "Burger",
          merchantId: new ObjectId(),
          price: "10",
          discountedPrice: "8",
          isAvailable: true,
          productType: "simple",
          images: [],
          variants: [],
          extras: [],
          discount: { isActive: true, validFrom: new Date(0), validUntil: new Date(Date.now() + 100000) },
        };
        MenuItem.findById = () => {
          const calls = {};
          const q = makeQuery(menuItem, calls);
          q.select = () => q;
          q.lean = async () => menuItem;
          return q;
        };

        const originalGetCart = CartService.getCart.bind(CartService);
        CartService.getCart = async () => ({ ok: true });
        try {
          await CartService.addToCart("cust-1", { menuItemId: new ObjectId(), quantity: 1 });
        } finally {
          CartService.getCart = originalGetCart;
        }
      } finally {
        restoreDate();
      }
    })
  );

  results.push(
    await run("updateCartItem fetches cart once and saves once", async () => {
      let findOneCalls = 0;
      let saveCalls = 0;

      const itemId = new ObjectId();
      const menuItemId = new ObjectId();

      const cartDoc = {
        items: [
          {
            _id: itemId,
            menuItemId,
            price: "10",
            quantity: 1,
            addOns: [],
            subtotal: "10",
          },
        ],
        pricing: { subtotal: 10, totalItems: 1 },
        save: async () => {
          saveCalls += 1;
          return cartDoc;
        },
      };

      Cart.findOne = async () => {
        findOneCalls += 1;
        return cartDoc;
      };

      MenuItem.findById = () => ({
        select() {
          return {
            lean: async () => ({
              productType: "simple",
              variants: [],
              extras: [],
            }),
          };
        },
      });

      const originalGetCart = CartService.getCart.bind(CartService);
      CartService.getCart = async () => ({ ok: true });
      try {
        await CartService.updateCartItem("cust-1", itemId.toString(), { quantity: 2 });
      } finally {
        CartService.getCart = originalGetCart;
      }

      assert.strictEqual(findOneCalls, 1, "Cart must be fetched once per updateCartItem");
      assert.strictEqual(saveCalls, 1, "Only one save per updateCartItem");
    })
  );

  results.push(
    await run("removeFromCart fetches cart once and saves once", async () => {
      let findOneCalls = 0;
      let saveCalls = 0;
      const itemId = new ObjectId();

      const cartDoc = {
        items: [{ _id: itemId, subtotal: "10", quantity: 1 }],
        pricing: { subtotal: 10, totalItems: 1 },
        save: async () => {
          saveCalls += 1;
          return cartDoc;
        },
      };

      Cart.findOne = async () => {
        findOneCalls += 1;
        return cartDoc;
      };

      const originalGetCart = CartService.getCart.bind(CartService);
      CartService.getCart = async () => ({ ok: true });
      try {
        await CartService.removeFromCart("cust-1", itemId.toString());
      } finally {
        CartService.getCart = originalGetCart;
      }

      assert.strictEqual(findOneCalls, 1);
      assert.strictEqual(saveCalls, 1);
    })
  );

  results.push(
    await run("clearCart fetches cart once and saves once", async () => {
      let findOneCalls = 0;
      let saveCalls = 0;

      const cartDoc = {
        items: [{ _id: new ObjectId(), subtotal: "10", quantity: 1 }],
        pricing: { subtotal: 10, totalItems: 1 },
        save: async () => {
          saveCalls += 1;
          return cartDoc;
        },
      };

      Cart.findOne = async () => {
        findOneCalls += 1;
        return cartDoc;
      };

      const originalGetCart = CartService.getCart.bind(CartService);
      CartService.getCart = async () => ({ ok: true });
      try {
        await CartService.clearCart("cust-1");
      } finally {
        CartService.getCart = originalGetCart;
      }

      assert.strictEqual(findOneCalls, 1);
      assert.strictEqual(saveCalls, 1);
    })
  );

  // Sanity: the suite must be able to load the required modules.
  results.push(
    await run("deleteCart calls findOneAndDelete once", async () => {
      let calls = 0;
      Cart.findOneAndDelete = async () => {
        calls += 1;
        return { ok: true };
      };
      await CartService.deleteCart("cust-1");
      assert.strictEqual(calls, 1);
    })
  );

  return results;
}

module.exports = { runCartServiceTests };


