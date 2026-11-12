const db = require("../config/db");

const PaymentModel = {
  /**
   * Record a Razorpay order/payment attempt
   */
  async create({
    orderId,
    payerId,
    razorpayOrderId = null,
    amount,
    currency = "INR",
    platformFee = 0.0,
    editorAmount = 0.0,
    status = "created",
  }) {
    const query = `
      INSERT INTO payments (
        order_id, payer_id, razorpay_order_id, amount, currency,
        platform_fee, editor_amount, gateway_reference, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $3, $8)
      RETURNING *;
    `;
    const values = [orderId, payerId, razorpayOrderId, amount, currency, platformFee, editorAmount, status];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  async findByRazorpayOrderId(razorpayOrderId) {
    const { rows } = await db.query("SELECT * FROM payments WHERE razorpay_order_id = $1;", [
      razorpayOrderId,
    ]);
    return rows[0] || null;
  },

  async findCapturedByOrderId(orderId) {
    const { rows } = await db.query(
      "SELECT * FROM payments WHERE order_id = $1 AND status IN ('captured', 'succeeded') ORDER BY paid_at DESC LIMIT 1;",
      [orderId]
    );
    return rows[0] || null;
  },

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
  },

  /**
   * Atomically mark payment captured, update order to in_progress, and record editor_earnings
   * using the commission amounts already saved on the order.
   */
  async markCapturedAndCreateEarning({
    razorpayOrderId,
    razorpayPaymentId,
    paymentMethod = null,
    paidAt = null,
  }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: paymentRows } = await client.query(
        "SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE;",
        [razorpayOrderId]
      );
      if (!paymentRows.length) {
        const err = new Error("Payment record not found for razorpay_order_id");
        err.statusCode = 404;
        throw err;
      }

      const existingPayment = paymentRows[0];
      if (existingPayment.status === "captured") {
        const { rows: existingEarning } = await client.query(
          "SELECT * FROM editor_earnings WHERE order_id = $1;",
          [existingPayment.order_id]
        );
        await client.query("COMMIT");
        return {
          payment: existingPayment,
          earning: existingEarning[0] || null,
          alreadyCaptured: true,
        };
      }

      const { rows: updatedPaymentRows } = await client.query(
        `UPDATE payments
         SET status = 'captured',
             razorpay_payment_id = $1,
             gateway_reference = $1,
             payment_method = COALESCE($2, payment_method),
             paid_at = COALESCE($3, CURRENT_TIMESTAMP)
         WHERE id = $4
         RETURNING *;`,
        [razorpayPaymentId, paymentMethod, paidAt, existingPayment.id]
      );
      const updatedPayment = updatedPaymentRows[0];

      // Lock order and fetch pre-saved commission values
      const { rows: orderRows } = await client.query(
        "SELECT * FROM orders WHERE id = $1 FOR UPDATE;",
        [updatedPayment.order_id]
      );
      const order = orderRows[0];

      if (["pending", "pending_editor_review", "accepted", "payment_pending"].includes(order.status)) {
        await client.query(
          `UPDATE orders
           SET status = 'in_progress', payment_confirmed_at = CURRENT_TIMESTAMP
           WHERE id = $1;`,
          [order.id]
        );
        await client.query(
          `INSERT INTO order_status_history (order_id, changed_by, old_status, new_status, note)
           VALUES ($1, $2, $3, 'in_progress', 'Payment captured and verified via Razorpay.');`,
          [order.id, order.client_id, order.status]
        );
      }

      const grossAmount = order.amount || order.agreed_price || updatedPayment.amount;
      const platformFee = order.platform_fee || updatedPayment.platform_fee || 0;
      const editorAmount = order.editor_amount || updatedPayment.editor_amount || grossAmount;

      const { rows: earningRows } = await client.query(
        `INSERT INTO editor_earnings (
           order_id, editor_id, gross_amount, platform_fee, editor_amount, status
         ) VALUES ($1, $2, $3, $4, $5, 'pending')
         ON CONFLICT (order_id) DO NOTHING
         RETURNING *;`,
        [order.id, order.editor_id, grossAmount, platformFee, editorAmount]
      );

      let earning = earningRows[0];
      if (!earning) {
        const resEarning = await client.query("SELECT * FROM editor_earnings WHERE order_id = $1;", [
          order.id,
        ]);
        earning = resEarning.rows[0];
      }

      await client.query("COMMIT");
      return { payment: updatedPayment, earning, alreadyCaptured: false };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async markFailed({ razorpayOrderId, razorpayPaymentId = null }) {
    const query = `
      UPDATE payments
      SET status = 'failed',
          razorpay_payment_id = COALESCE($2, razorpay_payment_id)
      WHERE razorpay_order_id = $1 AND status NOT IN ('captured', 'refunded')
      RETURNING *;
    `;
    const { rows } = await db.query(query, [razorpayOrderId, razorpayPaymentId]);
    return rows[0] || null;
  },

  async markRefunded({ razorpayPaymentId }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `UPDATE payments
         SET status = 'refunded'
         WHERE razorpay_payment_id = $1
         RETURNING *;`,
        [razorpayPaymentId]
      );

      if (rows[0]) {
        await client.query(
          `UPDATE editor_earnings
           SET status = 'cancelled'
           WHERE order_id = $1 AND status = 'pending';`,
          [rows[0].order_id]
        );
      }

      await client.query("COMMIT");
      return rows[0] || null;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = PaymentModel;
