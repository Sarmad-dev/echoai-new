/**
 * Google Sheets API Client
 * 
 * Provides a comprehensive interface for interacting with Google Sheets API
 * Handles reading from and writing to spreadsheets with proper error handling
 * and batch operations support.
 */

import { google } from 'googleapis';
import type { sheets_v4, drive_v3 } from 'googleapis';
import { Integration } from './oauth2-manager';

export interface GoogleSheetsSpreadsheet {
  spreadsheetId: string;
  properties: {
    title: string;
    locale?: string;
    autoRecalc?: string;
    timeZone?: string;
  };
  sheets: GoogleSheetsSheet[];
  spreadsheetUrl: string;
}

export interface GoogleSheetsSheet {
  properties: {
    sheetId: number;
    title: string;
    index: number;
    sheetType: string;
    gridProperties?: {
      rowCount: number;
      columnCount: number;
    };
  };
}

export interface GoogleSheetsRange {
  range: string;
  majorDimension: 'ROWS' | 'COLUMNS';
  values?: unknown[][];
}

export interface GoogleSheetsWriteRequest {
  range: string;
  values: unknown[][];
  majorDimension?: 'ROWS' | 'COLUMNS';
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface GoogleSheetsBatchWriteRequest {
  requests: GoogleSheetsWriteRequest[];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
  includeValuesInResponse?: boolean;
}

export interface GoogleSheetsApiError {
  code: number;
  message: string;
  status: string;
  details?: unknown[];
}

export class GoogleSheetsRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'GoogleSheetsRateLimitError';
  }
}

export class GoogleSheetsApiClient {
  private sheets: sheets_v4.Sheets;
  private accessToken: string;
  private retryAttempts = 3;
  private retryDelay = 1000; // Base delay in ms

  constructor(integration: Integration) {
    if (integration.provider !== 'google') {
      throw new Error('Integration must be for Google provider');
    }
    
    if (typeof window !== 'undefined') {
      throw new Error('GoogleSheetsApiClient can only be used on the server side');
    }
    
    this.accessToken = integration.accessToken;
    
    // Initialize Google Sheets API client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
    });
    
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Make authenticated request to Google Sheets API with retry logic
   */
  private async makeRequest<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        const apiError = error as { code?: number; message?: string; response?: { headers?: { 'retry-after'?: string } } };
        lastError = error as Error;

        // Handle rate limiting
        if (apiError.code === 429) {
          const retryAfter = apiError.response?.headers?.['retry-after'] 
            ? parseInt(apiError.response.headers['retry-after']) 
            : 60;
          
          throw new GoogleSheetsRateLimitError(
            'Google Sheets API rate limit exceeded',
            retryAfter
          );
        }

        // Handle quota exceeded
        if (apiError.code === 403 && apiError.message?.includes('quota')) {
          throw new GoogleSheetsRateLimitError(
            'Google Sheets API quota exceeded',
            3600 // 1 hour default retry
          );
        }

        // Don't retry on client errors (4xx except 429)
        if (apiError.code && apiError.code >= 400 && apiError.code < 500 && apiError.code !== 429) {
          throw new Error(
            `Google Sheets API error: ${apiError.message} (${apiError.code})`
          );
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  // ===== SPREADSHEET METHODS =====

  /**
   * Get spreadsheet metadata and sheet information
   */
  async getSpreadsheet(spreadsheetId: string): Promise<GoogleSheetsSpreadsheet | null> {
    try {
      const response = await this.makeRequest(async () => {
        return await this.sheets.spreadsheets.get({
          spreadsheetId,
          includeGridData: false,
        });
      });

      const spreadsheet = response.data;
      if (!spreadsheet) return null;

      return {
        spreadsheetId,
        properties: {
          title: spreadsheet.properties?.title || 'Untitled',
          locale: spreadsheet.properties?.locale || undefined,
          autoRecalc: spreadsheet.properties?.autoRecalc || undefined,
          timeZone: spreadsheet.properties?.timeZone || undefined,
        },
        sheets: spreadsheet.sheets?.map((sheet: sheets_v4.Schema$Sheet) => ({
          properties: {
            sheetId: sheet.properties?.sheetId || 0,
            title: sheet.properties?.title || 'Sheet1',
            index: sheet.properties?.index || 0,
            sheetType: sheet.properties?.sheetType || 'GRID',
            gridProperties: sheet.properties?.gridProperties ? {
              rowCount: sheet.properties.gridProperties.rowCount || 1000,
              columnCount: sheet.properties.gridProperties.columnCount || 26,
            } : undefined,
          },
        })) || [],
        spreadsheetUrl: spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      };
    } catch (error: unknown) {
      const apiError = error as { code?: number };
      if (apiError.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List spreadsheets accessible to the user (via Drive API)
   */
  async listSpreadsheets(maxResults: number = 50): Promise<Array<{
    id: string;
    name: string;
    createdTime: string;
    modifiedTime: string;
    webViewLink: string;
  }>> {
    try {
      // Initialize Drive API client with same auth
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: this.accessToken,
      });
      
      const drive = google.drive({ version: 'v3', auth });

      const response = await this.makeRequest(async () => {
        return await drive.files.list({
          q: "mimeType='application/vnd.google-apps.spreadsheet'",
          pageSize: maxResults,
          fields: 'files(id,name,createdTime,modifiedTime,webViewLink)',
          orderBy: 'modifiedTime desc',
        });
      });

      return response.data.files?.map((file: drive_v3.Schema$File) => ({
        id: file.id!,
        name: file.name!,
        createdTime: file.createdTime!,
        modifiedTime: file.modifiedTime!,
        webViewLink: file.webViewLink!,
      })) || [];
    } catch (error: unknown) {
      console.error('Error listing spreadsheets:', error);
      return [];
    }
  }

  // ===== READ METHODS =====

  /**
   * Read values from a specific range
   */
  async readRange(
    spreadsheetId: string,
    range: string,
    majorDimension: 'ROWS' | 'COLUMNS' = 'ROWS'
  ): Promise<GoogleSheetsRange | null> {
    try {
      const response = await this.makeRequest(async () => {
        return await this.sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
          majorDimension,
          valueRenderOption: 'UNFORMATTED_VALUE',
          dateTimeRenderOption: 'FORMATTED_STRING',
        });
      });

      const data = response.data;
      if (!data) return null;

      return {
        range: data.range || range,
        majorDimension: (data.majorDimension as 'ROWS' | 'COLUMNS') || majorDimension,
        values: data.values || [],
      };
    } catch (error: unknown) {
      const apiError = error as { code?: number; message?: string };
      if (apiError.code === 400 && apiError.message?.includes('range')) {
        return null; // Invalid range
      }
      throw error;
    }
  }

  /**
   * Read multiple ranges at once
   */
  async readRanges(
    spreadsheetId: string,
    ranges: string[],
    majorDimension: 'ROWS' | 'COLUMNS' = 'ROWS'
  ): Promise<GoogleSheetsRange[]> {
    try {
      const response = await this.makeRequest(async () => {
        return await this.sheets.spreadsheets.values.batchGet({
          spreadsheetId,
          ranges,
          majorDimension,
          valueRenderOption: 'UNFORMATTED_VALUE',
          dateTimeRenderOption: 'FORMATTED_STRING',
        });
      });

      return response.data.valueRanges?.map((valueRange: sheets_v4.Schema$ValueRange) => ({
        range: valueRange.range || '',
        majorDimension: (valueRange.majorDimension as 'ROWS' | 'COLUMNS') || majorDimension,
        values: valueRange.values || [],
      })) || [];
    } catch (error: unknown) {
      console.error('Error reading multiple ranges:', error);
      return [];
    }
  }

  /**
   * Read all data from a sheet
   */
  async readSheet(
    spreadsheetId: string,
    sheetName: string = 'Sheet1'
  ): Promise<unknown[][] | null> {
    const range = `${sheetName}!A:Z`; // Read all columns up to Z
    const result = await this.readRange(spreadsheetId, range);
    return result?.values || null;
  }

  /**
   * Read data with headers (first row as column names)
   */
  async readWithHeaders(
    spreadsheetId: string,
    range: string
  ): Promise<Array<Record<string, unknown>> | null> {
    const data = await this.readRange(spreadsheetId, range);
    if (!data?.values || data.values.length === 0) {
      return null;
    }

    const [headers, ...rows] = data.values;
    if (!headers || headers.length === 0) {
      return null;
    }

    return rows.map(row => {
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        const headerKey = String(header);
        record[headerKey] = row[index] || '';
      });
      return record;
    });
  }

  // ===== WRITE METHODS =====

  /**
   * Write values to a specific range
   */
  async writeRange(
    spreadsheetId: string,
    range: string,
    values: unknown[][],
    valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
  ): Promise<{
    updatedRows: number;
    updatedColumns: number;
    updatedCells: number;
  }> {
    const response = await this.makeRequest(async () => {
      return await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption,
        requestBody: {
          values,
          majorDimension: 'ROWS',
        },
      });
    });

    const result = response.data;
    return {
      updatedRows: result.updatedRows || 0,
      updatedColumns: result.updatedColumns || 0,
      updatedCells: result.updatedCells || 0,
    };
  }

  /**
   * Append values to the end of a sheet
   */
  async appendToSheet(
    spreadsheetId: string,
    range: string,
    values: unknown[][],
    valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
  ): Promise<{
    spreadsheetId: string;
    tableRange: string;
    updates: {
      updatedRows: number;
      updatedColumns: number;
      updatedCells: number;
    };
  }> {
    const response = await this.makeRequest(async () => {
      return await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption,
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values,
          majorDimension: 'ROWS',
        },
      });
    });

    const result = response.data;
    return {
      spreadsheetId,
      tableRange: result.tableRange || range,
      updates: {
        updatedRows: result.updates?.updatedRows || 0,
        updatedColumns: result.updates?.updatedColumns || 0,
        updatedCells: result.updates?.updatedCells || 0,
      },
    };
  }

  /**
   * Batch write to multiple ranges
   */
  async batchWrite(
    spreadsheetId: string,
    requests: GoogleSheetsWriteRequest[],
    valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
  ): Promise<{
    totalUpdatedRows: number;
    totalUpdatedColumns: number;
    totalUpdatedCells: number;
    responses: Array<{
      updatedRows: number;
      updatedColumns: number;
      updatedCells: number;
    }>;
  }> {
    const response = await this.makeRequest(async () => {
      return await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption,
          data: requests.map(req => ({
            range: req.range,
            values: req.values,
            majorDimension: req.majorDimension || 'ROWS',
          })),
        },
      });
    });

    const result = response.data;
    const responses = result.responses?.map((resp: sheets_v4.Schema$UpdateValuesResponse) => ({
      updatedRows: resp.updatedRows || 0,
      updatedColumns: resp.updatedColumns || 0,
      updatedCells: resp.updatedCells || 0,
    })) || [];

    return {
      totalUpdatedRows: result.totalUpdatedRows || 0,
      totalUpdatedColumns: result.totalUpdatedColumns || 0,
      totalUpdatedCells: result.totalUpdatedCells || 0,
      responses,
    };
  }

  /**
   * Clear values from a range
   */
  async clearRange(
    spreadsheetId: string,
    range: string
  ): Promise<{
    clearedRange: string;
  }> {
    const response = await this.makeRequest(async () => {
      return await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });
    });

    return {
      clearedRange: response.data.clearedRange || range,
    };
  }

  // ===== UTILITY METHODS =====

  /**
   * Get user information from Google OAuth2 API
   */
  async getUserInfo(accessToken?: string): Promise<{
    email: string;
    name: string;
    id: string;
    picture?: string;
    verified_email?: boolean;
  }> {
    const token = accessToken || this.accessToken;
    
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: token,
    });
    
    const oauth2 = google.oauth2({ version: 'v2', auth });
    
    const response = await this.makeRequest(async () => {
      return await oauth2.userinfo.get();
    });

    const userInfo = response.data;
    if (!userInfo.email || !userInfo.name) {
      throw new Error('Failed to get user info: missing required fields');
    }

    return {
      email: userInfo.email,
      name: userInfo.name,
      id: userInfo.id || '',
      picture: userInfo.picture!,
      verified_email: userInfo.verified_email!
    };
  }

  /**
   * Get Drive quota and storage information
   */
  async getDriveInfo(accessToken?: string): Promise<{
    quota: {
      limit: string;
      usage: string;
      usageInDrive: string;
    };
  }> {
    const token = accessToken || this.accessToken;
    
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: token,
    });
    
    const drive = google.drive({ version: 'v3', auth });

    const response = await this.makeRequest(async () => {
      return await drive.about.get({
        fields: 'storageQuota'
      });
    });

    const storageQuota = response.data.storageQuota;
    
    return {
      quota: {
        limit: storageQuota?.limit || 'unlimited',
        usage: storageQuota?.usage || '0',
        usageInDrive: storageQuota?.usageInDrive || '0'
      }
    };
  }

  /**
   * Test Sheets API access and permissions
   */
  async testSheetsAccess(accessToken?: string): Promise<{
    canCreate: boolean;
    canEdit: boolean;
    canShare: boolean;
  }> {
    const token = accessToken || this.accessToken;
    
    try {
      // Test by attempting to list spreadsheets (read permission)
      const auth = new google.auth.OAuth2();
      auth.setCredentials({
        access_token: token,
      });
      
      const drive = google.drive({ version: 'v3', auth });

      const response = await this.makeRequest(async () => {
        return await drive.files.list({
          q: "mimeType='application/vnd.google-apps.spreadsheet'",
          pageSize: 1,
          fields: 'files(id,name)',
        });
      });

      const canRead = response.status === 200;
      
      // For Google Sheets, if we can read, we typically can create/edit
      // The actual permissions depend on the OAuth scopes granted
      // We'll assume basic permissions if we can successfully list files
      return {
        canCreate: canRead,
        canEdit: canRead,
        canShare: canRead
      };
    } catch (error: unknown) {
      console.error('Error testing Sheets access:', error);
      return {
        canCreate: false,
        canEdit: false,
        canShare: false
      };
    }
  }

  /**
   * Test API connection and permissions
   */
  async testConnection(): Promise<{
    success: boolean;
    userEmail?: string;
    error?: string;
  }> {
    try {
      // Test by getting user info
      const userInfo = await this.getUserInfo();

      // Test Sheets API access by listing a few spreadsheets
      await this.listSpreadsheets(1);

      return {
        success: true,
        userEmail: userInfo.email,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get column letter from column index (0-based)
   */
  static getColumnLetter(columnIndex: number): string {
    let result = '';
    while (columnIndex >= 0) {
      result = String.fromCharCode(65 + (columnIndex % 26)) + result;
      columnIndex = Math.floor(columnIndex / 26) - 1;
    }
    return result;
  }

  /**
   * Get column index from column letter (returns 0-based index)
   */
  static getColumnIndex(columnLetter: string): number {
    let result = 0;
    for (let i = 0; i < columnLetter.length; i++) {
      result = result * 26 + (columnLetter.charCodeAt(i) - 64);
    }
    return result - 1;
  }

  /**
   * Format range string from sheet name, start row/col, end row/col
   */
  static formatRange(
    sheetName: string,
    startRow: number,
    startCol: number,
    endRow?: number,
    endCol?: number
  ): string {
    const startColLetter = this.getColumnLetter(startCol);
    const endColLetter = endCol !== undefined ? this.getColumnLetter(endCol) : '';
    
    let range = `${sheetName}!${startColLetter}${startRow}`;
    
    if (endRow !== undefined && endCol !== undefined) {
      range += `:${endColLetter}${endRow}`;
    } else if (endCol !== undefined) {
      range += `:${endColLetter}${startRow}`;
    }
    
    return range;
  }

  /**
   * Validate spreadsheet ID format
   */
  static isValidSpreadsheetId(spreadsheetId: string): boolean {
    // Google Sheets ID is typically 44 characters long and contains letters, numbers, hyphens, and underscores
    return /^[a-zA-Z0-9-_]{44}$/.test(spreadsheetId);
  }

  /**
   * Extract spreadsheet ID from Google Sheets URL
   */
  static extractSpreadsheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }
}