/**
 * Work Order Processor
 * Handles processing of work order messages using configuration
 * This is a migrated version of the existing first/reply message processors
 */

import { IMessageProcessor } from '../base/IMessageProcessor';
import { Configuration } from '../../config/types';
import { ValidatedWebhookPayload } from '../../validators';
import { ProcessingResult } from '../../../types/webhook';
import { analyzeMessage, analyzeReplyMessage } from '../../messageAnalyzer';
import { 
  createNewOrder, 
  convertFirstMessageToOrderData,
  getSheetRowByWorkId,
  updateSheetRowByIndices,
  appendUpdateLog
} from '../../../sheets/operations';
import { logger } from '../../logger';
import { isReplyMessage } from '../../validators';

export class WorkOrderProcessor implements IMessageProcessor {
  
  /**
   * Main entry point for processing messages
   * Routes to appropriate handler based on message type (first/reply)
   */
  async processMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult> {
    // Determine if this is a reply message
    const isReply = isReplyMessage(payload);
    
    logger.info('Routing message to appropriate handler', {
      messageId: payload.data.key.id,
      isReply,
      configId: config.id
    });

    if (isReply) {
      return await this.processReplyMessage(payload, messageText, senderName, config);
    } else {
      return await this.processFirstMessage(payload, messageText, senderName, config);
    }
  }

  async processFirstMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult> {
    try {
      const messageId = payload.data.key.id;
      
      logger.info('Processing first message with WorkOrderProcessor', { 
        messageId, 
        senderName,
        configId: config.id
      });

      // TODO: Load prompt from configuration
      // For now, use existing analyzeMessage which uses hardcoded prompt
      const analysis = await this.loadPromptAndAnalyze(config, messageText, senderName);
      
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

      // Create new work order with config-aware sheets operations
      const orderData = convertFirstMessageToOrderData(analysis, senderName);
      
      // TODO: Update createNewOrder to accept config parameter for config-driven sheets operations
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
        operation: 'WorkOrderProcessor.processFirstMessage',
        messageId: payload.data.key.id,
        configId: config.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        messageType: 'ignored',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async processReplyMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult> {
    try {
      const messageId = payload.data.key.id;
      const quotedMessageId = payload.data.contextInfo?.stanzaId;
      
      logger.info('Processing reply message with WorkOrderProcessor', { 
        messageId, 
        senderName,
        quotedMessageId,
        configId: config.id
      });

      // Extract quoted message content
      let quotedMessageText = '';
      
      if ((payload.data.contextInfo as any)?.quotedMessage) {
        const quotedMsg = (payload.data.contextInfo as any).quotedMessage;
        if (quotedMsg.conversation) {
          quotedMessageText = quotedMsg.conversation;
        } else if (quotedMsg.extendedTextMessage?.text) {
          quotedMessageText = quotedMsg.extendedTextMessage.text;
        } else if (quotedMsg.imageMessage?.caption) {
          quotedMessageText = quotedMsg.imageMessage.caption;
        }
      }

      if (!quotedMessageText || quotedMessageText.trim().length === 0) {
        return {
          success: false,
          messageType: 'reply',
          error: 'No quoted message content found in reply'
        };
      }

      logger.info('Found quoted message content', { 
        messageId,
        quotedTextLength: quotedMessageText.length
      });

      // Analyze the quoted message to get work_id
      const analysis = await analyzeMessage(quotedMessageText, senderName);

      if (!analysis.work_id || analysis.work_id.trim() === '') {
        return {
          success: false,
          messageType: 'reply',
          error: 'No work_id found in quoted message analysis'
        };
      }

      logger.info('Found work_id in quoted message', { 
        messageId, 
        workId: analysis.work_id 
      });

      // Get sheet data - will be updated to use config
      const sheetData = await getSheetRowByWorkId(analysis.work_id);
      
      if (!sheetData) {
        return {
          success: false,
          messageType: 'reply',
          error: `Work order ${analysis.work_id} not found in sheet`
        };
      }

      logger.info('Found existing work order with full data', { 
        messageId, 
        workId: analysis.work_id, 
        rowNumber: sheetData.rowNumber
      });

      // Analyze the reply message for updates
      const replyAnalysis = await analyzeReplyMessage(
        messageText, 
        senderName, 
        analysis.work_id,
        sheetData.headers,
        sheetData.rowData,
        sheetData.columnIndices
      );
      
      // Build column updates
      const columnUpdates: Record<number, any> = {};
      
      // Append reply to notes
      const notesColumnIndex = sheetData.columnIndices['notes'];
      if (notesColumnIndex !== undefined) {
        const prevNotes = sheetData.rowData[notesColumnIndex] ?? '';
        const separator = prevNotes ? '\n\n' : '';
        const formattedReply = `${senderName}: ${messageText}`;
        columnUpdates[notesColumnIndex] = `${prevNotes}${separator}${formattedReply}`;
      }
      
      // Add column updates from reply analysis
      if (replyAnalysis.columnUpdates) {
        Object.assign(columnUpdates, replyAnalysis.columnUpdates);
      }
      
      await updateSheetRowByIndices(sheetData.rowNumber, columnUpdates);
      
      // Log update to audit trail
      const changedFields = ['notes'];
      const newValues: Record<string, any> = { notes: messageText };
      
      if (replyAnalysis.columnUpdates) {
        for (const [columnIndex, value] of Object.entries(replyAnalysis.columnUpdates)) {
          const colIndex = parseInt(columnIndex);
          const fieldName = Object.keys(sheetData.columnIndices).find(
            key => sheetData.columnIndices[key] === colIndex
          );
          if (fieldName) {
            changedFields.push(fieldName);
            newValues[fieldName] = value;
          }
        }
      }
      
      await appendUpdateLog(analysis.work_id, {
        workId: analysis.work_id,
        changesDetected: true,
        changedFields,
        newValues
      });
      
      logger.info('Successfully processed reply message', {
        messageId,
        workId: analysis.work_id,
        changedFields
      });

      return {
        success: true,
        messageType: 'reply',
        analysis: replyAnalysis
      };

    } catch (error) {
      logger.error('Reply message processing failed', {
        operation: 'WorkOrderProcessor.processReplyMessage',
        messageId: payload.data.key.id,
        configId: config.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        messageType: 'reply',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async loadPromptAndAnalyze(
    config: Configuration,
    messageText: string,
    senderName: string
  ) {
    // Pass config ID to analyzeMessage for dynamic prompts/schemas
    return await analyzeMessage(messageText, senderName, config.id);
  }
}



