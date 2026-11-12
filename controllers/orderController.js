const OrderModel = require("../models/orderModel");
const EditorProfileModel = require("../models/editorProfileModel");
const CategoryModel = require("../models/categoryModel");
const MediaModel = require("../models/mediaModel");
const PaymentModel = require("../models/paymentModel");
const EarningModel = require("../models/earningModel");
const ReviewModel = require("../models/reviewModel");

const PLATFORM_COMMISSION_PERCENT = 20.0;

function isUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val || "");
}

function isOrderParticipant(order, user) {
  return (
    user.role === "admin" ||
    order.client_id === user.id ||
    order.editor_user_id === user.id
  );
}

const OrderController = {
  /**
   * Customer creates an order and pre-saves 20% platform_fee / 80% editor_amount
   */
  async createOrder(req, res, next) {
    try {
      const {
        editor_id,
        category_id,
        title,
        brief,
        requested_deadline,
        amount,
        budget,
        currency = "INR",
        revision_limit = 2,
      } = req.body;

      const orderAmount = parseFloat(amount !== undefined ? amount : budget);
      if (!editor_id || !category_id || !title || !brief || !requested_deadline || !Number.isFinite(orderAmount) || orderAmount <= 0) {
        return res.status(400).json({
          error: "editor_id, category_id, title, brief, requested_deadline, and a positive amount are required",
        });
      }

      if (!isUuid(editor_id) || !isUuid(category_id)) {
        return res.status(400).json({ error: "Invalid editor_id or category_id format" });
      }

      const editor = await EditorProfileModel.findById(editor_id);
      if (!editor) {
        return res.status(404).json({ error: "Selected editor not found" });
      }

      if (editor.user_id === req.user.id) {
        return res.status(400).json({ error: "You cannot place an order for your own editor profile" });
      }

      const category = await CategoryModel.findById(category_id);
      if (!category) {
        return res.status(404).json({ error: "Selected category not found" });
      }

      // Rule 2: Calculate and save commission percentage & amounts at order creation
      const platformFee = Number(((orderAmount * PLATFORM_COMMISSION_PERCENT) / 100).toFixed(2));
      const editorAmount = Number((orderAmount - platformFee).toFixed(2));

      const order = await OrderModel.create({
        clientId: req.user.id,
        editorId: editor.id,
        categoryId: category.id,
        title: title.trim(),
        brief: brief.trim(),
        requestedDeadline: requested_deadline,
        amount: orderAmount,
        commissionPercent: PLATFORM_COMMISSION_PERCENT,
        platformFee,
        editorAmount,
        currency: String(currency).toUpperCase().slice(0, 3),
        revisionLimit: Math.max(0, parseInt(revision_limit, 10) || 0),
      });

      return res.status(201).json({
        message: "Order created successfully",
        order,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List orders for logged-in client or editor
   */
  async listOrders(req, res, next) {
    try {
      const { status } = req.query;
      const orders = await OrderModel.findByUser(req.user.id, req.user.role, status || null);
      return res.json({ orders });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single order details with timeline, deliverables, payments & earnings
   */
  async getOrderById(req, res, next) {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        return res.status(400).json({ error: "Invalid order ID" });
      }

      const order = await OrderModel.findById(id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (!isOrderParticipant(order, req.user)) {
        return res.status(403).json({ error: "Unauthorized access to this order" });
      }

      const [timeline, deliverables, payments, earning] = await Promise.all([
        OrderModel.getTimeline(order.id),
        MediaModel.findDeliverables(order.id),
        PaymentModel.findByOrderId(order.id),
        EarningModel.findByOrderId(order.id),
      ]);

      return res.json({
        order,
        timeline,
        deliverables,
        payments,
        earning,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Editor accepts pending order
   */
  async acceptOrder(req, res, next) {
    try {
      const { id } = req.params;
      if (!isUuid(id)) return res.status(400).json({ error: "Invalid order ID" });

      const order = await OrderModel.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (order.editor_user_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only the assigned editor can accept this order" });
      }

      if (!["pending", "pending_editor_review"].includes(order.status)) {
        return res.status(400).json({ error: `Cannot accept order in '${order.status}' status` });
      }

      const updated = await OrderModel.updateStatus({
        orderId: order.id,
        changedBy: req.user.id,
        newStatus: "accepted",
        note: req.body?.note || "Order accepted by editor.",
        timestampCol: "accepted_at",
      });

      return res.json({ message: "Order accepted", order: updated });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Cancel order (before completion)
   */
  async cancelOrder(req, res, next) {
    try {
      const { id } = req.params;
      if (!isUuid(id)) return res.status(400).json({ error: "Invalid order ID" });

      const order = await OrderModel.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (!isOrderParticipant(order, req.user)) {
        return res.status(403).json({ error: "Unauthorized access to this order" });
      }

      if (["completed", "cancelled"].includes(order.status)) {
        return res.status(400).json({ error: `Order is already '${order.status}'` });
      }

      const updated = await OrderModel.updateStatus({
        orderId: order.id,
        changedBy: req.user.id,
        newStatus: "cancelled",
        note: req.body?.note || "Order cancelled.",
        timestampCol: "cancelled_at",
      });

      return res.json({ message: "Order cancelled", order: updated });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Editor submits preview/revision/final deliverable (Cloudinary file/URL)
   */
  async submitDeliverable(req, res, next) {
    try {
      const { id } = req.params;
      const { media_file_id, media_url, file_name, mime_type = "video/mp4", deliverable_type = "preview" } = req.body;

      if (!isUuid(id)) return res.status(400).json({ error: "Invalid order ID" });
      if (!["preview", "revision", "final"].includes(deliverable_type)) {
        return res.status(400).json({ error: "deliverable_type must be 'preview', 'revision', or 'final'" });
      }

      const order = await OrderModel.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (order.editor_user_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only the assigned editor can submit deliverables" });
      }

      if (!["in_progress", "revision_requested", "preview_ready"].includes(order.status)) {
        return res.status(400).json({
          error: `Order must be paid and in progress before submitting deliverables (current status: '${order.status}')`,
        });
      }

      let mediaFileId = media_file_id;
      if (mediaFileId) {
        if (!isUuid(mediaFileId)) {
          return res.status(400).json({ error: "Invalid media_file_id format" });
        }
        const existingMedia = await MediaModel.findById(mediaFileId);
        if (!existingMedia) {
          return res.status(404).json({ error: "Media file not found" });
        }
        if (existingMedia.uploaded_by !== req.user.id && req.user.role !== "admin") {
          return res.status(403).json({ error: "Unauthorized access to this media file" });
        }
      } else {
        if (!media_url) {
          return res.status(400).json({ error: "Either media_file_id or media_url is required" });
        }
        const mediaRecord = await MediaModel.createMediaFile({
          uploadedBy: req.user.id,
          orderId: order.id,
          fileName: file_name || `${deliverable_type}_deliverable`,
          storageKey: media_url,
          fileUrl: media_url,
          mediaType: mime_type.startsWith("image/") ? "image" : "video",
          mimeType: mime_type,
          sizeBytes: 0,
          uploadStatus: "uploaded",
          visibility: "shared",
        });
        mediaFileId = mediaRecord.id;
      }

      const deliverable = await MediaModel.createDeliverable({
        orderId: order.id,
        mediaFileId,
        deliverableType: deliverable_type,
        submittedBy: req.user.id,
      });

      const updatedOrder = await OrderModel.updateStatus({
        orderId: order.id,
        changedBy: req.user.id,
        newStatus: "preview_ready",
        note: `Editor submitted ${deliverable_type} deliverable v${deliverable.version_number}.`,
      });

      return res.status(201).json({
        message: "Deliverable submitted successfully",
        deliverable,
        order: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Client requests revision on submitted preview
   */
  async requestRevision(req, res, next) {
    try {
      const { id } = req.params;
      if (!isUuid(id)) return res.status(400).json({ error: "Invalid order ID" });

      const order = await OrderModel.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (order.client_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only the client can request a revision" });
      }

      if (order.status !== "preview_ready") {
        return res.status(400).json({ error: "Revisions can only be requested when status is 'preview_ready'" });
      }

      const updated = await OrderModel.requestRevision({
        orderId: order.id,
        changedBy: req.user.id,
        note: req.body?.note,
      });

      return res.json({ message: "Revision requested", order: updated });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Client completes order -> unlocks editor_earnings from 'pending' to 'available'
   */
  async completeOrder(req, res, next) {
    try {
      const { id } = req.params;
      if (!isUuid(id)) return res.status(400).json({ error: "Invalid order ID" });

      const order = await OrderModel.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (order.client_id !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Only the client can mark the order completed" });
      }

      if (!order.payment_confirmed_at) {
        return res.status(400).json({ error: "Order cannot be completed before payment is verified" });
      }

      if (!["in_progress", "preview_ready", "approved"].includes(order.status)) {
        return res.status(400).json({ error: `Cannot complete order in '${order.status}' status` });
      }

      const updated = await OrderModel.completeOrder({
        orderId: order.id,
        changedBy: req.user.id,
        note: req.body?.note,
      });

      const earning = await EarningModel.findByOrderId(order.id);

      return res.json({
        message: "Order marked as completed",
        order: updated,
        earning,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Client submits review for completed order
   */
  async createReview(req, res, next) {
    try {
      const { id } = req.params;
      const { rating, comment = null } = req.body;

      if (!isUuid(id)) return res.status(400).json({ error: "Invalid order ID" });

      const numRating = parseFloat(rating);
      if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ error: "Rating must be a number between 1 and 5" });
      }

      const order = await OrderModel.findById(id);
      if (!order) return res.status(404).json({ error: "Order not found" });

      if (order.client_id !== req.user.id) {
        return res.status(403).json({ error: "Only the order's client can post a review" });
      }

      if (order.status !== "completed") {
        return res.status(400).json({ error: "Reviews can only be submitted after the order is completed" });
      }

      const review = await ReviewModel.create({
        orderId: order.id,
        reviewerId: req.user.id,
        editorId: order.editor_id,
        rating: numRating,
        comment,
      });

      return res.status(201).json({
        message: "Review submitted successfully",
        review,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "You have already reviewed this order" });
      }
      next(error);
    }
  },
};

module.exports = OrderController;
