const express = require("express");
const router = express.Router();
const PaymentController = require("../controllers/paymentController");
const { authenticate } = require("../middlewares/authMiddleware");

// Public Razorpay webhook (secured via x-razorpay-signature)
router.post("/webhook", PaymentController.handleWebhook);

// Client payment routes
router.post("/create-order", authenticate, PaymentController.createOrder);
router.post("/verify", authenticate, PaymentController.verifyPayment);

module.exports = router;
