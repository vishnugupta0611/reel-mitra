const db = require("../config/db");

const ChatModel = {
  /**
   * Find existing conversation between client & editor or create a new one
   */
  async findOrCreateConversation({ clientId, editorId, orderId = null }) {
    // 1. Try finding existing conversation
    let findQuery = `
      SELECT * FROM conversations
      WHERE client_id = $1 AND editor_id = $2
    `;
    const findValues = [clientId, editorId];

    if (orderId) {
      findQuery += " AND order_id = $3";
      findValues.push(orderId);
    } else {
      findQuery += " AND order_id IS NULL";
    }

    const { rows: existing } = await db.query(findQuery, findValues);
    if (existing.length > 0) return existing[0];

    // 2. Create if not found
    const insertQuery = `
      INSERT INTO conversations (client_id, editor_id, order_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows: created } = await db.query(insertQuery, [clientId, editorId, orderId]);
    return created[0];
  },

  /**
   * List conversations for a user
   */
  async findUserConversations(userId) {
    const query = `
      SELECT 
        c.*,
        u_client.first_name AS client_name,
        u_client.avatar_url AS client_avatar,
        ep.display_name AS editor_name,
        (
          SELECT message_text 
          FROM messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) AS last_message,
        (
          SELECT created_at 
          FROM messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) AS last_message_at
      FROM conversations c
      JOIN users u_client ON c.client_id = u_client.id
      JOIN editor_profiles ep ON c.editor_id = ep.id
      WHERE c.client_id = $1 OR ep.user_id = $1
      ORDER BY last_message_at DESC NULLS LAST;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows;
  },

  /**
   * Add message to conversation
   */
  async createMessage({ conversationId, senderId, messageText, messageType = "text" }) {
    const query = `
      INSERT INTO messages (conversation_id, sender_id, message_text, message_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [conversationId, senderId, messageText, messageType]);
    return rows[0];
  },

  /**
   * Fetch messages in chronological order with pagination
   */
  async getMessages(conversationId, limit = 50, offset = 0) {
    const query = `
      SELECT 
        m.*,
        u.first_name AS sender_name,
        u.role AS sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3;
    `;
    const { rows } = await db.query(query, [conversationId, limit, offset]);
    return rows;
  }
};

module.exports = ChatModel;
