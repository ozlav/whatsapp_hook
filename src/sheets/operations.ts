/**
 * Google Sheets Operations - Handles work order creation and updates
 * Supports both new work order creation and updates to existing orders
 */

import { appendToSheet, getSheetData, createSheet, initializeSheetsClient, getSheetIdByName } from './client';
import { FirstMessageAnalysis, ReplyAnalysis } from '../lib/messageAnalyzer';
import { logger } from '../lib/logger';
import { env } from '../lib/env';

// Constants
const SHEET_NAMES = {
  WORK_ORDERS: 'Deposite', // Using your existing Deposite sheet
  LOGS: 'Logs', // All messages from target group
  AUDIT_LOG: 'AuditLog'
} as const;

const RANGES = {
  WORK_ORDERS_DATA: 'Deposite!A:N', // 14 columns in your Deposite sheet (added Job ID)
  WORK_ORDERS_HEADERS: 'Deposite!A1:N1',
  LOGS_DATA: 'Logs!A:F', // Simple log format: timestamp, sender, message, type, work_id, notes
  LOGS_HEADERS: 'Logs!A1:F1',
  AUDIT_LOG_DATA: 'AuditLog!A:F',
  AUDIT_LOG_HEADERS: 'AuditLog!A1:F1'
} as const;

const OPERATION_TYPES = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE'
} as const;

const DEFAULT_JOB_STATUS = 'new';
const HEADER_ROW_INDEX = 1; // 1-based row number for header row

// Cache for sheet IDs to avoid repeated API calls
let depositeSheetId: number | null = null;

/**
 * Get the Deposite sheet ID (cached for performance)
 * @returns The sheet ID for the Deposite tab
 */
async function getDepositeSheetId(): Promise<number> {
  if (depositeSheetId !== null) {
    return depositeSheetId;
  }

  const sheetId = await getSheetIdByName(SHEET_NAMES.WORK_ORDERS);
  if (sheetId === null) {
    throw new Error(`Sheet '${SHEET_NAMES.WORK_ORDERS}' not found in spreadsheet`);
  }

  depositeSheetId = sheetId;
  logger.info({ sheetId, sheetName: SHEET_NAMES.WORK_ORDERS }, 'Cached Deposite sheet ID');
  return sheetId;
}

/**
 * Work Order Data structure for Google Sheets
 */
export interface OrderData {
  work_id: string;
  customer_name: string;
  address: string;
  phone: string;
  job_description?: string;
  total_price?: number;
  deposit?: number;
  job_status?: string;
  start_date_time?: string;
  end_date_time?: string;
  sort_of_payment?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

/**
 * Column mapping for Google Sheets updates
 * Maps to deposit sheet columns: A=Full message, B=Time sent, C=from, D=group id, E=Job ID, F=customer name, etc.
 */
const COLUMN_MAP: Record<keyof Omit<OrderData, 'created_at'>, string> = {
  work_id: 'E', // Job ID column
  customer_name: 'F', // customer name
  address: 'G', // address
  phone: 'H', // Not in your sheet, but keeping for compatibility
  job_description: 'A', // Full message (closest match)
  total_price: 'K', // total price
  deposit: 'J', // deposit
  job_status: 'N', // job status
  start_date_time: 'H', // start
  end_date_time: 'I', // end date
  sort_of_payment: 'L', // sort of payment
  notes: 'M', // notes
  created_by: 'C', // from
  updated_at: 'B', // Time sent (closest match)
  updated_by: 'C' // from
} as const;

/**
 * Change Analysis for updates
 */
export interface ChangeAnalysis {
  workId: string;
  changesDetected: boolean;
  changedFields: string[];
  newValues?: Record<string, any>;
}

/**
 * Log any message to the Logs sheet
 * @param messageText - The message text
 * @param senderName - The sender's name
 * @param messageType - Type of message (first, reply, ignored)
 * @param workId - Work ID if available
 * @param notes - Additional notes
 * @returns Promise<boolean> - Success status
 */
export async function logMessage(
  messageText: string,
  senderName: string,
  messageType: 'first' | 'reply' | 'ignored',
  workId?: string,
  notes?: string
): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString();
    
    const logData = [[
      timestamp, // A: timestamp
      senderName, // B: sender
      messageText, // C: message
      messageType, // D: type
      workId || '', // E: work_id
      notes || '' // F: notes
    ]];

    await appendToSheet(RANGES.LOGS_DATA, logData);
    
    logger.info('Message logged to Logs sheet', { 
      senderName,
      messageType,
      workId,
      messageLength: messageText.length
    });
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to log message to Logs sheet', { 
      senderName,
      messageType,
      error: errorMessage
    });
    return false;
  }
}

/**
 * Create a new work order in Google Sheets
 * @param orderData - The work order data to create
 * @returns Row number where the order was created (timestamp-based identifier)
 * @throws {Error} When Google Sheets API fails
 */
export async function createNewOrder(orderData: OrderData, fullMessage?: string): Promise<number> {
  try {
    logger.info('Creating new work order', { workId: orderData.work_id });
    
    const sheetData = prepareOrderDataForSheet(orderData, fullMessage);

    // Append to main sheet
    await appendToSheet(RANGES.WORK_ORDERS_DATA, sheetData);
    
    // Log creation in audit sheet
    await logAuditEntry(orderData.work_id, OPERATION_TYPES.CREATE, 
      'New work order created', orderData.created_at, orderData.created_by, orderData);

    logger.info('Successfully created new work order', { 
      workId: orderData.work_id,
      customerName: orderData.customer_name
    });

    // Return timestamp as unique identifier (Google Sheets doesn't return actual row number)
    return Date.now();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create new work order', { 
      workId: orderData.work_id,
      error: errorMessage
    });
    throw new Error(`Failed to create work order: ${errorMessage}`);
  }
}

/**
 * Find a sheet row by work ID
 * @param workId - The work order ID to search for
 * @returns Row number if found, null otherwise
 */
export async function findSheetRowByWorkId(workId: string): Promise<number | null> {
  try {
    logger.info('Searching for work order', { workId });
    
    const data = await getSheetData(RANGES.WORK_ORDERS_DATA);
    
    if (data.length === 0) {
      logger.warn('No data found in WorkOrders sheet');
      return null;
    }

    // Search for the work_id in the Job ID column (column E, index 4)
    for (let i = HEADER_ROW_INDEX; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 4 && row[4] === workId) { // Job ID is in column E (index 4)
        const rowNumber = i + 1; // Convert to 1-based row number
        logger.info('Found work order', { workId, rowNumber });
        return rowNumber;
      }
    }

    logger.warn('Work order not found', { workId });
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to find work order', { 
      workId,
      error: errorMessage
    });
    return null;
  }
}

/**
 * Get full row data by work ID including headers and column indices
 * @param workId - The work order ID to search for
 * @returns Object with headers, row data, column indices, and row number, or null if not found
 */
export async function getSheetRowByWorkId(workId: string): Promise<{ 
  headers: string[], 
  rowData: string[], 
  columnIndices: Record<string, number>,
  rowNumber: number 
} | null> {
  try {
    logger.info('Getting full row data for work order', { workId });
    
    const [headersData, data] = await Promise.all([
      getSheetData(RANGES.WORK_ORDERS_HEADERS),
      getSheetData(RANGES.WORK_ORDERS_DATA)
    ]);
    
    if (data.length === 0) {
      logger.warn('No data found in WorkOrders sheet');
      return null;
    }

    const headers = headersData[0] || getWorkOrdersHeaders();

    // Create column index mapping (header name -> column index)
    const columnIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      columnIndices[header] = index;
    });

    // Search for the work_id in the Job ID column (column E, index 4)
    for (let i = HEADER_ROW_INDEX; i < data.length; i++) {
      const row = data[i];
      if (row && row.length > 4 && row[4] === workId) { // Job ID is in column E (index 4)
        const rowNumber = i + 1; // Convert to 1-based row number
        logger.info('Found work order with full data', { workId, rowNumber, columnIndices });
        return {
          headers,
          rowData: row,
          columnIndices,
          rowNumber
        };
      }
    }

    logger.warn('Work order not found', { workId });
    return null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get work order row data', { 
      workId,
      error: errorMessage
    });
    return null;
  }
}

/**
 * Update a specific row in Google Sheets using column indices
 * @param rowNumber - The row number to update (1-based)
 * @param columnUpdates - Object mapping column indices to new values
 * @throws {Error} When Google Sheets API fails or no valid updates provided
 */
export async function updateSheetRowByIndices(rowNumber: number, columnUpdates: Record<number, any>): Promise<void> {
  try {
    logger.info('Updating work order row by column indices', { rowNumber, columnUpdates });
    
    const client = await initializeSheetsClient();
    const sheetId = env.GOOGLE_SHEET_ID;
    
    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID is required');
    }

    const requests = await buildColumnUpdateRequests(rowNumber, columnUpdates);

    if (requests.length === 0) {
      logger.warn('No valid updates to apply', { rowNumber });
      return;
    }

    await client.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests }
    });

    logger.info('Successfully updated work order row by column indices', { 
      rowNumber, 
      updatedColumns: Object.keys(columnUpdates)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update work order row by column indices', { 
      rowNumber,
      error: errorMessage
    });
    throw new Error(`Failed to update work order: ${errorMessage}`);
  }
}

/**
 * Update a specific row in Google Sheets
 * @param rowNumber - The row number to update (1-based)
 * @param updates - The fields to update
 * @throws {Error} When Google Sheets API fails or no valid updates provided
 */
export async function updateSheetRow(rowNumber: number, updates: Partial<OrderData>): Promise<void> {
  try {
    logger.info('Updating work order row', { rowNumber, updates: Object.keys(updates) });
    
    const client = await initializeSheetsClient();
    const sheetId = env.GOOGLE_SHEET_ID;
    
    if (!sheetId) {
      throw new Error('GOOGLE_SHEET_ID is required');
    }

    const requests = await buildUpdateRequests(rowNumber, updates);

    if (requests.length === 0) {
      logger.warn('No valid updates to apply', { rowNumber });
      return;
    }

    await client.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests }
    });

    logger.info('Successfully updated work order row', { 
      rowNumber, 
      updatedFields: Object.keys(updates)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update work order row', { 
      rowNumber,
      error: errorMessage
    });
    throw new Error(`Failed to update work order: ${errorMessage}`);
  }
}

/**
 * Append update log to audit trail
 * @param workId - The work order ID
 * @param changes - The change analysis
 * @note This function does not throw errors to avoid breaking the main flow
 */
export async function appendUpdateLog(workId: string, changes: ChangeAnalysis): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const description = changes.changedFields.length > 0 
      ? `Fields changed: ${changes.changedFields.join(', ')}`
      : 'No changes detected';
    
    await logAuditEntry(
      workId,
      OPERATION_TYPES.UPDATE,
      description,
      timestamp,
      'system',
      changes.newValues || {}
    );

    logger.info('Logged update to audit trail', { 
      workId, 
      changedFields: changes.changedFields
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to log update to audit trail', { 
      workId,
      error: errorMessage
    });
    // Don't throw - audit logging failure shouldn't break the main flow
  }
}

/**
 * Convert FirstMessageAnalysis to OrderData
 * @param analysis - The first message analysis result
 * @param senderName - The sender's name
 * @returns OrderData for Google Sheets
 * @example
 * ```typescript
 * const analysis = { work_id: 'WO-123', customer_name: 'John', ... };
 * const orderData = convertFirstMessageToOrderData(analysis, 'John Doe');
 * ```
 */
export function convertFirstMessageToOrderData(
  analysis: FirstMessageAnalysis, 
  senderName: string
): OrderData {
  const timestamp = new Date().toISOString();
  
  return {
    work_id: analysis.work_id,
    customer_name: analysis.customer_name,
    address: analysis.address,
    phone: analysis.phone,
    job_description: analysis.job_description || '',
    total_price: analysis.total_price || 0,
    deposit: analysis.deposit || 0,
    job_status: analysis.job_status || DEFAULT_JOB_STATUS,
    start_date_time: analysis.start_date_time || '',
    end_date_time: analysis.end_date_time || '',
    sort_of_payment: analysis.sort_of_payment || '',
    notes: analysis.notes || '',
    created_at: timestamp,
    updated_at: timestamp,
    created_by: senderName,
    updated_by: senderName
  };
}

/**
 * Convert ReplyAnalysis to partial OrderData for updates
 * @param analysis - The reply analysis result
 * @param senderName - The sender's name
 * @returns Partial OrderData for updates
 * @example
 * ```typescript
 * const analysis = { changesDetected: true, changedFields: ['job_status'], columnUpdates: {13: 'completed'} };
 * const updates = convertReplyAnalysisToUpdates(analysis, 'Jane Smith');
 * ```
 */
export function convertReplyAnalysisToUpdates(
  _analysis: ReplyAnalysis,
  senderName: string
): Partial<OrderData> {
  const timestamp = new Date().toISOString();
  
  const updates: Partial<OrderData> = {
    updated_at: timestamp,
    updated_by: senderName
  };

  // Note: This function is now deprecated since we use column indices directly
  // The new approach uses updateSheetRowByIndices() with columnUpdates
  logger.warn('convertReplyAnalysisToUpdates is deprecated, use column indices directly');

  return updates;
}

/**
 * Initialize Google Sheets with required sheets and headers
 * @throws {Error} When initialization fails
 */
export async function initializeSheets(): Promise<void> {
  try {
    logger.info('Initializing Google Sheets structure');
    
    await createSheetWithHeaders(
      SHEET_NAMES.WORK_ORDERS,
      RANGES.WORK_ORDERS_HEADERS,
      getWorkOrdersHeaders()
    );

    await createSheetWithHeaders(
      SHEET_NAMES.LOGS,
      RANGES.LOGS_HEADERS,
      getLogsHeaders()
    );

    await createSheetWithHeaders(
      SHEET_NAMES.AUDIT_LOG,
      RANGES.AUDIT_LOG_HEADERS,
      getAuditLogHeaders()
    );

    logger.info('Google Sheets initialization completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize Google Sheets', { error: errorMessage });
    throw new Error(`Failed to initialize Google Sheets: ${errorMessage}`);
  }
}

// Helper functions

/**
 * Prepare order data for Google Sheets format
 * Matches your Deposite sheet structure:
 * Full message | Time sent | from | group id | Job ID | customer name | address | start | end date | deposit | total price | sort of payment | notes | job status
 */
function prepareOrderDataForSheet(orderData: OrderData, fullMessage?: string): string[][] {
  return [[
    fullMessage || '', // Full message
    orderData.created_at, // Time sent
    orderData.created_by, // from
    '120363418663151479@g.us', // group id (you can make this configurable)
    orderData.work_id, // Job ID
    orderData.customer_name, // customer name
    orderData.address, // address
    orderData.start_date_time || '', // start
    orderData.end_date_time || '', // end date
    String(orderData.deposit || ''), // deposit
    String(orderData.total_price || ''), // total price
    orderData.sort_of_payment || '', // sort of payment
    orderData.notes || '', // notes
    orderData.job_status || DEFAULT_JOB_STATUS // job status
  ]];
}

/**
 * Log an audit entry
 */
async function logAuditEntry(
  workId: string,
  operation: string,
  description: string,
  timestamp: string,
  user: string,
  details: any
): Promise<void> {
  await appendToSheet(RANGES.AUDIT_LOG_DATA, [[
    workId,
    operation,
    description,
    timestamp,
    user,
    JSON.stringify(details)
  ]]);
}

/**
 * Build update requests for Google Sheets batch update using column indices
 */
async function buildColumnUpdateRequests(rowNumber: number, columnUpdates: Record<number, any>): Promise<any[]> {
  const requests: any[] = [];
  const sheetId = await getDepositeSheetId();
  
  for (const [columnIndex, value] of Object.entries(columnUpdates)) {
    const colIndex = parseInt(columnIndex);
    if (!isNaN(colIndex) && value !== undefined) {
      requests.push({
        updateCells: {
          range: {
            sheetId: sheetId, // Use dynamic Deposite sheet ID
            startRowIndex: rowNumber - 1, // Convert to 0-based
            endRowIndex: rowNumber,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1
          },
          rows: [{
            values: [{
              userEnteredValue: {
                stringValue: String(value)
              }
            }]
          }],
          fields: 'userEnteredValue'
        }
      });
    }
  }

  return requests;
}

/**
 * Build update requests for Google Sheets batch update
 */
async function buildUpdateRequests(rowNumber: number, updates: Partial<OrderData>): Promise<any[]> {
  const requests: any[] = [];
  const sheetId = await getDepositeSheetId();
  
  for (const [field, value] of Object.entries(updates)) {
    if (value !== undefined && COLUMN_MAP[field as keyof typeof COLUMN_MAP]) {
      const column = COLUMN_MAP[field as keyof typeof COLUMN_MAP];
      requests.push({
        updateCells: {
          range: {
            sheetId: sheetId, // Use dynamic Deposite sheet ID
            startRowIndex: rowNumber - 1, // Convert to 0-based
            endRowIndex: rowNumber,
            startColumnIndex: column.charCodeAt(0) - 65, // Convert A=0, B=1, etc.
            endColumnIndex: column.charCodeAt(0) - 64
          },
          rows: [{
            values: [{
              userEnteredValue: {
                stringValue: String(value)
              }
            }]
          }],
          fields: 'userEnteredValue'
        }
      });
    }
  }

  return requests;
}

/**
 * Create a sheet with headers if it doesn't exist
 */
async function createSheetWithHeaders(
  sheetName: string,
  range: string,
  headers: string[]
): Promise<void> {
  try {
    await createSheet(sheetName);
    await appendToSheet(range, [headers]);
  } catch (error) {
    // Sheet might already exist, that's okay
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.info(`${sheetName} sheet already exists or creation failed`, { error: errorMessage });
  }
}

/**
 * Get Deposite sheet headers (matching your existing structure)
 */
function getWorkOrdersHeaders(): string[] {
  return [
    'Full message',
    'Time sent',
    'from',
    'group id',
    'Job ID',
    'customer name',
    'address',
    'start',
    'end date',
    'deposit',
    'total price',
    'sort of payment',
    'notes',
    'job status'
  ];
}

/**
 * Get Logs sheet headers
 */
function getLogsHeaders(): string[] {
  return [
    'Timestamp',
    'Sender',
    'Message',
    'Type',
    'Work ID',
    'Notes'
  ];
}

/**
 * Get AuditLog sheet headers
 */
function getAuditLogHeaders(): string[] {
  return [
    'Work ID',
    'Operation',
    'Description',
    'Timestamp',
    'User',
    'Details'
  ];
}
