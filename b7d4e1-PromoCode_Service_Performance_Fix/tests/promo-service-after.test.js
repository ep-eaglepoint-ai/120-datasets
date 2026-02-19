const { ObjectId } = require("mongodb");
const PromoCodeService = require("../repository_after/promocode.service");

class MockCollection {
  constructor(name) {
    this.name = name;
    this.data = [];
    this.spies = {
      find: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
    };
  }

  async insertOne(doc) {
    const _id = new ObjectId();
    const newDoc = { ...doc, _id };
    this.data.push(newDoc);
    return { insertedId: _id };
  }

  async insertMany(docs) {
    this.data.push(...docs);
    return { insertedCount: docs.length };
  }

  async findOne(query) {
    // Simple query matching implementation
    return (
      this.data.find((item) => {
        for (let key in query) {
          if (item[key] !== query[key]) return false;
        }
        return true;
      }) || null
    );
  }

  // Simulating the N+1 problem source
  find(query) {
    this.spies.find(query);
    const results = this.data.filter((item) => {
      // Very basic matching for promoId
      if (query.promoId && item.promoId.toString() !== query.promoId.toString())
        return false;
      if (query.userId && item.userId.toString() !== query.userId.toString())
        return false;
      return true;
    });
    return {
      toArray: async () => results,
    };
  }

  async countDocuments(query) {
    this.spies.countDocuments(query);
    return this.data.filter((item) => {
      if (query.promoId && item.promoId.toString() !== query.promoId.toString())
        return false;
      if (query.userId && item.userId.toString() !== query.userId.toString())
        return false;
      return true;
    }).length;
  }

  async updateOne(filter, update) {
    this.spies.updateOne(filter);

    // 1. Find the document
    const docIndex = this.data.findIndex(
      (item) => item._id.toString() === filter._id.toString()
    );
    if (docIndex === -1) return { modifiedCount: 0 };

    const doc = this.data[docIndex];

    // 2. Simulate the "Locked" Condition (currentUses < maxUses)
    if (filter.currentUses && filter.currentUses.$lt !== undefined) {
      if (doc.currentUses >= filter.currentUses.$lt) {
        return { modifiedCount: 0 }; // Fail the update (simulate race condition block)
      }
    }

    // 3. Apply Update ($inc)
    if (update.$inc) {
      for (let key in update.$inc) {
        doc[key] = (doc[key] || 0) + update.$inc[key];
      }
    }
    // Apply Update ($set)
    if (update.$set) {
      Object.assign(doc, update.$set);
    }

    return { modifiedCount: 1 };
  }

  async createIndex() {
    return true;
  } // No-op
  async aggregate() {
    return { toArray: async () => [] };
  } // Stub
}

class MockDb {
  constructor() {
    this.collections = {
      promo_codes: new MockCollection("promo_codes"),
      promo_usage: new MockCollection("promo_usage"),
      users: new MockCollection("users"),
    };
  }
  collection(name) {
    return this.collections[name];
  }
}

describe("OPTIMIZED Service (Unit Tests with Mocks)", () => {
  let mockDb;
  let service;

  beforeEach(() => {
    mockDb = new MockDb();
    service = new PromoCodeService(mockDb);
  });

  // Helper to quickly create data in mock DB
  const seedPromo = async (overrides = {}) => {
    const defaults = {
      code: "TEST",
      discountType: "flat",
      discountValue: 10,
      maxUses: 100,
      currentUses: 0,
      maxUsesPerUser: 1,
      minOrderAmount: 0,
      validFrom: new Date(Date.now() - 10000),
      validUntil: new Date(Date.now() + 10000),
      applicableOrderTypes: ["all"],
      applicableMerchants: [],
      isActive: true,
    };
    const doc = { ...defaults, ...overrides };
    await mockDb.collection("promo_codes").insertOne(doc);
    // Fetch it back to get the _id
    return mockDb.collection("promo_codes").data[0];
  };

  test("REQ 1: Should NOT fetch full usage array (Avoid N+1)", async () => {
    const promo = await seedPromo({ code: "PERF_TEST", maxUses: 50 });

    // Execute validation
    await service.validateAndApplyPromoCode(
      "PERF_TEST",
      new ObjectId(),
      100,
      "all"
    );

    const findSpy = mockDb.collection("promo_usage").spies.find;
    expect(findSpy).not.toHaveBeenCalled();
  });

  test("REQ 2: Should use Atomic Operators to prevent overselling", async () => {
    // Setup: Limit is 5
    const promo = await seedPromo({
      code: "FLASH",
      maxUses: 5,
      currentUses: 0,
    });

    const results = [];
    for (let i = 0; i < 10; i++) {
      try {
        await service.validateAndApplyPromoCode(
          "FLASH",
          new ObjectId(),
          100,
          "all"
        );
        results.push("success");
      } catch (e) {
        results.push("failed");
      }
    }

    const successes = results.filter((r) => r === "success").length;
    const failures = results.filter((r) => r === "failed").length;

    // Verify
    expect(successes).toBe(5);
    expect(failures).toBe(5);

    // Verify DB state
    const updatedPromo = mockDb.collection("promo_codes").data[0];
    expect(updatedPromo.currentUses).toBe(5);
  });

  test("REQ 3: Should NOT store validation history in memory map", () => {
    // Legacy code had `this.validatedCodes = new Map()`
    expect(service.validatedCodes).toBeUndefined();
  });

  test("REQ 4: Should check Expiry (Cheap) BEFORE DB Limit (Expensive)", async () => {
    const promo = await seedPromo({
      code: "EXPIRED",
      validUntil: new Date(Date.now() - 10000), // Expired
      maxUses: 5,
      currentUses: 5, // Full
    });

    await expect(
      service.validateAndApplyPromoCode("EXPIRED", new ObjectId(), 100, "all")
    ).rejects.toThrow("Promo code has expired");

    const updateSpy = mockDb.collection("promo_codes").spies.updateOne;
    expect(updateSpy).not.toHaveBeenCalled();
  });

  test("REQ 7: Logic - Max Uses Per User", async () => {
    const promo = await seedPromo({ code: "USER_LIMIT", maxUsesPerUser: 1 });
    const userId = new ObjectId();

    await service.validateAndApplyPromoCode("USER_LIMIT", userId, 100, "all");

    expect(mockDb.collection("promo_usage").data.length).toBe(1);

    await expect(
      service.validateAndApplyPromoCode("USER_LIMIT", userId, 100, "all")
    ).rejects.toThrow(/already used/);
  });

  test("REQ 7: Logic - Minimum Order Amount", async () => {
    await seedPromo({ code: "MIN_ORDER", minOrderAmount: 50 });

    await expect(
      service.validateAndApplyPromoCode("MIN_ORDER", new ObjectId(), 40, "all")
    ).rejects.toThrow(/Minimum order amount/);
  });

  test("REQ 5: Returns correct response object", async () => {
    await seedPromo({
      code: "RES_TEST",
      discountType: "percentage",
      discountValue: 10,
    });

    const res = await service.validateAndApplyPromoCode(
      "RES_TEST",
      new ObjectId(),
      100,
      "all"
    );

    expect(res).toMatchObject({
      success: true,
      promoCode: "RES_TEST",
      discountType: "percentage",
      discountValue: 10,
      discountAmount: 10,
      finalAmount: 90,
    });
  });
});
