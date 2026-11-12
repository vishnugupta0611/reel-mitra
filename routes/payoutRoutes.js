const express = require("express");
const router = express.Router();
const PayoutController = require("../controllers/payoutController");
const PaymentController = require("../controllers/paymentController");
const { authenticate, requireRole } = require("../middlewares/authMiddleware");

// Public RazorpayX webhook (secured via x-razorpay-signature)
router.post("/webhook", PaymentController.handleWebhook);

// Logged-in editor withdrawal endpoints
router.use(authenticate, requireRole("editor", "admin"));
router.post("/withdraw", PayoutController.withdraw);
router.get("/", PayoutController.listMyPayouts);
router.post("/:id/sync", PayoutController.syncPayoutStatus);

module.exports = router;
