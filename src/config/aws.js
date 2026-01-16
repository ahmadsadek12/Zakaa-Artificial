// AWS S3 Configuration
// S3 client setup for image storage

const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS
// Only configure if credentials are provided (not placeholder values)
const hasAWSConfig = process.env.AWS_ACCESS_KEY_ID && 
                     process.env.AWS_SECRET_ACCESS_KEY &&
                     process.env.AWS_ACCESS_KEY_ID !== 'your-aws-access-key' &&
                     process.env.AWS_SECRET_ACCESS_KEY !== 'your-aws-secret-key';

if (hasAWSConfig) {
  AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
}

const s3 = hasAWSConfig ? new AWS.S3() : null;

const S3_CONFIG = {
  bucket: process.env.S3_BUCKET_NAME || 'zakaa-images',
  baseUrl: process.env.S3_BASE_URL || `https://${process.env.S3_BUCKET_NAME || 'zakaa-images'}.s3.amazonaws.com`,
  region: process.env.AWS_REGION || 'us-east-1'
};

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} mimetype - File mimetype
 * @param {string} folder - Optional folder prefix
 * @returns {Promise<string>} - S3 URL
 */
async function uploadToS3(fileBuffer, fileName, mimetype, folder = '') {
  if (!s3) {
    throw new Error('S3 is not configured. Please set AWS credentials in .env file');
  }
  
  const key = folder ? `${folder}/${fileName}` : fileName;
  
  const params = {
    Bucket: S3_CONFIG.bucket,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype
    // Note: ACL removed - bucket policy handles public access
    // Modern S3 buckets (created after April 2023) have ACLs disabled by default
  };
  
  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
}

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
async function deleteFromS3(key) {
  const params = {
    Bucket: S3_CONFIG.bucket,
    Key: key
  };
  
  try {
    await s3.deleteObject(params).promise();
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('Failed to delete file from S3');
  }
}

/**
 * Extract key from S3 URL
 * @param {string} url - S3 URL
 * @returns {string} - S3 key
 */
function extractKeyFromUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading '/'
  } catch (error) {
    return url.replace(S3_CONFIG.baseUrl, '').replace(/^\//, '');
  }
}

module.exports = {
  s3,
  S3_CONFIG,
  uploadToS3,
  deleteFromS3,
  extractKeyFromUrl
};
