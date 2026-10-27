const db = require("../config/db");

const EditorProfileModel = {
  /**
   * Create an editor profile linked to a user account
   */
  async create({ userId, displayName, bio = null, experienceYears = 0, pricingFrom = 0.00, availabilityStatus = "available" }) {
    const query = `
      INSERT INTO editor_profiles (
        user_id, display_name, bio, experience_years, pricing_from, availability_status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, display_name, bio, experience_years, pricing_from, availability_status, average_rating, total_reviews, created_at, updated_at;
    `;
    const values = [userId, displayName, bio, experienceYears, pricingFrom, availabilityStatus];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  /**
   * Find profile by user_id
   */
  async findByUserId(userId) {
    const query = `
      SELECT ep.*, u.first_name, u.last_name, u.email, u.avatar_url
      FROM editor_profiles ep
      JOIN users u ON ep.user_id = u.id
      WHERE ep.user_id = $1;
    `;
    const { rows } = await db.query(query, [userId]);
    return rows[0] || null;
  },

  /**
   * Find profile by editor_profiles.id
   */
  async findById(id) {
    const query = `
      SELECT ep.*, u.first_name, u.last_name, u.email, u.avatar_url
      FROM editor_profiles ep
      JOIN users u ON ep.user_id = u.id
      WHERE ep.id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Browse and filter editors with category, search, price, experience, sorting, and pagination
   */
  async findAll({
    categoryId = null,
    availability = null,
    minRating = null,
    minPrice = null,
    maxPrice = null,
    experience = null,
    search = null,
    sortBy = "rating",
    order = "desc",
    limit = 12,
    offset = 0
  }) {
    let whereClauses = ["u.is_active = TRUE"];
    const values = [];
    let paramIndex = 1;

    if (minRating !== null && minRating !== undefined) {
      whereClauses.push(`ep.average_rating >= $${paramIndex++}`);
      values.push(minRating);
    }

    if (minPrice !== null && minPrice !== undefined) {
      whereClauses.push(`ep.pricing_from >= $${paramIndex++}`);
      values.push(minPrice);
    }

    if (maxPrice !== null && maxPrice !== undefined) {
      whereClauses.push(`ep.pricing_from <= $${paramIndex++}`);
      values.push(maxPrice);
    }

    if (experience !== null && experience !== undefined) {
      whereClauses.push(`ep.experience_years >= $${paramIndex++}`);
      values.push(experience);
    }

    if (availability) {
      whereClauses.push(`ep.availability_status = $${paramIndex++}`);
      values.push(availability);
    }

    if (categoryId) {
      whereClauses.push(`ec.category_id = $${paramIndex++}`);
      values.push(categoryId);
    }

    if (search) {
      whereClauses.push(`(ep.display_name ILIKE $${paramIndex} OR ep.bio ILIKE $${paramIndex})`);
      values.push(`%${search}%`);
      paramIndex++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Count total unique matching editors
    const countQuery = `
      SELECT COUNT(DISTINCT ep.id) AS total
      FROM editor_profiles ep
      JOIN users u ON ep.user_id = u.id
      LEFT JOIN editor_categories ec ON ep.id = ec.editor_id
      ${whereSql};
    `;
    const countRes = await db.query(countQuery, values);
    const total = parseInt(countRes.rows[0].total, 10);

    // Sorting
    let sortSql = "ep.average_rating DESC, ep.total_reviews DESC";
    const dir = order.toLowerCase() === "asc" ? "ASC" : "DESC";

    if (sortBy === "price") {
      sortSql = `ep.pricing_from ${dir}, ep.average_rating DESC`;
    } else if (sortBy === "experience") {
      sortSql = `ep.experience_years ${dir}, ep.average_rating DESC`;
    } else if (sortBy === "newest") {
      sortSql = `ep.created_at ${dir}`;
    } else if (sortBy === "rating") {
      sortSql = `ep.average_rating ${dir}, ep.total_reviews DESC`;
    }

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
        ep.created_at,
        u.avatar_url,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug,
              'experience_years', ec.experience_years
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS categories
      FROM editor_profiles ep
      JOIN users u ON ep.user_id = u.id
      LEFT JOIN editor_categories ec ON ep.id = ec.editor_id
      LEFT JOIN categories c ON ec.category_id = c.id
      ${whereSql}
      GROUP BY ep.id, u.avatar_url
      ORDER BY ${sortSql}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;
    values.push(limit, offset);

    const { rows } = await db.query(query, values);
    return { items: rows, total };
  },

  /**
   * Update availability status
   */
  async updateAvailability(id, availabilityStatus) {
    const query = `
      UPDATE editor_profiles
      SET availability_status = $1
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [availabilityStatus, id]);
    return rows[0] || null;
  },

  /**
   * Update editor profile
   */
  async update(id, { displayName, bio, experienceYears, pricingFrom, availabilityStatus }) {
    const query = `
      UPDATE editor_profiles
      SET
        display_name = COALESCE($1, display_name),
        bio = COALESCE($2, bio),
        experience_years = COALESCE($3, experience_years),
        pricing_from = COALESCE($4, pricing_from),
        availability_status = COALESCE($5, availability_status)
      WHERE id = $6
      RETURNING *;
    `;
    const { rows } = await db.query(query, [displayName, bio, experienceYears, pricingFrom, availabilityStatus, id]);
    return rows[0] || null;
  }
};

module.exports = EditorProfileModel;
