/**
 * Column Mapper
 * Utility for mapping data to/from Google Sheets using dynamic column mappings
 */

import { Configuration } from '../lib/config/types';
import { logger } from '../lib/logger';
import { OrderData } from './operations';

/**
 * Map order data to sheet row using configuration column mapping
 * @param data - Order data to map
 * @param config - Configuration with columnMapping
 * @returns Array of row values (strings)
 */
export function mapDataToColumns(
  data: OrderData,
  config: Configuration
): string[] {
  try {
    const columnMapping = config.columnMapping;
    const maxColumns = Math.max(...Object.values(columnMapping));
    const row: string[] = new Array(maxColumns + 1).fill('');
    
    // Map each field to its column index
    for (const [field, columnIndex] of Object.entries(columnMapping)) {
      const value = data[field as keyof OrderData];
      if (value !== undefined && value !== null) {
        row[columnIndex] = String(value);
      }
    }
    
    logger.debug({ 
      fieldCount: Object.keys(columnMapping).length,
      maxColumn: maxColumns 
    }, 'Mapped data to columns');
    
    return row;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to map data to columns');
    throw error;
  }
}

/**
 * Map sheet row to data using configuration column mapping
 * @param row - Sheet row values
 * @param config - Configuration with columnMapping
 * @returns Partial order data
 */
export function mapColumnsToData(
  row: string[],
  config: Configuration
): Partial<OrderData> {
  try {
    const columnMapping = config.columnMapping;
    const data: Partial<OrderData> = {};
    
    // Map each column index to its field
    for (const [field, columnIndex] of Object.entries(columnMapping)) {
      if (row[columnIndex] !== undefined) {
        (data as any)[field as keyof OrderData] = row[columnIndex];
      }
    }
    
    logger.debug({ 
      fieldCount: Object.keys(data).length 
    }, 'Mapped columns to data');
    
    return data;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to map columns to data');
    throw error;
  }
}

/**
 * Get sheet range for configuration
 * @param config - Configuration
 * @returns Range string (e.g., "Deposite!A:N")
 */
export function getSheetRange(config: Configuration): string {
  const sheetName = config.mainSheetName;
  // Default to 14 columns, but could be made dynamic
  const endColumn = 'N';
  return `${sheetName}!A:${endColumn}`;
}

/**
 * Get sheet headers based on column mapping
 * @param config - Configuration
 * @returns Array of header names
 */
export function getHeadersFromColumnMapping(config: Configuration): string[] {
  const columnMapping = config.columnMapping;
  const maxColumn = Math.max(...Object.values(columnMapping));
  const headers: string[] = new Array(maxColumn + 1).fill('');
  
  // Map field names to column positions
  for (const [field, columnIndex] of Object.entries(columnMapping)) {
    headers[columnIndex] = field;
  }
  
  return headers;
}

