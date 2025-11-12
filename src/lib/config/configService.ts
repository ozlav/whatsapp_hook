/**
 * Configuration Service
 * Manages message processing configurations with caching
 */

import { getPrismaClient } from '../../db/client';
import { logger } from '../logger';
import { Configuration, CreateConfigurationInput, UpdateConfigurationInput, ColumnMapping, ProcessorMetadata } from './types';

// In-memory cache for configurations
interface CacheEntry {
  config: Configuration | Configuration[] | null;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Get configuration by group ID
 * @param groupId - WhatsApp group ID
 * @returns Configuration or null if not found
 */
export async function getConfigurationByGroupId(groupId: string): Promise<Configuration | null> {
  try {
    const cacheKey = `groupId:${groupId}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug({ cacheKey }, 'Configuration cache hit');
      return Array.isArray(cached.config) ? null : cached.config as Configuration | null;
    }

    const prisma = getPrismaClient();
    if (!prisma) {
      logger.error('Database not available');
      return null;
    }

    const config = await prisma.configuration.findFirst({
      where: {
        enabled: true,
        groupIds: {
          has: groupId
        }
      },
      include: {
        prompts: true,
        schema: true
      }
    });

    if (!config) {
      logger.info({ groupId }, 'No configuration found for group ID');
      cache.set(cacheKey, { config: null, timestamp: Date.now() });
      return null;
    }

    const typedConfig = {
      ...config,
      columnMapping: config.columnMapping as any as ColumnMapping,
      metadata: config.metadata as any as ProcessorMetadata
    } as Configuration;
    
    // Cache result
    cache.set(cacheKey, { config: typedConfig, timestamp: Date.now() });
    
    logger.info({ 
      configurationId: config.id, 
      groupId 
    }, 'Found configuration for group ID');
    
    return typedConfig;
  } catch (error) {
    logger.error({ 
      groupId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to get configuration by group ID');
    return null;
  }
}

/**
 * Get all active configurations
 * @returns Array of enabled configurations
 */
export async function getAllActiveConfigurations(): Promise<Configuration[]> {
  try {
    const cacheKey = 'all:active';
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug({ cacheKey }, 'All configurations cache hit');
      return Array.isArray(cached.config) ? cached.config as Configuration[] : [];
    }

    const prisma = getPrismaClient();
    if (!prisma) {
      logger.error('Database not available');
      return [];
    }

    const configs = await prisma.configuration.findMany({
      where: { enabled: true },
      include: {
        prompts: true,
        schema: true
      }
    });

    const typedConfigs = configs.map(config => ({
      ...config,
      columnMapping: config.columnMapping as any as ColumnMapping,
      metadata: config.metadata as any as ProcessorMetadata
    })) as Configuration[];
    
    // Cache result
    cache.set(cacheKey, { config: typedConfigs, timestamp: Date.now() });
    
    logger.info({ count: configs.length }, 'Retrieved all active configurations');
    
    return typedConfigs;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to get all active configurations');
    return [];
  }
}

/**
 * Get configuration by ID
 * @param id - Configuration ID
 * @returns Configuration or null if not found
 */
export async function getConfigurationById(id: string): Promise<Configuration | null> {
  try {
    const cacheKey = `id:${id}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug({ cacheKey }, 'Configuration cache hit');
      return Array.isArray(cached.config) ? null : cached.config as Configuration | null;
    }

    const prisma = getPrismaClient();
    if (!prisma) {
      logger.error('Database not available');
      return null;
    }

    const config = await prisma.configuration.findUnique({
      where: { id },
      include: {
        prompts: true,
        schema: true
      }
    });

    if (!config) {
      logger.warn({ id }, 'Configuration not found');
      return null;
    }

    const typedConfig = {
      ...config,
      columnMapping: config.columnMapping as any as ColumnMapping,
      metadata: config.metadata as any as ProcessorMetadata
    } as Configuration;
    
    // Cache result
    cache.set(cacheKey, { config: typedConfig, timestamp: Date.now() });
    
    return typedConfig;
  } catch (error) {
    logger.error({ 
      id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to get configuration by ID');
    return null;
  }
}

/**
 * Create new configuration
 * @param data - Configuration data
 * @returns Created configuration
 */
export async function createConfiguration(data: CreateConfigurationInput): Promise<Configuration> {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('Database not available');
    }

    const config = await prisma.configuration.create({
      data: {
        ...data,
        enabled: data.enabled !== undefined ? data.enabled : true,
        columnMapping: data.columnMapping as any,
        metadata: data.metadata as any
      },
      include: {
        prompts: true,
        schema: true
      }
    });

    // Clear cache
    cache.clear();
    
    logger.info({ 
      configurationId: config.id, 
      name: config.name 
    }, 'Created new configuration');
    
    return {
      ...config,
      columnMapping: config.columnMapping as any as ColumnMapping,
      metadata: config.metadata as any as ProcessorMetadata
    } as Configuration;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to create configuration');
    throw error;
  }
}

/**
 * Update configuration
 * @param id - Configuration ID
 * @param data - Update data
 * @returns Updated configuration
 */
export async function updateConfiguration(
  id: string, 
  data: UpdateConfigurationInput
): Promise<Configuration> {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('Database not available');
    }

    const config = await prisma.configuration.update({
      where: { id },
      data: {
        ...data,
        columnMapping: data.columnMapping as any,
        metadata: data.metadata as any
      },
      include: {
        prompts: true,
        schema: true
      }
    });

    // Clear cache
    cache.clear();
    
    logger.info({ 
      configurationId: config.id 
    }, 'Updated configuration');
    
    return {
      ...config,
      columnMapping: config.columnMapping as any as ColumnMapping,
      metadata: config.metadata as any as ProcessorMetadata
    } as Configuration;
  } catch (error) {
    logger.error({ 
      id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to update configuration');
    throw error;
  }
}

/**
 * Delete/disable configuration
 * @param id - Configuration ID
 */
export async function deleteConfiguration(id: string): Promise<void> {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      throw new Error('Database not available');
    }

    await prisma.configuration.delete({
      where: { id }
    });

    // Clear cache
    cache.clear();
    
    logger.info({ 
      configurationId: id 
    }, 'Deleted configuration');
  } catch (error) {
    logger.error({ 
      id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to delete configuration');
    throw error;
  }
}

/**
 * Clear configuration cache
 * Useful for testing or manual cache invalidation
 */
export function clearCache(): void {
  cache.clear();
  logger.info('Configuration cache cleared');
}



