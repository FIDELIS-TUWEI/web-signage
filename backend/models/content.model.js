const mongoose = require('mongoose');

const CONTENT_TYPES = ['image', 'video', 'text'];

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    type: { type: String, enum: CONTENT_TYPES, required: true, index: true },
    fileUrl: { type: String, default: null },
    publicId: { type: String, default: null, select: false },
    thumbnailUrl: { type: String, default: null },
    textContent: { type: String, default: null, maxlength: 2000 },
    displayDuration: { type: Number, default: 10, min: 1, max: 600 },
    fileSize: { type: Number, default: null },
    mimeType: { type: String, default: null },
    dimensions: {
      width: { type: Number, default: null },
      height: { type: Number, default: null },
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    isActive: { type: Boolean, default: true, index: true },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

contentSchema.index({ type: 1, isActive: 1 });
contentSchema.index({ title: 'text', description: 'text', tags: 'text' });

const Content =
  mongoose.models.Content || mongoose.model('Content', contentSchema);
Content.CONTENT_TYPES = CONTENT_TYPES;
module.exports = Content;
