const mongoose = require('mongoose');

const playlistItemSchema = new mongoose.Schema(
  {
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      required: true,
    },
    order: { type: Number, required: true, min: 0 },
    durationOverride: { type: Number, default: null, min: 1, max: 600 },
  },
  { _id: true }
);

const playlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    isActive: { type: Boolean, default: true, index: true },
    items: { type: [playlistItemSchema], default: [] },
    createdBy: {
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

playlistSchema.virtual('itemCount').get(function () {
  return this.items.length;
});

const Playlist =
  mongoose.models.Playlist || mongoose.model('Playlist', playlistSchema);
module.exports = Playlist;
