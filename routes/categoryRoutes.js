const express = require("express");
const router = express.Router();
const CategoryController = require("../controllers/categoryController");

// Public category routes
router.get("/", CategoryController.getAllCategories);
router.get("/:category_id", CategoryController.getCategoryById);
router.get("/:category_id/editors", CategoryController.getCategoryEditors);

module.exports = router;
