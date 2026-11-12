const db = require("../config/db");

const PayoutAccountModel = {
  async findLatestContactByEditorId(editorId) {
    const { rows } = await db.query(
      "SELECT razorpay_contact_id FROM editor_payout_accounts WHERE editor_id = $1 ORDER BY created_at ASC LIMIT 1;",
      [editorId]
    );
    return rows[0]?.razorpay_contact_id || null;
  },

  async findByEditorAndFundAccount(editorId, razorpayFundAccountId) {
    const { rows } = await db.query(
      "SELECT * FROM editor_payout_accounts WHERE editor_id = $1 AND razorpay_fund_account_id = $2;",
      [editorId, razorpayFundAccountId]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await db.query("SELECT * FROM editor_payout_accounts WHERE id = $1;", [id]);
    return rows[0] || null;
  },

  async findByEditorId(editorId) {
    const { rows } = await db.query(
      `SELECT * FROM editor_payout_accounts
       WHERE editor_id = $1 AND account_status <> 'inactive'
       ORDER BY created_at DESC;`,
      [editorId]
    );
    return rows;
  },

  async create({
    editorId,
    razorpayContactId,
    razorpayFundAccountId,
    accountType,
    accountStatus = "pending_verification",
    accountLabel = null,
    failureReason = null,
  }) {
    const { rows } = await db.query(
      `INSERT INTO editor_payout_accounts (
         editor_id, razorpay_contact_id, razorpay_fund_account_id,
         account_type, account_status, account_label, failure_reason
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [
        editorId,
        razorpayContactId,
        razorpayFundAccountId,
        accountType,
        accountStatus,
        accountLabel,
        failureReason,
      ]
    );
    return rows[0];
  },

  /**
   * Lock account row and transition to 'validating' to prevent duplicate validation requests
   */
  async beginValidation(id, editorId) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        "SELECT * FROM editor_payout_accounts WHERE id = $1 FOR UPDATE;",
        [id]
      );
      if (!rows.length) {
        const err = new Error("Payout account not found");
        err.statusCode = 404;
        throw err;
      }

      const account = rows[0];
      if (account.editor_id !== editorId) {
        const err = new Error("Unauthorized access to this payout account");
        err.statusCode = 403;
        throw err;
      }

      if (account.account_status === "verified") {
        const err = new Error("Payout account is already verified");
        err.statusCode = 409;
        throw err;
      }

      if (account.account_status === "validating") {
        const err = new Error("Validation is already in progress for this payout account");
        err.statusCode = 409;
        throw err;
      }

      if (account.account_status === "inactive") {
        const err = new Error("Cannot validate an inactive payout account");
        err.statusCode = 400;
        throw err;
      }

      const { rows: updated } = await client.query(
        `UPDATE editor_payout_accounts
         SET account_status = 'validating', failure_reason = NULL
         WHERE id = $1
         RETURNING *;`,
        [id]
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
   * Revert to pending_verification when RazorpayX validation API is unavailable (e.g., activation/IP not ready)
   */
  async markValidationUnavailable(id, reason) {
    const { rows } = await db.query(
      `UPDATE editor_payout_accounts
       SET account_status = 'pending_verification',
           failure_reason = $2
       WHERE id = $1 AND account_status <> 'verified'
       RETURNING *;`,
      [id, reason]
    );
    return rows[0] || null;
  },

  /**
   * Apply RazorpayX Fund Account Validation result.
   * Strictly marks 'verified' ONLY when validation completed AND account_status is 'active'.
   */
  async applyValidationResult({
    id = null,
    razorpayValidationId = null,
    fallbackId = null,
    validationStatus,
    resultAccountStatus = null,
    registeredName = null,
    failureReason = null,
  }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      let rows;
      if (id) {
        ({ rows } = await client.query(
          "SELECT * FROM editor_payout_accounts WHERE id = $1 FOR UPDATE;",
          [id]
        ));
      } else {
        ({ rows } = await client.query(
          `SELECT * FROM editor_payout_accounts
           WHERE razorpay_validation_id = $1
              OR ($2::uuid IS NOT NULL AND id = $2::uuid)
           FOR UPDATE;`,
          [razorpayValidationId, fallbackId]
        ));
      }

      if (!rows.length) {
        await client.query("COMMIT");
        return null;
      }

      const current = rows[0];
      let nextStatus = current.account_status;
      let finalReason = failureReason;

      if (validationStatus === "created") {
        nextStatus = "validating";
        finalReason = null;
      } else if (validationStatus === "completed" && resultAccountStatus === "active") {
        nextStatus = "verified";
        finalReason = null;
      } else if (validationStatus === "failed" || validationStatus === "completed") {
        nextStatus = "failed";
        finalReason = failureReason || `Validation status: ${resultAccountStatus || validationStatus}`;
      }

      // Never downgrade an already verified account via duplicate/out-of-order events
      if (current.account_status === "verified" && nextStatus !== "verified") {
        await client.query("COMMIT");
        return current;
      }

      const { rows: updated } = await client.query(
        `UPDATE editor_payout_accounts
         SET razorpay_validation_id = COALESCE($1, razorpay_validation_id),
             account_status = $2,
             registered_name = COALESCE($3, registered_name),
             failure_reason = $4
         WHERE id = $5
         RETURNING *;`,
        [razorpayValidationId, nextStatus, registeredName, finalReason, current.id]
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
};

module.exports = PayoutAccountModel;
