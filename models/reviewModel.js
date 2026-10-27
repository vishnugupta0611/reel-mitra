const db = require("../config/db");

const ReviewModel = {
  /**
   * Find reviews for an editor
   */
  async findByEditorId(editorId, limit = 20, offset = 0) {
    const query = `
      SELECT 
        r.id,
        r.order_id,
        r.rating,
        r.comment,
        r.created_at,
        u.id AS reviewer_id,
        u.first_name,
        u.last_name,
        u.avatar_url
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.editor_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const { rows } = await db.query(query, [editorId, limit, offset]);
    return rows;
  },

  /**
   * Get total reviews and average rating
   */
  async getEditorRatingSummary(editorId) {
    const query = `
      SELECT 
        COALESCE(ROUND(AVG(rating)::numeric, 2), 0.00) AS average_rating,
        COUNT(id)::int AS total_reviews
      FROM reviews
      WHERE editor_id = $1;
    `;
    const { rows } = await db.query(query, [editorId]);
    return rows[0] || { average_rating: 0, total_reviews: 0 };
  },

  /**
   * Create a review
   */
  async create({ orderId = null, reviewerId, editorId, rating, comment = null }) {
    const query = `
      INSERT INTO reviews (order_id, reviewer_id, editor_id, rating, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [orderId, reviewerId, editorId, rating, comment]);
    return rows[0];
  }
};

module.exports = ReviewModel;
