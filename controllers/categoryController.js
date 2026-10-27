const CategoryModel = require("../models/categoryModel");

const CategoryController = {
  /**
   * Get all categories (defaults to hierarchy: parent with subcategories)
   */
  async getAllCategories(req, res, next) {
    try {
      const { flat } = req.query;
      if (flat === "true") {
        const flatCategories = await CategoryModel.findAllFlat();
        return res.json({ categories: flatCategories });
      }

      const categories = await CategoryModel.getHierarchy();
      return res.json({ categories });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get category details by ID or slug
   */
  async getCategoryById(req, res, next) {
    try {
      const { category_id } = req.params;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category_id);

      let category = null;
      if (isUUID) {
        category = await CategoryModel.findById(category_id);
      } else {
        category = await CategoryModel.findBySlug(category_id);
      }

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      return res.json({ category });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get editors specializing in a category
   */
  async getCategoryEditors(req, res, next) {
    try {
      const { category_id } = req.params;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category_id);

      let category = null;
      if (isUUID) {
        category = await CategoryModel.findById(category_id);
      } else {
        category = await CategoryModel.findBySlug(category_id);
      }

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      const editors = await CategoryModel.findEditorsByCategoryId(category.id);
      return res.json({
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
        },
        total_editors: editors.length,
        editors,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = CategoryController;
