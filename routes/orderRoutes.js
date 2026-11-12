const express = require("express");
const router = express.Router();
const OrderController = require("../controllers/orderController");
const { authenticate } = require("../middlewares/authMiddleware");

router.use(authenticate);

router.post("/", OrderController.createOrder);
router.get("/", OrderController.listOrders);
router.get("/:id", OrderController.getOrderById);
router.patch("/:id/accept", OrderController.acceptOrder);
router.patch("/:id/cancel", OrderController.cancelOrder);
router.post("/:id/deliverables", OrderController.submitDeliverable);
router.patch("/:id/request-revision", OrderController.requestRevision);
router.patch("/:id/complete", OrderController.completeOrder);
router.post("/:id/review", OrderController.createReview);

module.exports = router;
