/**
 * Message Analyzer Tests
 * Tests for LLM-based message analysis
 */

import { analyzeMessage, analyzeReplyMessage, testOpenAIConnection } from '../src/lib/messageAnalyzer';

// Mock OpenAI to avoid API calls in tests
jest.mock('@langchain/openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn()
  }))
}));

describe('Message Analyzer', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('analyzeFirstMessage', () => {
    it('should extract work order data from first message', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockResolvedValue(JSON.stringify({
          work_id: 'WO-12345',
          address: '123 Main St, City, State',
          phone: '555-123-4567',
          customer_name: 'John Doe',
          job_description: 'Plumbing repair',
          total_price: 500,
          deposit: 100,
          job_status: 'new',
          relevant: true
        }))
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeMessage(
        'Work order #WO-12345 for John Doe at 123 Main St, City, State. Phone: 555-123-4567. Plumbing repair needed, $500 total, $100 deposit.',
        'John Doe'
      );

      expect(result.work_id).toBe('WO-12345');
      expect(result.address).toBe('123 Main St, City, State');
      expect(result.phone).toBe('555-123-4567');
      expect(result.customer_name).toBe('John Doe');
      expect(result.relevant).toBe(true);
    });

    it('should mark as irrelevant if missing required fields', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockResolvedValue(JSON.stringify({
          work_id: '',
          address: '123 Main St',
          phone: '',
          customer_name: 'John Doe',
          relevant: false
        }))
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeMessage(
        'Just a regular message without work order info',
        'John Doe'
      );

      expect(result.relevant).toBe(false);
      expect(result.work_id).toBe('');
      expect(result.phone).toBe('');
    });

    it('should handle LLM response parsing errors gracefully', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockResolvedValue('Invalid JSON response')
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeMessage(
        'Some message',
        'John Doe'
      );

      expect(result.work_id).toBe('');
      expect(result.relevant).toBe(false);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockRejectedValue(new Error('API Error'))
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeMessage(
        'Some message',
        'John Doe'
      );

      expect(result.work_id).toBe('');
      expect(result.relevant).toBe(false);
    });
  });

  describe('analyzeReplyMessage', () => {

    it('should detect work order and changes in reply', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockResolvedValue(JSON.stringify({
          hasWorkId: true,
          workId: 'WO-12345',
          changesDetected: true,
          changedFields: ['job_status'],
          newValues: {
            job_status: 'completed'
          }
        }))
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeReplyMessage(
        'Update: job is completed, status changed to done',
        'Jane Smith',
        'WO-12345',
        ['work_id', 'customer_name', 'job_status', 'notes'],
        ['WO-12345', 'John Doe', 'in_progress', ''],
        { work_id: 0, customer_name: 1, job_status: 2, notes: 3 }
      );

      expect(result.changesDetected).toBe(true);
      expect(result.changedFields).toContain('job_status');
    });

    it('should detect no changes in reply', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockResolvedValue(JSON.stringify({
          hasWorkId: true,
          workId: 'WO-12345',
          changesDetected: false,
          changedFields: []
        }))
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeReplyMessage(
        'Thanks for the update',
        'John Doe',
        'WO-12345',
        ['work_id', 'customer_name', 'job_status', 'notes'],
        ['WO-12345', 'John Doe', 'in_progress', ''],
        { work_id: 0, customer_name: 1, job_status: 2, notes: 3 }
      );

      expect(result.changesDetected).toBe(false);
      expect(result.changedFields).toHaveLength(0);
    });

    it('should detect no work order in thread', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockResolvedValue(JSON.stringify({
          hasWorkId: false,
          changesDetected: false,
          changedFields: []
        }))
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeReplyMessage(
        'Just a regular conversation',
        'John Doe',
        'WO-12345',
        ['work_id', 'customer_name', 'job_status', 'notes'],
        ['WO-12345', 'John Doe', 'in_progress', ''],
        { work_id: 0, customer_name: 1, job_status: 2, notes: 3 }
      );

      expect(result.changesDetected).toBe(false);
    });

    it('should handle LLM response parsing errors gracefully', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockResolvedValue('Invalid JSON response')
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeReplyMessage(
        'Some reply',
        'John Doe',
        'WO-12345',
        ['work_id', 'customer_name', 'job_status', 'notes'],
        ['WO-12345', 'John Doe', 'in_progress', ''],
        { work_id: 0, customer_name: 1, job_status: 2, notes: 3 }
      );

      expect(result.changesDetected).toBe(false);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockRejectedValue(new Error('API Error'))
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await analyzeReplyMessage(
        'Some reply',
        'John Doe',
        'WO-12345',
        ['work_id', 'customer_name', 'job_status', 'notes'],
        ['WO-12345', 'John Doe', 'in_progress', ''],
        { work_id: 0, customer_name: 1, job_status: 2, notes: 3 }
      );

      expect(result.changesDetected).toBe(false);
    });
  });

  describe('testOpenAIConnection', () => {
    it('should return true for successful connection', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockResolvedValue('Test successful')
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await testOpenAIConnection();
      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      const mockOpenAI = require('@langchain/openai').OpenAI;
      const mockClient = {
        invoke: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };
      mockOpenAI.mockImplementation(() => mockClient);

      const result = await testOpenAIConnection();
      expect(result).toBe(false);
    });
  });
});
