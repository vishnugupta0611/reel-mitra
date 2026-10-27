const express = require("express");
const router = express.Router();
const EditorController = require("../controllers/editorController");

// Public discovery endpoints
router.get("/", EditorController.listEditors);
router.get("/:editor_id", EditorController.getPublicProfile);
router.get("/:editor_id/portfolio", EditorController.getPublicPortfolio);
router.get("/:editor_id/reviews", EditorController.getPublicReviews);

module.exports = router;
