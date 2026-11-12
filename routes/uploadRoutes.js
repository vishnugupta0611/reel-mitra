const express = require("express");
const multer = require("multer");
const router = express.Router();
const UploadController = require("../controllers/uploadController");
const { authenticate } = require("../middlewares/authMiddleware");

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
  fileFilter: (req, file, cb) => {
    const allowed =
      ALLOWED_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix)) ||
      file.mimetype === "application/pdf";
    if (!allowed) {
      const err = new Error("Unsupported file type. Allowed: image, video, audio, pdf");
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// Uploads require logged-in user
router.use(authenticate);

router.post("/initiate", UploadController.initiate);
router.post("/file", upload.single("file"), UploadController.uploadFile);
router.post("/:upload_id/complete", UploadController.complete);
router.get("/:upload_id", UploadController.getStatus);
router.delete("/:upload_id", UploadController.deleteFile);

module.exports = router;
