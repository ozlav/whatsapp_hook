/**
 * Common Error Handling Utilities
 * Provides centralized error handling for all message processors
 */

import { logger } from './logger';
import { ProcessingResult } from '../types/webhook';

export interface ErrorContext {
  messageId?: string;
  workId?: string;
  senderName?: string;
  remoteJid?: string;
  quotedMessageId?: string | undefined;
  analysis?: any;
  customMessage?: string;
  rowId?: string;
  rowNumber?: number;
}

export type ErrorType = 
  | 'not_found' 
  | 'missing_content' 
  | 'invalid_data' 
  | 'ignored' 
  | 'network_error'
  | 'validation_error';

/**
 * Common error handler that can handle all error cases across processors
 * @param errorType - Type of error to handle
 * @param context - Context information for logging
 * @param logLevel - Log level to use (default: 'warn')
 * @returns Standardized ProcessingResult
 */
export function handleErrorCase(
  errorType: ErrorType,
  context: ErrorContext,
  logLevel: 'warn' | 'info' | 'error' = 'warn'
): ProcessingResult {
  
  const errorMessages = {
    not_found: 'Work order not found in Google Sheets',
    missing_content: 'No quoted message content found in reply',
    invalid_data: 'Invalid or empty data provided',
    ignored: context.customMessage || 'Message ignored',
    network_error: 'Network error occurred',
    validation_error: 'Validation failed'
  };

  const logData = {
    messageId: context.messageId,
    workId: context.workId,
    senderName: context.senderName,
    remoteJid: context.remoteJid,
    quotedMessageId: context.quotedMessageId,
    rowId: context.rowId,
    rowNumber: context.rowNumber
  };

  // Remove undefined values
  Object.keys(logData).forEach(key => {
    const typedKey = key as keyof typeof logData;
    if (logData[typedKey] === undefined) {
      delete logData[typedKey];
    }
  });

  logger[logLevel](errorMessages[errorType], logData);

  return {
    success: true,
    messageType: 'ignored',
    analysis: context.analysis,
    error: errorMessages[errorType]
  };
}

/**
 * Handle network/API errors with retry logic
 * @param error - The error that occurred
 * @param context - Context information
 * @param operation - Operation that failed
 * @returns ProcessingResult
 */
export function handleNetworkError(
  error: any,
  context: ErrorContext,
  operation: string
): ProcessingResult {
  logger.error(`${operation} failed`, {
    ...context,
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined
  });

  return {
    success: false,
    messageType: 'ignored',
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}