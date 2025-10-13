/**
 * WhatsApp Message Processor - Fallback Functions
 * Provides fallback functions for basic message logging
 */

import { logger } from './logger';
import { createNewOrder } from '../sheets/operations';
import { extractMessageText, extractSenderName, isFromTargetGroup } from './messageParser';
import { env } from './env';

/**
 * Simple function to add any message to deposit sheet as a basic log entry (FALLBACK)
 * @param webhookData - The webhook payload from WhatsApp
 * @returns Promise<boolean> - Success status
 */
export async function addMessageToDepositSheet(webhookData: any): Promise<boolean> {
  try {
    const messageData = webhookData.data;
    const messageText = extractMessageText(messageData);
    const senderName = extractSenderName(messageData);
    const remoteJid = messageData.key?.remoteJid;
    const timestamp = new Date().toISOString();

    // Check if message is from target group (same as processWhatsAppMessage)
    const targetGroupId = env.TARGET_GROUP_ID || '120363418663151479@g.us'; // Use env var or fallback
    const isFromGroup = isFromTargetGroup(remoteJid, targetGroupId);
    
    if (!isFromGroup) {
      logger.info('Message not from target group, skipping basic log', { remoteJid });
      return false;
    }

    // Skip if no message text
    if (!messageText || messageText.trim().length === 0) {
      logger.info('No message text found, skipping basic log');
      return false;
    }

    // Create a basic order data structure
    const basicOrderData = {
      work_id: `MSG_${Date.now()}`,
      customer_name: senderName,
      address: '',
      phone: '',
      job_description: messageText,
      total_price: 0,
      deposit: 0,
      job_status: 'new',
      start_date_time: '',
      end_date_time: '',
      sort_of_payment: '',
      notes: '',
      created_at: timestamp,
      updated_at: timestamp,
      created_by: senderName,
      updated_by: senderName
    };

    // Add to deposit sheet
    await createNewOrder(basicOrderData, messageText);
    
    logger.info('Added message to deposit sheet as basic log', { 
      workId: basicOrderData.work_id,
      senderName,
      remoteJid
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to add message to deposit sheet', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}
