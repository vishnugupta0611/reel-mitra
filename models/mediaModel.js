const db = require("../config/db");

const MediaModel = {
  /**
   * Insert metadata for an uploaded media file
   */
  async createMediaFile({
    uploadedBy,
    orderId = null,
    fileName,
    storageKey,
    mediaType,
    mimeType,
    sizeBytes,
    uploadStatus = "pending",
    visibility = "private",
  }) {
    const query = `
      INSERT INTO media_files (
        uploaded_by, order_id, file_name, storage_key,
        media_type, mime_type, size_bytes, upload_status, visibility
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      uploadedBy,
      orderId,
      fileName,
      storageKey,
      mediaType,
      mimeType,
      sizeBytes,
      uploadStatus,
      visibility,
    ];
    const { rows } = await db.query(query, values);
    return rows[0];
  },

  /**
   * Find media file by ID
   */
  async findById(id) {
    const query = `SELECT * FROM media_files WHERE id = $1;`;
    const { rows } = await db.query(query, [id]);
    return rows[0] || null;
  },

  /**
   * Update upload status (e.g. 'uploaded', 'failed')
   */
  async updateUploadStatus(id, uploadStatus) {
    const query = `
      UPDATE media_files
      SET upload_status = $1
      WHERE id = $2
      RETURNING *;
    `;
    const { rows } = await db.query(query, [uploadStatus, id]);
    return rows[0] || null;
  },

  /**
   * List files for an order
   */
  async findByOrderId(orderId) {
    const query = `
      SELECT mf.*, u.first_name, u.last_name
      FROM media_files mf
      JOIN users u ON mf.uploaded_by = u.id
      WHERE mf.order_id = $1
      ORDER BY mf.created_at DESC;
    `;
    const { rows } = await db.query(query, [orderId]);
    return rows;
  },

  /**
   * Submit deliverable version (preview, revision, final)
   */
  async createDeliverable({
    orderId,
    mediaFileId,
    deliverableType,
    submittedBy,
  }) {
    // Determine next version number for this order and deliverable type
    const versionQuery = `
      SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
      FROM order_deliverables
      WHERE order_id = $1 AND deliverable_type = $2;
    `;
    const vRes = await db.query(versionQuery, [orderId, deliverableType]);
    const nextVersion = vRes.rows[0].next_version;

    const query = `
      INSERT INTO order_deliverables (
        order_id, media_file_id, deliverable_type, version_number, submitted_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [
      orderId,
      mediaFileId,
      deliverableType,
      nextVersion,
      submittedBy,
    ]);
    return rows[0];
  },

  /**
   * List deliverables with media file details
   */
  async findDeliverables(orderId) {
    const query = `
      SELECT 
        od.*,
        mf.file_name,
        mf.storage_key,
        mf.media_type,
        mf.mime_type,
        mf.size_bytes,
        u.first_name AS submitted_by_name
      FROM order_deliverables od
      JOIN media_files mf ON od.media_file_id = mf.id
      JOIN users u ON od.submitted_by = u.id
      WHERE od.order_id = $1
      ORDER BY od.version_number DESC;
    `;
    const { rows } = await db.query(query, [orderId]);
    return rows;
  }
};

module.exports = MediaModel;

