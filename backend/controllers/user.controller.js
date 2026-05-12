const asyncHandler = require('express-async-handler');
const User = require('../models/user.model');
const { AppError } = require('../middleware/errorHandler');
const { uploadBuffer, deleteByPublicId } = require('../utils/cloudinary');
const tokenStore = require('../utils/tokenStore');

const ALLOWED_UPDATE_FIELDS = ['firstName', 'lastName', 'role', 'isActive'];

exports.createUser = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, password, role } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return next(new AppError('firstName, lastName, email, and password are required.', 400));
  }

  const exists = await User.exists({ email });
  if (exists) return next(new AppError('A user with this email already exists.', 409));

  const user = await User.create({ firstName, lastName, email, password, role });

  res.status(201).json({
    status: 'success',
    message: 'User created successfully.',
    data: {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    },
  });
});

exports.getAllUsers = asyncHandler(async (req, res) => {
  const { role, isActive, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean({ virtuals: true }),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: users.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: { users },
  });
});

exports.getUserById = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id).lean({ virtuals: true });
  if (!user) return next(new AppError('User not found.', 404));
  res.status(200).json({ status: 'success', data: { user } });
});

exports.updateUser = asyncHandler(async (req, res, next) => {
  const updateData = {};
  ALLOWED_UPDATE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  });

  // Prevent self-demotion
  if (
    req.user._id.toString() === req.params.id &&
    updateData.role &&
    updateData.role !== req.user.role
  ) {
    return next(new AppError('You cannot change your own role.', 403));
  }

  const user = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  }).lean({ virtuals: true });

  if (!user) return next(new AppError('User not found.', 404));

  // If deactivated, revoke all their sessions
  if (updateData.isActive === false) {
    await tokenStore.revokeAll(req.params.id);
  }

  res.status(200).json({ status: 'success', message: 'User updated.', data: { user } });
});

exports.deleteUser = asyncHandler(async (req, res, next) => {
  if (req.user._id.toString() === req.params.id) {
    return next(new AppError('You cannot delete your own account.', 403));
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  await tokenStore.revokeAll(req.params.id);

  if (user.avatarPublicId) {
    await deleteByPublicId(user.avatarPublicId).catch(() => {});
  }

  res.status(200).json({ status: 'success', message: 'User deleted.' });
});

exports.uploadAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('No file uploaded.', 400));

  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  if (user.avatarPublicId) {
    await deleteByPublicId(user.avatarPublicId).catch(() => {});
  }

  const result = await uploadBuffer(req.file.buffer, {
    folder: 'web-signage/avatars',
    transformation: [{ width: 200, height: 200, crop: 'fill', gravity: 'face' }],
  });

  user.avatar = result.secure_url;
  user.avatarPublicId = result.public_id;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Avatar updated.',
    data: { avatar: user.avatar },
  });
});
