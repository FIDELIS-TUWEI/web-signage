const { v2: cloudinary } = require('cloudinary');
const config = require('./config');

cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a buffer to Cloudinary and returns the upload result.
 * @param {Buffer} buffer
 * @param {object} options – Cloudinary upload options (folder, resource_type, etc.)
 */
const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });

const deleteByPublicId = (publicId, resourceType = 'image') =>
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType });

module.exports = { cloudinary, uploadBuffer, deleteByPublicId };
