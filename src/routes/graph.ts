import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { processMessage } from '../graph';
import { loadSchema } from '../lib/schemaLoader';

const graphRouter = Router();

// Schema for the request
const ProcessMessageSchema = z.object({
  message: z.any(), // Raw webhook message payload
});

// Process a message
graphRouter.post('/process', async (req, res): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    // Validate request body
    const validationResult = ProcessMessageSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: validationResult.error.errors,
        requestId,
      });
      return;
    }
    
    const { message } = validationResult.data;
    
    logger.info({ requestId }, 'Processing message');
    
    // Process the message
    const result = await processMessage(message);
    
    if (result.success) {
      logger.info({ requestId }, 'Message processed successfully');
      
      res.json({
        ok: true,
        data: result.data,
        requestId,
        timestamp: new Date().toISOString(),
      });
    } else {
      logger.warn({ requestId, error: result.error }, 'Message processing failed');
      
      res.status(500).json({
        ok: false,
        error: 'Message processing failed',
        details: result.error,
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Graph processing endpoint failed');
    
    res.status(500).json({
      ok: false,
      error: 'Internal Server Error',
      message: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
  }
});

// Test endpoint
graphRouter.get('/test', (req, res): void => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    const schema = loadSchema();
    
    res.json({
      ok: true,
      message: 'Graph processing endpoint is working',
      requestId,
      timestamp: new Date().toISOString(),
      schema: {
        title: schema.title,
        requiredFields: schema.required || [],
        propertiesCount: Object.keys(schema.properties || {}).length,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: 'Failed to load schema',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    });
  }
});

export { graphRouter };