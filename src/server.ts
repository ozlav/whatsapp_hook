import express from 'express';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health';
import { webhookRouter } from './routes/webhook';
import { logger } from './lib/logger';
import { env } from './lib/env';
import { testDatabaseConnection, disconnectDatabase } from './db/client';

// Load environment variables
dotenv.config();

// Log startup information
logger.info('Starting WhatsApp webhook server...', {
  nodeEnv: process.env['NODE_ENV'],
  port: process.env['PORT'],
  hasDatabaseUrl: !!process.env['DATABASE_URL'],
  hasOpenaiKey: !!process.env['OPENAI_API_KEY'],
  hasGoogleSheetId: !!process.env['GOOGLE_SHEET_ID'],
  hasWebhookSecret: !!process.env['EVOLUTION_WEBHOOK_SECRET'],
  hasTargetGroupId: !!process.env['TARGET_GROUP_ID']
});

const app = express();
const PORT = parseInt(env.PORT || process.env['PORT'] || '3000', 10);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// JSON error handler middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    const requestId = req.headers['x-request-id'] as string;
    logger.warn({ requestId, error: err.message }, 'Malformed JSON received');
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON in request body',
      requestId
    });
    return;
  }
  next(err);
});

// Request logging middleware
app.use((req, _res, next) => {
  const requestId = Math.random().toString(36).substring(7);
  req.headers['x-request-id'] = requestId;
  logger.info({ requestId, method: req.method, url: req.url }, 'Incoming request');
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/webhook', webhookRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ 
    message: 'Zehava WhatsApp Webhook Service',
    version: '1.0.0',
    status: 'running'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  logger.error({ requestId, error: err.message, stack: err.stack }, 'Unhandled error');
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
    requestId
  });
});

// Start server only if not in test environment
let server: any = null;
if (env.NODE_ENV !== 'test') {
  // Test database connection before starting server
  const startServer = async () => {
    try {
      if (env.DATABASE_URL) {
        const dbConnected = await testDatabaseConnection();
        if (!dbConnected) {
          logger.warn('Database connection failed, but continuing without database');
        }
      } else {
        logger.info('No DATABASE_URL provided, running without database');
      }
      
      server = app.listen(PORT, () => {
        logger.info({ port: PORT, env: env.NODE_ENV }, 'Server started');
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Failed to start server');
      process.exit(1);
    }
  };
  
  startServer();
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }
});

export default app;
