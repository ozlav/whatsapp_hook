import { ChatOpenAI } from '@langchain/openai';
import { ProcessingResult } from '../types/schema';
import { loadSchema, generatePrompt } from '../lib/schemaLoader';
import { logger } from '../lib/logger';

/**
 * Process a message and extract data according to the schema
 */
export async function processMessage(rawMessage: any): Promise<ProcessingResult> {
  try {
    // Load schema
    const schema = loadSchema();
    
    // Extract text from message
    const messageText = extractTextFromMessage(rawMessage);
    
    if (!messageText) {
      return {
        success: false,
        data: null,
        error: 'Message is not a text message - only text messages are processed'
      };
    }
    
    // Process with OpenAI
    const extractedData = await extractWithOpenAI(messageText, schema);
    
    return {
      success: true,
      data: extractedData
    };
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Message processing failed');
    
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Extract text content from WhatsApp message
 * Only processes text messages, skips all other types
 */
function extractTextFromMessage(rawMessage: any): string | null {
  const data = rawMessage.data || {};
  const message = data.message || {};
  
  // Only process text messages
  if (message.conversation) {
    return message.conversation;
  }
  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }
  
  // Skip all other message types (images, videos, documents, etc.)
  return null;
}

/**
 * Extract data using OpenAI
 */
async function extractWithOpenAI(messageText: string, schema: any): Promise<any> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  
  const openai = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.1,
    openAIApiKey: apiKey,
    modelKwargs: {
      response_format: { type: "json_object" }
    },
  });
  
  const prompt = generatePrompt(schema, messageText);
  
  const response = await openai.invoke(prompt);
  const responseText = response.content as string;
  
  logger.info({ responseText }, 'OpenAI response received');
  
  try {
    const parsedData = JSON.parse(responseText);
    logger.info({ parsedData }, 'Successfully parsed OpenAI response');
    return parsedData;
  } catch (parseError) {
    logger.warn({ 
      responseText, 
      parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error' 
    }, 'Failed to parse OpenAI response as JSON');
    
    // Return empty data structure
    const emptyData: any = {};
    const properties = schema.properties || {};
    for (const key of Object.keys(properties)) {
      emptyData[key] = null;
    }
    
    return emptyData;
  }
}