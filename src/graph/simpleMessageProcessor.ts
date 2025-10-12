/**
 * Simple Message Processor (without LangGraph)
 * Direct function calls for message analysis
 * This is a working implementation that we can enhance with LangGraph later
 */

import { analyzeFirstMessage, analyzeReplyMessage, FirstMessageAnalysis, ReplyAnalysis } from '../lib/messageAnalyzer';
import { isReplyMessage, extractMessageText, extractSenderName } from '../lib/messageParser';
import { getThreadHistoryForReply } from '../db/queries/threadQueries';
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
    if (remoteJid !== env.TARGET_GROUP_ID) {
      logger.info('Message from non-target group, ignoring', { remoteJid, targetGroup: env.TARGET_GROUP_ID });
      return {
        success: true,
        messageType: 'ignored'
      };
    }
    
    // Check if message is a reply
    if (isReplyMessage(payload)) {
      logger.info('Processing reply message', { messageId, senderName });
      
      // Get thread history
      const threadHistory = await getThreadHistoryForReply(messageId, env.TARGET_GROUP_ID || '');
      
      if (threadHistory.length === 0) {
        logger.warn('No thread history found for reply', { messageId });
        return {
          success: false,
          messageType: 'reply',
          error: 'No thread history found'
        };
      }
      
      // Analyze reply
      const analysis = await analyzeReplyMessage(messageText, senderName, threadHistory);
      
      return {
        success: true,
        messageType: 'reply',
        analysis
      };
    } else {
      logger.info('Processing first message', { messageId, senderName });
      
      // Analyze first message
      const analysis = await analyzeFirstMessage(messageText, senderName);
      
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
