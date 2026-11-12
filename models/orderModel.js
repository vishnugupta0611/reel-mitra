const db = require("../config/db");

const OrderModel = {
  /**
   * Create a new project request / order with pre-calculated commission & split
   */
  async create({
    clientId,
    editorId,
    categoryId,
    title,
    brief,
    requestedDeadline,
    amount,
    commissionPercent = 20.0,
    platformFee,
    editorAmount,
    currency = "INR",
    revisionLimit = 0,
  }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const orderQuery = `
        INSERT INTO orders (
          client_id, editor_id, category_id, title, brief,
          requested_deadline, budget, agreed_price, amount,
          commission_percent, platform_fee, editor_amount,
          currency, revision_limit, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $7, $8, $9, $10, $11, $12, 'pending')
        RETURNING *;
      `;
      const orderValues = [
        clientId,
        editorId,
        categoryId,
        title,
        brief,
        requestedDeadline,
        amount,
        commissionPercent,
        platformFee,
        editorAmount,
        currency,
        revisionLimit,
      ];
      const { rows: orderRows } = await client.query(orderQuery, orderValues);
      const newOrder = orderRows[0];

      const historyQuery = `
        INSERT INTO order_status_history (
          order_id, changed_by, old_status, new_status, note
        ) VALUES ($1, $2, NULL, 'pending', 'Order created by client and submitted to editor.');
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
        ep.user_id AS editor_user_id,
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
   * Find orders for a user (as client or editor), optionally filtered by status
   */
  async findByUser(userId, role, status = null) {
    const params = [userId];
    let statusFilter = "";
    if (status) {
      statusFilter = " AND o.status = $2";
      params.push(status);
    }

    let query = "";
    if (role === "editor") {
      query = `
        SELECT o.*, c.first_name AS client_first_name, c.last_name AS client_last_name, cat.name AS category_name
        FROM orders o
        JOIN users c ON o.client_id = c.id
        JOIN categories cat ON o.category_id = cat.id
        JOIN editor_profiles ep ON o.editor_id = ep.id
        WHERE ep.user_id = $1${statusFilter}
        ORDER BY o.created_at DESC;
      `;
    } else {
      query = `
        SELECT o.*, ep.display_name AS editor_name, cat.name AS category_name
        FROM orders o
        JOIN editor_profiles ep ON o.editor_id = ep.id
        JOIN categories cat ON o.category_id = cat.id
        WHERE o.client_id = $1${statusFilter}
        ORDER BY o.created_at DESC;
      `;
    }

    const { rows } = await db.query(query, params);
    return rows;
  },

  /**
   * Atomic Order Status Transition with History
   */
  async updateStatus({ orderId, changedBy, newStatus, note = null, timestampCol = null }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: current } = await client.query(
        "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
        [orderId]
      );
      if (!current.length) throw new Error("Order not found");
      const oldStatus = current[0].status;

      let updateSql = "UPDATE orders SET status = $1";
      const params = [newStatus];
      let pIdx = 2;

      if (
        timestampCol &&
        ["accepted_at", "payment_confirmed_at", "approved_at", "completed_at", "cancelled_at"].includes(timestampCol)
      ) {
        updateSql += `, ${timestampCol} = CURRENT_TIMESTAMP`;
      }

      updateSql += ` WHERE id = $${pIdx} RETURNING *;`;
      params.push(orderId);

      const { rows: updatedRows } = await client.query(updateSql, params);

      await client.query(
        `INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note)
         VALUES ($1, $2, $3, $4, $5);`,
        [orderId, changedBy, oldStatus, newStatus, note]
      );

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
   * Request revision on preview_ready order (increments revisions_used)
   */
  async requestRevision({ orderId, changedBy, note }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        "SELECT status, revision_limit, revisions_used FROM orders WHERE id = $1 FOR UPDATE",
        [orderId]
      );
      if (!rows.length) throw new Error("Order not found");

      const current = rows[0];
      if (current.revision_limit > 0 && current.revisions_used >= current.revision_limit) {
        const err = new Error("Revision limit reached for this order");
        err.statusCode = 400;
        throw err;
      }

      const { rows: updated } = await client.query(
        `UPDATE orders
         SET status = 'revision_requested', revisions_used = revisions_used + 1
         WHERE id = $1
         RETURNING *;`,
        [orderId]
      );

      await client.query(
        `INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note)
         VALUES ($1, $2, $3, 'revision_requested', $4);`,
        [orderId, changedBy, current.status, note || "Client requested a revision."]
      );

      await client.query("COMMIT");
      return updated[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Mark order completed and unlock editor_earnings from pending -> available
   */
  async completeOrder({ orderId, changedBy, note }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        "SELECT status FROM orders WHERE id = $1 FOR UPDATE",
        [orderId]
      );
      if (!rows.length) throw new Error("Order not found");
      const oldStatus = rows[0].status;

      const { rows: updated } = await client.query(
        `UPDATE orders
         SET status = 'completed', approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP), completed_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *;`,
        [orderId]
      );

      await client.query(
        `INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note)
         VALUES ($1, $2, $3, 'completed', $4);`,
        [orderId, changedBy, oldStatus, note || "Client approved deliverable and completed the order."]
      );

      await client.query(
        `UPDATE editor_earnings
         SET status = 'available'
         WHERE order_id = $1 AND status = 'pending';`,
        [orderId]
      );

      await client.query("COMMIT");
      return updated[0];
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
  },
};

module.exports = OrderModel;
