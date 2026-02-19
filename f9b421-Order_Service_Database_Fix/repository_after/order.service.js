const mysql = require("mysql2/promise");

class OrderService {
  constructor(pool) {
    this.pool = pool;
  }

  // Solves N+1 problem. Fetches all data in one query and maps it.
  async getOrdersWithItems(userId) {
    const query = `
      SELECT o.id as order_id, o.user_id, o.status, o.created_at,
             oi.id as item_id, oi.product_id, oi.quantity, oi.price
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = ?
    `;

    const [rows] = await this.pool.query(query, [userId]);

    const ordersMap = new Map();

    for (const row of rows) {
      if (!ordersMap.has(row.order_id)) {
        ordersMap.set(row.order_id, {
          id: row.order_id,
          user_id: row.user_id,
          status: row.status,
          created_at: row.created_at,
          items: [],
        });
      }

      if (row.item_id) {
        ordersMap.get(row.order_id).items.push({
          id: row.item_id,
          order_id: row.order_id,
          product_id: row.product_id,
          quantity: row.quantity,
          price: row.price,
        });
      }
    }

    return Array.from(ordersMap.values());
  }

  // Prevents SQL Injection on sortBy
  async searchOrders(status, sortBy) {
    const validSortColumns = ["created_at", "id", "total_amount", "status"];
    const safeSortBy = validSortColumns.includes(sortBy)
      ? sortBy
      : "created_at";

    // Use parameterized query for status
    const query = `SELECT * FROM orders WHERE status = ? ORDER BY ${safeSortBy}`;
    const [orders] = await this.pool.query(query, [status]);
    return orders;
  }

  // Uses Transaction & Atomic Stock Updates
  async createOrder(userId, items) {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const [orderResult] = await connection.query(
        "INSERT INTO orders (user_id, status, created_at) VALUES (?, ?, NOW())",
        [userId, "pending"]
      );
      const orderId = orderResult.insertId;

      for (const item of items) {
        // Atomic update: only update if stock is sufficient
        const [updateResult] = await connection.query(
          "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
          [item.quantity, item.productId, item.quantity]
        );

        if (updateResult.affectedRows === 0) {
          throw new Error(`Product ${item.productId} out of stock`);
        }

        await connection.query(
          "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
          [orderId, item.productId, item.quantity, item.price]
        );
      }

      await connection.commit();
      return { orderId, status: "pending" };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Atomic update + Single Query
  async reserveStock(productId, quantity) {
    const [result] = await this.pool.query(
      "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
      [quantity, productId, quantity]
    );
    return result.affectedRows > 0;
  }

  // Connection Leak (Removed explicit getConnection, pool.query handles release)
  async getOrderStats() {
    const [stats] = await this.pool.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(total_amount) as revenue,
        AVG(total_amount) as avg_order
      FROM orders
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    return stats[0];
  }

  async getAllOrders(status) {
    let query = "SELECT * FROM orders";
    const params = [];

    if (status) {
      query += " WHERE status = ?";
      params.push(status);
    }

    const [orders] = await this.pool.query(query, params);
    return orders;
  }

  async updateOrderStatus(orderId, newStatus) {
    const [result] = await this.pool.query(
      "UPDATE orders SET status = ? WHERE id = ?",
      [newStatus, orderId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = OrderService;
