import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

/**
 * Loads the JSON schema from schema.json
 */
export function loadSchema(): any {
  try {
    const schemaPath = path.join(process.cwd(), 'schema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    return JSON.parse(schemaContent);
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to load schema.json');
    throw new Error(`Failed to load schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generates a simple prompt for OpenAI based on the schema
 */
export function generatePrompt(schema: any, messageText: string): string {
  const properties = schema.properties || {};
  const required = schema.required || [];
  
  // Build property descriptions
  const propertyDescriptions = Object.entries(properties).map(([key, prop]: [string, any]) => {
    const requiredText = required.includes(key) ? ' (REQUIRED)' : ' (optional)';
    return `- ${key}: ${prop.description || 'No description'}${requiredText}`;
  }).join('\n');
  
  return `
Extract the following information from this message and return as a JSON object:

Message: ${messageText}

Fields to extract:
${propertyDescriptions}

Rules:
- Use null for missing fields
- Extract numbers as numbers (not strings)
- For dates, use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
- Look for patterns like "Name: John", "Total: $200", "Start: 2024-01-15 09:00"
- For boolean fields like 'relevant', set to true if you can extract any meaningful data

Return a JSON object with the extracted data:
`;
}