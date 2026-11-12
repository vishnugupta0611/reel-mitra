const db = require("../config/db");

const VALID_PAYOUT_STATUSES = [
  "queued",
  "pending",
  "processing",
  "processed",
  "failed",
  "reversed",
  "rejected",
];

function normalizePayoutStatus(rawStatus) {
  if (VALID_PAYOUT_STATUSES.includes(rawStatus)) return rawStatus;
  if (rawStatus === "cancelled") return "failed";
  return "queued";
}

const PayoutModel = {
  /**
   * Atomically lock editor wallet, validate verified fund account & balance, and reserve payout amount
   */
  async reserveForWithdrawal({
    editorId,
    payoutAccountId,
    amount,
    currency = "INR",
    mode,
    minWithdrawalAmount,
  }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // Serialize concurrent withdrawal attempts for this editor
      const { rows: editorRows } = await client.query(
        "SELECT id FROM editor_profiles WHERE id = $1 FOR UPDATE;",
        [editorId]
      );
      if (!editorRows.length) {
        const err = new Error("Editor profile not found");
        err.statusCode = 404;
        throw err;
      }

      const { rows: accountRows } = await client.query(
        "SELECT * FROM editor_payout_accounts WHERE id = $1 AND editor_id = $2 FOR UPDATE;",
        [payoutAccountId, editorId]
      );
      if (!accountRows.length) {
        const err = new Error("Payout account not found");
        err.statusCode = 404;
        throw err;
      }

      const account = accountRows[0];
      if (account.account_status !== "verified") {
        const err = new Error(
          `Payout account must be verified before withdrawing (current status: '${account.account_status}')`
        );
        err.statusCode = 400;
        throw err;
      }

      const requestedMode = String(
        mode || (account.account_type === "vpa" ? "UPI" : "IMPS")
      ).toUpperCase();

      if (account.account_type === "vpa" && requestedMode !== "UPI") {
        const err = new Error("UPI/VPA payout accounts only support mode 'UPI'");
        err.statusCode = 400;
        throw err;
      }

      if (
        account.account_type === "bank_account" &&
        !["IMPS", "NEFT", "RTGS"].includes(requestedMode)
      ) {
        const err = new Error("Bank payout accounts must use 'IMPS', 'NEFT', or 'RTGS' mode");
        err.statusCode = 400;
        throw err;
      }

      const requestedPaise = Math.round(Number(amount) * 100);
      const minPaise = Math.round(Number(minWithdrawalAmount) * 100);
      if (!Number.isFinite(requestedPaise) || requestedPaise < minPaise) {
        const err = new Error(`Minimum withdrawal amount is ₹${Number(minWithdrawalAmount).toFixed(2)}`);
        err.statusCode = 400;
        throw err;
      }

      // Compute exact available balance inside editor lock
      const balRes = await client.query(
        `SELECT
           COALESCE((SELECT SUM(editor_amount) FROM editor_earnings WHERE editor_id = $1 AND status = 'available'), 0.00) AS unlocked_amount,
           COALESCE((SELECT SUM(amount) FROM payouts WHERE editor_id = $1 AND status IN ('queued', 'pending', 'processing', 'processed')), 0.00) AS allocated_amount;`,
        [editorId]
      );

      const unlockedPaise = Math.round(Number(balRes.rows[0].unlocked_amount) * 100);
      const allocatedPaise = Math.round(Number(balRes.rows[0].allocated_amount) * 100);
      const availablePaise = Math.max(0, unlockedPaise - allocatedPaise);

      if (requestedPaise > availablePaise) {
        const err = new Error(
          `Insufficient available balance. Available: ₹${(availablePaise / 100).toFixed(2)}`
        );
        err.statusCode = 400;
        throw err;
      }

      const cleanAmount = (requestedPaise / 100).toFixed(2);
      const { rows: inserted } = await client.query(
        `INSERT INTO payouts (editor_id, payout_account_id, amount, currency, mode, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *;`,
        [editorId, account.id, cleanAmount, currency, requestedMode]
      );

      await client.query("COMMIT");
      return { payout: inserted[0], payoutAccount: account };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async attachRazorpayPayout({ payoutId, razorpayPayoutId, status, utr = null, failureReason = null }) {
    const normalized = normalizePayoutStatus(status);
    const completedAt = normalized === "processed" ? new Date() : null;
    const { rows } = await db.query(
      `UPDATE payouts
       SET razorpay_payout_id = $1,
           status = $2,
           utr = COALESCE($3, utr),
           failure_reason = $4,
           completed_at = COALESCE(completed_at, $5)
       WHERE id = $6
       RETURNING *;`,
      [razorpayPayoutId, normalized, utr, failureReason, completedAt, payoutId]
    );
    return rows[0] || null;
  },

  /**
   * Release reserved balance when RazorpayX payout creation fails definitively
   */
  async markCreationFailed({ payoutId, failureReason }) {
    const { rows } = await db.query(
      `UPDATE payouts
       SET status = 'failed',
           failure_reason = $2
       WHERE id = $1 AND razorpay_payout_id IS NULL AND status IN ('pending', 'queued')
       RETURNING *;`,
      [payoutId, failureReason]
    );
    return rows[0] || null;
  },

  /**
   * Idempotent status transition (from RazorpayX webhook or sync API)
   */
  async applyStatusUpdate({
    id = null,
    razorpayPayoutId = null,
    fallbackId = null,
    status,
    utr = null,
    failureReason = null,
    completedAt = null,
  }) {
    const normalized = normalizePayoutStatus(status);
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      let rows;
      if (id) {
        ({ rows } = await client.query("SELECT * FROM payouts WHERE id = $1 FOR UPDATE;", [id]));
      } else {
        ({ rows } = await client.query(
          `SELECT * FROM payouts
           WHERE razorpay_payout_id = $1
              OR ($2::uuid IS NOT NULL AND id = $2::uuid)
           FOR UPDATE;`,
          [razorpayPayoutId, fallbackId]
        ));
      }

      if (!rows.length) {
        await client.query("COMMIT");
        return null;
      }

      const current = rows[0];

      // Preserve terminal failure/reversal states
      if (["failed", "rejected", "reversed"].includes(current.status)) {
        await client.query("COMMIT");
        return current;
      }

      // A processed payout can only transition to reversed (if beneficiary bank bounces)
      if (current.status === "processed" && normalized !== "reversed") {
        if (utr && !current.utr) {
          const { rows: patched } = await client.query(
            "UPDATE payouts SET utr = $1 WHERE id = $2 RETURNING *;",
            [utr, current.id]
          );
          await client.query("COMMIT");
          return patched[0];
        }
        await client.query("COMMIT");
        return current;
      }

      const nextCompletedAt =
        normalized === "processed" ? completedAt || current.completed_at || new Date() : current.completed_at;
      const nextFailureReason =
        ["failed", "reversed", "rejected"].includes(normalized) ? failureReason || current.failure_reason : null;

      const { rows: updated } = await client.query(
        `UPDATE payouts
         SET status = $1,
             utr = COALESCE($2, utr),
             failure_reason = $3,
             completed_at = $4
         WHERE id = $5
         RETURNING *;`,
        [normalized, utr, nextFailureReason, nextCompletedAt, current.id]
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

  async findById(id) {
    const { rows } = await db.query(
      `SELECT p.*, epa.account_type, epa.account_label
       FROM payouts p
       JOIN editor_payout_accounts epa ON p.payout_account_id = epa.id
       WHERE p.id = $1;`,
      [id]
    );
    return rows[0] || null;
  },

  async findByEditorId(editorId) {
    const { rows } = await db.query(
      `SELECT p.*, epa.account_type, epa.account_label
       FROM payouts p
       JOIN editor_payout_accounts epa ON p.payout_account_id = epa.id
       WHERE p.editor_id = $1
       ORDER BY p.created_at DESC;`,
      [editorId]
    );
    return rows;
  },
};

module.exports = PayoutModel;
