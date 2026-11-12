const db = require("../config/db");
const { getMinWithdrawalAmount } = require("../config/razorpay");

const EarningModel = {
  async findByOrderId(orderId) {
    const { rows } = await db.query("SELECT * FROM editor_earnings WHERE order_id = $1;", [orderId]);
    return rows[0] || null;
  },

  async getWalletSummary(editorId, client = db) {
    const query = `
      SELECT
        COALESCE((SELECT SUM(editor_amount) FROM editor_earnings WHERE editor_id = $1 AND status = 'pending'), 0.00) AS pending_amount,
        COALESCE((SELECT SUM(editor_amount) FROM editor_earnings WHERE editor_id = $1 AND status = 'available'), 0.00) AS unlocked_amount,
        COALESCE((SELECT SUM(amount) FROM payouts WHERE editor_id = $1 AND status IN ('queued', 'pending', 'processing')), 0.00) AS reserved_amount,
        COALESCE((SELECT SUM(amount) FROM payouts WHERE editor_id = $1 AND status = 'processed'), 0.00) AS withdrawn_amount;
    `;
    const { rows } = await client.query(query, [editorId]);
    const row = rows[0] || {};

    const pendingPaise = Math.round(Number(row.pending_amount || 0) * 100);
    const unlockedPaise = Math.round(Number(row.unlocked_amount || 0) * 100);
    const reservedPaise = Math.round(Number(row.reserved_amount || 0) * 100);
    const withdrawnPaise = Math.round(Number(row.withdrawn_amount || 0) * 100);

    const availablePaise = Math.max(0, unlockedPaise - reservedPaise - withdrawnPaise);
    const totalEarnedPaise = pendingPaise + unlockedPaise;

    return {
      total_earned: (totalEarnedPaise / 100).toFixed(2),
      pending_amount: (pendingPaise / 100).toFixed(2),
      available_balance: (availablePaise / 100).toFixed(2),
      reserved_amount: (reservedPaise / 100).toFixed(2),
      withdrawn_amount: (withdrawnPaise / 100).toFixed(2),
      minimum_withdrawal_amount: getMinWithdrawalAmount().toFixed(2),
    };
  },

  async findByEditorId(editorId) {
    const listQuery = `
      SELECT 
        ee.*,
        o.title AS order_title,
        o.status AS order_status
      FROM editor_earnings ee
      JOIN orders o ON ee.order_id = o.id
      WHERE ee.editor_id = $1
      ORDER BY ee.created_at DESC;
    `;

    const [listRes, summary] = await Promise.all([
      db.query(listQuery, [editorId]),
      EarningModel.getWalletSummary(editorId),
    ]);

    return {
      summary,
      items: listRes.rows,
    };
  },
};

module.exports = EarningModel;
