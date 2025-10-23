/**
 * Google Sheets Operations Tests
 * Comprehensive test suite for work order creation and updates
 */

import {
  createNewOrder,
  findSheetRowByWorkId,
  updateSheetRow,
  appendUpdateLog,
  convertFirstMessageToOrderData,
  convertReplyAnalysisToUpdates,
  OrderData,
  ChangeAnalysis
} from '../src/sheets/operations';
import { FirstMessageAnalysis, ReplyAnalysis } from '../src/lib/messageAnalyzer';

// Mock Google Sheets client
jest.mock('../src/sheets/client', () => ({
  appendToSheet: jest.fn().mockResolvedValue(undefined),
  getSheetData: jest.fn(),
  createSheet: jest.fn().mockResolvedValue(undefined),
  initializeSheetsClient: jest.fn()
}));

// Test data factories
const createMockFirstMessageAnalysis = (overrides: Partial<FirstMessageAnalysis> = {}): FirstMessageAnalysis => ({
  work_id: 'WO-12345',
  customer_name: 'John Doe',
  address: '123 Main St',
  phone: '555-123-4567',
  job_description: 'Plumbing repair',
  total_price: 500,
  deposit: 100,
  job_status: 'new',
  relevant: true,
  ...overrides
});

const createMockReplyAnalysis = (overrides: Partial<ReplyAnalysis> = {}): ReplyAnalysis => {
  const defaults: ReplyAnalysis = {
    changesDetected: true,
    changedFields: ['job_status', 'notes'],
    columnUpdates: {
      2: 'completed',
      3: 'Job finished successfully'
    }
  };
  
  return { ...defaults, ...overrides };
};

const createMockOrderData = (overrides: Partial<OrderData> = {}): OrderData => ({
  work_id: 'WO-12345',
  customer_name: 'John Doe',
  address: '123 Main St',
  phone: '555-123-4567',
  job_description: 'Plumbing repair',
  total_price: 500,
  deposit: 100,
  job_status: 'new',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  created_by: 'John Doe',
  updated_by: 'John Doe',
  ...overrides
});

const createMockChangeAnalysis = (overrides: Partial<ChangeAnalysis> = {}): ChangeAnalysis => ({
  workId: 'WO-12345',
  changesDetected: true,
  changedFields: ['job_status', 'notes'],
  newValues: {
    job_status: 'completed',
    notes: 'Job finished successfully'
  },
  ...overrides
});

describe('Google Sheets Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertFirstMessageToOrderData', () => {
    describe('with complete data', () => {
      it('should convert FirstMessageAnalysis to OrderData with all fields', () => {
        const analysis = createMockFirstMessageAnalysis();
        const result = convertFirstMessageToOrderData(analysis, 'John Doe');

        expect(result.work_id).toBe('WO-12345');
        expect(result.customer_name).toBe('John Doe');
        expect(result.address).toBe('123 Main St');
        expect(result.phone).toBe('555-123-4567');
        expect(result.job_description).toBe('Plumbing repair');
        expect(result.total_price).toBe(500);
        expect(result.deposit).toBe(100);
        expect(result.job_status).toBe('new');
        expect(result.created_by).toBe('John Doe');
        expect(result.updated_by).toBe('John Doe');
        expect(result.created_at).toBeDefined();
        expect(result.updated_at).toBeDefined();
      });
    });

    describe('with missing optional fields', () => {
      it('should handle missing optional fields with default values', () => {
        const analysis = createMockFirstMessageAnalysis({
          job_description: '',
          total_price: 0,
          deposit: 0,
          job_status: 'new'
        });

        const result = convertFirstMessageToOrderData(analysis, 'John Doe');

        expect(result.work_id).toBe('WO-12345');
        expect(result.job_description).toBe('');
        expect(result.total_price).toBe(0);
        expect(result.deposit).toBe(0);
        expect(result.job_status).toBe('new');
      });
    });
  });

  describe('convertReplyAnalysisToUpdates', () => {
    describe('with changes detected', () => {
      it('should convert ReplyAnalysis to partial OrderData with new values', () => {
        const analysis = createMockReplyAnalysis();
        const result = convertReplyAnalysisToUpdates(analysis, 'Jane Smith');

        expect(result.updated_by).toBe('Jane Smith');
        expect(result.updated_at).toBeDefined();
        expect(result.job_status).toBe('completed');
        expect(result.notes).toBe('Job finished successfully');
      });
    });

    describe('without changes detected', () => {
      it('should return only metadata when no new values provided', () => {
        const analysis: ReplyAnalysis = {
          changesDetected: false,
          changedFields: []
        };

        const result = convertReplyAnalysisToUpdates(analysis, 'Jane Smith');

        expect(result.updated_by).toBe('Jane Smith');
        expect(result.updated_at).toBeDefined();
        expect(Object.keys(result)).toHaveLength(2); // Only updated_by and updated_at
      });
    });
  });

  describe('createNewOrder', () => {
    describe('successful creation', () => {
      it('should create a new work order and return row identifier', async () => {
        const orderData = createMockOrderData();
        const result = await createNewOrder(orderData);

        expect(result).toBeDefined();
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThan(0);
      });
    });

    describe('error handling', () => {
      it('should throw error when Google Sheets API fails', async () => {
        const { appendToSheet } = require('../src/sheets/client');
        appendToSheet.mockRejectedValueOnce(new Error('API Error'));

        const orderData = createMockOrderData();
        await expect(createNewOrder(orderData)).rejects.toThrow('Failed to create work order: API Error');
      });
    });
  });

  describe('findSheetRowByWorkId', () => {
    describe('when work order exists', () => {
      it('should return 1-based row number for existing work order', async () => {
        const { getSheetData } = require('../src/sheets/client');
        getSheetData.mockResolvedValueOnce([
          ['Full message', 'Time sent', 'from', 'group id', 'Job ID', 'customer name', 'address', 'start', 'end date', 'deposit', 'total price', 'sort of payment', 'notes', 'job status'], // Header
          ['Message 1', '2024-01-01', 'User1', 'group1', 'WO-12345', 'John Doe', '123 Main St', '2024-01-01', '2024-01-02', '100', '500', 'cash', 'Notes 1', 'new'],
          ['Message 2', '2024-01-01', 'User2', 'group1', 'WO-67890', 'Jane Smith', '456 Oak Ave', '2024-01-01', '2024-01-02', '200', '800', 'card', 'Notes 2', 'in_progress']
        ]);

        const result = await findSheetRowByWorkId('WO-12345');
        expect(result).toBe(2); // 1-based row number
      });
    });

    describe('when work order does not exist', () => {
      it('should return null when work order not found in data', async () => {
        const { getSheetData } = require('../src/sheets/client');
        getSheetData.mockResolvedValueOnce([
          ['Full message', 'Time sent', 'from', 'group id', 'Job ID', 'customer name', 'address', 'start', 'end date', 'deposit', 'total price', 'sort of payment', 'notes', 'job status'], // Header
          ['Message 2', '2024-01-01', 'User2', 'group1', 'WO-67890', 'Jane Smith', '456 Oak Ave', '2024-01-01', '2024-01-02', '200', '800', 'card', 'Notes 2', 'in_progress']
        ]);

        const result = await findSheetRowByWorkId('WO-12345');
        expect(result).toBeNull();
      });

      it('should return null when no data is available', async () => {
        const { getSheetData } = require('../src/sheets/client');
        getSheetData.mockResolvedValueOnce([]);

        const result = await findSheetRowByWorkId('WO-12345');
        expect(result).toBeNull();
      });
    });
  });

  describe('updateSheetRow', () => {
    describe('with valid updates', () => {
      it('should update work order row with provided fields', async () => {
        const { initializeSheetsClient } = require('../src/sheets/client');
        const mockClient = {
          spreadsheets: {
            batchUpdate: jest.fn().mockResolvedValue({})
          }
        };
        initializeSheetsClient.mockResolvedValue(mockClient);

        const updates = {
          job_status: 'completed',
          notes: 'Job finished successfully',
          updated_at: '2024-01-01T12:00:00Z',
          updated_by: 'Jane Smith'
        };

        await updateSheetRow(2, updates);

        expect(mockClient.spreadsheets.batchUpdate).toHaveBeenCalledWith({
          spreadsheetId: process.env['GOOGLE_SHEET_ID'],
          requestBody: {
            requests: expect.arrayContaining([
              expect.objectContaining({
                updateCells: expect.objectContaining({
                  range: expect.objectContaining({
                    startRowIndex: 1,
                    endRowIndex: 2
                  })
                })
              })
            ])
          }
        });
      });
    });

    describe('with empty updates', () => {
      it('should not call Google Sheets API when no updates provided', async () => {
        const { initializeSheetsClient } = require('../src/sheets/client');
        const mockClient = {
          spreadsheets: {
            batchUpdate: jest.fn().mockResolvedValue({})
          }
        };
        initializeSheetsClient.mockResolvedValue(mockClient);

        await updateSheetRow(2, {});
        expect(mockClient.spreadsheets.batchUpdate).not.toHaveBeenCalled();
      });
    });
  });

  describe('appendUpdateLog', () => {
    describe('successful logging', () => {
      it('should log update to audit trail with change details', async () => {
        const { appendToSheet } = require('../src/sheets/client');
        const changes = createMockChangeAnalysis();

        await appendUpdateLog('WO-12345', changes);

        expect(appendToSheet).toHaveBeenCalledWith('AuditLog!A:F', [
          [
            'WO-12345',
            'UPDATE',
            'Fields changed: job_status, notes',
            expect.any(String),
            'system',
            JSON.stringify(changes.newValues)
          ]
        ]);
      });
    });

    describe('error handling', () => {
      it('should handle audit logging errors gracefully without throwing', async () => {
        const { appendToSheet } = require('../src/sheets/client');
        appendToSheet.mockRejectedValueOnce(new Error('Audit Error'));

        const changes = createMockChangeAnalysis({
          changedFields: ['job_status'],
          newValues: { job_status: 'completed' }
        });

        // Should not throw error - audit logging failure shouldn't break main flow
        await expect(appendUpdateLog('WO-12345', changes)).resolves.toBeUndefined();
      });
    });
  });
});
