/**
 * Simple Message Processor (without LangGraph)
 * Main router that delegates to specialized processors
 * Now uses configuration-driven architecture
 */

import { logMessage } from '../sheets/operations';
import { logger } from '../lib/logger';
import { 
  validateWebhookPayload,
  extractMessageText, 
  extractSenderName
} from '../lib/validators';
import { WhatsAppWebhookPayload, ProcessingResult } from '../types/webhook';
import { handleErrorCase, handleNetworkError } from '../lib/errorHandling';
import { getConfigurationByGroupId } from '../lib/config/configService';
import { ProcessorFactory } from '../lib/processors/factory/ProcessorFactory';
import { shouldUseConfiguration, createDefaultConfigFromEnv } from '../lib/config/migrationHelper';


/**
 * Process a WhatsApp message following the logic defined in overview.md
 * Now uses configuration-driven processor selection
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

    // Step 2: Check if we should use configuration or fallback to env
    const useConfig = await shouldUseConfiguration(remoteJid);
    
    if (!useConfig) {
      // Fallback to old behavior - try to create default config once
      const created = await createDefaultConfigFromEnv();
      
      if (!created) {
        // Still no config - skip processing
        logger.info({ remoteJid }, 'No configuration found and env fallback failed');
        return handleErrorCase('ignored', {
          messageId,
          remoteJid,
          customMessage: 'No configuration found for group'
        }, 'info');
      }
    }

    // Step 3: Get configuration for this group
    const config = await getConfigurationByGroupId(remoteJid);
    
    if (!config) {
      logger.info({ remoteJid }, 'No configuration found for group');
      return handleErrorCase('ignored', {
        messageId,
        remoteJid,
        customMessage: 'No configuration found for group'
      }, 'info');
    }

    logger.info({ 
      configId: config['id'], 
      processorClass: config['processorClass'] 
    }, 'Using configuration for message processing');

    // Step 4: Extract and validate message text
    const messageText = extractMessageText(validatedPayload);
    const senderName = extractSenderName(validatedPayload);

    // Step 5: Log ALL messages to Logs sheet first
    await logMessage(messageText, senderName, 'ignored', undefined, 'Message received');

    // Step 6: Get processor from factory
    const processor = ProcessorFactory.get(config['processorClass']);
    
    if (!processor) {
      logger.error({ 
        processorClass: config['processorClass'] 
      }, 'Processor not found');
      
      return handleErrorCase('ignored', {
        messageId,
        customMessage: `Processor ${config['processorClass']} not found`
      });
    }

    // Step 7: Process message (processor will handle routing internally)
    return await processor.processMessage(validatedPayload, messageText, senderName, config);

  } catch (error) {
    return handleNetworkError(error, {
      messageId: payload?.data?.key?.id || 'unknown'
    }, 'Message processing');
  }
}


