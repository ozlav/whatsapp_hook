/**
 * Message Parser - Handles WhatsApp message parsing and reply detection
 * Works with EvolutionAPI webhook payloads
 */

import { getTargetGroupId } from './env';

export interface WhatsAppMessage {
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
}

export interface ThreadMessage {
  thread_base_id: string;
  thread_depth: number;
  current_message_id: string;
  sender_name: string;
  message_text: string;
  full_thread_history: string;
}

/**
 * Check if a WhatsApp message is a reply
 * @param payload - WhatsApp webhook payload
 * @returns true if message is a reply
 */
export function isReplyMessage(payload: any): boolean {
  try {
    const data = payload.data || payload;
    return !!(data.contextInfo?.stanzaId);
  } catch (error) {
    return false;
  }
}

/**
 * Extract the quoted message ID from a reply
 * @param payload - WhatsApp webhook payload
 * @returns parent message ID or null
 */
export function extractQuotedMessageId(payload: any): string | null {
  try {
    const data = payload.data || payload;
    return data.contextInfo?.stanzaId || null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract message text from various WhatsApp message types
 * @param payload - WhatsApp webhook payload
 * @returns extracted text or empty string
 */
export function extractMessageText(payload: any): string {
  try {
    const data = payload.data || payload;
    const message = data.message;
    
    if (!message) return '';
    
    // Try different message types
    if (message.conversation) {
      return message.conversation;
    }
    
    if (message.extendedTextMessage?.text) {
      return message.extendedTextMessage.text;
    }
    
    if (message.imageMessage?.caption) {
      return message.imageMessage.caption;
    }
    
    return '';
  } catch (error) {
    return '';
  }
}

/**
 * Extract sender name from WhatsApp payload
 * @param payload - WhatsApp webhook payload
 * @returns sender name or 'Unknown'
 */
export function extractSenderName(payload: any): string {
  try {
    const data = payload.data || payload;
    return data.pushName || 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Extract message ID from WhatsApp payload
 * @param payload - WhatsApp webhook payload
 * @returns message ID or empty string
 */
export function extractMessageId(payload: any): string {
  try {
    const data = payload.data || payload;
    return data.key?.id || '';
  } catch (error) {
    return '';
  }
}

/**
 * Extract remote JID (group ID) from WhatsApp payload
 * @param payload - WhatsApp webhook payload
 * @returns remote JID or empty string
 */
export function extractRemoteJid(payload: any): string {
  try {
    const data = payload.data || payload;
    return data.key?.remoteJid || '';
  } catch (error) {
    return '';
  }
}

/**
 * Check if message is from target group
 * @param remoteJid - The remote JID (group ID) to check
 * @param targetGroupId - Target group ID to filter by
 * @returns true if message is from target group
 */
export function isFromTargetGroup(remoteJid: string, targetGroupId?: string): boolean {
  try {
    const groupId = targetGroupId || getTargetGroupId();
    return remoteJid === groupId;
  } catch (error) {
    return false;
  }
}
