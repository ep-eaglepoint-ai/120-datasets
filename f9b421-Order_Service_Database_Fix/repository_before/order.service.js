const mysql = require("mysql2/promise");

class OrderService {
  constructor(pool) {
    this.pool = pool;
  }

  async getOrdersWithItems(userId) {
    const [orders] = await this.pool.query(
      "SELECT * FROM orders WHERE user_id = ?",
      [userId]
    );

    for (const order of orders) {
      const [items] = await this.pool.query(
        "SELECT * FROM order_items WHERE order_id = ?",
        [order.id]
      );
      order.items = items;
    }

    return orders;
  }

  async searchOrders(status, sortBy) {
    const query = `SELECT * FROM orders WHERE status = '${status}' ORDER BY ${sortBy}`;
    const [orders] = await this.pool.query(query);
    return orders;
  }

  async createOrder(userId, items) {
    const [orderResult] = await this.pool.query(
      "INSERT INTO orders (user_id, status, created_at) VALUES (?, ?, NOW())",
      [userId, "pending"]
    );
    const orderId = orderResult.insertId;

    for (const item of items) {
      await this.pool.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
        [orderId, item.productId, item.quantity, item.price]
      );

      await this.pool.query(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [item.quantity, item.productId]
      );
    }

    return { orderId, status: "pending" };
  }

  async reserveStock(productId, quantity) {
    const [rows] = await this.pool.query(
      "SELECT stock FROM products WHERE id = ?",
      [productId]
    );

    if (rows.length === 0) {
      throw new Error("Product not found");
    }

    if (rows[0].stock >= quantity) {
      await this.pool.query(
        "UPDATE products SET stock = stock - ? WHERE id = ?",
        [quantity, productId]
      );
      return true;
    }

    return false;
  }

  async getOrderStats() {
    const connection = await this.pool.getConnection();
    const [stats] = await connection.query(`
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
    if (status) {
      query += ` WHERE status = '${status}'`;
    }
    const [orders] = await this.pool.query(query);
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
