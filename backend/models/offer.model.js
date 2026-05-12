const mongoose = require('mongoose');

const OFFER_TYPES = ['fnb', 'room', 'spa', 'activity'];
const CURRENCIES = ['USD', 'KES', 'EUR', 'GBP', 'AED', 'TZS', 'UGX'];

const priceSchema = new mongoose.Schema(
  {
    original: { type: Number, min: 0, default: null },
    discounted: { type: Number, min: 0, default: null },
    currency: { type: String, enum: CURRENCIES, default: 'USD' },
  },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    type: { type: String, enum: OFFER_TYPES, required: true, index: true },
    imageUrl: { type: String, default: null },
    imagePublicId: { type: String, default: null, select: false },
    price: { type: priceSchema, default: () => ({}) },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 0 },
    displayOnScreens: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Display',
      },
    ],
    tags: [{ type: String, trim: true, lowercase: true }],
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

offerSchema.virtual('isCurrentlyValid').get(function () {
  const now = new Date();
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validTo && now > this.validTo) return false;
  return true;
});

offerSchema.index({ type: 1, isActive: 1 });
offerSchema.index({ validTo: 1, isActive: 1 });

const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema);
Offer.OFFER_TYPES = OFFER_TYPES;
module.exports = Offer;
