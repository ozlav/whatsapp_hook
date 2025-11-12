/**
 * Schema Service
 * Manages loading and validation of dynamic JSON schemas
 */

import { getPrismaClient } from '../../db/client';
import { logger } from '../logger';
import { SchemaDefinition, Schema } from '../config/types';

// Cache for schemas
interface SchemaCacheEntry {
  schema: Schema | null;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const schemaCache = new Map<string, SchemaCacheEntry>();

/**
 * Get schema for a configuration
 * @param configId - Configuration ID
 * @returns Schema or null if not found
 */
export async function getSchemaByConfigId(configId: string): Promise<Schema | null> {
  try {
    const cached = schemaCache.get(configId);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug({ configId }, 'Schema cache hit');
      return cached.schema;
    }

    const prisma = getPrismaClient();
    if (!prisma) {
      logger.error('Database not available');
      return null;
    }

    const schema = await prisma.schema.findUnique({
      where: { configurationId: configId }
    });

    schemaCache.set(configId, { 
      schema: schema as any, 
      timestamp: Date.now() 
    });
    
    if (!schema) {
      logger.warn({ configId }, 'Schema not found for configuration');
      return null;
    }
    
    logger.info({ 
      configId 
    }, 'Loaded schema for configuration');
    
    return schema as any;
  } catch (error) {
    logger.error({ 
      configId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to get schema');
    return null;
  }
}

/**
 * Validate data against a JSON schema
 * This is a simplified implementation - for production, use ajv or similar
 * @param data - Data to validate
 * @param schema - JSON schema definition
 * @returns True if valid, false otherwise
 */
export function validateAgainstSchema(
  data: Record<string, any>, 
  schema: SchemaDefinition
): boolean {
  try {
    // Basic validation - check required fields
    const required = schema['required'] || [];
    
    for (const field of required) {
      if (!(field in data) || data[field] === null || data[field] === undefined) {
        logger.warn({ field }, 'Required field missing');
        return false;
      }
    }
    
    // Validate field types if schema has properties
    if (schema['properties']) {
      for (const [field, value] of Object.entries(data)) {
        const fieldSchema = schema['properties'][field];
        if (fieldSchema && !validateFieldType(value, fieldSchema)) {
          logger.warn({ field, value, expectedType: fieldSchema.type }, 'Type mismatch');
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Schema validation failed');
    return false;
  }
}

/**
 * Validate a single field against its schema definition
 */
function validateFieldType(value: any, fieldSchema: any): boolean {
  if (!fieldSchema.type) {
    return true; // No type specified, pass
  }

  const expectedType = fieldSchema.type;
  
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null;
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

/**
 * Clear schema cache
 * Useful for testing or manual cache invalidation
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
  logger.info('Schema cache cleared');
}

