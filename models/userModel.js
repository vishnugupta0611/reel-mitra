const db = require("../config/db");

const UserModel = {
  /**
   * Create a new user (client, editor, or admin)
   */
  async create({ firstName, lastName, email, phone = null, passwordHash, role = "client", avatarUrl = null }) {
    const query = `
      INSERT INTO users (
        first_name, last_name, email, phone, password_hash, role, avatar_url
      ) VALUES ($1, $2, LOWER(TRIM($3)), $4, $5, $6, $7)
      RETURNING id, first_name, last_name, email, phone, role, avatar_url, is_active, email_verified_at, created_at, updated_at;
    `;
    const values = [firstName, lastName, email, phone, passwordHash, role, avatarUrl];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  /**
   * Find user by email (case-insensitive)
   */
  async findByEmail(email) {
    const query = `
      SELECT * FROM users 
      WHERE LOWER(email) = LOWER(TRIM($1));
    `;
    const { rows } = await db.query(query, [email]);
    return rows[0] || null;
  },

  /**
   * Find user by ID (excludes password_hash for safety)
   */
  async findById(id) {
    const query = `
      SELECT id, first_name, last_name, email, phone, role, avatar_url, is_active, settings, email_verified_at, created_at, updated_at
      FROM users
      WHERE id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Find user by ID including password hash (internal auth only)
   */
  async findByIdWithPassword(id) {
    const query = `
      SELECT * FROM users
      WHERE id = $1;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Update profile fields
   */
  async updateProfile(id, { firstName, lastName, phone, avatarUrl }) {
    const query = `
      UPDATE users
      SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        avatar_url = COALESCE($4, avatar_url)
      WHERE id = $5
      RETURNING id, first_name, last_name, email, phone, role, avatar_url, settings, updated_at;
    `;
    const { rows } = await db.query(query, [firstName, lastName, phone, avatarUrl, id]);
    return rows[0] || null;
  },

  /**
   * Update password hash
   */
  async updatePassword(id, passwordHash) {
    const query = `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      RETURNING id;
    `;
    const { rows } = await db.query(query, [passwordHash, id]);
    return rows[0] || null;
  },

  /**
   * Update email address
   */
  async updateEmail(id, email) {
    const query = `
      UPDATE users
      SET email = LOWER(TRIM($1)), email_verified_at = NULL
      WHERE id = $2
      RETURNING id, email, updated_at;
    `;
    const { rows } = await db.query(query, [email, id]);
    return rows[0] || null;
  },

  /**
   * Update phone number
   */
  async updatePhone(id, phone) {
    const query = `
      UPDATE users
      SET phone = $1
      WHERE id = $2
      RETURNING id, phone, updated_at;
    `;
    const { rows } = await db.query(query, [phone, id]);
    return rows[0] || null;
  },

  /**
   * Deactivate user account (soft delete)
   */
  async deactivate(id) {
    const query = `
      UPDATE users
      SET is_active = FALSE
      WHERE id = $1
      RETURNING id, is_active, updated_at;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Update settings json
   */
  async updateSettings(id, settings) {
    const query = `
      UPDATE users
      SET settings = $1
      WHERE id = $2
      RETURNING id, settings, updated_at;
    `;
    const { rows } = await db.query(query, [JSON.stringify(settings), id]);
    return rows[0] || null;
  },

  /**
   * Mark email verified
   */
  async verifyEmail(id) {
    const query = `
      UPDATE users
      SET email_verified_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, email_verified_at;
    `;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  }
};

module.exports = UserModel;
