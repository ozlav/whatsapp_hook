/**
 * Thread Queries - Handles thread extraction from EvolutionAPI Message table
 * Uses the getThread.sql query to extract complete message threads
 * EvolutionAPI uses the same PostgreSQL database but different schema
 */

import { getPrismaClient } from '../client';
import { logger } from '../../lib/logger';
import { ThreadMessage } from '../../lib/messageParser';

/**
 * Test EvolutionAPI Message table access
 * Uses the same database connection but queries EvolutionAPI's Message table
 */
export const testEvolutionDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = getPrismaClient();
    if (!client) {
      logger.warn('Database client not available for EvolutionAPI Message table access');
      return false;
    }
    
    // Test if we can access the EvolutionAPI Message table
    await client.$queryRaw`SELECT 1 FROM "Message" LIMIT 1`;
    logger.info('EvolutionAPI Message table access successful');
    return true;
  } catch (error) {
    logger.error('EvolutionAPI Message table access failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
};

/**
 * Get complete thread history for a message
 * Uses the getThread.sql query to extract thread with recursive CTE
 * @param messageId - The message ID to get thread for
 * @param targetGroupId - Target group ID to filter by
 * @returns Complete thread history or empty array
 */
export async function getThreadHistory(
  messageId: string, 
  targetGroupId: string
): Promise<ThreadMessage[]> {
  try {
    const client = getPrismaClient();
    if (!client) {
      logger.warn('Database not available, cannot get thread history');
      return [];
    }

    // Use the getThread.sql query with parameterized group ID
    const query = `
      WITH RECURSIVE MessageThread AS (
          -- 1. ANCHOR MEMBER: Base Message (Depth 0)
          SELECT
              t."key" ->> 'id' AS thread_base_id,
              t."key" ->> 'id' AS current_message_id,
              t."contextInfo" ->> 'stanzaId' AS parent_message_id,
              t."message" -> 'conversation' AS message_text,
              t."pushName" AS sender_name,
              0 AS thread_depth,
              -- Initialize the history with the first message
              CONCAT(t."pushName", ' : ', t."message" -> 'conversation') AS full_thread_history
          FROM
              "Message" t
          WHERE
              -- Identify messages that are NOT replies (start of a thread)
              (t."contextInfo" IS NULL OR t."contextInfo" ->> 'stanzaId' IS NULL)
              AND t."message" -> 'conversation' IS NOT NULL
              AND t."key" ->> 'remoteJid' = $1

          UNION ALL

          -- 2. RECURSIVE MEMBER: Replies (Depth 1, 2, 3, etc.)
          SELECT
              mt.thread_base_id,
              t."key" ->> 'id' AS current_message_id,
              t."contextInfo" ->> 'stanzaId' AS parent_message_id,
              t."message" -> 'conversation' AS message_text,
              t."pushName" AS sender_name,
              mt.thread_depth + 1 AS thread_depth,
              -- Accumulate the history: previous history + separator + current message
              CONCAT(mt.full_thread_history, ' | ', t."pushName", ' : ', t."message" -> 'conversation') AS full_thread_history
          FROM
              "Message" t
          JOIN
              MessageThread mt ON t."contextInfo" ->> 'stanzaId' = mt.current_message_id
          WHERE
              t."contextInfo" ->> 'stanzaId' IS NOT NULL
              AND t."key" ->> 'remoteJid' = $1
      )
      -- 3. FINAL SELECTION: Output the full thread, ordered by the base message and depth
      SELECT
          thread_base_id,
          thread_depth,
          current_message_id,
          sender_name,
          message_text,
          full_thread_history
      FROM
          MessageThread
      WHERE
          current_message_id = $2 OR thread_base_id = $2
      ORDER BY
          thread_base_id,
          thread_depth;
    `;

    const result = await client.$queryRawUnsafe<ThreadMessage[]>(query, targetGroupId, messageId);
    
    logger.info('Thread history retrieved', { 
      messageId, 
      targetGroupId, 
      threadLength: result.length 
    });
    
    return result;
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
 * Finds the base message and returns complete thread
 * @param replyMessageId - The reply message ID
 * @param targetGroupId - Target group ID to filter by
 * @returns Complete thread history or empty array
 */
export async function getThreadHistoryForReply(
  replyMessageId: string, 
  targetGroupId: string
): Promise<ThreadMessage[]> {
  try {
    const client = getPrismaClient();
    if (!client) {
      logger.warn('Database not available, cannot get thread history for reply');
      return [];
    }

    // First, find the base message by following the reply chain
    const findBaseQuery = `
      WITH RECURSIVE ReplyChain AS (
          -- Start with the reply message
          SELECT
              "key" ->> 'id' AS message_id,
              "contextInfo" ->> 'stanzaId' AS parent_id,
              0 AS depth
          FROM "Message"
          WHERE "key" ->> 'id' = $1
          
          UNION ALL
          
          -- Follow the chain backwards to find the base message
          SELECT
              m."key" ->> 'id' AS message_id,
              m."contextInfo" ->> 'stanzaId' AS parent_id,
              rc.depth + 1
          FROM "Message" m
          JOIN ReplyChain rc ON m."key" ->> 'id' = rc.parent_id
          WHERE m."contextInfo" ->> 'stanzaId' IS NOT NULL
      )
      SELECT message_id FROM ReplyChain 
      WHERE parent_id IS NULL 
      ORDER BY depth DESC 
      LIMIT 1;
    `;

    const baseResult = await client.$queryRawUnsafe<{ message_id: string }[]>(
      findBaseQuery, 
      replyMessageId
    );

    if (baseResult.length === 0) {
      logger.warn('Could not find base message for reply', { replyMessageId });
      return [];
    }

    const baseMessageId = baseResult[0]?.message_id;
    if (!baseMessageId) {
      logger.warn('Base message ID not found for reply', { replyMessageId });
      return [];
    }
    
    logger.info('Found base message for reply', { replyMessageId, baseMessageId });

    // Now get the complete thread starting from the base message
    return await getThreadHistory(baseMessageId, targetGroupId);
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
