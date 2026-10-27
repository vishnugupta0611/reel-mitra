const MediaModel = require("../models/mediaModel");

const UploadController = {
  /**
   * Initiate file upload session and get presigned/authorized upload target
   */
  async initiate(req, res, next) {
    try {
      const { file_name, mime_type, size_bytes = 0, media_type = "video" } = req.body;

      if (!file_name || !mime_type) {
        return res.status(400).json({ error: "file_name and mime_type are required" });
      }

      // Sanitize filename and create unique storage key
      const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storageKey = `uploads/${req.user.id}/${Date.now()}_${safeName}`;

      let detectedMediaType = media_type;
      if (mime_type.startsWith("image/")) detectedMediaType = "image";
      else if (mime_type.startsWith("video/")) detectedMediaType = "video";
      else if (mime_type.startsWith("audio/")) detectedMediaType = "audio";

      const mediaFile = await MediaModel.createMediaFile({
        uploadedBy: req.user.id,
        orderId: null,
        fileName: safeName,
        storageKey,
        mediaType: detectedMediaType,
        mimeType: mime_type,
        sizeBytes: parseInt(size_bytes, 10) || 0,
        uploadStatus: "pending",
        visibility: "private",
      });

      // Construct direct upload endpoint / signed mock URL
      const uploadUrl = `https://storage.reelmitra.com/direct/${mediaFile.id}`;

      return res.status(201).json({
        message: "Upload initiated successfully",
        upload_id: mediaFile.id,
        storage_key: storageKey,
        upload_url: uploadUrl,
        expires_in: 3600,
        file: mediaFile,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Complete and verify uploaded file
   */
  async complete(req, res, next) {
    try {
      const { upload_id } = req.params;

      const mediaFile = await MediaModel.findById(upload_id);
      if (!mediaFile) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      if (mediaFile.uploaded_by !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized access to this upload" });
      }

      const updated = await MediaModel.updateUploadStatus(upload_id, "uploaded");

      return res.json({
        message: "Upload marked as completed",
        media_file: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Check upload status and file metadata
   */
  async getStatus(req, res, next) {
    try {
      const { upload_id } = req.params;

      const mediaFile = await MediaModel.findById(upload_id);
      if (!mediaFile) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      if (mediaFile.uploaded_by !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized access to this upload" });
      }

      return res.json({
        upload_id: mediaFile.id,
        status: mediaFile.upload_status,
        file_name: mediaFile.file_name,
        storage_key: mediaFile.storage_key,
        media_type: mediaFile.media_type,
        mime_type: mediaFile.mime_type,
        size_bytes: mediaFile.size_bytes,
        created_at: mediaFile.created_at,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = UploadController;
