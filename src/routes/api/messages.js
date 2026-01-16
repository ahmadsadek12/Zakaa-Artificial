// Messages API Routes
// Allow business owners to send messages and images to customers

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requireUserType } = require('../../middleware/auth');
const { tenantIsolation } = require('../../middleware/tenant');
const { asyncHandler } = require('../../middleware/errorHandler');
const logger = require('../../utils/logger');
const CONSTANTS = require('../../config/constants');
const { queryMySQL } = require('../../config/database');
const telegramMessageSender = require('../../services/telegram/telegramMessageSender');
const whatsappMessageSender = require('../../services/whatsapp/messageSender');
const twilioMessageSender = require('../../services/whatsapp/twilioMessageSender');
const { decryptToken } = require('../../utils/encryption');

// All routes require authentication and business/admin access
router.use(authenticate);
router.use(requireUserType(CONSTANTS.USER_TYPES.ADMIN, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.BRANCH));
router.use(tenantIsolation);

/**
 * Send image to customer
 * POST /api/messages/send-image
 * Body: { customerPhoneNumber, imageUrl, caption, channel }
 */
router.post('/send-image', [
  body('customerPhoneNumber').notEmpty().withMessage('Customer phone number is required'),
  body('imageUrl').isURL().withMessage('Image URL must be a valid URL'),
  body('caption').optional().isString().withMessage('Caption must be a string'),
  body('channel').isIn(['telegram', 'whatsapp']).withMessage('Channel must be telegram or whatsapp')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }

  const { customerPhoneNumber, imageUrl, caption = '', channel } = req.body;
  const businessId = req.businessId;

  try {
    // Get business details
    const businesses = await queryMySQL(
      'SELECT * FROM users WHERE id = ? AND user_type IN (?, ?)',
      [businessId, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.ADMIN]
    );

    if (!businesses || businesses.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Business not found' }
      });
    }

    const business = businesses[0];

    if (channel === 'telegram') {
      // Extract Telegram chat ID from customer phone number
      // Format: telegram:123456789 or just 123456789
      const chatId = customerPhoneNumber.startsWith('telegram:')
        ? customerPhoneNumber.replace('telegram:', '')
        : customerPhoneNumber;

      await telegramMessageSender.sendPhoto({
        chatId: parseInt(chatId),
        imageUrl,
        caption
      });

      logger.info('Image sent via Telegram', {
        businessId,
        chatId,
        imageUrl
      });
    } else if (channel === 'whatsapp') {
      // Determine which WhatsApp provider to use
      const whatsappProvider = process.env.WHATSAPP_PROVIDER || 'meta';

      if (whatsappProvider === 'twilio') {
        // Twilio WhatsApp
        const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
        if (!twilioNumber) {
          throw new Error('Twilio WhatsApp number not configured');
        }

        await twilioMessageSender.sendImage({
          to: customerPhoneNumber,
          from: twilioNumber,
          imageUrl,
          caption
        });

        logger.info('Image sent via Twilio WhatsApp', {
          businessId,
          to: customerPhoneNumber,
          imageUrl
        });
      } else {
        // Meta WhatsApp Business API
        const phoneNumberId = business.whatsapp_phone_number_id;
        const accessToken = business.whatsapp_access_token_encrypted;

        if (!phoneNumberId || !accessToken) {
          return res.status(400).json({
            success: false,
            error: { message: 'WhatsApp not configured for this business' }
          });
        }

        await whatsappMessageSender.sendImage({
          phoneNumberId,
          accessToken,
          to: customerPhoneNumber,
          imageUrl,
          caption
        });

        logger.info('Image sent via Meta WhatsApp', {
          businessId,
          to: customerPhoneNumber,
          imageUrl
        });
      }
    }

    res.json({
      success: true,
      message: 'Image sent successfully'
    });
  } catch (error) {
    logger.error('Error sending image to customer:', {
      businessId,
      customerPhoneNumber,
      channel,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to send image' }
    });
  }
}));

/**
 * Send text message to customer
 * POST /api/messages/send-message
 * Body: { customerPhoneNumber, message, channel }
 */
router.post('/send-message', [
  body('customerPhoneNumber').notEmpty().withMessage('Customer phone number is required'),
  body('message').notEmpty().withMessage('Message text is required'),
  body('channel').isIn(['telegram', 'whatsapp']).withMessage('Channel must be telegram or whatsapp')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: { message: 'Validation failed', errors: errors.array() }
    });
  }

  const { customerPhoneNumber, message, channel } = req.body;
  const businessId = req.businessId;

  try {
    // Get business details
    const businesses = await queryMySQL(
      'SELECT * FROM users WHERE id = ? AND user_type IN (?, ?)',
      [businessId, CONSTANTS.USER_TYPES.BUSINESS, CONSTANTS.USER_TYPES.ADMIN]
    );

    if (!businesses || businesses.length === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Business not found' }
      });
    }

    const business = businesses[0];

    if (channel === 'telegram') {
      // Extract Telegram chat ID from customer phone number
      const chatId = customerPhoneNumber.startsWith('telegram:')
        ? customerPhoneNumber.replace('telegram:', '')
        : customerPhoneNumber;

      await telegramMessageSender.sendMessage({
        chatId: parseInt(chatId),
        message
      });

      logger.info('Message sent via Telegram', {
        businessId,
        chatId
      });
    } else if (channel === 'whatsapp') {
      // Determine which WhatsApp provider to use
      const whatsappProvider = process.env.WHATSAPP_PROVIDER || 'meta';

      if (whatsappProvider === 'twilio') {
        // Twilio WhatsApp
        const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
        if (!twilioNumber) {
          throw new Error('Twilio WhatsApp number not configured');
        }

        await twilioMessageSender.sendMessage({
          to: customerPhoneNumber,
          from: twilioNumber,
          message
        });

        logger.info('Message sent via Twilio WhatsApp', {
          businessId,
          to: customerPhoneNumber
        });
      } else {
        // Meta WhatsApp Business API
        const phoneNumberId = business.whatsapp_phone_number_id;
        const accessToken = business.whatsapp_access_token_encrypted;

        if (!phoneNumberId || !accessToken) {
          return res.status(400).json({
            success: false,
            error: { message: 'WhatsApp not configured for this business' }
          });
        }

        await whatsappMessageSender.sendMessage({
          phoneNumberId,
          accessToken,
          to: customerPhoneNumber,
          message
        });

        logger.info('Message sent via Meta WhatsApp', {
          businessId,
          to: customerPhoneNumber
        });
      }
    }

    res.json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    logger.error('Error sending message to customer:', {
      businessId,
      customerPhoneNumber,
      channel,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to send message' }
    });
  }
}));

module.exports = router;
