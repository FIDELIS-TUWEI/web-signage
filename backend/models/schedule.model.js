const mongoose = require('mongoose');

const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6]; // 0 = Sunday
const SCHEDULE_STATUSES = ['pending', 'active', 'expired'];
// HH:mm regex — used in app validation, stored as string for simplicity
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    displayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Display',
      required: true,
      index: true,
    },
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: (v) => TIME_REGEX.test(v),
        message: 'startTime must be in HH:mm format',
      },
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: (v) => TIME_REGEX.test(v),
        message: 'endTime must be in HH:mm format',
      },
    },
    daysOfWeek: {
      type: [{ type: Number, enum: DAYS_OF_WEEK }],
      default: [0, 1, 2, 3, 4, 5, 6],
    },
    priority: { type: Number, default: 1, min: 1, max: 10 },
    isActive: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: SCHEDULE_STATUSES,
      default: 'pending',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

scheduleSchema.index({ displayId: 1, status: 1, priority: -1 });
scheduleSchema.index({ endDate: 1, status: 1 });

const Schedule =
  mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
Schedule.SCHEDULE_STATUSES = SCHEDULE_STATUSES;
module.exports = Schedule;
