/**
 * Processor Factory
 * Manages registration and retrieval of message processors
 */

import { logger } from '../../logger';
import { IMessageProcessor } from '../base/IMessageProcessor';

/**
 * Processor factory class
 * Maintains a registry of processor implementations
 */
class ProcessorFactory {
  private processors: Map<string, IMessageProcessor> = new Map();

  /**
   * Register a processor with the factory
   * @param className - Processor class name
   * @param processor - Processor implementation
   */
  register(className: string, processor: IMessageProcessor): void {
    this.processors.set(className, processor);
    logger.info({ className }, 'Registered processor');
  }

  /**
   * Get a processor by class name
   * @param className - Processor class name
   * @returns Processor instance or null if not found
   */
  get(className: string): IMessageProcessor | null {
    const processor = this.processors.get(className);
    
    if (!processor) {
      logger.error({ 
        className, 
        availableProcessors: Array.from(this.processors.keys()) 
      }, 'Processor not found');
      return null;
    }
    
    logger.debug({ className }, 'Retrieved processor');
    return processor;
  }

  /**
   * Check if a processor is registered
   * @param className - Processor class name
   * @returns True if processor is registered
   */
  has(className: string): boolean {
    return this.processors.has(className);
  }

  /**
   * Get all registered processor names
   * @returns Array of processor class names
   */
  listProcessors(): string[] {
    return Array.from(this.processors.keys());
  }

  /**
   * Clear all registered processors
   * Useful for testing or cleanup
   */
  clear(): void {
    this.processors.clear();
    logger.info('Cleared all processors');
  }
}

// Create and export singleton instance
const factoryInstance = new ProcessorFactory();
export { factoryInstance as ProcessorFactory };



