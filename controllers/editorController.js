const EditorProfileModel = require("../models/editorProfileModel");
const CategoryModel = require("../models/categoryModel");
const PortfolioModel = require("../models/portfolioModel");
const ReviewModel = require("../models/reviewModel");

const EditorController = {
  // ==========================================================================
  // Public Discovery Endpoints (No Login Required)
  // ==========================================================================

  /**
   * Search and filter all public editors with pagination
   */
  async listEditors(req, res, next) {
    try {
      const {
        search,
        category_id,
        min_rating,
        min_price,
        max_price,
        experience,
        available,
        sort_by = "rating",
        order = "desc",
        page = 1,
        limit = 12,
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 12));
      const offset = (pageNum - 1) * limitNum;

      const { items, total } = await EditorProfileModel.findAll({
        search: search ? search.trim() : null,
        categoryId: category_id || null,
        minRating: min_rating !== undefined ? parseFloat(min_rating) : null,
        minPrice: min_price !== undefined ? parseFloat(min_price) : null,
        maxPrice: max_price !== undefined ? parseFloat(max_price) : null,
        experience: experience !== undefined ? parseInt(experience, 10) : null,
        availability: available || null,
        sortBy: sort_by,
        order,
        limit: limitNum,
        offset,
      });

      return res.json({
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          total_pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get public profile of a single editor
   */
  async getPublicProfile(req, res, next) {
    try {
      const { editor_id } = req.params;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editor_id);

      if (!isUUID) {
        return res.status(400).json({ error: "Invalid editor ID format" });
      }

      let editor = await EditorProfileModel.findById(editor_id);
      if (!editor) {
        editor = await EditorProfileModel.findByUserId(editor_id);
      }

      if (!editor) {
        return res.status(404).json({ error: "Editor not found" });
      }

      // Hide private user details from public view
      delete editor.email;

      const categories = await CategoryModel.findByEditorId(editor.id);
      const portfolio = await PortfolioModel.findByEditorId(editor.id);
      const ratingSummary = await ReviewModel.getEditorRatingSummary(editor.id);

      return res.json({
        editor: {
          ...editor,
          categories,
          portfolio_count: portfolio.length,
          reviews_summary: ratingSummary,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get public portfolio of an editor
   */
  async getPublicPortfolio(req, res, next) {
    try {
      const { editor_id } = req.params;
      const portfolio = await PortfolioModel.findByEditorId(editor_id);
      return res.json({ portfolio });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get public reviews of an editor
   */
  async getPublicReviews(req, res, next) {
    try {
      const { editor_id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const reviews = await ReviewModel.findByEditorId(editor_id, limitNum, offset);
      const summary = await ReviewModel.getEditorRatingSummary(editor_id);

      return res.json({
        summary,
        reviews,
      });
    } catch (error) {
      next(error);
    }
  },

  // ==========================================================================
  // Editor-Specific Management Endpoints (Logged-in Editor Only)
  // ==========================================================================

  /**
   * Editor onboarding / setup
   */
  async onboarding(req, res, next) {
    try {
      const { display_name, bio, experience_years, pricing_from, category_ids } = req.body;
      const editorId = req.editor.id;

      const updated = await EditorProfileModel.update(editorId, {
        displayName: display_name,
        bio,
        experienceYears: experience_years !== undefined ? parseInt(experience_years, 10) : undefined,
        pricingFrom: pricing_from !== undefined ? parseFloat(pricing_from) : undefined,
      });

      let categories = [];
      if (Array.isArray(category_ids) && category_ids.length > 0) {
        categories = await CategoryModel.setEditorCategories(editorId, category_ids);
      } else {
        categories = await CategoryModel.findByEditorId(editorId);
      }

      return res.json({
        message: "Editor onboarding completed successfully",
        profile: updated,
        categories,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get logged-in editor's profile
   */
  async getMyProfile(req, res, next) {
    try {
      const editor = await EditorProfileModel.findById(req.editor.id);
      const categories = await CategoryModel.findByEditorId(req.editor.id);
      const portfolio = await PortfolioModel.findByEditorId(req.editor.id);

      return res.json({
        profile: editor,
        categories,
        portfolio_count: portfolio.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update logged-in editor's profile details
   */
  async updateMyProfile(req, res, next) {
    try {
      const { display_name, bio, experience_years, pricing_from, availability_status } = req.body;

      if (availability_status && !["available", "busy", "unavailable"].includes(availability_status)) {
        return res.status(400).json({ error: "Invalid availability_status value" });
      }

      const updated = await EditorProfileModel.update(req.editor.id, {
        displayName: display_name,
        bio,
        experienceYears: experience_years !== undefined ? parseInt(experience_years, 10) : undefined,
        pricingFrom: pricing_from !== undefined ? parseFloat(pricing_from) : undefined,
        availabilityStatus: availability_status,
      });

      return res.json({
        message: "Editor profile updated successfully",
        profile: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Calculate and return editor profile completion status
   */
  async getProfileCompletion(req, res, next) {
    try {
      const editor = await EditorProfileModel.findById(req.editor.id);
      const categories = await CategoryModel.findByEditorId(req.editor.id);
      const portfolio = await PortfolioModel.findByEditorId(req.editor.id);

      const checklist = {
        has_display_name: Boolean(editor.display_name && editor.display_name.trim()),
        has_bio: Boolean(editor.bio && editor.bio.trim().length > 10),
        has_pricing: Boolean(editor.pricing_from && parseFloat(editor.pricing_from) > 0),
        has_categories: categories.length > 0,
        has_portfolio: portfolio.length > 0,
      };

      const keys = Object.keys(checklist);
      const completedCount = keys.filter((k) => checklist[k]).length;
      const percentage = Math.round((completedCount / keys.length) * 100);

      const missing = [];
      if (!checklist.has_display_name) missing.push("display_name");
      if (!checklist.has_bio) missing.push("bio (at least 10 chars)");
      if (!checklist.has_pricing) missing.push("pricing_from");
      if (!checklist.has_categories) missing.push("categories (select at least one)");
      if (!checklist.has_portfolio) missing.push("portfolio (add at least one item)");

      return res.json({
        completion_percentage: percentage,
        checklist,
        missing_fields: missing,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update availability status
   */
  async updateAvailability(req, res, next) {
    try {
      const { availability_status } = req.body;

      if (!availability_status || !["available", "busy", "unavailable"].includes(availability_status)) {
        return res.status(400).json({ error: "availability_status must be 'available', 'busy', or 'unavailable'" });
      }

      const updated = await EditorProfileModel.updateAvailability(req.editor.id, availability_status);

      return res.json({
        message: "Availability updated successfully",
        availability_status: updated.availability_status,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get logged-in editor's assigned categories
   */
  async getMyCategories(req, res, next) {
    try {
      const categories = await CategoryModel.findByEditorId(req.editor.id);
      return res.json({ categories });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Replace logged-in editor's assigned categories
   */
  async updateMyCategories(req, res, next) {
    try {
      const { category_ids } = req.body;
      if (!Array.isArray(category_ids)) {
        return res.status(400).json({ error: "category_ids array is required" });
      }

      const updated = await CategoryModel.setEditorCategories(req.editor.id, category_ids);
      return res.json({
        message: "Categories updated successfully",
        categories: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a portfolio item
   */
  async createPortfolioItem(req, res, next) {
    try {
      const { title, description, media_url, thumbnail_url, category_id, sort_order } = req.body;

      if (!title || !media_url) {
        return res.status(400).json({ error: "Title and media_url are required" });
      }

      const item = await PortfolioModel.create({
        editorId: req.editor.id,
        categoryId: category_id || null,
        title,
        description,
        mediaUrl: media_url,
        thumbnailUrl: thumbnail_url,
        sortOrder: sort_order !== undefined ? parseInt(sort_order, 10) : 0,
      });

      return res.status(201).json({
        message: "Portfolio item added successfully",
        item,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get logged-in editor's portfolio items
   */
  async getMyPortfolio(req, res, next) {
    try {
      const portfolio = await PortfolioModel.findByEditorId(req.editor.id);
      return res.json({ portfolio });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get a single portfolio item by ID
   */
  async getPortfolioItemById(req, res, next) {
    try {
      const { item_id } = req.params;
      const item = await PortfolioModel.findById(item_id);

      if (!item || item.editor_id !== req.editor.id) {
        return res.status(404).json({ error: "Portfolio item not found" });
      }

      return res.json({ item });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Edit a portfolio item
   */
  async updatePortfolioItem(req, res, next) {
    try {
      const { item_id } = req.params;
      const { title, description, media_url, thumbnail_url, category_id, sort_order } = req.body;

      const updated = await PortfolioModel.update(item_id, req.editor.id, {
        title,
        description,
        mediaUrl: media_url,
        thumbnailUrl: thumbnail_url,
        categoryId: category_id,
        sortOrder: sort_order !== undefined ? parseInt(sort_order, 10) : undefined,
      });

      if (!updated) {
        return res.status(404).json({ error: "Portfolio item not found or unauthorized to edit" });
      }

      return res.json({
        message: "Portfolio item updated successfully",
        item: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete a portfolio item
   */
  async deletePortfolioItem(req, res, next) {
    try {
      const { item_id } = req.params;
      const deleted = await PortfolioModel.delete(item_id, req.editor.id);

      if (!deleted) {
        return res.status(404).json({ error: "Portfolio item not found or unauthorized to delete" });
      }

      return res.json({ message: "Portfolio item deleted successfully" });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reorder portfolio items
   */
  async reorderPortfolio(req, res, next) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items array with { id, sort_order } is required" });
      }

      const reordered = await PortfolioModel.reorder(req.editor.id, items);
      return res.json({
        message: "Portfolio reordered successfully",
        portfolio: reordered,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = EditorController;
