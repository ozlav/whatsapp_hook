import { Router } from 'express';
import { logger } from '../lib/logger';
import { getPrismaClient } from '../db/client';
import { testSheetsConnection } from '../sheets/client';
import { processWhatsAppMessage } from '../graph/simpleMessageProcessor';
import { addMessageToDepositSheet } from '../lib/whatsappProcessor';
import { createNewOrder, convertFirstMessageToOrderData } from '../sheets/operations';
import { analyzeFirstMessage } from '../lib/messageAnalyzer';
import { extractMessageText, extractSenderName } from '../lib/messageParser';

const webhookRouter = Router();

// WhatsApp webhook endpoint
webhookRouter.post('/whatsapp', async (req, res): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    // Check if body parsing failed (malformed JSON)
    if (req.body === undefined || req.body === null) {
      logger.warn({ requestId }, 'Webhook received malformed JSON');
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid JSON in request body',
        requestId
      });
      return;
    }

    logger.info({ requestId, body: req.body }, 'WhatsApp webhook received');
    
    // Basic validation - check if body exists and has content
    if (!req.body || Object.keys(req.body).length === 0) {
      logger.warn({ requestId }, 'Webhook received empty body');
      res.status(400).json({
        error: 'Bad Request',
        message: 'Request body is required',
        requestId
      });
      return;
    }

    // Log webhook to database (if available)
    try {
      const prisma = getPrismaClient();
      if (prisma) {
        await prisma.webhookLog.create({
          data: {
            rawPayload: req.body,
            headers: req.headers as any,
            method: req.method,
            url: req.originalUrl,
            userAgent: req.get('User-Agent') || null,
            ipAddress: req.ip || req.connection.remoteAddress || null,
            requestId: requestId || null,
            status: 'received'
          }
        });
        logger.info({ requestId }, 'Webhook logged to database');
      } else {
        logger.info({ requestId }, 'Database not available, skipping webhook logging');
      }
    } catch (dbError) {
      logger.error({ 
        requestId, 
        error: dbError instanceof Error ? dbError.message : 'Database error' 
      }, 'Failed to log webhook to database');
      // Continue processing even if database logging fails
    }

    // Note: Message processing is handled by /webhook/whatsapp/messages-upsert endpoint
    // This endpoint only logs to database to avoid duplicate processing
    logger.info({ requestId }, 'Message logged to database (processing handled by messages-upsert endpoint)');

    // TODO: Add EvolutionAPI signature verification
    // TODO: Add group ID filtering (remotejid)
    // TODO: Add message processing pipeline
    
    // For now, just acknowledge receipt
    logger.info({ requestId, messageId: req.body.data?.key?.id || 'unknown' }, 'Webhook processed successfully');
    
    res.status(200).json({
      ok: true,
      message: 'Webhook received and queued for processing',
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Webhook processing failed');
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process webhook',
      requestId
    });
  }
});

// WhatsApp messages-upsert endpoint (Evolution API specific)
webhookRouter.post('/whatsapp/messages-upsert', async (req, res): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    // Check if body parsing failed (malformed JSON)
    if (req.body === undefined || req.body === null) {
      logger.warn({ requestId }, 'Messages-upsert webhook received malformed JSON');
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid JSON in request body',
        requestId
      });
      return;
    }

    logger.info({ requestId, body: req.body }, 'WhatsApp messages-upsert webhook received');
    
    // Basic validation - check if body exists and has content
    if (!req.body || Object.keys(req.body).length === 0) {
      logger.warn({ requestId }, 'Messages-upsert webhook received empty body');
      res.status(400).json({
        error: 'Bad Request',
        message: 'Empty request body',
        requestId
      });
      return;
    }

    // Log webhook to database
    try {
      const prisma = getPrismaClient();
      if (prisma) {
        await prisma.webhookLog.create({
          data: {
            rawPayload: JSON.stringify(req.body),
            headers: JSON.stringify(req.headers),
            method: req.method,
            url: req.url,
            userAgent: req.headers['user-agent'] || 'unknown',
            ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
            requestId: requestId || 'no-request-id',
            status: 'received'
          }
        });
        logger.info({ requestId }, 'Messages-upsert webhook logged to database');
      }
    } catch (dbError) {
      logger.error({ 
        requestId, 
        error: dbError instanceof Error ? dbError.message : 'Database error' 
      }, 'Failed to log messages-upsert webhook to database');
      // Continue processing even if database logging fails
    }

    // Process WhatsApp message using the proper flow
    try {
      const messageId = req.body.data?.key?.id || 'unknown';
      
      // Process message with proper reply detection and flow
      const result = await processWhatsAppMessage(req.body);
      
      if (result.success) {
        logger.info({ 
          requestId, 
          messageId, 
          messageType: result.messageType 
        }, 'Messages-upsert processed successfully');
        
        // Log analysis results if available
        if (result.analysis) {
          logger.info({ 
            requestId, 
            messageId,
            analysis: result.analysis 
          }, 'Message analysis completed');
        }
      } else {
        logger.warn({ 
          requestId, 
          messageId, 
          error: result.error 
        }, 'Messages-upsert processing failed');
        
        // Fallback: add as basic message log
        try {
          await addMessageToDepositSheet(req.body);
          logger.info({ requestId, messageId }, 'Added to deposit sheet as basic log');
        } catch (fallbackError) {
          logger.error({ 
            requestId, 
            error: fallbackError instanceof Error ? fallbackError.message : 'Fallback error' 
          }, 'Failed to add message as basic log');
        }
      }
    } catch (processingError) {
      logger.error({ 
        requestId, 
        error: processingError instanceof Error ? processingError.message : 'Processing error' 
      }, 'Failed to process messages-upsert');
      // Continue processing even if message processing fails
    }

    // Send success response
    res.json({
      ok: true,
      message: 'Messages-upsert webhook processed successfully',
      requestId,
      timestamp: new Date().toISOString()
    });

    logger.info({ requestId }, 'Messages-upsert webhook processed successfully');
  } catch (error) {
    logger.error({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to process messages-upsert webhook');
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process messages-upsert webhook',
      requestId
    });
  }
});

// Test endpoint for webhook functionality
webhookRouter.get('/test', (req, res): void => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.info({ requestId }, 'Webhook test endpoint accessed');
  
  res.json({
    ok: true,
    message: 'Webhook endpoint is working',
    requestId,
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: 'POST /webhook/whatsapp',
      messagesUpsert: 'POST /webhook/whatsapp/messages-upsert',
      test: 'GET /webhook/test',
      logs: 'GET /webhook/logs',
      sheetsTest: 'GET /webhook/sheets-test'
    }
  });
});

// Test Google Sheets connectivity
webhookRouter.get('/sheets-test', async (req, res): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    logger.info({ requestId }, 'Testing Google Sheets connectivity');
    
    // Debug: Check environment variables in webhook context
    logger.info({ 
      requestId,
      GOOGLE_SHEET_ID: process.env['GOOGLE_SHEET_ID'] ? 'Set' : 'Missing',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env['GOOGLE_SERVICE_ACCOUNT_EMAIL'] ? 'Set' : 'Missing',
      GOOGLE_PRIVATE_KEY: process.env['GOOGLE_PRIVATE_KEY'] ? 'Set' : 'Missing'
    }, 'Environment variables in webhook context');
    
    const isConnected = await testSheetsConnection();
    
    if (isConnected) {
      logger.info({ requestId }, 'Google Sheets connection test successful');
      res.json({
        ok: true,
        message: 'Google Sheets connection successful',
        requestId,
        timestamp: new Date().toISOString()
      });
    } else {
      logger.warn({ requestId }, 'Google Sheets connection test failed');
      res.status(500).json({
        ok: false,
        message: 'Google Sheets connection failed',
        requestId,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Google Sheets test failed');
    
    res.status(500).json({
      ok: false,
      message: 'Google Sheets test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// View logged webhooks
webhookRouter.get('/logs', async (req, res): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    const prisma = getPrismaClient();
    
    if (!prisma) {
      logger.warn({ requestId }, 'Database not available, cannot retrieve webhook logs');
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database not available',
        requestId,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Get query parameters for pagination and filtering
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string) || 10, 100); // Max 100 per page
    const status = req.query['status'] as string;
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }
    
    // Get webhook logs with pagination
    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          method: true,
          url: true,
          userAgent: true,
          ipAddress: true,
          requestId: true,
          status: true,
          errorMessage: true,
          rawPayload: true
        }
      }),
      prisma.webhookLog.count({ where })
    ]);
    
    logger.info({ requestId, page, limit, total }, 'Webhook logs retrieved');
    
    res.json({
      ok: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Database error' 
    }, 'Failed to retrieve webhook logs');
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve webhook logs',
      requestId
    });
  }
});

// Test endpoint for direct Google Sheets operations
webhookRouter.post('/test-create-order', async (req, res): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    const { orderData, fullMessage } = req.body;
    
    if (!orderData) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'orderData is required',
        requestId
      });
      return;
    }
    
    logger.info({ requestId, orderData }, 'Testing direct Google Sheets operation');
    
    // Test the createNewOrder function directly
    const result = await createNewOrder(orderData, fullMessage);
    
    logger.info({ requestId, result }, 'Direct Google Sheets operation completed');
    
    res.json({
      ok: true,
      message: 'Order created successfully',
      result,
      requestId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Direct Google Sheets operation failed');
    
    res.status(500).json({
      ok: false,
      error: 'Google Sheets operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId
    });
  }
});

export { webhookRouter };
