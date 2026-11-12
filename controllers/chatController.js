const ChatModel = require("../models/chatModel");
const EditorProfileModel = require("../models/editorProfileModel");
const OrderModel = require("../models/orderModel");
const UserModel = require("../models/userModel");
const MediaModel = require("../models/mediaModel");

function isUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || "");
}

function isParticipant(conversation, user) {
  return (
    user.role === "admin" ||
    conversation.client_id === user.id ||
    conversation.editor_user_id === user.id
  );
}

const ChatController = {
  /**
   * Start or retrieve a conversation between client and editor (optionally scoped to order_id)
   */
  async createOrGetConversation(req, res, next) {
    try {
      const { editor_id, client_id, order_id = null } = req.body;
      let clientId = null;
      let editorId = null;

      if (order_id) {
        if (!isUuid(order_id)) {
          return res.status(400).json({ error: "Invalid order_id format" });
        }
        const order = await OrderModel.findById(order_id);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        if (
          req.user.role !== "admin" &&
          order.client_id !== req.user.id &&
          order.editor_user_id !== req.user.id
        ) {
          return res.status(403).json({ error: "Unauthorized access to this order" });
        }
        clientId = order.client_id;
        editorId = order.editor_id;
      } else if (editor_id) {
        if (!isUuid(editor_id)) {
          return res.status(400).json({ error: "Invalid editor_id format" });
        }
        const editor = await EditorProfileModel.findById(editor_id);
        if (!editor) {
          return res.status(404).json({ error: "Editor not found" });
        }
        if (editor.user_id === req.user.id) {
          return res.status(400).json({ error: "Cannot start a conversation with yourself" });
        }
        clientId = req.user.id;
        editorId = editor.id;
      } else if (client_id) {
        if (!req.editor) {
          return res.status(403).json({ error: "Only editors can initiate conversations by client_id" });
        }
        if (!isUuid(client_id)) {
          return res.status(400).json({ error: "Invalid client_id format" });
        }
        const clientUser = await UserModel.findById(client_id);
        if (!clientUser) {
          return res.status(404).json({ error: "Client user not found" });
        }
        if (clientUser.id === req.user.id) {
          return res.status(400).json({ error: "Cannot start a conversation with yourself" });
        }
        clientId = clientUser.id;
        editorId = req.editor.id;
      } else {
        return res.status(400).json({ error: "editor_id, client_id, or order_id is required" });
      }

      const { conversation, created } = await ChatModel.findOrCreateConversation({
        clientId,
        editorId,
        orderId: order_id || null,
      });

      const fullConversation = await ChatModel.findConversationById(conversation.id);

      return res.status(created ? 201 : 200).json({
        message: created ? "Conversation created" : "Conversation retrieved",
        conversation: fullConversation,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List conversations for logged-in client or editor
   */
  async listConversations(req, res, next) {
    try {
      const conversations = await ChatModel.findUserConversations(req.user.id);
      return res.json({ conversations });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get chronological messages inside a conversation
   */
  async getMessages(req, res, next) {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }

      const conversation = await ChatModel.findConversationById(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (!isParticipant(conversation, req.user)) {
        return res.status(403).json({ error: "Unauthorized access to this conversation" });
      }

      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
      const offset = (page - 1) * limit;

      const messages = await ChatModel.getMessages(id, limit, offset);
      return res.json({
        conversation,
        messages,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send a text or Cloudinary media message in a conversation
   */
  async sendMessage(req, res, next) {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }

      const conversation = await ChatModel.findConversationById(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      if (!isParticipant(conversation, req.user)) {
        return res.status(403).json({ error: "Unauthorized access to this conversation" });
      }

      const { message_text, media_url, media_file_id } = req.body;
      const text = typeof message_text === "string" ? message_text.trim() : "";
      let finalMediaUrl = media_url ? String(media_url).trim() : null;
      let finalMediaFileId = null;

      if (media_file_id) {
        if (!isUuid(media_file_id)) {
          return res.status(400).json({ error: "Invalid media_file_id format" });
        }
        const mediaFile = await MediaModel.findById(media_file_id);
        if (!mediaFile) {
          return res.status(404).json({ error: "Media file not found" });
        }
        if (mediaFile.uploaded_by !== req.user.id && mediaFile.visibility === "private" && req.user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized access to this media file" });
        }
        finalMediaFileId = mediaFile.id;
        finalMediaUrl = finalMediaUrl || mediaFile.file_url || null;
      }

      if (!text && !finalMediaUrl && !finalMediaFileId) {
        return res.status(400).json({ error: "message_text, media_url, or media_file_id is required" });
      }

      const messageType = finalMediaUrl || finalMediaFileId ? "file" : "text";
      const message = await ChatModel.createMessage({
        conversationId: id,
        senderId: req.user.id,
        messageText: text,
        messageType,
        mediaUrl: finalMediaUrl,
        mediaFileId: finalMediaFileId,
      });

      return res.status(201).json({
        message: "Message sent",
        data: message,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = ChatController;
