/**
 * WhatsApp Message Processor
 * Processes WhatsApp messages and adds them to the deposit sheet
 */

import { logger } from './logger';
import { createNewOrder, convertFirstMessageToOrderData } from '../sheets/operations';
import { analyzeFirstMessage } from './messageAnalyzer';
import { extractMessageText, extractSenderName, isFromTargetGroup } from './messageParser';

/**
 * Process a WhatsApp webhook message and add to deposit sheet
 * @param webhookData - The webhook payload from WhatsApp
 * @returns Promise<boolean> - Success status
 */
export async function processWhatsAppMessage(webhookData: any): Promise<boolean> {
  try {
    const messageData = webhookData.data;
    const messageText = extractMessageText(messageData);
    const senderName = extractSenderName(messageData);
    const remoteJid = messageData.key?.remoteJid;

    // Check if message is from target group
    const targetGroupId = '120363418663151479@g.us'; // You can make this configurable
    if (!isFromTargetGroup(messageData, targetGroupId)) {
      logger.info('Message not from target group, skipping', { remoteJid });
      return false;
    }

    // Skip if no message text
    if (!messageText || messageText.trim().length === 0) {
      logger.info('No message text found, skipping');
      return false;
    }

    logger.info('Processing WhatsApp message', { 
      senderName, 
      messageLength: messageText.length,
      remoteJid 
    });

    // Try to analyze the message for work order data
    try {
      const analysis = await analyzeFirstMessage(messageText, senderName);
      
      if (analysis.relevant) {
        // Convert to order data
        const orderData = convertFirstMessageToOrderData(analysis, senderName);
        
        // Add to deposit sheet
        await createNewOrder(orderData, messageText);
        
        logger.info('Successfully added work order to deposit sheet', {
          workId: analysis.work_id,
          customerName: analysis.customer_name
        });
        
        return true;
      } else {
        logger.info('Message not relevant for work order processing', { messageText: messageText.substring(0, 100) });
        return false;
      }
    } catch (analysisError) {
      logger.error('Failed to analyze message', { 
        error: analysisError instanceof Error ? analysisError.message : 'Unknown error',
        messageText: messageText.substring(0, 100)
      });
      
      // Even if analysis fails, we might want to log the message
      // For now, we'll skip it
      return false;
    }

  } catch (error) {
    logger.error('Failed to process WhatsApp message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      webhookData: webhookData ? 'present' : 'missing'
    });
    return false;
  }
}

/**
 * Simple function to add any message to deposit sheet as a basic log entry
 * @param webhookData - The webhook payload from WhatsApp
 * @returns Promise<boolean> - Success status
 */
export async function addMessageToDepositSheet(webhookData: any): Promise<boolean> {
  try {
    const messageData = webhookData.data;
    const messageText = extractMessageText(messageData);
    const senderName = extractSenderName(messageData);
    const timestamp = new Date().toISOString();

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
    
    logger.info('Added message to deposit sheet', { 
      workId: basicOrderData.work_id,
      senderName 
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to add message to deposit sheet', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}
