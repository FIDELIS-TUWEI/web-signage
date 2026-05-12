const asyncHandler = require('express-async-handler');
const Playlist = require('../models/playlist.model');
const Content = require('../models/content.model');
const { AppError } = require('../middleware/errorHandler');
const { emitToAdmin } = require('../socket');

exports.createPlaylist = asyncHandler(async (req, res, next) => {
  const { name, description } = req.body;
  if (!name) return next(new AppError('name is required.', 400));

  const playlist = await Playlist.create({
    name,
    description,
    items: [],
    createdBy: req.user._id,
  });

  res.status(201).json({ status: 'success', message: 'Playlist created.', data: { playlist } });
});

exports.getAllPlaylists = asyncHandler(async (req, res) => {
  const { isActive, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const skip = (Number(page) - 1) * Number(limit);

  const [playlists, total] = await Promise.all([
    Playlist.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean({ virtuals: true }),
    Playlist.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: playlists.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: { playlists },
  });
});

exports.getPlaylistById = asyncHandler(async (req, res, next) => {
  const playlist = await Playlist.findById(req.params.id)
    .populate({
      path: 'items.contentId',
      select: '-publicId',
    })
    .populate('createdBy', 'firstName lastName')
    .lean({ virtuals: true });

  if (!playlist) return next(new AppError('Playlist not found.', 404));
  res.status(200).json({ status: 'success', data: { playlist } });
});

exports.updatePlaylist = asyncHandler(async (req, res, next) => {
  const allowed = ['name', 'description', 'isActive'];
  const updateData = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updateData[f] = req.body[f];
  });

  const playlist = await Playlist.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).lean({ virtuals: true });

  if (!playlist) return next(new AppError('Playlist not found.', 404));

  emitToAdmin('playlist:updated', { playlistId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Playlist updated.', data: { playlist } });
});

exports.deletePlaylist = asyncHandler(async (req, res, next) => {
  const playlist = await Playlist.findByIdAndDelete(req.params.id);
  if (!playlist) return next(new AppError('Playlist not found.', 404));
  res.status(200).json({ status: 'success', message: 'Playlist deleted.' });
});

exports.addItem = asyncHandler(async (req, res, next) => {
  const { contentId, durationOverride } = req.body;
  if (!contentId) return next(new AppError('contentId is required.', 400));

  const [playlist, content] = await Promise.all([
    Playlist.findById(req.params.id),
    Content.exists({ _id: contentId, isActive: true }),
  ]);

  if (!playlist) return next(new AppError('Playlist not found.', 404));
  if (!content) return next(new AppError('Content not found or inactive.', 404));

  const order = playlist.items.length;
  playlist.items.push({ contentId, order, durationOverride: durationOverride || null });
  await playlist.save();

  emitToAdmin('playlist:updated', { playlistId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Item added to playlist.', data: { playlist } });
});

exports.reorderItems = asyncHandler(async (req, res, next) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) {
    return next(new AppError('orderedIds must be an array of item _ids.', 400));
  }

  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return next(new AppError('Playlist not found.', 404));

  const itemMap = new Map(playlist.items.map((item) => [item._id.toString(), item]));

  const reordered = orderedIds.map((id, index) => {
    const item = itemMap.get(id.toString());
    if (!item) throw new AppError(`Item ${id} not found in this playlist.`, 400);
    item.order = index;
    return item;
  });

  playlist.items = reordered;
  await playlist.save();

  emitToAdmin('playlist:updated', { playlistId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Items reordered.', data: { playlist } });
});

exports.removeItem = asyncHandler(async (req, res, next) => {
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return next(new AppError('Playlist not found.', 404));

  const before = playlist.items.length;
  playlist.items = playlist.items.filter(
    (item) => item._id.toString() !== req.params.itemId
  );

  if (playlist.items.length === before) {
    return next(new AppError('Item not found in playlist.', 404));
  }

  // Re-normalise order after removal
  playlist.items.forEach((item, i) => { item.order = i; });
  await playlist.save();

  emitToAdmin('playlist:updated', { playlistId: req.params.id });
  res.status(200).json({ status: 'success', message: 'Item removed.', data: { playlist } });
});
