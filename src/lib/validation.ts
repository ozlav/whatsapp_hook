/**
 * Validation utilities for WhatsApp webhook payloads
 * Provides comprehensive validation and error handling
 */

import { logger } from './logger';
import { env } from './env';

/**
 * Validation error types
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class WebhookValidationError extends ValidationError {
  constructor(message: string, field?: string) {
    super(message, field);
    this.name = 'WebhookValidationError';
  }
}

/**
 * WhatsApp webhook payload structure validation
 */
export interface ValidatedWebhookPayload {
  data: {
    key: {
      id: string;
      remoteJid: string;
    };
    pushName?: string;
    message: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      imageMessage?: {
        caption?: string;
      };
    };
    contextInfo?: {
      stanzaId?: string;
    };
  };
}

/**
 * Validate webhook payload structure
 * @param payload - Raw webhook payload
 * @returns Validated payload structure
 * @throws {WebhookValidationError} When payload is invalid
 */
export function validateWebhookPayload(payload: any): ValidatedWebhookPayload {
  try {
    // Check if payload exists
    if (!payload) {
      throw new WebhookValidationError('Payload is required');
    }

    // Check if data exists
    if (!payload.data) {
      throw new WebhookValidationError('Payload data is required', 'data');
    }

    const data = payload.data;

    // Validate key structure
    if (!data.key || typeof data.key !== 'object') {
      throw new WebhookValidationError('Message key is required', 'data.key');
    }

    if (!data.key.id || typeof data.key.id !== 'string') {
      throw new WebhookValidationError('Message ID is required', 'data.key.id');
    }

    if (!data.key.remoteJid || typeof data.key.remoteJid !== 'string') {
      throw new WebhookValidationError('Remote JID is required', 'data.key.remoteJid');
    }

    // Validate message structure
    if (!data.message || typeof data.message !== 'object') {
      throw new WebhookValidationError('Message content is required', 'data.message');
    }

    // Check if message has any content
    const hasContent = 
      data.message.conversation ||
      data.message.extendedTextMessage?.text ||
      data.message.imageMessage?.caption;

    if (!hasContent) {
      throw new WebhookValidationError('Message must have text content', 'data.message');
    }

    // Validate contextInfo if present
    if (data.contextInfo && typeof data.contextInfo !== 'object') {
      throw new WebhookValidationError('Context info must be an object', 'data.contextInfo');
    }

    logger.debug('Webhook payload validation successful', {
      messageId: data.key.id,
      remoteJid: data.key.remoteJid,
      hasContextInfo: !!data.contextInfo
    });

    return payload as ValidatedWebhookPayload;
  } catch (error) {
    if (error instanceof WebhookValidationError) {
      throw error;
    }
    
    logger.error('Webhook payload validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: JSON.stringify(payload, null, 2)
    });
    
    throw new WebhookValidationError('Invalid webhook payload structure');
  }
}

/**
 * Validate message text extraction
 * @param payload - Validated webhook payload
 * @returns Extracted message text
 * @throws {ValidationError} When no text can be extracted
 */
export function validateMessageText(payload: ValidatedWebhookPayload): string {
  try {
    const message = payload.data.message;
    let text = '';

    // Try different message types
    if (message.conversation) {
      text = message.conversation;
    } else if (message.extendedTextMessage?.text) {
      text = message.extendedTextMessage.text;
    } else if (message.imageMessage?.caption) {
      text = message.imageMessage.caption;
    }

    if (!text || text.trim().length === 0) {
      throw new ValidationError('No text content found in message');
    }

    return text.trim();
  } catch (error) {
    logger.error('Message text validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: payload.data.key.id
    });
    throw error;
  }
}

/**
 * Validate sender information
 * @param payload - Validated webhook payload
 * @returns Sender name
 */
export function validateSenderName(payload: ValidatedWebhookPayload): string {
  try {
    const senderName = payload.data.pushName || 'Unknown';
    
    if (!senderName || senderName.trim().length === 0) {
      return 'Unknown';
    }

    return senderName.trim();
  } catch (error) {
    logger.error('Sender name validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: payload.data.key.id
    });
    return 'Unknown';
  }
}

/**
 * Validate group ID filtering
 * @param remoteJid - The remote JID (group ID) to check
 * @returns true if message is from target group
 */
export function validateTargetGroup(remoteJid: string): boolean {
  try {
    const targetGroupId = env.TARGET_GROUP_ID || '120363418663151479@g.us';
    const isFromTargetGroup = remoteJid === targetGroupId;
    
    logger.debug('Group validation', {
      remoteJid,
      targetGroupId,
      isFromTargetGroup
    });

    return isFromTargetGroup;
  } catch (error) {
    logger.error('Group validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      remoteJid
    });
    return false;
  }
}

/**
 * Validate message relevance for processing
 * @param messageText - The message text to check
 * @returns true if message appears relevant for work order processing
 */
export function validateMessageRelevance(messageText: string): boolean {
  try {
    if (!messageText || messageText.trim().length === 0) {
      return false;
    }

    const text = messageText.toLowerCase();
    
    // Check for work order indicators
    const workOrderIndicators = [
      'work', 'job', 'order', 'service', 'repair', 'install',
      'address', 'phone', 'customer', 'client', 'deposit', 'price',
      'total', 'payment', 'status', 'complete', 'done', 'finished'
    ];

    const hasIndicators = workOrderIndicators.some(indicator => 
      text.includes(indicator)
    );

    // Check for contact information patterns
    const phonePattern = /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/;
    const addressPattern = /\d+\s+[a-zA-Z\s]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd|boulevard)/i;
    
    const hasContactInfo = phonePattern.test(text) || addressPattern.test(text);

    const isRelevant = hasIndicators || hasContactInfo;

    logger.debug('Message relevance validation', {
      hasIndicators,
      hasContactInfo,
      isRelevant,
      messageLength: messageText.length
    });

    return isRelevant;
  } catch (error) {
    logger.error('Message relevance validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageText: messageText.substring(0, 100)
    });
    return false;
  }
}

/**
 * Validate work order data completeness
 * @param analysis - LLM analysis result
 * @returns true if analysis contains minimum required fields
 */
export function validateWorkOrderCompleteness(analysis: any): boolean {
  try {
    // Check for minimum required fields
    const hasWorkId = analysis.work_id && analysis.work_id.trim().length > 0;
    const hasAddress = analysis.address && analysis.address.trim().length > 0;
    const hasPhone = analysis.phone && analysis.phone.trim().length > 0;
    const hasCustomerName = analysis.customer_name && analysis.customer_name.trim().length > 0;

    // Address can be used as work_id fallback
    const hasWorkIdOrAddress = hasWorkId || hasAddress;

    const isComplete = hasWorkIdOrAddress && hasAddress && hasPhone && hasCustomerName;

    logger.debug('Work order completeness validation', {
      hasWorkId,
      hasAddress,
      hasPhone,
      hasCustomerName,
      hasWorkIdOrAddress,
      isComplete
    });

    return isComplete;
  } catch (error) {
    logger.error('Work order completeness validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      analysis
    });
    return false;
  }
}

