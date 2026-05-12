const mongoose = require('mongoose');

const MEETING_STATUSES = ['scheduled', 'ongoing', 'completed', 'cancelled'];

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    organizerName: { type: String, required: true, trim: true, maxlength: 100 },
    organizerEmail: { type: String, trim: true, lowercase: true, default: null },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true },
    status: {
      type: String,
      enum: MEETING_STATUSES,
      default: 'scheduled',
      index: true,
    },
    attendeesCount: { type: Number, min: 1, default: null },
    isPrivate: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

meetingSchema.virtual('durationMinutes').get(function () {
  if (!this.startTime || !this.endTime) return null;
  return Math.round((this.endTime - this.startTime) / 60000);
});

meetingSchema.index({ roomId: 1, startTime: 1, status: 1 });
meetingSchema.index({ startTime: 1, endTime: 1, status: 1 });

const Meeting =
  mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);
Meeting.MEETING_STATUSES = MEETING_STATUSES;
module.exports = Meeting;
