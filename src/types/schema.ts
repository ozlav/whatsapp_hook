/**
 * Simple types for schema-based data extraction
 */

// Simple processing result
export interface ProcessingResult {
  success: boolean;
  data: any;
  error?: string;
}