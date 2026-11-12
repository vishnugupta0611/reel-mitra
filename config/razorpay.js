const crypto = require("crypto");
const Razorpay = require("razorpay");

const RAZORPAYX_BASE_URL = "https://api.razorpay.com/v1";

function isPlaceholder(val) {
  return !val || String(val).startsWith("your_") || String(val).includes("your_key_id") || String(val).includes("your_razorpay");
}

function isRazorpayConfigured() {
  return Boolean(
    !isPlaceholder(process.env.RAZORPAY_KEY_ID) &&
      !isPlaceholder(process.env.RAZORPAY_KEY_SECRET)
  );
}

function isRazorpayXConfigured() {
  return Boolean(
    isRazorpayConfigured() && !isPlaceholder(process.env.RAZORPAYX_ACCOUNT_NUMBER)
  );
}

function isAutoValidateEnabled() {
  return String(process.env.RAZORPAYX_AUTO_VALIDATE).toLowerCase() === "true";
}

function getMinWithdrawalAmount() {
  const val = parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || "100");
  return Number.isFinite(val) && val > 0 ? val : 100;
}

function getRazorpayClient() {
  if (!isRazorpayConfigured()) {
    const err = new Error("Razorpay API keys are not configured in .env");
    err.statusCode = 500;
    throw err;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function timingSafeHexEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return timingSafeHexEqual(expected, razorpaySignature);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!rawBody || !signature) return false;

  const secrets = [process.env.RAZORPAY_WEBHOOK_SECRET, process.env.RAZORPAYX_WEBHOOK_SECRET]
    .filter((s) => s && !isPlaceholder(s));

  if (!secrets.length) return false;

  return secrets.some((secret) => {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return timingSafeHexEqual(expected, signature);
  });
}

async function razorpayXRequest(method, apiPath, body = null, extraHeaders = {}) {
  if (!isRazorpayConfigured()) {
    const err = new Error("Razorpay API keys are not configured in .env");
    err.statusCode = 500;
    err.preRequest = true;
    throw err;
  }

  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");

  const response = await fetch(`${RAZORPAYX_BASE_URL}${apiPath}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const description =
      data?.error?.description || data?.message || `RazorpayX API failed (${response.status})`;
    const err = new Error(description);
    err.statusCode = response.status >= 400 && response.status < 600 ? response.status : 502;
    err.razorpayError = data?.error || data;
    throw err;
  }

  return data;
}

const RazorpayX = {
  async createContact({ name, email = null, contact = null, referenceId = null, notes = {} }) {
    const payload = {
      name,
      type: process.env.RAZORPAYX_CONTACT_TYPE || "vendor",
      ...(email ? { email } : {}),
      ...(contact ? { contact: String(contact).replace(/\s+/g, "") } : {}),
      ...(referenceId ? { reference_id: String(referenceId).slice(0, 40) } : {}),
      notes,
    };
    return razorpayXRequest("POST", "/contacts", payload);
  },

  async createBankFundAccount({ contactId, name, ifsc, accountNumber }) {
    return razorpayXRequest("POST", "/fund_accounts", {
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name,
        ifsc: String(ifsc).toUpperCase().trim(),
        account_number: String(accountNumber).trim(),
      },
    });
  },

  async createVpaFundAccount({ contactId, vpaAddress }) {
    return razorpayXRequest("POST", "/fund_accounts", {
      contact_id: contactId,
      account_type: "vpa",
      vpa: {
        address: String(vpaAddress).trim().toLowerCase(),
      },
    });
  },

  async validateFundAccount({ fundAccountId, accountType = "bank_account", notes = {} }) {
    if (!isRazorpayXConfigured()) {
      const err = new Error("RAZORPAYX_ACCOUNT_NUMBER is not configured in .env");
      err.statusCode = 503;
      err.preRequest = true;
      err.unavailable = true;
      throw err;
    }

    const payload = {
      account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
      fund_account: { id: fundAccountId },
      notes,
    };

    if (accountType === "bank_account") {
      payload.amount = 100; // ₹1 penny-drop validation for bank accounts
      payload.currency = "INR";
    }

    return razorpayXRequest("POST", "/fund_accounts/validations", payload);
  },

  async fetchFundAccountValidation(validationId) {
    return razorpayXRequest("GET", `/fund_accounts/validations/${validationId}`);
  },

  async createPayout({
    fundAccountId,
    amountPaise,
    currency = "INR",
    mode,
    purpose = "payout",
    referenceId,
    narration = "ReelMitra Editor Payout",
    idempotencyKey,
  }) {
    if (!isRazorpayXConfigured()) {
      const err = new Error("RAZORPAYX_ACCOUNT_NUMBER is not configured in .env");
      err.statusCode = 503;
      err.preRequest = true;
      throw err;
    }

    return razorpayXRequest(
      "POST",
      "/payouts",
      {
        account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER,
        fund_account_id: fundAccountId,
        amount: amountPaise,
        currency,
        mode,
        purpose,
        queue_if_low_balance:
          String(process.env.RAZORPAYX_QUEUE_IF_LOW_BALANCE).toLowerCase() === "true",
        reference_id: String(referenceId).slice(0, 40),
        narration: String(narration).slice(0, 30),
      },
      {
        "X-Payout-Idempotency": idempotencyKey,
      }
    );
  },

  async fetchPayout(razorpayPayoutId) {
    return razorpayXRequest("GET", `/payouts/${razorpayPayoutId}`);
  },
};

module.exports = {
  isRazorpayConfigured,
  isRazorpayXConfigured,
  isAutoValidateEnabled,
  getMinWithdrawalAmount,
  getRazorpayClient,
  verifyPaymentSignature,
  verifyWebhookSignature,
  RazorpayX,
};
