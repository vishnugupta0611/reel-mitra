const MediaModel = require("../models/mediaModel");
const {
  isCloudinaryConfigured,
  generateUploadSignature,
  uploadBuffer,
  destroyAsset,
} = require("../config/cloudinary");

const ALLOWED_FOLDERS = ["avatars", "portfolio", "orders", "deliverables", "chat", "general"];

function detectMediaType(mimeType = "") {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "document";
  return "other";
}

function getCloudinaryResourceType(mediaType) {
  if (mediaType === "video" || mediaType === "audio") return "video";
  if (mediaType === "image") return "image";
  return "raw";
}

const UploadController = {
  /**
   * Initiate direct Cloudinary upload (returns signed parameters + media_files ID)
   */
  async initiate(req, res, next) {
    try {
      const { file_name, mime_type, size_bytes = 0, folder = "general", order_id = null } = req.body;

      if (!file_name || !mime_type) {
        return res.status(400).json({ error: "file_name and mime_type are required" });
      }

      const detectedMediaType = detectMediaType(mime_type);
      if (detectedMediaType === "other") {
        return res.status(400).json({ error: "Unsupported file type. Allowed: image, video, audio, pdf" });
      }

      const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : "general";
      const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]+$/, "");
      const cloudinaryFolder = `reelmitra/${safeFolder}/${req.user.id}`;
      const publicId = `${Date.now()}_${safeName}`;
      const storageKey = `${cloudinaryFolder}/${publicId}`;

      const mediaFile = await MediaModel.createMediaFile({
        uploadedBy: req.user.id,
        orderId: order_id,
        fileName: file_name.replace(/[^a-zA-Z0-9._-]/g, "_"),
        storageKey,
        mediaType: detectedMediaType,
        mimeType: mime_type,
        sizeBytes: parseInt(size_bytes, 10) || 0,
        uploadStatus: "pending",
        visibility: safeFolder === "avatars" || safeFolder === "portfolio" ? "public" : "private",
      });

      const signData = generateUploadSignature({
        folder: cloudinaryFolder,
        publicId,
      });

      const resourceType = getCloudinaryResourceType(detectedMediaType);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${signData.cloud_name}/${resourceType}/upload`;

      return res.status(201).json({
        message: "Cloudinary upload initiated",
        upload_id: mediaFile.id,
        storage_key: storageKey,
        upload_url: uploadUrl,
        resource_type: resourceType,
        cloudinary: signData,
        file: mediaFile,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upload file directly via server to Cloudinary (ideal for avatars, thumbnails, chat images/videos)
   */
  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded. Use form field name 'file'" });
      }

      if (!isCloudinaryConfigured()) {
        return res.status(500).json({ error: "Cloudinary credentials are not configured in .env" });
      }

      const folder = ALLOWED_FOLDERS.includes(req.body.folder) ? req.body.folder : "general";
      const orderId = req.body.order_id || null;
      const detectedMediaType = detectMediaType(req.file.mimetype);
      const resourceType = getCloudinaryResourceType(detectedMediaType);

      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]+$/, "");
      const cloudinaryFolder = `reelmitra/${folder}/${req.user.id}`;
      const publicId = `${Date.now()}_${safeName}`;

      const result = await uploadBuffer(req.file.buffer, {
        folder: cloudinaryFolder,
        publicId,
        resourceType,
      });

      const mediaFile = await MediaModel.createMediaFile({
        uploadedBy: req.user.id,
        orderId,
        fileName: req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"),
        storageKey: result.public_id,
        fileUrl: result.secure_url,
        mediaType: detectedMediaType,
        mimeType: req.file.mimetype,
        sizeBytes: result.bytes || req.file.size,
        uploadStatus: "uploaded",
        visibility: folder === "avatars" || folder === "portfolio" ? "public" : "private",
      });

      return res.status(201).json({
        message: "File uploaded to Cloudinary successfully",
        url: result.secure_url,
        public_id: result.public_id,
        media_file: mediaFile,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Complete and confirm a direct Cloudinary upload
   */
  async complete(req, res, next) {
    try {
      const { upload_id } = req.params;
      const { secure_url, file_url, public_id, storage_key, size_bytes } = req.body || {};

      const mediaFile = await MediaModel.findById(upload_id);
      if (!mediaFile) {
        return res.status(404).json({ error: "Upload session not found" });
      }

      if (mediaFile.uploaded_by !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized access to this upload" });
      }

      const finalUrl = secure_url || file_url || mediaFile.file_url;
      const finalKey = public_id || storage_key || mediaFile.storage_key;
      const finalSize = size_bytes !== undefined ? parseInt(size_bytes, 10) : null;

      const updated = await MediaModel.updateUploadStatus(upload_id, "uploaded", {
        fileUrl: finalUrl,
        storageKey: finalKey,
        sizeBytes: finalSize,
      });

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
        file_url: mediaFile.file_url,
        media_type: mediaFile.media_type,
        mime_type: mediaFile.mime_type,
        size_bytes: mediaFile.size_bytes,
        created_at: mediaFile.created_at,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete uploaded asset from Cloudinary & DB
   */
  async deleteFile(req, res, next) {
    try {
      const { upload_id } = req.params;

      const mediaFile = await MediaModel.findById(upload_id);
      if (!mediaFile) {
        return res.status(404).json({ error: "Media file not found" });
      }

      if (mediaFile.uploaded_by !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized access to this file" });
      }

      if (isCloudinaryConfigured() && mediaFile.storage_key) {
        const resourceType = getCloudinaryResourceType(mediaFile.media_type);
        await destroyAsset(mediaFile.storage_key, resourceType).catch((err) => {
          console.warn("Cloudinary delete warning:", err.message);
        });
      }

      await MediaModel.delete(upload_id);
      return res.json({ message: "Media file deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = UploadController;
