/**
 * TypeScript types for WhatsApp webhook payloads
 * Provides proper typing for EvolutionAPI webhook data
 */

/**
 * WhatsApp message content types
 */
export interface MessageContent {
  conversation?: string;
  extendedTextMessage?: {
    text: string;
  };
  imageMessage?: {
    caption?: string;
  };
}

/**
 * WhatsApp context info for replies
 */
export interface ContextInfo {
  stanzaId?: string;
  quotedMessage?: MessageContent;
}

/**
 * WhatsApp message key
 */
export interface MessageKey {
  id: string;
  remoteJid: string;
}

/**
 * WhatsApp webhook payload data
 */
export interface WhatsAppWebhookData {
  key: MessageKey;
  pushName?: string;
  message: MessageContent;
  contextInfo?: ContextInfo;
}

/**
 * Complete WhatsApp webhook payload
 */
export interface WhatsAppWebhookPayload {
  data: WhatsAppWebhookData;
}

/**
 * API response types
 */
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
  timestamp?: string;
}

/**
 * Processing result types
 */
export interface ProcessingResult {
  success: boolean;
  messageType: 'first' | 'reply' | 'ignored';
  analysis?: any;
  error?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  ok: boolean;
  timestamp: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  version: string;
  environment: string;
  requestId?: string;
}


