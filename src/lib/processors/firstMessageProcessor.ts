/**
 * First Message Processor
 * Handles processing of new work order messages
 */

import { analyzeMessage } from '../messageAnalyzer';
import { createNewOrder, convertFirstMessageToOrderData } from '../../sheets/operations';
import { logger } from '../logger';
import { ValidatedWebhookPayload } from '../validators';
import { ProcessingResult } from '../../types/webhook';

/**
 * Process a first message (new work order)
 * @param payload - Validated webhook payload
 * @param messageText - Extracted message text
 * @param senderName - Sender name
 * @returns Processing result
 */
export async function processFirstMessage(
  payload: ValidatedWebhookPayload,
  messageText: string,
  senderName: string
): Promise<ProcessingResult> {
  try {
    const messageId = payload.data.key.id;
    
    logger.info('Processing first message', { messageId, senderName });

    // Step 1: Analyze message with LLM
    const analysis = await analyzeMessage(messageText, senderName);
    
    // Step 2: Check if LLM determined the message is relevant
    if (!analysis.relevant) {
      logger.info('Message not relevant according to LLM analysis', { 
        messageId,
        workId: analysis.work_id
      });
      
      return {
        success: true,
        messageType: 'ignored',
        analysis,
        error: 'Message not relevant according to LLM analysis'
      };
    }

    // Step 3: Create new work order in Google Sheets
    const orderData = convertFirstMessageToOrderData(analysis, senderName);
    await createNewOrder(orderData, messageText);
    
    logger.info('Successfully processed first message', {
      messageId,
      workId: analysis.work_id,
      customerName: analysis.customer_name
    });

    return {
      success: true,
      messageType: 'first',
      analysis
    };

  } catch (error) {
    logger.error('First message processing failed', {
      operation: 'processFirstMessage',
      messageId: payload.data.key.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      success: false,
      messageType: 'ignored',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
