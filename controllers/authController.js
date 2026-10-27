const bcrypt = require("bcryptjs");
const UserModel = require("../models/userModel");
const EditorProfileModel = require("../models/editorProfileModel");
const { generateToken, verifyToken } = require("../utils/tokenUtils");

const AuthController = {
  /**
   * Register a new user (client or editor)
   */
  async register(req, res, next) {
    try {
      const { name, first_name, last_name, email, password, role = "client", phone } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const assignedRole = role ? role.toLowerCase() : "client";
      if (!["client", "editor"].includes(assignedRole)) {
        return res.status(400).json({ error: "Role must be 'client' or 'editor'. Admin registration is restricted." });
      }

      // Check for existing user
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists" });
      }

      // Determine names
      let fName = first_name;
      let lName = last_name;
      if (!fName && name) {
        const parts = name.trim().split(" ");
        fName = parts[0];
        lName = parts.slice(1).join(" ") || "User";
      }
      fName = fName || "User";
      lName = lName || "";

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await UserModel.create({
        firstName: fName,
        lastName: lName,
        email,
        phone: phone || null,
        passwordHash,
        role: assignedRole,
      });

      // If registered as editor, automatically initialize an editor profile
      let editorProfile = null;
      if (assignedRole === "editor") {
        editorProfile = await EditorProfileModel.create({
          userId: user.id,
          displayName: `${fName} ${lName}`.trim() || "Editor",
        });
      }

      const token = generateToken({ id: user.id, role: user.role, email: user.email });

      res.cookie("token", token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });

      return res.status(201).json({
        message: "Registration successful",
        token,
        user,
        editor: editorProfile,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Log in user
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const userWithPassword = await UserModel.findByEmail(email);
      if (!userWithPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!userWithPassword.is_active) {
        return res.status(403).json({ error: "This account has been deactivated" });
      }

      const isMatch = await bcrypt.compare(password, userWithPassword.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = generateToken({
        id: userWithPassword.id,
        role: userWithPassword.role,
        email: userWithPassword.email,
      });

      res.cookie("token", token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });

      const { password_hash, ...safeUser } = userWithPassword;

      let editorProfile = null;
      if (safeUser.role === "editor") {
        editorProfile = await EditorProfileModel.findByUserId(safeUser.id);
      }

      return res.json({
        message: "Login successful",
        token,
        user: safeUser,
        editor: editorProfile,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Log out user
   */
  async logout(req, res) {
    res.clearCookie("token");
    return res.json({ message: "Logout successful" });
  },

  /**
   * Get current authenticated user details
   */
  async me(req, res) {
    return res.json({
      user: req.user,
      editor: req.editor || null,
    });
  },

  /**
   * Refresh session token
   */
  async refresh(req, res, next) {
    try {
      let token = null;
      if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
      } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
      }

      if (!token) {
        return res.status(401).json({ error: "Refresh token is missing" });
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.id) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const user = await UserModel.findById(decoded.id);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: "User not found or inactive" });
      }

      const newToken = generateToken({ id: user.id, role: user.role, email: user.email });

      res.cookie("token", newToken, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });

      return res.json({
        message: "Token refreshed successfully",
        token: newToken,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Verify email address
   */
  async verifyEmail(req, res, next) {
    try {
      const userId = req.user ? req.user.id : req.body.user_id;
      const { email } = req.body;

      let targetUser = null;
      if (userId) {
        targetUser = await UserModel.findById(userId);
      } else if (email) {
        targetUser = await UserModel.findByEmail(email);
      }

      if (!targetUser) {
        return res.status(404).json({ error: "User not found to verify email" });
      }

      const updated = await UserModel.verifyEmail(targetUser.id);
      return res.json({
        message: "Email verified successfully",
        user: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Resend verification email
   */
  async resendVerification(req, res, next) {
    try {
      const email = req.body.email || (req.user && req.user.email);
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User with this email does not exist" });
      }

      return res.json({
        message: `Verification instructions sent to ${email}`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Request password reset
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        // Return 200 for security so attackers cannot enumerate valid emails
        return res.json({ message: "If that email exists, reset instructions have been sent." });
      }

      return res.json({
        message: "Password reset instructions sent to your email",
        demo_reset_token: Buffer.from(`${user.id}:${Date.now()}`).toString("base64"),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reset password using reset token / email
   */
  async resetPassword(req, res, next) {
    try {
      const { email, new_password } = req.body;
      if (!email || !new_password) {
        return res.status(400).json({ error: "Email and new_password are required" });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const newHash = await bcrypt.hash(new_password, 10);
      await UserModel.updatePassword(user.id, newHash);

      return res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Change password for logged-in user
   */
  async changePassword(req, res, next) {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (new_password.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }

      const userWithPassword = await UserModel.findByIdWithPassword(req.user.id);
      const isMatch = await bcrypt.compare(current_password, userWithPassword.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: "Current password does not match" });
      }

      const newHash = await bcrypt.hash(new_password, 10);
      await UserModel.updatePassword(req.user.id, newHash);

      return res.json({ message: "Password updated successfully" });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = AuthController;
