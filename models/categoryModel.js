const db = require("../config/db");

const CategoryModel = {
  /**
   * Create dynamic category (parent or child)
   */
  async create({ parentId = null, name, slug, description = null, sortOrder = 0, isActive = true }) {
    const query = `
      INSERT INTO categories (
        parent_id, name, slug, description, sort_order, is_active
      ) VALUES ($1, $2, LOWER(TRIM($3)), $4, $5, $6)
      RETURNING *;
    `;
    const values = [parentId, name, slug, description, sortOrder, isActive];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  /**
   * Get all active categories flat
   */
  async findAllFlat() {
    const query = `
      SELECT * FROM categories 
      WHERE is_active = TRUE 
      ORDER BY sort_order ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
  },

  /**
   * Get all active categories in a hierarchy (Parent categories with their subcategories)
   */
  async getHierarchy() {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.slug,
        p.description,
        p.sort_order,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug,
              'description', c.description,
              'sort_order', c.sort_order
            ) ORDER BY c.sort_order ASC
          ) FILTER (WHERE c.id IS NOT NULL AND c.is_active = TRUE),
          '[]'
        ) AS subcategories
      FROM categories p
      LEFT JOIN categories c ON c.parent_id = p.id
      WHERE p.parent_id IS NULL AND p.is_active = TRUE
      GROUP BY p.id
      ORDER BY p.sort_order ASC;
    `;
    const { rows } = await db.query(query);
    return rows;
  },

  /**
   * Find category by ID (UUID)
   */
  async findById(id) {
    const query = `
      SELECT * FROM categories 
      WHERE id = $1 AND is_active = TRUE;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Find category by slug
   */
  async findBySlug(slug) {
    const query = `
      SELECT * FROM categories 
      WHERE slug = LOWER(TRIM($1)) AND is_active = TRUE;
    `;
    const { rows } = await db.query(query, [slug]);
    return rows[0] || null;
  },

  /**
   * Find editors associated with a category
   */
  async findEditorsByCategoryId(categoryId) {
    const query = `
      SELECT 
        ep.id,
        ep.user_id,
        ep.display_name,
        ep.bio,
        ep.experience_years,
        ep.pricing_from,
        ep.availability_status,
        ep.average_rating,
        ep.total_reviews,
        ec.experience_years AS category_experience_years,
        u.avatar_url
      FROM editor_categories ec
      JOIN editor_profiles ep ON ec.editor_id = ep.id
      JOIN users u ON ep.user_id = u.id
      WHERE ec.category_id = $1 AND u.is_active = TRUE
      ORDER BY ep.average_rating DESC, ep.total_reviews DESC;
    `;
    const { rows } = await db.query(query, [categoryId]);
    return rows;
  },

  /**
   * Find categories for an editor
   */
  async findByEditorId(editorId) {
    const query = `
      SELECT 
        c.id,
        c.parent_id,
        c.name,
        c.slug,
        c.description,
        c.sort_order,
        ec.experience_years
      FROM editor_categories ec
      JOIN categories c ON ec.category_id = c.id
      WHERE ec.editor_id = $1 AND c.is_active = TRUE
      ORDER BY c.sort_order ASC;
    `;
    const { rows } = await db.query(query, [editorId]);
    return rows;
  },

  /**
   * Replace all categories for an editor
   */
  async setEditorCategories(editorId, categoryIds) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM editor_categories WHERE editor_id = $1", [editorId]);

      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        for (const catId of categoryIds) {
          await client.query(
            "INSERT INTO editor_categories (editor_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [editorId, catId]
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
   * Assign specialization category to editor
   */
  async assignToEditor(editorId, categoryId, experienceYears = 0) {
    const query = `
      INSERT INTO editor_categories (editor_id, category_id, experience_years)
      VALUES ($1, $2, $3)
      ON CONFLICT (editor_id, category_id) 
      DO UPDATE SET experience_years = EXCLUDED.experience_years
      RETURNING *;
    `;
    const { rows } = await db.query(query, [editorId, categoryId, experienceYears]);
    return rows[0];
  },

  /**
   * Remove specialization from editor
   */
  async removeFromEditor(editorId, categoryId) {
    const query = `
      DELETE FROM editor_categories 
      WHERE editor_id = $1 AND category_id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [editorId, categoryId]);
    return rows[0] || null;
  }
};

module.exports = CategoryModel;
