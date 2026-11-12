const express = require("express");
const router = express.Router();
const ChatController = require("../controllers/chatController");
const { authenticate } = require("../middlewares/authMiddleware");

router.use(authenticate);

router.post("/", ChatController.createOrGetConversation);
router.get("/", ChatController.listConversations);
router.get("/:id/messages", ChatController.getMessages);
router.post("/:id/messages", ChatController.sendMessage);

module.exports = router;
