/**
 * Message Processor Interface
 * Base interface for all message processors
 */

import { Configuration } from '../../config/types';
import { ValidatedWebhookPayload } from '../../validators';
import { ProcessingResult } from '../../../types/webhook';

/**
 * Abstract message processor interface
 * All processor implementations must implement these methods
 */
export interface IMessageProcessor {
  /**
   * Main entry point for processing any message
   * Routes to appropriate handler based on message type (first/reply)
   * @param payload - Validated webhook payload
   * @param messageText - Extracted message text
   * @param senderName - Sender name
   * @param config - Configuration for this processor
   * @returns Processing result
   */
  processMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult>;

  /**
   * Process a first message (new work order)
   * @param payload - Validated webhook payload
   * @param messageText - Extracted message text
   * @param senderName - Sender name
   * @param config - Configuration for this processor
   * @returns Processing result
   */
  processFirstMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult>;

  /**
   * Process a reply message (update existing work order)
   * @param payload - Validated webhook payload
   * @param messageText - Extracted message text
   * @param senderName - Sender name
   * @param config - Configuration for this processor
   * @returns Processing result
   */
  processReplyMessage(
    payload: ValidatedWebhookPayload,
    messageText: string,
    senderName: string,
    config: Configuration
  ): Promise<ProcessingResult>;

  /**
   * Validate message before processing
   * @param payload - Validated webhook payload
   * @param config - Configuration for this processor
   * @returns True if message should be processed
   */
  validateMessage?(
    payload: ValidatedWebhookPayload,
    config: Configuration
  ): Promise<boolean>;
}



