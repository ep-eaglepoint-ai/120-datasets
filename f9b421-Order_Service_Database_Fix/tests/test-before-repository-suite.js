const OrderService = require("../repository_before/order.service");

const assert = require("assert");
const { performance } = require("perf_hooks");

// MOCK DATABASE ---
class MockPool {
  constructor() {
    this.data = {
      orders: [],
      order_items: [],
      products: Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        stock: 50,
      })),
    };
    this.activeConnections = 0;
    this.maxConnections = 10;
  }

  async _delay() {
    return new Promise((resolve) => setTimeout(resolve, 1));
  }

  async _execute(sql, params, transactionContext) {
    await this._delay();

    // -- 1. SELECT JOIN (Optimized Code) --
    if (sql.includes("LEFT JOIN order_items")) {
      const userId = params[0];
      const userOrders = this.data.orders.filter((o) => o.user_id === userId);
      const rows = [];
      for (const o of userOrders) {
        const items = this.data.order_items.filter((i) => i.order_id === o.id);
        if (items.length === 0) {
          rows.push({
            order_id: o.id,
            user_id: o.user_id,
            status: o.status,
            created_at: o.created_at,
            item_id: null,
          });
        }
        for (const i of items) {
          rows.push({
            order_id: o.id,
            user_id: o.user_id,
            status: o.status,
            created_at: o.created_at,
            item_id: i.id,
            product_id: i.product_id,
            quantity: i.quantity,
            price: i.price,
          });
        }
      }
      return [rows];
    }

    // -- SELECT ITEMS BY ORDER ID (Unoptimized Code support) --
    // This was missing, causing "Incorrect item count" in the old code
    if (sql.includes("FROM order_items WHERE order_id =")) {
      const orderId = params[0];
      const items = this.data.order_items.filter((i) => i.order_id === orderId);
      return [items];
    }

    // -- INSERT ORDER --
    if (sql.startsWith("INSERT INTO orders")) {
      const id = this.data.orders.length + 1;
      const newOrder = {
        id,
        user_id: params[0],
        status: params[1],
        created_at: new Date(),
      };
      this.data.orders.push(newOrder);
      if (transactionContext) {
        transactionContext.undoStack.push(() => {
          const idx = this.data.orders.indexOf(newOrder);
          if (idx > -1) this.data.orders.splice(idx, 1);
        });
      }
      return [{ insertId: id }];
    }

    // -- INSERT ITEM --
    if (sql.startsWith("INSERT INTO order_items")) {
      const newItem = {
        id: this.data.order_items.length + 1,
        order_id: params[0],
        product_id: params[1],
        quantity: params[2],
        price: params[3],
      };
      this.data.order_items.push(newItem);
      if (transactionContext) {
        transactionContext.undoStack.push(() => {
          const idx = this.data.order_items.indexOf(newItem);
          if (idx > -1) this.data.order_items.splice(idx, 1);
        });
      }
      return [{ affectedRows: 1 }];
    }

    // -- UPDATE STOCK --
    if (sql.startsWith("UPDATE products SET stock")) {
      // Handle both atomic (optimized) and standard (unoptimized) updates
      let qty, pid;

      const matchAtomic = sql.match(/stock - \? WHERE id = \? AND stock >= \?/);

      if (matchAtomic) {
        qty = params[0];
        pid = params[1];
      } else {
        // Unoptimized: UPDATE products SET stock = stock - ? WHERE id = ?
        qty = params[0];
        pid = params[1];
      }

      const prod = this.data.products.find((p) => p.id === pid);

      // We enforce strict stock rules in the Mock to catch race conditions
      if (prod && prod.stock >= qty) {
        prod.stock -= qty;
        if (transactionContext) {
          transactionContext.undoStack.push(() => {
            prod.stock += qty;
          });
        }
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    }

    // -- SELECT ALL / SEARCH --
    if (sql.startsWith("SELECT * FROM orders")) {
      if (sql.includes("WHERE status =")) {
        // Handle parameterized (Fixed) vs String Interp (Bad)
        let status = params[0];
        if (!status) {
          const match = sql.match(/status = '(\w+)'/);
          if (match) status = match[1];
        }
        if (status)
          return [this.data.orders.filter((o) => o.status === status)];
      }
      return [[...this.data.orders]];
    }

    // --  SELECT STOCK (for check) --
    if (sql.includes("SELECT stock FROM products")) {
      const pid = params[0];
      const prod = this.data.products.find((p) => p.id === pid);
      return [[prod ? { stock: prod.stock } : null]];
    }

    // -- STATS --
    if (sql.includes("COUNT(*)")) {
      return [
        [{ total_orders: this.data.orders.length, revenue: 0, avg_order: 0 }],
      ];
    }

    // --  UPDATE STATUS --
    if (sql.startsWith("UPDATE orders SET status")) {
      return [{ affectedRows: 1 }];
    }

    return [[]];
  }

  async query(sql, params = []) {
    return this._execute(sql, params, null);
  }

  async getConnection() {
    this.activeConnections++;
    return new MockConnection(this);
  }
}

class MockConnection {
  constructor(pool) {
    this.pool = pool;
    this.inTransaction = false;
    this.undoStack = [];
  }

  async query(sql, params = []) {
    return this.pool._execute(sql, params, this.inTransaction ? this : null);
  }

  async beginTransaction() {
    this.inTransaction = true;
    this.undoStack = [];
  }

  async commit() {
    this.inTransaction = false;
    this.undoStack = [];
  }

  async rollback() {
    if (this.inTransaction) {
      while (this.undoStack.length > 0) {
        const undoFn = this.undoStack.pop();
        undoFn();
      }
      this.inTransaction = false;
    }
  }

  release() {
    this.pool.activeConnections--;
  }
}

// --- 2. TEST RUNNER HELPERS ---

async function assertPerformance(maxMs, fn) {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;

  if (duration > maxMs) {
    throw new Error(
      `Time limit exceeded! Took ${duration.toFixed(2)}ms (Limit: ${maxMs}ms)`
    );
  }
  return result;
}

// Helper to run a single test safely without crashing the whole suite
async function runTest(name, testFn) {
  process.stdout.write(name + " ... ");
  try {
    await testFn();
    console.log("✅ PASS");
    return true;
  } catch (error) {
    console.log("❌ FAIL");
    console.error(`   └─Reason: ${error.message}`);
    return false;
  }
}

// --- 3. TEST SCENARIOS ---

async function runTests() {
  const mockPool = new MockPool();
  const service = new OrderService(mockPool);
  let passedCount = 0;
  let totalTests = 0;

  // --- Scenario 1: Performance (N+1 Check) ---
  totalTests++;
  const s1 = await runTest("1. User with 50 orders (N+1 check)", async () => {
    // Setup Data
    mockPool.data.orders = [];
    mockPool.data.order_items = [];
    for (let i = 0; i < 50; i++) {
      mockPool.data.orders.push({
        id: 100 + i,
        user_id: 1,
        status: "completed",
        created_at: new Date(),
      });
      for (let j = 0; j < 10; j++) {
        mockPool.data.order_items.push({
          id: 1000 + i * 10 + j,
          order_id: 100 + i,
          product_id: 1,
          quantity: 1,
          price: 10,
        });
      }
    }

    await assertPerformance(200, async () => {
      const orders = await service.getOrdersWithItems(1);
      if (orders.length !== 50)
        throw new Error(`Expected 50 orders, got ${orders.length}`);
      // Check first order items to ensure data integrity
      if (!orders[0].items || orders[0].items.length !== 10)
        throw new Error(
          `Expected 10 items per order, got ${
            orders[0].items ? orders[0].items.length : 0
          }`
        );
    });
  });
  if (s1) passedCount++;

  // --- Scenario 2: Search & Security ---
  totalTests++;
  const s2 = await runTest("2. Search Security (SQL Inj)", async () => {
    await assertPerformance(200, async () => {
      await service.searchOrders("completed", "total_amount");
      await service.searchOrders("completed", "hack; DROP TABLE orders");
    });
  });
  if (s2) passedCount++;

  // --- Scenario 3: Partial Rollback ---
  totalTests++;
  const s3 = await runTest("3. Partial Rollback (Transaction)", async () => {
    const p1 = mockPool.data.products[0];
    const p2 = mockPool.data.products[1];
    p1.stock = 50;
    p2.stock = 0; // Will fail
    const initialOrders = mockPool.data.orders.length;

    try {
      await service.createOrder(999, [
        { productId: p1.id, quantity: 1, price: 100 },
        { productId: p2.id, quantity: 1, price: 100 },
      ]);
      throw new Error("Order creation should have failed but didn't");
    } catch (e) {
      if (e.message === "Order creation should have failed but didn't") throw e;
    }

    if (p1.stock !== 50)
      throw new Error(
        `Stock mismatch. Expected 50, got ${p1.stock} (Rollback failed)`
      );
    if (mockPool.data.orders.length !== initialOrders)
      throw new Error("Order was inserted despite failure");
  });
  if (s3) passedCount++;

  // --- Scenario 4: Concurrency ---
  totalTests++;
  const s4 = await runTest(
    "4. Concurrency (100 users / 50 items)",
    async () => {
      const targetP = mockPool.data.products[2];
      targetP.stock = 50;
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(
          service
            .createOrder(i, [{ productId: targetP.id, quantity: 1, price: 10 }])
            .catch(() => "FAIL")
        );
      }
      const results = await Promise.all(promises);
      const success = results.filter((r) => r !== "FAIL").length;

      if (success !== 50)
        throw new Error(`Race condition! Success: ${success} (Expected 50)`);
      if (targetP.stock !== 0)
        throw new Error(`Stock mismatch! Stock: ${targetP.stock} (Expected 0)`);
    }
  );
  if (s4) passedCount++;

  // --- Scenario 5: Connection Leaks ---
  totalTests++;
  const s5 = await runTest("5. Connection Leaks (500 Reports)", async () => {
    const startConns = mockPool.activeConnections;
    // Relaxed time for reports, focusing on leaks
    for (let i = 0; i < 500; i++) {
      await service.getOrderStats();
    }
    if (mockPool.activeConnections !== startConns) {
      throw new Error(
        `Leaked ${mockPool.activeConnections - startConns} connections!`
      );
    }
  });
  if (s5) passedCount++;

  // --- Scenario 6: Large Dataset ---
  totalTests++;
  const s6 = await runTest("6. Large Dataset (50k Orders)", async () => {
    mockPool.data.orders = Array.from({ length: 50000 }, (_, i) => ({
      id: i,
      user_id: 1,
      status: "pending",
      total_amount: 100,
      created_at: new Date(),
    }));

    await assertPerformance(200, async () => {
      const result = await service.getAllOrders();
      if (result.length !== 50000) throw new Error("Data size mismatch");
    });
  });
  if (s6) passedCount++;

  // --- Summary ---
  console.log("\n---------------------------");
  console.log(`TEST SUMMARY: ${passedCount}/${totalTests} Passed`);

  if (passedCount < totalTests) {
    console.log("❌ OVERALL STATUS: FAILED");
    process.exit(1);
  } else {
    console.log("✅ OVERALL STATUS: PASSED");
    process.exit(0);
  }
}

runTests();
