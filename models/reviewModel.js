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
   * Create a review and update editor rating stats atomically
   */
  async create({ orderId = null, reviewerId, editorId, rating, comment = null }) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `INSERT INTO reviews (order_id, reviewer_id, editor_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *;`,
        [orderId, reviewerId, editorId, rating, comment]
      );

      await client.query(
        `UPDATE editor_profiles
         SET average_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE editor_id = $1), 0.00),
             total_reviews = (SELECT COUNT(id)::int FROM reviews WHERE editor_id = $1)
         WHERE id = $1;`,
        [editorId]
      );

      await client.query("COMMIT");
      return rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
};

module.exports = ReviewModel;
