const db = require("../config/db");

const OrderModel = {
  /**
   * Create a new project request / order
   */
  async create({
    clientId,
    editorId,
    categoryId,
    title,
    brief,
    requestedDeadline,
    budget = null,
    currency = "INR",
    revisionLimit = 0,
  }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Insert Order
      const orderQuery = `
        INSERT INTO orders (
          client_id, editor_id, category_id, title, brief,
          requested_deadline, budget, currency, revision_limit, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_editor_review')
        RETURNING *;
      `;
      const orderValues = [
        clientId,
        editorId,
        categoryId,
        title,
        brief,
        requestedDeadline,
        budget,
        currency,
        revisionLimit,
      ];
      const { rows: orderRows } = await client.query(orderQuery, orderValues);
      const newOrder = orderRows[0];

      // 2. Insert initial timeline entry into order_status_history
      const historyQuery = `
        INSERT INTO order_status_history (
          order_id, changed_by, old_status, new_status, note
        ) VALUES ($1, $2, NULL, 'pending_editor_review', 'Order created by client and submitted to editor.');
      `;
      await client.query(historyQuery, [newOrder.id, clientId]);

      await client.query("COMMIT");
      return newOrder;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Find order by ID with client, editor, and category details
   */
  async findById(id) {
    const query = `
      SELECT 
        o.*,
        c.first_name AS client_first_name,
        c.last_name AS client_last_name,
        c.email AS client_email,
        ep.display_name AS editor_name,
        cat.name AS category_name
      FROM orders o
      JOIN users c ON o.client_id = c.id
      JOIN editor_profiles ep ON o.editor_id = ep.id
      JOIN categories cat ON o.category_id = cat.id
      WHERE o.id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Find orders for a user (as client or editor)
   */
  async findByUser(userId, role) {
    let query = "";
    if (role === "editor") {
      query = `
        SELECT o.*, c.first_name AS client_first_name, c.last_name AS client_last_name, cat.name AS category_name
        FROM orders o
        JOIN users c ON o.client_id = c.id
        JOIN categories cat ON o.category_id = cat.id
        JOIN editor_profiles ep ON o.editor_id = ep.id
        WHERE ep.user_id = $1
        ORDER BY o.created_at DESC;
      `;
    } else {
      // client
      query = `
        SELECT o.*, ep.display_name AS editor_name, cat.name AS category_name
        FROM orders o
        JOIN editor_profiles ep ON o.editor_id = ep.id
        JOIN categories cat ON o.category_id = cat.id
        WHERE o.client_id = $1
        ORDER BY o.created_at DESC;
      `;
    }
    const { rows } = await db.query(query, [userId]);
    return rows;
  },

  /**
   * Atomic Order Status Transition with History
   */
  async updateStatus({ orderId, changedBy, newStatus, note = null, timestampCol = null }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // Check current status
      const { rows: current } = await client.query(
        "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
        [orderId]
      );
      if (!current.length) throw new Error("Order not found");
      const oldStatus = current[0].status;

      // Update orders table
      let updateSql = "UPDATE orders SET status = $1";
      const params = [newStatus];
      let pIdx = 2;

      // Optionally set status timestamp (accepted_at, payment_confirmed_at, approved_at, completed_at, cancelled_at)
      if (timestampCol && ["accepted_at", "payment_confirmed_at", "approved_at", "completed_at", "cancelled_at"].includes(timestampCol)) {
        updateSql += `, ${timestampCol} = CURRENT_TIMESTAMP`;
      }

      updateSql += ` WHERE id = $${pIdx} RETURNING *;`;
      params.push(orderId);

      const { rows: updatedRows } = await client.query(updateSql, params);

      // Record in order_status_history
      const historySql = `
        INSERT INTO order_status_history (
          order_id, changed_by, old_status, new_status, note
        ) VALUES ($1, $2, $3, $4, $5);
      `;
      await client.query(historySql, [orderId, changedBy, oldStatus, newStatus, note]);

      await client.query("COMMIT");
      return updatedRows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get status history timeline for an order
   */
  async getTimeline(orderId) {
    const query = `
      SELECT 
        osh.*,
        u.first_name AS changed_by_first_name,
        u.last_name AS changed_by_last_name,
        u.role AS changed_by_role
      FROM order_status_history osh
      JOIN users u ON osh.changed_by = u.id
      WHERE osh.order_id = $1
      ORDER BY osh.created_at ASC;
    `;
    const { rows } = await db.query(query, [orderId]);
    return rows;
  }
};

module.exports = OrderModel;
