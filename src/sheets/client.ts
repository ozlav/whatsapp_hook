import { google, sheets_v4 } from 'googleapis';
import { logger } from '../lib/logger';
import { env, validateRequiredVar } from '../lib/env';

// Google Sheets client singleton
let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Initialize Google Sheets client with service account authentication
 */
export const initializeSheetsClient = (): sheets_v4.Sheets => {
  if (sheetsClient) {
    return sheetsClient;
  }

  try {
    // Debug: Log environment variables
    logger.info({
      GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Set' : 'Missing',
      GOOGLE_PRIVATE_KEY: env.GOOGLE_PRIVATE_KEY ? 'Set' : 'Missing',
      GOOGLE_SHEET_ID: env.GOOGLE_SHEET_ID ? 'Set' : 'Missing'
    }, 'Environment variables in Google Sheets client');
    
    // Validate required environment variables
    const serviceAccountEmail = validateRequiredVar('GOOGLE_SERVICE_ACCOUNT_EMAIL', env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    const privateKey = validateRequiredVar('GOOGLE_PRIVATE_KEY', env.GOOGLE_PRIVATE_KEY);
    const sheetId = validateRequiredVar('GOOGLE_SHEET_ID', env.GOOGLE_SHEET_ID);

    // Create JWT client for service account authentication
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });

    // Initialize Sheets API client
    sheetsClient = google.sheets({ version: 'v4', auth });

    logger.info({ 
      serviceAccountEmail, 
      sheetId: sheetId.substring(0, 10) + '...' // Log partial ID for security
    }, 'Google Sheets client initialized');

    return sheetsClient;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Failed to initialize Google Sheets client');
    throw error;
  }
};

/**
 * Append data to a Google Sheet
 */
export const appendToSheet = async (
  range: string,
  values: any[][],
  sheetId?: string
): Promise<void> => {
  try {
    const client = initializeSheetsClient();
    const targetSheetId = sheetId || validateRequiredVar('GOOGLE_SHEET_ID', env.GOOGLE_SHEET_ID);

    logger.info({ 
      range, 
      rowCount: values.length,
      sheetId: targetSheetId.substring(0, 10) + '...'
    }, 'Appending data to Google Sheet');

    const response = await client.spreadsheets.values.append({
      spreadsheetId: targetSheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values
      }
    });

    logger.info({ 
      updatedRows: response.data.updates?.updatedRows,
      updatedCells: response.data.updates?.updatedCells
    }, 'Successfully appended data to Google Sheet');

  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      range,
      sheetId: sheetId?.substring(0, 10) + '...'
    }, 'Failed to append data to Google Sheet');
    throw error;
  }
};

/**
 * Get data from a Google Sheet
 */
export const getSheetData = async (
  range: string,
  sheetId?: string
): Promise<any[][]> => {
  try {
    const client = initializeSheetsClient();
    const targetSheetId = sheetId || validateRequiredVar('GOOGLE_SHEET_ID', env.GOOGLE_SHEET_ID);

    logger.info({ 
      range,
      sheetId: targetSheetId.substring(0, 10) + '...'
    }, 'Reading data from Google Sheet');

    const response = await client.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range
    });

    const values = response.data.values || [];
    
    logger.info({ 
      rowCount: values.length,
      range
    }, 'Successfully read data from Google Sheet');

    return values;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      range,
      sheetId: sheetId?.substring(0, 10) + '...'
    }, 'Failed to read data from Google Sheet');
    throw error;
  }
};

/**
 * Create a new sheet in the spreadsheet
 */
export const createSheet = async (
  sheetName: string,
  sheetId?: string
): Promise<void> => {
  try {
    const client = initializeSheetsClient();
    const targetSheetId = sheetId || validateRequiredVar('GOOGLE_SHEET_ID', env.GOOGLE_SHEET_ID);

    logger.info({ 
      sheetName,
      sheetId: targetSheetId.substring(0, 10) + '...'
    }, 'Creating new sheet');

    await client.spreadsheets.batchUpdate({
      spreadsheetId: targetSheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName
            }
          }
        }]
      }
    });

    logger.info({ sheetName }, 'Successfully created new sheet');
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      sheetName,
      sheetId: sheetId?.substring(0, 10) + '...'
    }, 'Failed to create new sheet');
    throw error;
  }
};

/**
 * Test Google Sheets connection
 */
export const testSheetsConnection = async (): Promise<boolean> => {
  try {
    const client = initializeSheetsClient();
    const sheetId = validateRequiredVar('GOOGLE_SHEET_ID', env.GOOGLE_SHEET_ID);

    // Try to get spreadsheet metadata
    await client.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: 'properties.title'
    });

    logger.info({ 
      sheetId: sheetId.substring(0, 10) + '...'
    }, 'Google Sheets connection test successful');

    return true;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'Google Sheets connection test failed');
    return false;
  }
};
