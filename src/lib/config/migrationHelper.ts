/**
 * Migration Helper
 * Helps convert existing env-based configuration to database configuration
 */

import { env } from '../env';
import { getPrismaClient } from '../../db/client';
import { logger } from '../logger';
import { createConfiguration, getAllActiveConfigurations } from './configService';
import { CreateConfigurationInput } from './types';

/**
 * Create default configuration from environment variables
 * @returns Created configuration or null if database not available
 */
export async function createDefaultConfigFromEnv(): Promise<boolean> {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      logger.warn('Database not available, cannot create default configuration');
      return false;
    }

    // Check if configuration already exists
    const existingConfigs = await getAllActiveConfigurations();
    if (existingConfigs.length > 0) {
      logger.info({ count: existingConfigs.length }, 'Configuration(s) already exist');
      return true;
    }

    // Get values from environment or use defaults
    const groupId = env.TARGET_GROUP_ID || '120363420497664775@g.us';
    const spreadsheetId = env.GOOGLE_SHEET_ID || '';

    if (!spreadsheetId) {
      logger.error('GOOGLE_SHEET_ID not set, cannot create default configuration');
      return false;
    }

    // Create column mapping for existing WorkOrderProcessor
    const columnMapping = {
      work_id: 4,
      customer_name: 5,
      address: 6,
      phone: 7,
      job_description: 0, // Full message column
      total_price: 10,
      deposit: 9,
      job_status: 13,
      start_date_time: 7,
      end_date_time: 8,
      sort_of_payment: 11,
      notes: 12,
      created_by: 2,
      updated_at: 1,
      updated_by: 2
    };

    const configData: CreateConfigurationInput = {
      name: 'Default Work Orders',
      enabled: true,
      groupIds: [groupId],
      processorClass: 'WorkOrderProcessor',
      spreadsheetId,
      mainSheetName: 'Deposite',
      logSheetName: 'Logs',
      auditSheetName: 'AuditLog',
      columnMapping,
      metadata: {
        requiresWorkId: true,
        allowUpdates: true,
        migratedFromEnv: true
      }
    };

    const config = await createConfiguration(configData);
    
    logger.info({ 
      configId: config.id, 
      groupId,
      spreadsheetId 
    }, 'Created default configuration from environment variables');
    
    return true;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to create default configuration from environment');
    return false;
  }
}

/**
 * Check if configuration exists or if we should fallback to env vars
 * @param groupId - WhatsApp group ID
 * @returns True if should use config, false to fallback to env
 */
export async function shouldUseConfiguration(groupId: string): Promise<boolean> {
  try {
    const configs = await getAllActiveConfigurations();
    
    // Check if any config handles this group
    const hasConfig = configs.some(config => 
      config.groupIds.includes(groupId)
    );
    
    if (hasConfig) {
      return true;
    }
    
    logger.info({ 
      groupId 
    }, 'No configuration found for group, will fallback to env vars');
    return false;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to check configuration existence');
    return false;
  }
}


