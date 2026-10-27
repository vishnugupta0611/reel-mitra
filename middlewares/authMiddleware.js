const { verifyToken } = require("../utils/tokenUtils");
const UserModel = require("../models/userModel");
const EditorProfileModel = require("../models/editorProfileModel");

async function authenticate(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({ error: "Invalid or expired session token" });
  }

  try {
    const user = await UserModel.findById(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: "User account not found or deactivated" });
    }

    req.user = user;

    if (user.role === "editor") {
      let editorProfile = await EditorProfileModel.findByUserId(user.id);
      if (!editorProfile) {
        editorProfile = await EditorProfileModel.create({
          userId: user.id,
          displayName: `${user.first_name} ${user.last_name}`.trim() || "Editor",
        });
      }
      req.editor = editorProfile;
    }

    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied: insufficient permissions" });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
};
