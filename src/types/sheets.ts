/**
 * TypeScript types for Google Sheets operations
 */

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
 * Change Analysis for updates
 */
export interface ChangeAnalysis {
  workId: string;
  changesDetected: boolean;
  changedFields: string[];
  newValues?: Record<string, any>;
}

/**
 * Sheet row data with metadata
 */
export interface SheetRowData {
  headers: string[];
  rowData: string[];
  columnIndices: Record<string, number>;
  rowNumber: number;
}

/**
 * Google Sheets API response types
 */
export interface SheetsResponse {
  updatedRows?: number;
  updatedCells?: number;
}

/**
 * Column update mapping
 */
export type ColumnUpdates = Record<number, any>;


