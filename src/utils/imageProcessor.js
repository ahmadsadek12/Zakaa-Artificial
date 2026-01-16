// Image Processing Utility
// Compress and resize images before uploading to S3

const sharp = require('sharp');
const logger = require('./logger');

/**
 * Compress and resize image
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} options - Processing options
 * @param {number} options.maxWidth - Maximum width (default: 1200)
 * @param {number} options.maxHeight - Maximum height (default: 1200)
 * @param {number} options.quality - JPEG quality 1-100 (default: 85)
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function compressImage(imageBuffer, options = {}) {
  try {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 85
    } = options;

    const compressed = await sharp(imageBuffer)
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer();

    const originalSize = imageBuffer.length;
    const compressedSize = compressed.length;
    const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

    logger.debug('Image compressed', {
      originalSize: `${(originalSize / 1024).toFixed(2)}KB`,
      compressedSize: `${(compressedSize / 1024).toFixed(2)}KB`,
      reduction: `${reduction}%`
    });

    return compressed;
  } catch (error) {
    logger.error('Image compression failed:', error);
    // Return original if compression fails
    return imageBuffer;
  }
}

/**
 * Get image metadata
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Object>} - Image metadata
 */
async function getImageMetadata(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length
    };
  } catch (error) {
    logger.error('Failed to get image metadata:', error);
    return null;
  }
}

module.exports = {
  compressImage,
  getImageMetadata
};
