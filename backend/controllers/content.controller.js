const asyncHandler = require('express-async-handler');
const Content = require('../models/content.model');
const { AppError } = require('../middleware/errorHandler');
const { uploadBuffer, deleteByPublicId } = require('../utils/cloudinary');
const { emitToAdmin } = require('../socket');

const resolveResourceType = (mimeType) =>
  mimeType?.startsWith('video/') ? 'video' : 'image';

exports.uploadContent = asyncHandler(async (req, res, next) => {
  const { title, description, type, textContent, displayDuration, tags } = req.body;

  if (!title || !type) return next(new AppError('title and type are required.', 400));
  if (!Content.CONTENT_TYPES.includes(type)) {
    return next(new AppError(`type must be one of: ${Content.CONTENT_TYPES.join(', ')}`, 400));
  }

  let fileUrl = null;
  let publicId = null;
  let thumbnailUrl = null;
  let fileSize = null;
  let mimeType = null;
  let dimensions = {};

  if (type !== 'text') {
    if (!req.file) return next(new AppError('A file is required for image/video content.', 400));

    const resourceType = resolveResourceType(req.file.mimetype);
    const result = await uploadBuffer(req.file.buffer, {
      folder: 'hdwss/content',
      resource_type: resourceType,
      eager:
        resourceType === 'video'
          ? [{ width: 320, height: 180, crop: 'fill', format: 'jpg' }]
          : undefined,
    });

    fileUrl = result.secure_url;
    publicId = result.public_id;
    thumbnailUrl = result.eager?.[0]?.secure_url ?? result.secure_url;
    fileSize = req.file.size;
    mimeType = req.file.mimetype;
    dimensions = { width: result.width, height: result.height };
  }

  const content = await Content.create({
    title,
    description,
    type,
    fileUrl,
    publicId,
    thumbnailUrl,
    textContent: type === 'text' ? textContent : null,
    displayDuration: displayDuration ? Number(displayDuration) : 10,
    fileSize,
    mimeType,
    dimensions,
    tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : [],
    uploadedBy: req.user._id,
  });

  emitToAdmin('content:new', { contentId: content._id, title: content.title, type });

  res.status(201).json({ status: 'success', message: 'Content uploaded.', data: { content } });
});

exports.getAllContent = asyncHandler(async (req, res) => {
  const { type, isActive, search, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);

  const [contents, total] = await Promise.all([
    Content.find(filter)
      .select('-publicId')
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Content.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: contents.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: { contents },
  });
});

exports.getContentById = asyncHandler(async (req, res, next) => {
  const content = await Content.findById(req.params.id)
    .select('-publicId')
    .populate('uploadedBy', 'firstName lastName')
    .lean();
  if (!content) return next(new AppError('Content not found.', 404));
  res.status(200).json({ status: 'success', data: { content } });
});

exports.updateContent = asyncHandler(async (req, res, next) => {
  const allowed = ['title', 'description', 'displayDuration', 'tags', 'textContent', 'isActive'];
  const updateData = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  });

  const content = await Content.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  })
    .select('-publicId')
    .lean();

  if (!content) return next(new AppError('Content not found.', 404));

  emitToAdmin('content:updated', { contentId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Content updated.', data: { content } });
});

exports.deleteContent = asyncHandler(async (req, res, next) => {
  const content = await Content.findByIdAndDelete(req.params.id);
  if (!content) return next(new AppError('Content not found.', 404));

  if (content.publicId) {
    const rt = resolveResourceType(content.mimeType);
    await deleteByPublicId(content.publicId, rt).catch(() => {});
  }

  emitToAdmin('content:deleted', { contentId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Content deleted.' });
});
