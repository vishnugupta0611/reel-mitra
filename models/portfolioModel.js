const db = require("../config/db");

const PortfolioModel = {
  /**
   * Add portfolio item for editor
   */
  async create({ editorId, categoryId = null, title, description = null, mediaUrl, thumbnailUrl = null, sortOrder = 0 }) {
    const query = `
      INSERT INTO portfolio_items (
        editor_id, category_id, title, description, media_url, thumbnail_url, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [editorId, categoryId, title, description, mediaUrl, thumbnailUrl, sortOrder];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  /**
   * Get all portfolio items for an editor
   */
  async findByEditorId(editorId) {
    const query = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM portfolio_items p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.editor_id = $1
      ORDER BY p.sort_order ASC, p.created_at DESC;
    `;
    const { rows } = await db.query(query, [editorId]);
    return rows;
  },

  /**
   * Find a specific portfolio item by ID
   */
  async findById(id) {
    const query = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM portfolio_items p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Update a portfolio item (with editor ownership check)
   */
  async update(id, editorId, { title, description, mediaUrl, thumbnailUrl, categoryId, sortOrder }) {
    const query = `
      UPDATE portfolio_items
      SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        media_url = COALESCE($3, media_url),
        thumbnail_url = COALESCE($4, thumbnail_url),
        category_id = COALESCE($5, category_id),
        sort_order = COALESCE($6, sort_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND editor_id = $8
      RETURNING *;
    `;
    const values = [title, description, mediaUrl, thumbnailUrl, categoryId, sortOrder, id, editorId];
    const { rows } = await db.query(query, values);
    return rows[0] || null;
  },

  /**
   * Reorder portfolio items in a transaction
   */
  async reorder(editorId, items) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      for (const item of items) {
        if (item.id && typeof item.sort_order === "number") {
          await client.query(
            "UPDATE portfolio_items SET sort_order = $1 WHERE id = $2 AND editor_id = $3",
            [item.sort_order, item.id, editorId]
          );
        }
      }
      await client.query("COMMIT");
      return await this.findByEditorId(editorId);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Delete a portfolio item (only owner can delete)
   */
  async delete(id, editorId) {
    const query = `
      DELETE FROM portfolio_items
      WHERE id = $1 AND editor_id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, editorId]);
    return rows[0] || null;
  }
};

module.exports = PortfolioModel;
