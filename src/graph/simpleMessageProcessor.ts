/**
 * Simple Message Processor (without LangGraph)
 * Direct function calls for message analysis
 * This is a working implementation that we can enhance with LangGraph later
 */

import { analyzeFirstMessage, analyzeReplyMessage, FirstMessageAnalysis, ReplyAnalysis } from '../lib/messageAnalyzer';
import { isReplyMessage, extractMessageText, extractSenderName } from '../lib/messageParser';
import { getThreadHistoryForReply } from '../db/queries/threadQueries';
import { createNewOrder, convertFirstMessageToOrderData, findSheetRowByWorkId, updateSheetRow } from '../sheets/operations';
import { logger } from '../lib/logger';
import { env } from '../lib/env';

/**
 * Process a WhatsApp message (simplified approach)
 * @param payload - WhatsApp webhook payload
 * @returns Processing result
 */
export async function processWhatsAppMessage(payload: any): Promise<{
  success: boolean;
  messageType: 'first' | 'reply' | 'ignored';
  analysis?: FirstMessageAnalysis | ReplyAnalysis;
  error?: string;
}> {
  try {
    // Extract basic message info
    const messageText = extractMessageText(payload);
    const senderName = extractSenderName(payload);
    const messageId = payload.data?.key?.id || 'unknown';
    const remoteJid = payload.data?.key?.remoteJid || 'unknown';
    
    // Check if from target group
    const targetGroupId = env.TARGET_GROUP_ID || '120363418663151479@g.us'; // Use env var or fallback
    logger.info('Group check debug', { 
      remoteJid, 
      targetGroup: targetGroupId,
      match: remoteJid === targetGroupId 
    });
    
    if (remoteJid !== targetGroupId) {
      logger.info('Message from non-target group, ignoring', { remoteJid, targetGroup: targetGroupId });
      return {
        success: true,
        messageType: 'ignored'
      };
    }
    
    // Check if message is a reply
    if (isReplyMessage(payload)) {
      logger.info('Processing reply message', { messageId, senderName });
      
      // For replies, we can extract the original message from quotedMessage
      // This avoids needing to query the EvolutionAPI database
      const quotedMessage = payload.data?.contextInfo?.quotedMessage;
      if (!quotedMessage || !quotedMessage.conversation) {
        logger.warn('Reply message has no quoted message content', { messageId });
        return {
          success: false,
          messageType: 'reply',
          error: 'No quoted message found'
        };
      }
      
      // Get thread history using the quoted message
      const threadHistory = await getThreadHistoryForReply(messageId, env.TARGET_GROUP_ID || '', quotedMessage);
      
      if (threadHistory.length === 0) {
        logger.warn('No thread history found for reply', { messageId });
        return {
          success: false,
          messageType: 'reply',
          error: 'No thread history found'
        };
      }
      
      logger.info('Using quoted message as thread history', { 
        messageId, 
        quotedMessageLength: quotedMessage.conversation.length,
        threadLength: threadHistory.length
      });
      
      // Analyze reply
      const analysis = await analyzeReplyMessage(messageText, senderName, threadHistory);
      
      // If changes are detected, update the Google Sheet
      if (analysis.changesDetected && analysis.hasWorkId && analysis.workId) {
        try {
          logger.info('Reply contains work order changes, updating Google Sheet', {
            workId: analysis.workId,
            changedFields: analysis.changedFields,
            newValues: analysis.newValues
          });
          
          // Find the existing row by work ID
          const rowNumber = await findSheetRowByWorkId(analysis.workId);
          
          if (rowNumber) {
            // Update the existing row
            const updates: any = {
              updated_at: new Date().toISOString(),
              updated_by: senderName
            };
            
            // Add the changed fields to the update
            if (analysis.newValues) {
              Object.assign(updates, analysis.newValues);
            }
            
            // Add extracted data from thread history if available
            if (analysis.extractedData) {
              // Only add extracted data if we don't already have it in newValues
              for (const [key, value] of Object.entries(analysis.extractedData)) {
                if (!updates[key] && value) {
                  updates[key] = value;
                }
              }
            }
            
            // Add notes with the reply message
            if (messageText) {
              updates.notes = (updates.notes || '') + ` | Reply: ${messageText}`;
            }
            
            await updateSheetRow(rowNumber, updates);
            
            logger.info('Successfully updated existing work order in Google Sheet', {
              workId: analysis.workId,
              rowNumber,
              changedFields: analysis.changedFields
            });
          } else {
            // Work order not found, create a new one
            logger.warn('Work order not found in Google Sheet, creating new entry', {
              workId: analysis.workId
            });
            
            const orderData = convertFirstMessageToOrderData({
              work_id: analysis.workId,
              address: analysis.extractedData?.address || '',
              phone: analysis.extractedData?.phone || '',
              customer_name: analysis.extractedData?.customer_name || senderName,
              job_description: analysis.extractedData?.job_description || '',
              total_price: analysis.extractedData?.total_price || analysis.newValues?.total_price || 0,
              deposit: analysis.extractedData?.deposit || analysis.newValues?.deposit || 0,
              job_status: analysis.newValues?.job_status || 'updated',
              start_date_time: analysis.extractedData?.start_date_time || analysis.newValues?.start_date_time || null,
              end_date_time: analysis.extractedData?.end_date_time || analysis.newValues?.end_date_time || null,
              sort_of_payment: analysis.extractedData?.sort_of_payment || analysis.newValues?.sort_of_payment || '',
              notes: analysis.newValues?.notes || messageText,
              relevant: true
            }, senderName);
            
            await createNewOrder(orderData, messageText);
            
            logger.info('Successfully created new work order from reply', {
              workId: analysis.workId,
              changedFields: analysis.changedFields
            });
          }
        } catch (sheetsError) {
          logger.error('Failed to update work order in Google Sheets', {
            error: sheetsError instanceof Error ? sheetsError.message : 'Unknown error',
            workId: analysis.workId
          });
          
          return {
            success: false,
            messageType: 'reply',
            analysis,
            error: 'Failed to update Google Sheets'
          };
        }
      } else {
        logger.info('Reply message has no work order changes', { 
          hasWorkId: analysis.hasWorkId,
          changesDetected: analysis.changesDetected 
        });
      }
      
      return {
        success: true,
        messageType: 'reply',
        analysis
      };
    } else {
      logger.info('Processing first message', { messageId, senderName });
      
      // Analyze first message
      const analysis = await analyzeFirstMessage(messageText, senderName);
      
      // If analysis is relevant, add to Google Sheets
      if (analysis.relevant) {
        try {
          // Convert to order data
          const orderData = convertFirstMessageToOrderData(analysis, senderName);
          
          // Add to deposit sheet
          await createNewOrder(orderData, messageText);
          
          logger.info('Successfully added work order to deposit sheet', {
            workId: analysis.work_id,
            customerName: analysis.customer_name
          });
        } catch (sheetsError) {
          logger.error('Failed to add work order to Google Sheets', {
            error: sheetsError instanceof Error ? sheetsError.message : 'Unknown error',
            workId: analysis.work_id
          });
          
          return {
            success: false,
            messageType: 'first',
            analysis,
            error: 'Failed to add to Google Sheets'
          };
        }
      } else {
        logger.info('Message not relevant for work order processing', { 
          messageText: messageText.substring(0, 100) 
        });
      }
      
      return {
        success: true,
        messageType: 'first',
        analysis
      };
    }
  } catch (error) {
    logger.error('Message processing failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      payload: JSON.stringify(payload).substring(0, 200)
    });
    
    return {
      success: false,
      messageType: 'ignored',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test the message processor
 */
export async function testMessageProcessor(): Promise<void> {
  try {
    // Test first message
    const firstMessagePayload = {
      data: {
        key: {
          id: 'test_123',
          remoteJid: env.TARGET_GROUP_ID || '120363418663151479@g.us'
        },
        pushName: 'Test User',
        message: {
          conversation: 'Work order #WO-12345 for John Doe at 123 Main St, $500 total'
        }
      }
    };
    
    const result = await processWhatsAppMessage(firstMessagePayload);
    console.log('Test result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}
