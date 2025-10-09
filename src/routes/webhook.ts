import { Router } from 'express';
import { logger } from '../lib/logger';
import { getPrismaClient } from '../db/client';
import { appendToSheet, testSheetsConnection } from '../sheets/client';

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

    // Save webhook payload to Google Sheets
    try {
      const timestamp = new Date().toISOString();
      const messageId = req.body.data?.key?.id || 'unknown';
      const remoteJid = req.body.data?.key?.remoteJid || 'unknown';
      const messageText = req.body.data?.message?.conversation || 
                        req.body.data?.message?.extendedTextMessage?.text || 
                        req.body.data?.message?.imageMessage?.caption ||
                        'no text';
      
      // Prepare data for Google Sheets
      const sheetData = [
        [
          timestamp,
          requestId || 'no-request-id',
          messageId,
          remoteJid,
          messageText,
          JSON.stringify(req.body) // Full payload as JSON string
        ]
      ];

      await appendToSheet('logs!A:F', sheetData);
      logger.info({ requestId, messageId }, 'Webhook payload saved to Google Sheets');
    } catch (sheetsError) {
      logger.error({ 
        requestId, 
        error: sheetsError instanceof Error ? sheetsError.message : 'Sheets error' 
      }, 'Failed to save webhook payload to Google Sheets');
      // Continue processing even if Sheets save fails
    }

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

export { webhookRouter };
