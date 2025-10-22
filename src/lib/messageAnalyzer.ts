/**
 * Message Analyzer - Handles LLM analysis of WhatsApp messages
 * Uses only 2 LLM calls: first message analysis and reply analysis
 */

import { ChatOpenAI } from '@langchain/openai';
import { logger } from './logger';
import { env } from './env';
import { loadSchema } from './schemaLoader';

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
      timeout: 30000, // 30 second timeout
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
  changesDetected: boolean;
  changedFields: string[];
  columnUpdates?: Record<number, any>; // Maps column indices to new values
}

/**
 * Analyze message to extract work order data
 * Single LLM call that extracts all fields + relevance check
 * Used for both first messages and quoted messages in replies
 * @param messageText - The message text to analyze
 * @param senderName - The sender's name
 * @returns Message analysis result
 */
export async function analyzeMessage(
  messageText: string,
  senderName: string
): Promise<FirstMessageAnalysis> {
  try {
    const client = getOpenAIClient();
    const schema = await loadSchema();
    
    const prompt = `You are analyzing a WhatsApp message for work order information. Extract all relevant fields and determine if this message contains enough information to be considered a work order.

Message from ${senderName}: "${messageText}"

Extract the following information and return ONLY a valid JSON object:
- work_id: The unique work order ID, job number, or lead ID. If none found, leave empty (will use address as fallback)
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
    
    // Use address as fallback ID if no explicit work_id is provided
    if (!analysis.work_id || analysis.work_id.trim() === '') {
      if (analysis.address && analysis.address.trim() !== '') {
        analysis.work_id = analysis.address;
        logger.info('Using address as work_id fallback', { 
          address: analysis.address,
          workId: analysis.work_id 
        });
      }
    }
    
    // Validate required fields
    if (!analysis.work_id || !analysis.address || !analysis.phone) {
      analysis.relevant = false;
    }
    
    logger.info('Message analysis completed', { 
      workId: analysis.work_id,
      relevant: analysis.relevant,
      hasAddress: !!analysis.address,
      hasPhone: !!analysis.phone
    });
    
    return analysis;
  } catch (error) {
    logger.error('Message analysis failed', { 
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
 * Analyze reply message to detect work order changes based on current Google Sheets row data
 * @param messageText - The reply message text
 * @param senderName - The sender's name
 * @param workId - The work order ID
 * @param headers - Google Sheets column headers
 * @param rowData - Current row data from Google Sheets
 * @returns Reply analysis result
 */
export async function analyzeReplyMessage(
  messageText: string,
  senderName: string,
  workId: string,
  headers: string[],
  rowData: string[],
  columnIndices: Record<string, number>
): Promise<ReplyAnalysis> {
  try {
    const client = getOpenAIClient();
    
    // Create a mapping of headers to current values
    const currentData: Record<string, string> = {};
    headers.forEach((header, index) => {
      currentData[header] = rowData[index] || '';
    });
    
    const prompt = `Analyze this WhatsApp reply for work order updates.

Current data:
${headers.map((header, index) => `${index}:${header}=${rowData[index] || ''}`).join(' | ')}

Reply: "${messageText}"

Return JSON with:
- changesDetected: boolean
- changedFields: array of field names
- columnUpdates: {columnIndex: newValue}

Rules:
- "done"/"finished"/"completed" → job status = "done"
- "cancelled"/"cancel" → job status = "cancelled" 
- "refund" → job status = "refund"

Example: {"changesDetected":true,"changedFields":["job status","notes"],"columnUpdates":{"13":"done","12":"Job finished"}}`;

    logger.info('Sending prompt to OpenAI', { 
      workId,
      promptLength: prompt.length,
      columnIndicesCount: Object.keys(columnIndices).length
    });
    
    const response = await client.invoke(prompt);
    const responseText = response.content as string;
    
    logger.info('Received response from OpenAI', { 
      workId,
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 200)
    });
    
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
        changesDetected: false,
        changedFields: []
      };
    }
    
    logger.info('Reply message analysis completed', { 
      workId,
      changesDetected: analysis.changesDetected,
      changedFields: analysis.changedFields,
      columnUpdates: analysis.columnUpdates
    });
    
    return analysis;
  } catch (error) {
    logger.error('Reply message analysis failed', { 
      messageText: messageText.substring(0, 100),
      senderName,
      workId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    // Return fallback analysis
    return {
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
