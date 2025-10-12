/**
 * Message Analyzer - Handles LLM analysis of WhatsApp messages
 * Uses only 2 LLM calls: first message analysis and reply analysis
 */

import { ChatOpenAI } from '@langchain/openai';
import { logger } from './logger';
import { env } from './env';
import { loadSchema } from './schemaLoader';
import { ThreadMessage } from './messageParser';

// OpenAI client instance
let openaiClient: ChatOpenAI | null = null;

/**
 * Get OpenAI client instance
 */
const getOpenAIClient = (): ChatOpenAI => {
  if (!openaiClient) {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for message analysis');
    }
    
    openaiClient = new ChatOpenAI({
      modelName: 'gpt-4o-mini', // Use faster, cheaper model
      temperature: 0.1, // Low temperature for consistent extraction
      openAIApiKey: apiKey,
      modelKwargs: {
        response_format: { type: "json_object" }
      }
    });
  }
  
  return openaiClient;
};

/**
 * First Message Analysis Result
 */
export interface FirstMessageAnalysis {
  work_id: string;
  address: string;
  phone: string;
  customer_name: string;
  job_description?: string;
  total_price?: number;
  deposit?: number;
  job_status?: string;
  start_date_time?: string;
  end_date_time?: string;
  sort_of_payment?: string;
  notes?: string;
  relevant: boolean;
}

/**
 * Reply Analysis Result
 */
export interface ReplyAnalysis {
  hasWorkId: boolean;
  workId?: string;
  changesDetected: boolean;
  changedFields: string[];
  newValues?: Record<string, any>;
}

/**
 * Analyze first message to extract work order data
 * Single LLM call that extracts all fields + relevance check
 * @param messageText - The message text to analyze
 * @param senderName - The sender's name
 * @returns First message analysis result
 */
export async function analyzeFirstMessage(
  messageText: string,
  senderName: string
): Promise<FirstMessageAnalysis> {
  try {
    const client = getOpenAIClient();
    const schema = await loadSchema();
    
    const prompt = `You are analyzing a WhatsApp message for work order information. Extract all relevant fields and determine if this message contains enough information to be considered a work order.

Message from ${senderName}: "${messageText}"

Extract the following information and return ONLY a valid JSON object:
- work_id: The unique work order ID or job number (required)
- address: The full address of the customer (required)
- phone: The customer's phone number (required)
- customer_name: The full name of the customer (required)
- job_description: Description of the work to be done
- total_price: The total monetary amount for the job (number)
- deposit: The deposit amount (number)
- job_status: Status like 'done', 'refund', 'cancelled', or 'new' if not mentioned
- start_date_time: When the service/job started (ISO format)
- end_date_time: When the service/job ended (ISO format)
- sort_of_payment: Payment method (cash, check, cc/credit card, etc.)
- notes: Any additional information or notes
- relevant: true if message has work_id, address, and phone (minimum required fields)

IMPORTANT:
- Return ONLY valid JSON, no other text
- Use null for missing optional fields
- For dates, use ISO format (YYYY-MM-DDTHH:mm:ssZ)
- For numbers, use actual numbers not strings
- If work_id, address, or phone are missing, set relevant to false
- Be conservative - only mark as relevant if you're confident about the minimum fields

Schema requirements: ${JSON.stringify(schema, null, 2)}`;

    const response = await client.invoke(prompt);
    const responseText = response.content as string;
    
    // Parse JSON response
    let analysis: FirstMessageAnalysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse LLM response as JSON', { 
        response: responseText, 
        error: parseError instanceof Error ? parseError.message : 'Unknown error' 
      });
      
      // Fallback: return minimal analysis
      analysis = {
        work_id: '',
        address: '',
        phone: '',
        customer_name: senderName,
        relevant: false
      };
    }
    
    // Validate required fields
    if (!analysis.work_id || !analysis.address || !analysis.phone) {
      analysis.relevant = false;
    }
    
    logger.info('First message analysis completed', { 
      workId: analysis.work_id,
      relevant: analysis.relevant,
      hasAddress: !!analysis.address,
      hasPhone: !!analysis.phone
    });
    
    return analysis;
  } catch (error) {
    logger.error('First message analysis failed', { 
      messageText: messageText.substring(0, 100),
      senderName,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    // Return fallback analysis
    return {
      work_id: '',
      address: '',
      phone: '',
      customer_name: senderName,
      relevant: false
    };
  }
}

/**
 * Analyze reply message to detect work order changes
 * Single LLM call that checks work_id + detects changes
 * @param messageText - The reply message text
 * @param senderName - The sender's name
 * @param threadHistory - Complete thread history
 * @returns Reply analysis result
 */
export async function analyzeReplyMessage(
  messageText: string,
  senderName: string,
  threadHistory: ThreadMessage[]
): Promise<ReplyAnalysis> {
  try {
    const client = getOpenAIClient();
    
    // Build thread context
    const threadContext = threadHistory
      .map(msg => `${msg.sender_name}: ${msg.message_text}`)
      .join(' | ');
    
    const prompt = `You are analyzing a WhatsApp reply message in a thread to detect work order changes. Determine if this thread contains a work order and what specific fields changed in the latest reply.

Thread History: ${threadContext}

Latest Reply from ${senderName}: "${messageText}"

Analyze the thread and reply, then return ONLY a valid JSON object with:
- hasWorkId: true if the thread contains a work order with work_id
- workId: the work_id if found (string)
- changesDetected: true if the latest reply contains changes to work order fields
- changedFields: array of field names that changed (e.g., ["job_status", "total_price"])
- newValues: object with new values for changed fields (optional)

Work order fields to check for changes:
- work_id, address, phone, customer_name
- job_description, total_price, deposit
- job_status, start_date_time, end_date_time
- sort_of_payment, notes

IMPORTANT:
- Return ONLY valid JSON, no other text
- Be conservative - only mark changes if you're confident
- Look for explicit changes in the latest reply
- If no work order found in thread, set hasWorkId to false
- If no changes detected, set changesDetected to false and empty changedFields array

Example response:
{
  "hasWorkId": true,
  "workId": "WO-12345",
  "changesDetected": true,
  "changedFields": ["job_status", "notes"],
  "newValues": {
    "job_status": "completed",
    "notes": "Job finished successfully"
  }
}`;

    const response = await client.invoke(prompt);
    const responseText = response.content as string;
    
    // Parse JSON response
    let analysis: ReplyAnalysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse LLM response as JSON', { 
        response: responseText, 
        error: parseError instanceof Error ? parseError.message : 'Unknown error' 
      });
      
      // Fallback: return minimal analysis
      analysis = {
        hasWorkId: false,
        changesDetected: false,
        changedFields: []
      };
    }
    
    logger.info('Reply message analysis completed', { 
      hasWorkId: analysis.hasWorkId,
      workId: analysis.workId,
      changesDetected: analysis.changesDetected,
      changedFields: analysis.changedFields
    });
    
    return analysis;
  } catch (error) {
    logger.error('Reply message analysis failed', { 
      messageText: messageText.substring(0, 100),
      senderName,
      threadLength: threadHistory.length,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    // Return fallback analysis
    return {
      hasWorkId: false,
      changesDetected: false,
      changedFields: []
    };
  }
}

/**
 * Test OpenAI connection
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const client = getOpenAIClient();
    await client.invoke('Test connection');
    logger.info('OpenAI connection test successful');
    return true;
  } catch (error) {
    logger.error('OpenAI connection test failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}
