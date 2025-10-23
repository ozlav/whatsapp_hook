/**
 * Simple Message Processor (without LangGraph)
 * Main router that delegates to specialized processors
 * This is a working implementation that we can enhance with LangGraph later
 */

import { logMessage } from '../sheets/operations';
import { logger } from '../lib/logger';
import { getTargetGroupId } from '../lib/env';
import { 
  validateWebhookPayload,
  extractMessageText, 
  extractSenderName, 
  isFromTargetGroup,
  isReplyMessage
} from '../lib/validators';
import { processFirstMessage } from '../lib/processors/firstMessageProcessor';
import { processReplyMessage } from '../lib/processors/replyMessageProcessor';
import { WhatsAppWebhookPayload, ProcessingResult } from '../types/webhook';


/**
 * Process a WhatsApp message following the logic defined in overview.md
 * @param payload - WhatsApp webhook payload
 * @returns Processing result
 */
export async function processWhatsAppMessage(payload: WhatsAppWebhookPayload): Promise<ProcessingResult> {
  try {
    // Step 1: Validate webhook payload
    const validatedPayload = validateWebhookPayload(payload);
    const messageId = validatedPayload.data.key.id;
    const remoteJid = validatedPayload.data.key.remoteJid;
    
    logger.info('Processing WhatsApp message', { messageId, remoteJid });

    // Step 2: Check if message is from target group
    if (!isFromTargetGroup(remoteJid)) {
      logger.info('Message not from target group, ignoring', { 
        messageId, 
        remoteJid,
        targetGroup: getTargetGroupId()
      });
      return {
        success: true,
        messageType: 'ignored',
        error: 'Message not from target group'
      };
    }

    // Step 3: Extract and validate message text
    const messageText = extractMessageText(validatedPayload);
    const senderName = extractSenderName(validatedPayload);

    // Step 4: Log ALL messages to Logs sheet first
    await logMessage(messageText, senderName, 'ignored', undefined, 'Message received');

    // Step 5: Route to appropriate processor
    const isReply = isReplyMessage(validatedPayload);
    
    if (isReply) {
      return await processReplyMessage(validatedPayload, messageText, senderName);
    } else {
      return await processFirstMessage(validatedPayload, messageText, senderName);
    }

  } catch (error) {
    logger.error('Message processing failed', {
      operation: 'processWhatsAppMessage',
      messageId: payload?.data?.key?.id || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      success: false,
      messageType: 'ignored',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}


