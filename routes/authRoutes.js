const express = require("express");
const router = express.Router();
const AuthController = require("../controllers/authController");
const { authenticate } = require("../middlewares/authMiddleware");

// Public authentication routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/logout", AuthController.logout);
router.post("/refresh", AuthController.refresh);
router.post("/verify-email", AuthController.verifyEmail);
router.post("/resend-verification", AuthController.resendVerification);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);

// Authenticated auth routes
router.get("/me", authenticate, AuthController.me);
router.patch("/change-password", authenticate, AuthController.changePassword);

module.exports = router;
