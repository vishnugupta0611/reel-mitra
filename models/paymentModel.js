const db = require("../config/db");

const PaymentModel = {
  /**
   * Record a payment transaction
   */
  async create({
    orderId,
    payerId,
    amount,
    currency = "INR",
    platformFee = 0.00,
    editorAmount = 0.00,
    gatewayReference = null,
    status = "pending",
  }) {
    const query = `
      INSERT INTO payments (
        order_id, payer_id, amount, currency, platform_fee,
        editor_amount, gateway_reference, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      orderId,
      payerId,
      amount,
      currency,
      platformFee,
      editorAmount,
      gatewayReference,
      status,
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  /**
   * Update payment status (e.g. upon payment gateway webhook confirmation)
   */
  async updateStatus(id, { status, paidAt = null }) {
    const query = `
      UPDATE payments
      SET status = $1, paid_at = COALESCE($2, paid_at)
      WHERE id = $3
      RETURNING *;
    `;
    const { rows } = await db.query(query, [status, paidAt, id]);
    return rows[0] || null;
  },

  /**
   * Find payment by order ID
   */
  async findByOrderId(orderId) {
    const query = `
      SELECT p.*, u.first_name, u.last_name, u.email
      FROM payments p
      JOIN users u ON p.payer_id = u.id
      WHERE p.order_id = $1
      ORDER BY p.created_at DESC;
    `;
    const { rows } = await db.query(query, [orderId]);
    return rows;
  }
};

module.exports = PaymentModel;
