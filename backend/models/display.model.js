const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ORIENTATIONS = ['landscape', 'portrait'];
const THEMES = ['dark', 'light', 'brand'];
const DISPLAY_STATUSES = ['active', 'inactive'];

const displayConfigSchema = new mongoose.Schema(
  {
    showWeather: { type: Boolean, default: true },
    showForex: { type: Boolean, default: true },
    showOffers: { type: Boolean, default: true },
    showMeetingInfo: { type: Boolean, default: true },
    slideshowEnabled: { type: Boolean, default: true },
    slideshowInterval: { type: Number, default: 10, min: 3, max: 60 },
    weatherCity: { type: String, default: null },
    theme: { type: String, enum: THEMES, default: 'dark' },
    fallbackMessage: {
      type: String,
      default: 'Welcome — No content scheduled',
      maxlength: 120,
    },
  },
  { _id: false }
);

const displaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    orientation: {
      type: String,
      enum: ORIENTATIONS,
      default: 'landscape',
    },
    screenSize: { type: Number, min: 10, max: 120, default: 43 },
    status: { type: String, enum: DISPLAY_STATUSES, default: 'active', index: true },
    pairedRoomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    config: { type: displayConfigSchema, default: () => ({}) },
    deviceKey: {
      type: String,
      unique: true,
      default: () => uuidv4(),
      select: false,
    },
    isOnline: { type: Boolean, default: false, index: true },
    lastSeen: { type: Date, default: null },
    ipAddress: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    registeredAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

displaySchema.index({ status: 1, isActive: 1 });
displaySchema.index({ pairedRoomId: 1 });

const Display =
  mongoose.models.Display || mongoose.model('Display', displaySchema);
Display.ORIENTATIONS = ORIENTATIONS;
Display.THEMES = THEMES;
Display.DISPLAY_STATUSES = DISPLAY_STATUSES;
module.exports = Display;
