const db = require("../config/db");

const ChatModel = {
  /**
   * Find existing conversation between client & editor or create a new one
   */
  async findOrCreateConversation({ clientId, editorId, orderId = null }) {
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
    if (existing.length > 0) {
      return { conversation: existing[0], created: false };
    }

    const insertQuery = `
      INSERT INTO conversations (client_id, editor_id, order_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows: created } = await db.query(insertQuery, [clientId, editorId, orderId]);
    return { conversation: created[0], created: true };
  },

  /**
   * Find conversation by ID with participant user IDs
   */
  async findConversationById(id) {
    const query = `
      SELECT
        c.*,
        u_client.first_name AS client_first_name,
        u_client.last_name AS client_last_name,
        u_client.avatar_url AS client_avatar,
        ep.user_id AS editor_user_id,
        ep.display_name AS editor_name
      FROM conversations c
      JOIN users u_client ON c.client_id = u_client.id
      JOIN editor_profiles ep ON c.editor_id = ep.id
      WHERE c.id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * List conversations for a user (as client or editor)
   */
  async findUserConversations(userId) {
    const query = `
      SELECT 
        c.*,
        u_client.first_name AS client_first_name,
        u_client.last_name AS client_last_name,
        u_client.avatar_url AS client_avatar,
        ep.user_id AS editor_user_id,
        ep.display_name AS editor_name,
        lm.message_text AS last_message,
        lm.message_type AS last_message_type,
        lm.media_url AS last_media_url,
        lm.created_at AS last_message_at
      FROM conversations c
      JOIN users u_client ON c.client_id = u_client.id
      JOIN editor_profiles ep ON c.editor_id = ep.id
      LEFT JOIN LATERAL (
        SELECT message_text, message_type, media_url, created_at
        FROM messages m
        WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT 1
      ) lm ON TRUE
      WHERE c.client_id = $1 OR ep.user_id = $1
      ORDER BY COALESCE(lm.created_at, c.updated_at, c.created_at) DESC;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows;
  },

  /**
   * Add text or media message to conversation and touch conversation.updated_at
   */
  async createMessage({
    conversationId,
    senderId,
    messageText,
    messageType = "text",
    mediaUrl = null,
    mediaFileId = null,
  }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `INSERT INTO messages (
           conversation_id, sender_id, message_text, message_type, media_url, media_file_id
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *;`,
        [conversationId, senderId, messageText, messageType, mediaUrl, mediaFileId]
      );

      await client.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1;",
        [conversationId]
      );

      await client.query("COMMIT");
      return rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Fetch messages in chronological order with pagination
   */
  async getMessages(conversationId, limit = 50, offset = 0) {
    const query = `
      SELECT 
        m.*,
        u.first_name AS sender_first_name,
        u.last_name AS sender_last_name,
        u.avatar_url AS sender_avatar,
        u.role AS sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1 AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC
      LIMIT $2 OFFSET $3;
    `;
    const { rows } = await db.query(query, [conversationId, limit, offset]);
    return rows;
  },
};

module.exports = ChatModel;
