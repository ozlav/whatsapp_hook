/**
 * Configuration Types
 * Type definitions for the configuration-driven message processing system
 */

import { Prompt as PrismaPrompt, Schema as PrismaSchema } from '@prisma/client';

/**
 * Column mapping configuration
 * Maps field names to column indices (0-based)
 */
export interface ColumnMapping {
  [fieldName: string]: number;
}

/**
 * Processor metadata
 * Additional configuration for specific processors
 */
export interface ProcessorMetadata {
  [key: string]: any;
}

/**
 * Configuration object for message processing
 */
export interface Configuration {
  id: string;
  name: string;
  enabled: boolean;
  groupIds: string[];
  processorClass: string;
  spreadsheetId: string;
  mainSheetName: string;
  logSheetName: string;
  auditSheetName: string;
  columnMapping: ColumnMapping;
  metadata?: ProcessorMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Prompt object
 */
export interface Prompt extends PrismaPrompt {}

/**
 * Schema definition
 */
export interface SchemaDefinition {
  [key: string]: any;
}

/**
 * Schema object from database
 */
export interface Schema extends Omit<PrismaSchema, 'definition'> {
  definition: SchemaDefinition;
}

/**
 * Configuration creation input
 */
export interface CreateConfigurationInput {
  name: string;
  enabled?: boolean;
  groupIds: string[];
  processorClass: string;
  spreadsheetId: string;
  mainSheetName: string;
  logSheetName: string;
  auditSheetName: string;
  columnMapping: ColumnMapping;
  metadata?: ProcessorMetadata;
}

/**
 * Configuration update input
 */
export interface UpdateConfigurationInput {
  name?: string;
  enabled?: boolean;
  groupIds?: string[];
  processorClass?: string;
  spreadsheetId?: string;
  mainSheetName?: string;
  logSheetName?: string;
  auditSheetName?: string;
  columnMapping?: ColumnMapping;
  metadata?: ProcessorMetadata;
}

/**
 * Prompt creation input
 */
export interface CreatePromptInput {
  configurationId: string;
  name: string;
  type: string;
  template: string;
  systemPrompt?: string;
}

/**
 * Schema creation input
 */
export interface CreateSchemaInput {
  configurationId: string;
  definition: SchemaDefinition;
}

/**
 * Cache key for configuration lookup
 */
export interface CacheKey {
  type: 'byGroupId' | 'byId' | 'all';
  value?: string;
}



