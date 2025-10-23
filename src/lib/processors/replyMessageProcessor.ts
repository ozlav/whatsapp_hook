/**
 * Reply Message Processor
 * Handles processing of reply messages that update existing work orders
 */

import { analyzeMessage, analyzeReplyMessage } from '../messageAnalyzer';
import { getSheetRowByWorkId, updateSheetRowByIndices, appendUpdateLog } from '../../sheets/operations';
import { logger } from '../logger';
import { ValidatedWebhookPayload } from '../validators';
import { ProcessingResult } from '../../types/webhook';

/**
 * Process a reply message (update existing work order)
 * @param payload - Validated webhook payload
 * @param messageText - Extracted message text
 * @param senderName - Sender name
 * @returns Processing result
 */
export async function processReplyMessage(
  payload: ValidatedWebhookPayload,
  messageText: string,
  senderName: string
): Promise<ProcessingResult> {
  try {
    const messageId = payload.data.key.id;
    const quotedMessageId = payload.data.contextInfo?.stanzaId;
    
    logger.info('Processing reply message', { 
      messageId, 
      senderName, 
      quotedMessageId,
      replyText: messageText.substring(0, 100) + '...'
    });

    // Step 1: Extract quoted message content from the reply payload
    // In EvolutionAPI, the quoted message content is in the contextInfo.quotedMessage
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
      logger.warn('No quoted message content found in reply', { 
        messageId, 
        quotedMessageId,
        hasQuotedMessage: !!(payload.data.contextInfo as any)?.quotedMessage
      });
      
      return {
        success: true,
        messageType: 'ignored',
        error: 'No quoted message content found in reply'
      };
    }

    logger.info('Found quoted message content', { 
      messageId,
      quotedTextLength: quotedMessageText.length,
      quotedText: quotedMessageText.substring(0, 200) + '...'
    });

    // Step 2: Analyze the quoted message with LLM to extract work_id
    const analysis = await analyzeMessage(quotedMessageText, senderName);

    // Step 3: Check if analysis contains a work_id
    if (!analysis.work_id || analysis.work_id.trim() === '') {
      logger.info('No work_id found in quoted message analysis', { 
        messageId,
        quotedText: quotedMessageText.substring(0, 100) + '...'
      });
      
      return {
        success: true,
        messageType: 'ignored',
        analysis,
        error: 'No work_id found in quoted message analysis'
      };
    }

    logger.info('Found work_id in quoted message', { 
      messageId, 
      workId: analysis.work_id 
    });

    // Step 4: Get full work order data from Google Sheets (including headers)
    const sheetData = await getSheetRowByWorkId(analysis.work_id);
    
    if (!sheetData) {
      logger.warn('Work order not found in Google Sheets', { 
        messageId, 
        workId: analysis.work_id 
      });
      
      return {
        success: true,
        messageType: 'ignored',
        analysis,
        error: 'Work order not found in Google Sheets'
      };
    }

    logger.info('Found existing work order with full data', { 
      messageId, 
      workId: analysis.work_id, 
      rowNumber: sheetData.rowNumber,
      headers: sheetData.headers
    });

    // Step 5: Analyze the reply message for potential updates using current row data
    const replyAnalysis = await analyzeReplyMessage(
      messageText, 
      senderName, 
      analysis.work_id,
      sheetData.headers,
      sheetData.rowData,
      sheetData.columnIndices
    );
    
    // Step 6: Update Google Sheets row with reply message and any detected changes
    const columnUpdates: Record<number, any> = {};
    
    // Append the reply message to the notes column as a new line (do not override)
    const notesColumnIndex = sheetData.columnIndices['notes'];
    if (notesColumnIndex !== undefined) {
      const prevNotes = sheetData.rowData[notesColumnIndex] ?? '';
      const separator = prevNotes ? '\n' : '';
      columnUpdates[notesColumnIndex] = `${prevNotes}${separator}${messageText}`;
    }
    
    // Add any column updates from reply analysis
    if (replyAnalysis.columnUpdates) {
      Object.assign(columnUpdates, replyAnalysis.columnUpdates);
    }
    
    await updateSheetRowByIndices(sheetData.rowNumber, columnUpdates);
    
    // Step 7: Log update to audit trail
    const changedFields = ['notes'];
    const newValues: Record<string, any> = { notes: messageText };
    
    if (replyAnalysis.columnUpdates) {
      // Convert column indices back to field names for logging
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
    
    // Log the changes to the database
    const changesSummary = changedFields.map(field => {
      const value = newValues[field] || '';
      return `${field}: ${value}`;
    }).join(', ');
    
    logger.info('Successfully processed reply message', {
      messageId,
      workId: analysis.work_id,
      replyMessage: messageText,
      rowNumber: sheetData.rowNumber,
      changedFields,
      changesSummary
    });

    return {
      success: true,
      messageType: 'reply',
      analysis: replyAnalysis
    };

  } catch (error) {
    logger.error('Reply message processing failed', {
      operation: 'processReplyMessage',
      messageId: payload.data.key.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      messageType: 'ignored',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
