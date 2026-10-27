const express = require("express");
const router = express.Router();
const UploadController = require("../controllers/uploadController");
const { authenticate } = require("../middlewares/authMiddleware");

// Uploads require logged-in user
router.use(authenticate);

router.post("/initiate", UploadController.initiate);
router.post("/:upload_id/complete", UploadController.complete);
router.get("/:upload_id", UploadController.getStatus);

module.exports = router;
