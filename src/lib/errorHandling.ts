/**
 * Error handling utilities for message processing
 * Provides robust error handling and recovery strategies
 */

import { logger } from './logger';

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


