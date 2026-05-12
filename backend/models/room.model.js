const mongoose = require('mongoose');

const ROOM_STATUSES = ['vacant', 'occupied', 'maintenance', 'reserved'];

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    displayName: { type: String, trim: true, maxlength: 100, default: null },
    capacity: { type: Number, min: 1, default: null },
    floor: { type: String, trim: true, maxlength: 50, default: null },
    building: { type: String, trim: true, maxlength: 100, default: null },
    amenities: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ROOM_STATUSES,
      default: 'vacant',
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null, select: false },
    description: { type: String, trim: true, maxlength: 500, default: '' },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

roomSchema.virtual('label').get(function () {
  return this.displayName || this.name;
});

const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
Room.ROOM_STATUSES = ROOM_STATUSES;
module.exports = Room;
