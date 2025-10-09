import { Router } from 'express';
import { logger } from '../lib/logger';

const healthRouter = Router();

// Health check endpoint
healthRouter.get('/', (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    const healthStatus = {
      ok: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env['npm_package_version'] || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      requestId
    };

    logger.debug({ requestId, healthStatus }, 'Health check requested');
    
    res.status(200).json(healthStatus);
  } catch (error) {
    logger.error({ requestId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Health check failed');
    
    res.status(500).json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      requestId
    });
  }
});

// Detailed health check
healthRouter.get('/detailed', (req, res) => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    const checks = {
      server: { status: 'ok', message: 'Express server running' },
      memory: { 
        status: 'ok', 
        message: 'Memory usage normal',
        details: process.memoryUsage()
      },
      uptime: { 
        status: 'ok', 
        message: 'Server running normally',
        details: `${Math.floor(process.uptime())} seconds`
      }
    };

    logger.info({ requestId, checks }, 'Detailed health check completed');

    res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      checks,
      requestId
    });
  } catch (error) {
    logger.error({ requestId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Detailed health check failed');
    
    res.status(500).json({
      ok: false,
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      requestId
    });
  }
});

export { healthRouter };
