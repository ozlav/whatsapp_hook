/**
 * Prompt Service
 * Manages loading and rendering of dynamic prompts from database
 */

import { getPrismaClient } from '../../db/client';
import { logger } from '../logger';
import { Prompt } from '../config/types';

// Cache for prompts
interface PromptCacheEntry {
  prompts: Prompt[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const promptCache = new Map<string, PromptCacheEntry>();

/**
 * Get prompts for a configuration
 * @param configId - Configuration ID
 * @returns Array of prompts
 */
export async function getPromptsByConfigId(configId: string): Promise<Prompt[]> {
  try {
    const cacheKey = `config:${configId}`;
    const cached = promptCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug({ cacheKey }, 'Prompt cache hit');
      return cached.prompts;
    }

    const prisma = getPrismaClient();
    if (!prisma) {
      logger.error('Database not available');
      return [];
    }

    const prompts = await prisma.prompt.findMany({
      where: { configurationId: configId }
    });

    promptCache.set(cacheKey, { prompts, timestamp: Date.now() });
    
    logger.info({ 
      configId, 
      promptCount: prompts.length 
    }, 'Loaded prompts for configuration');
    
    return prompts;
  } catch (error) {
    logger.error({ 
      configId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to get prompts');
    return [];
  }
}

/**
 * Get a specific prompt by type
 * @param configId - Configuration ID
 * @param type - Prompt type
 * @returns Prompt or null if not found
 */
export async function getPromptByType(
  configId: string, 
  type: string
): Promise<Prompt | null> {
  try {
    const prompts = await getPromptsByConfigId(configId);
    const prompt = prompts.find(p => p.type === type);
    
    if (!prompt) {
      logger.warn({ configId, type }, 'Prompt not found');
      return null;
    }
    
    return prompt;
  } catch (error) {
    logger.error({ 
      configId, 
      type,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to get prompt by type');
    return null;
  }
}

/**
 * Render a prompt template with variables
 * @param template - Prompt template with {{variable}} placeholders
 * @param variables - Variables to substitute
 * @returns Rendered prompt
 */
export function renderPrompt(template: string, variables: Record<string, string>): string {
  let rendered = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
  }
  
  // Log any unreplaced placeholders
  const unreplaced = rendered.match(/{{([^}]+)}}/g);
  if (unreplaced) {
    logger.warn({ 
      unreplacedPlaceholders: unreplaced 
    }, 'Unreplaced placeholders in prompt');
  }
  
  return rendered;
}

/**
 * Clear prompt cache
 * Useful for testing or manual cache invalidation
 */
export function clearPromptCache(): void {
  promptCache.clear();
  logger.info('Prompt cache cleared');
}


