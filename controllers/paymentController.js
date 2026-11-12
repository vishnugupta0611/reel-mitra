const OrderModel = require("../models/orderModel");
const PaymentModel = require("../models/paymentModel");
const PayoutModel = require("../models/payoutModel");
const PayoutAccountModel = require("../models/payoutAccountModel");
const {
  getRazorpayClient,
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require("../config/razorpay");

function isUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || "");
}

function wrapRazorpayError(err, fallback = "Razorpay request failed") {
  if (err instanceof Error) return err;
  const msg = err?.error?.description || err?.description || fallback;
  const wrapped = new Error(msg);
  wrapped.statusCode = err?.statusCode || 502;
  return wrapped;
}

const PaymentController = {
  /**
   * Create a Razorpay Payment Gateway order using DB-saved amount
   */
  async createOrder(req, res, next) {
    try {
      const { order_id } = req.body;
      if (!order_id || !isUuid(order_id)) {
        return res.status(400).json({ error: "Valid order_id is required" });
      }

      const order = await OrderModel.findById(order_id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.client_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only the order's client can initiate payment" });
      }

      const existingCaptured = await PaymentModel.findCapturedByOrderId(order.id);
      if (existingCaptured) {
        return res.status(409).json({ error: "Order has already been paid" });
      }

      if (!["pending", "pending_editor_review", "accepted", "payment_pending"].includes(order.status)) {
        return res.status(400).json({ error: `Cannot pay for order in '${order.status}' status` });
      }

      // Use saved amount from order (never trust frontend amount)
      const orderAmount = Number(order.amount ?? order.agreed_price ?? order.budget ?? 0);
      if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
        return res.status(400).json({ error: "Order does not have a valid payable amount" });
      }

      const amountPaise = Math.round(orderAmount * 100);
      const currency = (order.currency || "INR").trim().toUpperCase();

      const razorpay = getRazorpayClient();
      let rzpOrder;
      try {
        rzpOrder = await razorpay.orders.create({
          amount: amountPaise,
          currency,
          receipt: `ord_${order.id.replace(/-/g, "").slice(0, 32)}`,
          notes: {
            order_id: order.id,
            client_id: order.client_id,
            editor_id: order.editor_id,
          },
        });
      } catch (rzpErr) {
        throw wrapRazorpayError(rzpErr, "Failed to create Razorpay order");
      }

      const payment = await PaymentModel.create({
        orderId: order.id,
        payerId: req.user.id,
        razorpayOrderId: rzpOrder.id,
        amount: orderAmount,
        currency,
        platformFee: Number(order.platform_fee || 0),
        editorAmount: Number(order.editor_amount || orderAmount),
        status: "created",
      });

      return res.status(201).json({
        message: "Razorpay order created",
        key_id: process.env.RAZORPAY_KEY_ID,
        razorpay_order: rzpOrder,
        payment,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Never trust frontend payment success. Verify HMAC signature + Razorpay payment status.
   */
  async verifyPayment(req, res, next) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          error: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
        });
      }

      const isValid = verifyPaymentSignature({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });

      if (!isValid) {
        return res.status(400).json({ error: "Invalid payment signature" });
      }

      const paymentRecord = await PaymentModel.findByRazorpayOrderId(razorpay_order_id);
      if (!paymentRecord) {
        return res.status(404).json({ error: "Payment record not found" });
      }

      if (paymentRecord.payer_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized access to this payment" });
      }

      const razorpay = getRazorpayClient();
      let rzpPayment;
      try {
        rzpPayment = await razorpay.payments.fetch(razorpay_payment_id);
        if (rzpPayment.status === "authorized") {
          rzpPayment = await razorpay.payments.capture(
            razorpay_payment_id,
            Math.round(Number(paymentRecord.amount) * 100),
            (paymentRecord.currency || "INR").trim()
          );
        }
      } catch (rzpErr) {
        throw wrapRazorpayError(rzpErr, "Failed to verify payment with Razorpay");
      }

      if (rzpPayment.order_id && rzpPayment.order_id !== razorpay_order_id) {
        return res.status(400).json({ error: "Payment does not match Razorpay order ID" });
      }

      if (rzpPayment.status === "failed") {
        await PaymentModel.markFailed({
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
        });
        return res.status(400).json({ error: "Payment failed on Razorpay" });
      }

      if (rzpPayment.status !== "captured") {
        return res.status(400).json({
          error: `Payment is not captured yet (current status: ${rzpPayment.status})`,
        });
      }

      const result = await PaymentModel.markCapturedAndCreateEarning({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        paymentMethod: rzpPayment.method || null,
        paidAt: rzpPayment.created_at ? new Date(rzpPayment.created_at * 1000) : new Date(),
      });

      return res.json({
        message: result.alreadyCaptured
          ? "Payment already verified and captured"
          : "Payment verified and captured successfully",
        payment: result.payment,
        earning: result.earning,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Unified Razorpay Payment Gateway + RazorpayX Webhook Handler
   * Verifies x-razorpay-signature against raw JSON body and handles events idempotently.
   */
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers["x-razorpay-signature"];
      const isValid = verifyWebhookSignature(req.rawBody, signature);

      if (!isValid) {
        return res.status(400).json({ error: "Invalid webhook signature" });
      }

      const event = req.body?.event;
      const payload = req.body?.payload || {};

      if (event === "payment.captured") {
        const entity = payload.payment?.entity;
        if (entity?.order_id && entity?.id) {
          const existing = await PaymentModel.findByRazorpayOrderId(entity.order_id);
          if (existing) {
            await PaymentModel.markCapturedAndCreateEarning({
              razorpayOrderId: entity.order_id,
              razorpayPaymentId: entity.id,
              paymentMethod: entity.method || null,
              paidAt: entity.created_at ? new Date(entity.created_at * 1000) : new Date(),
            });
          }
        }
      } else if (event === "payment.failed") {
        const entity = payload.payment?.entity;
        if (entity?.order_id) {
          await PaymentModel.markFailed({
            razorpayOrderId: entity.order_id,
            razorpayPaymentId: entity.id || null,
          });
        }
      } else if (event === "refund.processed" || event === "payment.refunded") {
        const refundEntity = payload.refund?.entity;
        const paymentEntity = payload.payment?.entity;
        const rzpPaymentId = refundEntity?.payment_id || paymentEntity?.id;
        if (rzpPaymentId) {
          await PaymentModel.markRefunded({ razorpayPaymentId: rzpPaymentId });
        }
      } else if (
        [
          "payout.queued",
          "payout.pending",
          "payout.processing",
          "payout.processed",
          "payout.failed",
          "payout.reversed",
          "payout.rejected",
        ].includes(event)
      ) {
        const entity = payload.payout?.entity;
        if (entity?.id) {
          const status = entity.status || event.split(".")[1];
          const failureReason =
            entity.status_details?.description ||
            entity.status_details?.reason ||
            entity.error?.description ||
            null;

          await PayoutModel.applyStatusUpdate({
            razorpayPayoutId: entity.id,
            fallbackId: isUuid(entity.reference_id) ? entity.reference_id : null,
            status,
            utr: entity.utr || null,
            failureReason,
          });
        }
      } else if (
        event === "fund_account.validation.completed" ||
        event === "fund_account.validation.failed"
      ) {
        const entity =
          payload["fund_account.validation"]?.entity || payload.fund_account_validation?.entity;
        if (entity?.id) {
          const results = entity.results || entity.validation_results || {};
          const failureReason =
            entity.error?.description ||
            entity.status_details?.description ||
            results.details ||
            null;

          await PayoutAccountModel.applyValidationResult({
            razorpayValidationId: entity.id,
            fallbackId: isUuid(entity.notes?.payout_account_id)
              ? entity.notes.payout_account_id
              : null,
            validationStatus: entity.status || (event.endsWith(".failed") ? "failed" : "completed"),
            resultAccountStatus: results.account_status || null,
            registeredName: results.registered_name || null,
            failureReason,
          });
        }
      }

      return res.json({ status: "ok", event: event || null });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = PaymentController;
