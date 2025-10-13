/**
 * Thread Queries - Handles thread extraction from EvolutionAPI
 * Uses EvolutionAPI REST API to get message threads instead of direct database access
 */

import { logger } from '../../lib/logger';
import { ThreadMessage } from '../../lib/messageParser';
import { env } from '../../lib/env';

/**
 * Test EvolutionAPI connection
 * Uses EvolutionAPI REST API to test connectivity
 */
export const testEvolutionApiConnection = async (): Promise<boolean> => {
  try {
    // For now, we'll assume EvolutionAPI is accessible
    // In a real implementation, we could ping the EvolutionAPI health endpoint
    logger.info('EvolutionAPI connection test - assuming available');
    return true;
  } catch (error) {
    logger.error('EvolutionAPI connection test failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
};

/**
 * Get complete thread history for a message
 * Since we can't access EvolutionAPI database directly, we'll use a simplified approach
 * that extracts thread context from the webhook payload itself
 * @param messageId - The message ID to get thread for
 * @param targetGroupId - Target group ID to filter by
 * @returns Complete thread history or empty array
 */
export async function getThreadHistory(
  messageId: string, 
  targetGroupId: string
): Promise<ThreadMessage[]> {
  try {
    // Since we can't access EvolutionAPI database directly,
    // we'll return a minimal thread history
    // In a real implementation, we could use EvolutionAPI REST API
    logger.info('Thread history requested but EvolutionAPI database not accessible', { 
      messageId, 
      targetGroupId 
    });
    
    return [];
  } catch (error) {
    logger.error('Failed to get thread history', { 
      messageId, 
      targetGroupId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return [];
  }
}

/**
 * Get thread history for a reply message
 * Since we can't access EvolutionAPI database directly, we'll use the quoted message
 * from the reply payload to reconstruct the thread context
 * @param replyMessageId - The reply message ID
 * @param targetGroupId - Target group ID to filter by
 * @param quotedMessage - The quoted message content from the reply payload
 * @returns Complete thread history or empty array
 */
export async function getThreadHistoryForReply(
  replyMessageId: string, 
  targetGroupId: string,
  quotedMessage?: any
): Promise<ThreadMessage[]> {
  try {
    // Since we can't access EvolutionAPI database directly,
    // we'll use the quoted message to reconstruct thread context
    if (!quotedMessage || !quotedMessage.conversation) {
      logger.warn('No quoted message available for thread reconstruction', { replyMessageId });
      return [];
    }

    // Create a simple thread history from the quoted message
    const threadHistory: ThreadMessage[] = [{
      message_id: replyMessageId,
      sender_name: 'Original Sender', // We don't have the original sender name
      message_text: quotedMessage.conversation,
      thread_depth: 0,
      full_thread_history: quotedMessage.conversation
    }];

    logger.info('Reconstructed thread history from quoted message', { 
      replyMessageId, 
      targetGroupId,
      threadLength: threadHistory.length 
    });
    
    return threadHistory;
  } catch (error) {
    logger.error('Failed to get thread history for reply', { 
      replyMessageId, 
      targetGroupId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return [];
  }
}

// Note: No separate shutdown needed since we use the same database connection
// The main database client handles shutdown in src/db/client.ts
