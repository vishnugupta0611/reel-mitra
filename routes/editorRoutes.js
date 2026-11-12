const express = require("express");
const router = express.Router();
const EditorController = require("../controllers/editorController");
const PayoutController = require("../controllers/payoutController");
const { authenticate, requireRole } = require("../middlewares/authMiddleware");

// All routes here require logged-in editor
router.use(authenticate, requireRole("editor", "admin"));

// Profile
router.post("/onboarding", EditorController.onboarding);
router.get("/profile", EditorController.getMyProfile);
router.patch("/profile", EditorController.updateMyProfile);
router.get("/profile/completion", EditorController.getProfileCompletion);
router.patch("/availability", EditorController.updateAvailability);

// Earnings Ledger & Payout Accounts (RazorpayX)
router.get("/earnings", PayoutController.getMyEarnings);
router.get("/wallet", PayoutController.getMyEarnings);
router.post("/payout-accounts", PayoutController.createPayoutAccount);
router.get("/payout-accounts", PayoutController.listPayoutAccounts);
router.post("/payout-accounts/:id/validate", PayoutController.validatePayoutAccount);

// Categories
router.get("/categories", EditorController.getMyCategories);
router.put("/categories", EditorController.updateMyCategories);

// Portfolio
router.post("/portfolio", EditorController.createPortfolioItem);
router.get("/portfolio", EditorController.getMyPortfolio);
router.patch("/portfolio/reorder", EditorController.reorderPortfolio);
router.get("/portfolio/:item_id", EditorController.getPortfolioItemById);
router.patch("/portfolio/:item_id", EditorController.updatePortfolioItem);
router.delete("/portfolio/:item_id", EditorController.deletePortfolioItem);

module.exports = router;
