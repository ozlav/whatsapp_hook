/**
 * Configuration API Routes
 * Admin API for managing message processing configurations
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import {
  getAllActiveConfigurations,
  getConfigurationById,
  createConfiguration,
  updateConfiguration,
  deleteConfiguration
} from '../lib/config/configService';
import { CreateConfigurationInput, UpdateConfigurationInput } from '../lib/config/types';

const configRouter = Router();

/**
 * GET /config
 * List all configurations
 */
configRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    logger.info({ requestId }, 'Getting all configurations');
    
    const configs = await getAllActiveConfigurations();
    
    res.json({
      ok: true,
      data: configs,
      count: configs.length,
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to get configurations');
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve configurations',
      requestId
    });
  }
});

/**
 * GET /config/:id
 * Get specific configuration
 */
configRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  const { id } = req.params;
  
  if (!id) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Configuration ID is required',
      requestId
    });
    return;
  }
  
  try {
    logger.info({ requestId, configId: id }, 'Getting configuration');
    
    const config = await getConfigurationById(id);
    
    if (!config) {
      res.status(404).json({
        error: 'Not Found',
        message: `Configuration ${id} not found`,
        requestId
      });
      return;
    }
    
    res.json({
      ok: true,
      data: config,
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      configId: id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to get configuration');
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve configuration',
      requestId
    });
  }
});

/**
 * POST /config
 * Create new configuration
 */
configRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    logger.info({ requestId, body: req.body }, 'Creating configuration');
    
    const configData = req.body as CreateConfigurationInput;
    
    // Basic validation
    if (!configData.name || !configData.groupIds || !configData.processorClass) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'name, groupIds, and processorClass are required',
        requestId
      });
      return;
    }
    
    const config = await createConfiguration(configData);
    
    logger.info({ requestId, configId: config.id }, 'Configuration created');
    
    res.status(201).json({
      ok: true,
      data: config,
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to create configuration');
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create configuration',
      requestId
    });
  }
});

/**
 * PUT /config/:id
 * Update configuration
 */
configRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  const { id } = req.params;
  
  if (!id) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Configuration ID is required',
      requestId
    });
    return;
  }
  
  try {
    logger.info({ requestId, configId: id, body: req.body }, 'Updating configuration');
    
    const updateData = req.body as UpdateConfigurationInput;
    
    const config = await updateConfiguration(id, updateData);
    
    logger.info({ requestId, configId: config.id }, 'Configuration updated');
    
    res.json({
      ok: true,
      data: config,
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      configId: id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to update configuration');
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update configuration',
      requestId
    });
  }
});

/**
 * DELETE /config/:id
 * Delete configuration
 */
configRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  const { id } = req.params;
  
  if (!id) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Configuration ID is required',
      requestId
    });
    return;
  }
  
  try {
    logger.info({ requestId, configId: id }, 'Deleting configuration');
    
    await deleteConfiguration(id);
    
    logger.info({ requestId, configId: id }, 'Configuration deleted');
    
    res.json({
      ok: true,
      message: 'Configuration deleted',
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      configId: id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to delete configuration');
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete configuration',
      requestId
    });
  }
});

export { configRouter };

