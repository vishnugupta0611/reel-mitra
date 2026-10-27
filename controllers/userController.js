const UserModel = require("../models/userModel");

const UserController = {
  /**
   * Get current user's profile
   */
  async getProfile(req, res) {
    return res.json({
      user: req.user,
      editor: req.editor || null,
    });
  },

  /**
   * Update current user's basic profile fields (name, phone, avatar)
   */
  async updateProfile(req, res, next) {
    try {
      const { first_name, last_name, phone, avatar_url, name } = req.body;

      let fName = first_name;
      let lName = last_name;
      if (!fName && name) {
        const parts = name.trim().split(" ");
        fName = parts[0];
        lName = parts.slice(1).join(" ");
      }

      const updated = await UserModel.updateProfile(req.user.id, {
        firstName: fName,
        lastName: lName,
        phone,
        avatarUrl: avatar_url,
      });

      return res.json({
        message: "Profile updated successfully",
        user: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update email address
   */
  async updateEmail(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if email already in use
      const existing = await UserModel.findByEmail(email);
      if (existing && existing.id !== req.user.id) {
        return res.status(409).json({ error: "Email is already taken by another account" });
      }

      const updated = await UserModel.updateEmail(req.user.id, email);
      return res.json({
        message: "Email updated successfully. Please verify your new email.",
        user: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update phone number
   */
  async updatePhone(req, res, next) {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const updated = await UserModel.updatePhone(req.user.id, phone);
      return res.json({
        message: "Phone number updated successfully",
        user: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Deactivate current user's account
   */
  async deleteAccount(req, res, next) {
    try {
      await UserModel.deactivate(req.user.id);
      res.clearCookie("token");
      return res.json({
        message: "Account deactivated successfully",
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get user settings/preferences
   */
  async getSettings(req, res) {
    const user = await UserModel.findById(req.user.id);
    return res.json({
      settings: user ? user.settings || {} : {},
    });
  },

  /**
   * Update user settings/preferences
   */
  async updateSettings(req, res, next) {
    try {
      const newSettings = req.body.settings || req.body;
      const current = req.user.settings || {};
      const merged = { ...current, ...newSettings };

      const updated = await UserModel.updateSettings(req.user.id, merged);
      return res.json({
        message: "Settings updated successfully",
        settings: updated.settings,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = UserController;
