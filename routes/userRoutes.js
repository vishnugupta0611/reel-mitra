const express = require("express");
const router = express.Router();
const UserController = require("../controllers/userController");
const { authenticate } = require("../middlewares/authMiddleware");

// All user routes are authenticated for logged-in user
router.use(authenticate);

router.get("/me", UserController.getProfile);
router.patch("/me", UserController.updateProfile);
router.patch("/me/email", UserController.updateEmail);
router.patch("/me/phone", UserController.updatePhone);
router.delete("/me", UserController.deleteAccount);
router.get("/me/settings", UserController.getSettings);
router.patch("/me/settings", UserController.updateSettings);

module.exports = router;
