const PayoutAccountModel = require("../models/payoutAccountModel");
const PayoutModel = require("../models/payoutModel");
const EarningModel = require("../models/earningModel");
const {
  isAutoValidateEnabled,
  getMinWithdrawalAmount,
  RazorpayX,
} = require("../config/razorpay");

function isUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || "");
}

function maskBankAccount(accountNumber) {
  const clean = String(accountNumber).trim();
  const tail = clean.slice(-4);
  return `****${tail}`;
}

function extractValidationResult(validation) {
  const results = validation?.results || validation?.validation_results || {};
  const failureReason =
    validation?.error?.description ||
    validation?.status_details?.description ||
    (validation?.status === "failed" ? "Fund account validation failed" : results?.details || null);
  return {
    razorpayValidationId: validation?.id || null,
    validationStatus: validation?.status || "created",
    resultAccountStatus: results?.account_status || null,
    registeredName: results?.registered_name || null,
    failureReason,
  };
}

function extractPayoutFailureReason(entity) {
  return (
    entity?.status_details?.description ||
    entity?.status_details?.reason ||
    entity?.error?.description ||
    null
  );
}

const PayoutController = {
  /**
   * Setup editor payout account (Bank Account or UPI VPA) via RazorpayX Contacts & Fund Accounts
   */
  async createPayoutAccount(req, res, next) {
    try {
      if (!req.editor) {
        return res.status(403).json({ error: "Editor profile required" });
      }
      const { account_type, account_holder_name, account_number, ifsc, vpa_address } = req.body;

      if (!["bank_account", "vpa"].includes(account_type)) {
        return res.status(400).json({ error: "account_type must be 'bank_account' or 'vpa'" });
      }

      if (account_type === "bank_account") {
        if (!account_holder_name || !account_number || !ifsc) {
          return res.status(400).json({
            error: "account_holder_name, account_number, and ifsc are required for bank_account",
          });
        }
        const cleanAcct = String(account_number).trim();
        const cleanIfsc = String(ifsc).toUpperCase().trim();
        if (!/^[a-zA-Z0-9]{6,34}$/.test(cleanAcct)) {
          return res.status(400).json({ error: "Invalid bank account number format" });
        }
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
          return res.status(400).json({ error: "Invalid 11-character IFSC code format" });
        }
      } else {
        if (!vpa_address || !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/.test(String(vpa_address).trim())) {
          return res.status(400).json({ error: "Valid UPI / vpa_address is required for vpa" });
        }
      }

      // 1. Reuse existing RazorpayX Contact ID or create one
      let contactId = await PayoutAccountModel.findLatestContactByEditorId(req.editor.id);
      if (!contactId) {
        const contactName =
          account_holder_name?.trim() ||
          req.editor.display_name ||
          `${req.user.first_name} ${req.user.last_name}`.trim();

        const rzpContact = await RazorpayX.createContact({
          name: contactName,
          email: req.user.email,
          contact: req.user.phone || null,
          referenceId: `ed_${req.editor.id}`,
          notes: { editor_id: req.editor.id, user_id: req.user.id },
        });
        contactId = rzpContact.id;
      }

      // 2. Create RazorpayX Fund Account
      let rzpFundAccount;
      let accountLabel;
      if (account_type === "bank_account") {
        const cleanIfsc = String(ifsc).toUpperCase().trim();
        const cleanAcct = String(account_number).trim();
        rzpFundAccount = await RazorpayX.createBankFundAccount({
          contactId,
          name: account_holder_name.trim(),
          ifsc: cleanIfsc,
          accountNumber: cleanAcct,
        });
        accountLabel = `${maskBankAccount(cleanAcct)} (${cleanIfsc})`;
      } else {
        const cleanVpa = String(vpa_address).trim().toLowerCase();
        rzpFundAccount = await RazorpayX.createVpaFundAccount({
          contactId,
          vpaAddress: cleanVpa,
        });
        accountLabel = cleanVpa;
      }

      // Prevent duplicate DB record for same fund_account_id
      const existing = await PayoutAccountModel.findByEditorAndFundAccount(
        req.editor.id,
        rzpFundAccount.id
      );
      if (existing) {
        return res.status(200).json({
          message: "Payout account already registered",
          payout_account: existing,
        });
      }

      // 3. Save payout account cleanly in pending_verification (never mark verified without validation)
      let payoutAccount = await PayoutAccountModel.create({
        editorId: req.editor.id,
        razorpayContactId: contactId,
        razorpayFundAccountId: rzpFundAccount.id,
        accountType: account_type,
        accountStatus: "pending_verification",
        accountLabel,
      });

      // 4. Automatically trigger penny-drop validation ONLY when RAZORPAYX_AUTO_VALIDATE=true
      let validationMessage = "Payout account saved in pending_verification status";
      if (isAutoValidateEnabled()) {
        try {
          const locked = await PayoutAccountModel.beginValidation(payoutAccount.id, req.editor.id);
          const validation = await RazorpayX.validateFundAccount({
            fundAccountId: locked.razorpay_fund_account_id,
            accountType: locked.account_type,
            notes: { editor_id: req.editor.id, payout_account_id: locked.id },
          });
          payoutAccount = await PayoutAccountModel.applyValidationResult({
            id: locked.id,
            ...extractValidationResult(validation),
          });
          validationMessage =
            payoutAccount.account_status === "verified"
              ? "Payout account created and verified"
              : `Payout account saved (validation status: ${payoutAccount.account_status})`;
        } catch (valErr) {
          // Graceful fallback: keep saved account in pending_verification when validation API is unavailable
          payoutAccount =
            (await PayoutAccountModel.markValidationUnavailable(payoutAccount.id, valErr.message)) ||
            payoutAccount;
          validationMessage =
            "Payout account saved in pending_verification; automatic validation unavailable";
        }
      }

      return res.status(201).json({
        message: validationMessage,
        payout_account: payoutAccount,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List logged-in editor's payout accounts
   */
  async listPayoutAccounts(req, res, next) {
    try {
      if (!req.editor) {
        return res.status(403).json({ error: "Editor profile required" });
      }
      const accounts = await PayoutAccountModel.findByEditorId(req.editor.id);
      return res.json({ payout_accounts: accounts });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Manually initiate RazorpayX Fund Account Validation
   */
  async validatePayoutAccount(req, res, next) {
    let lockedAccount = null;
    try {
      if (!req.editor) {
        return res.status(403).json({ error: "Editor profile required" });
      }
      const { id } = req.params;
      if (!isUuid(id)) {
        return res.status(400).json({ error: "Invalid payout account ID" });
      }

      lockedAccount = await PayoutAccountModel.beginValidation(id, req.editor.id);

      const validation = await RazorpayX.validateFundAccount({
        fundAccountId: lockedAccount.razorpay_fund_account_id,
        accountType: lockedAccount.account_type,
        notes: { editor_id: req.editor.id, payout_account_id: lockedAccount.id },
      });

      const updated = await PayoutAccountModel.applyValidationResult({
        id: lockedAccount.id,
        ...extractValidationResult(validation),
      });

      return res.json({
        message:
          updated.account_status === "verified"
            ? "Payout account verified successfully"
            : `Validation status: ${updated.account_status}`,
        validation,
        payout_account: updated,
      });
    } catch (error) {
      if (lockedAccount) {
        await PayoutAccountModel.markValidationUnavailable(lockedAccount.id, error.message).catch(
          () => {}
        );
      }
      next(error);
    }
  },

  /**
   * Get editor wallet summary + per-order earnings ledger
   */
  async getMyEarnings(req, res, next) {
    try {
      if (!req.editor) {
        return res.status(403).json({ error: "Editor profile required" });
      }
      const data = await EarningModel.findByEditorId(req.editor.id);
      return res.json(data);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Editor initiates a withdrawal from available balance to a verified Fund Account
   */
  async withdraw(req, res, next) {
    let reservedPayout = null;
    try {
      if (!req.editor) {
        return res.status(403).json({ error: "Editor profile required" });
      }
      const { amount, payout_account_id, mode } = req.body;
      const numericAmount = parseFloat(amount);

      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: "A positive withdrawal amount is required" });
      }

      let targetAccountId = payout_account_id;
      if (targetAccountId) {
        if (!isUuid(targetAccountId)) {
          return res.status(400).json({ error: "Invalid payout_account_id format" });
        }
      } else {
        const accounts = await PayoutAccountModel.findByEditorId(req.editor.id);
        if (!accounts.length) {
          return res.status(400).json({ error: "No payout account found. Please add one first." });
        }
        const verified = accounts.find((a) => a.account_status === "verified");
        targetAccountId = (verified || accounts[0]).id;
      }

      const reservation = await PayoutModel.reserveForWithdrawal({
        editorId: req.editor.id,
        payoutAccountId: targetAccountId,
        amount: numericAmount,
        currency: "INR",
        mode,
        minWithdrawalAmount: getMinWithdrawalAmount(),
      });

      reservedPayout = reservation.payout;
      const payoutAccount = reservation.payoutAccount;
      const amountPaise = Math.round(Number(reservedPayout.amount) * 100);

      let rzpPayout;
      try {
        rzpPayout = await RazorpayX.createPayout({
          fundAccountId: payoutAccount.razorpay_fund_account_id,
          amountPaise,
          currency: reservedPayout.currency.trim(),
          mode: reservedPayout.mode,
          referenceId: reservedPayout.id,
          idempotencyKey: reservedPayout.id,
        });
      } catch (rzpErr) {
        // Only release reserved balance on definitive pre-creation rejection (local config error or HTTP 4xx).
        // Keep transient 5xx/timeouts reserved so X-Payout-Idempotency/webhook reconciliation prevents double payouts.
        const isDefinitiveRejection = Boolean(
          rzpErr.preRequest || (rzpErr.statusCode >= 400 && rzpErr.statusCode < 500)
        );
        if (isDefinitiveRejection) {
          await PayoutModel.markCreationFailed({
            payoutId: reservedPayout.id,
            failureReason: rzpErr.message,
          });
        }
        throw rzpErr;
      }

      const updatedPayout = await PayoutModel.attachRazorpayPayout({
        payoutId: reservedPayout.id,
        razorpayPayoutId: rzpPayout.id,
        status: rzpPayout.status,
        utr: rzpPayout.utr || null,
        failureReason: extractPayoutFailureReason(rzpPayout),
      });

      const wallet = await EarningModel.getWalletSummary(req.editor.id);

      return res.status(201).json({
        message: "Withdrawal payout initiated",
        payout: updatedPayout,
        wallet,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List logged-in editor's withdrawal payouts & wallet summary
   */
  async listMyPayouts(req, res, next) {
    try {
      if (!req.editor) {
        return res.status(403).json({ error: "Editor profile required" });
      }
      const [wallet, payouts] = await Promise.all([
        EarningModel.getWalletSummary(req.editor.id),
        PayoutModel.findByEditorId(req.editor.id),
      ]);
      return res.json({ wallet, payouts });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Sync payout status manually from RazorpayX API
   */
  async syncPayoutStatus(req, res, next) {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        return res.status(400).json({ error: "Invalid payout ID" });
      }

      const payout = await PayoutModel.findById(id);
      if (!payout) {
        return res.status(404).json({ error: "Payout not found" });
      }

      if (req.user.role !== "admin" && (!req.editor || payout.editor_id !== req.editor.id)) {
        return res.status(403).json({ error: "Unauthorized access to this payout" });
      }

      if (!payout.razorpay_payout_id) {
        return res.status(400).json({ error: "Payout does not have a razorpay_payout_id" });
      }

      const rzpPayout = await RazorpayX.fetchPayout(payout.razorpay_payout_id);
      const updated = await PayoutModel.applyStatusUpdate({
        id: payout.id,
        status: rzpPayout.status,
        utr: rzpPayout.utr || null,
        failureReason: extractPayoutFailureReason(rzpPayout),
      });

      const wallet = await EarningModel.getWalletSummary(payout.editor_id);

      return res.json({
        message: "Payout status synced",
        payout: updated,
        wallet,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = PayoutController;
