/**
 * Error handling utilities for message processing
 * Provides robust error handling and recovery strategies
 */

import { logger } from './logger';
import { addMessageToDepositSheet } from './whatsappProcessor';
import { ValidationError, WebhookValidationError } from './validation';

/**
 * Error types for message processing
 */
export class MessageProcessingError extends Error {
  constructor(message: string, public originalError?: Error, public context?: any) {
    super(message);
    this.name = 'MessageProcessingError';
  }
}

export class LLMAnalysisError extends MessageProcessingError {
  constructor(message: string, originalError?: Error, context?: any) {
    super(message, originalError, context);
    this.name = 'LLMAnalysisError';
  }
}

export class SheetsOperationError extends MessageProcessingError {
  constructor(message: string, originalError?: Error, context?: any) {
    super(message, originalError, context);
    this.name = 'SheetsOperationError';
  }
}

/**
 * Processing result types
 */
export interface ProcessingResult {
  success: boolean;
  messageType: 'first' | 'reply' | 'ignored';
  analysis?: any;
  error?: string;
  fallbackUsed?: boolean;
}

/**
 * Handle processing errors with fallback strategies
 * @param error - The error that occurred
 * @param context - Additional context about the error
 * @param webhookData - Original webhook data for fallback
 * @returns Processing result with error information
 */
export async function handleProcessingError(
  error: Error,
  context: any,
  webhookData?: any
): Promise<ProcessingResult> {
  try {
    logger.error('Processing error occurred', {
      error: error.message,
      context,
      errorType: error.constructor.name
    });

    // Try fallback logging if webhook data is available
    if (webhookData) {
      try {
        await addMessageToDepositSheet(webhookData);
        logger.info('Fallback logging successful', { context });
        
        return {
          success: true,
          messageType: 'ignored',
          fallbackUsed: true,
          error: `Processing failed, logged as basic entry: ${error.message}`
        };
      } catch (fallbackError) {
        logger.error('Fallback logging also failed', {
          originalError: error.message,
          fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
          context
        });
      }
    }

    // Return error result
    return {
      success: false,
      messageType: 'ignored',
      error: error.message
    };
  } catch (handlingError) {
    logger.error('Error handling itself failed', {
      originalError: error.message,
      handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown error',
      context
    });

    return {
      success: false,
      messageType: 'ignored',
      error: `Critical error: ${error.message}`
    };
  }
}

/**
 * Handle LLM analysis errors
 * @param error - The LLM error
 * @param context - Analysis context
 * @param webhookData - Original webhook data for fallback
 * @returns Processing result
 */
export async function handleLLMAnalysisError(
  error: Error,
  context: any,
  webhookData?: any
): Promise<ProcessingResult> {
  const llmError = new LLMAnalysisError(
    `LLM analysis failed: ${error.message}`,
    error,
    context
  );

  logger.error('LLM analysis error', {
    error: error.message,
    context,
    messageText: context.messageText?.substring(0, 100)
  });

  return handleProcessingError(llmError, context, webhookData);
}

/**
 * Handle Google Sheets operation errors
 * @param error - The Sheets error
 * @param context - Operation context
 * @param webhookData - Original webhook data for fallback
 * @returns Processing result
 */
export async function handleSheetsOperationError(
  error: Error,
  context: any,
  webhookData?: any
): Promise<ProcessingResult> {
  const sheetsError = new SheetsOperationError(
    `Google Sheets operation failed: ${error.message}`,
    error,
    context
  );

  logger.error('Google Sheets operation error', {
    error: error.message,
    context,
    operation: context.operation
  });

  return handleProcessingError(sheetsError, context, webhookData);
}

/**
 * Handle validation errors
 * @param error - The validation error
 * @param context - Validation context
 * @param webhookData - Original webhook data for fallback
 * @returns Processing result
 */
export async function handleValidationError(
  error: ValidationError | WebhookValidationError,
  context: any,
  webhookData?: any
): Promise<ProcessingResult> {
  logger.warn('Validation error', {
    error: error.message,
    field: error.field,
    context
  });

  // For validation errors, we might still want to log the message
  if (webhookData) {
    try {
      await addMessageToDepositSheet(webhookData);
      logger.info('Validation failed, logged as basic entry', { context });
      
      return {
        success: true,
        messageType: 'ignored',
        fallbackUsed: true,
        error: `Validation failed, logged as basic entry: ${error.message}`
      };
    } catch (fallbackError) {
      logger.error('Fallback logging failed after validation error', {
        validationError: error.message,
        fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        context
      });
    }
  }

  return {
    success: false,
    messageType: 'ignored',
    error: error.message
  };
}

/**
 * Retry logic for transient failures
 * @param operation - The operation to retry
 * @param maxRetries - Maximum number of retries
 * @param delay - Delay between retries in milliseconds
 * @returns Promise with operation result
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }

      logger.warn('Operation failed, retrying', {
        attempt,
        maxRetries,
        error: lastError.message,
        delay
      });

      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError!;
}

/**
 * Check if an error is retryable
 * @param error - The error to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /rate limit/i,
    /quota exceeded/i,
    /service unavailable/i,
    /internal server error/i,
    /bad gateway/i,
    /gateway timeout/i
  ];

  return retryablePatterns.some(pattern => pattern.test(error.message));
}

/**
 * Create a safe error message for external consumption
 * @param error - The error to sanitize
 * @returns Safe error message
 */
export function sanitizeErrorMessage(error: Error): string {
  // Remove sensitive information from error messages
  let message = error.message;
  
  // Remove potential API keys or sensitive data
  message = message.replace(/[A-Za-z0-9]{20,}/g, '[REDACTED]');
  message = message.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED]');
  message = message.replace(/AIza[0-9A-Za-z\\-_]{35}/g, '[REDACTED]');
  
  return message;
}

/**
 * Log error with context for debugging
 * @param error - The error to log
 * @param context - Additional context
 * @param level - Log level
 */
export function logErrorWithContext(
  error: Error,
  context: any,
  level: 'error' | 'warn' = 'error'
): void {
  const logData = {
    error: error.message,
    errorType: error.constructor.name,
    stack: error.stack,
    context
  };

  if (level === 'warn') {
    logger.warn('Error occurred', logData);
  } else {
    logger.error('Error occurred', logData);
  }
}


