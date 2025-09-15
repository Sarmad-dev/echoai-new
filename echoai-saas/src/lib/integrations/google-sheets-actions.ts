/**
 * Google Sheets Integration Action Handlers
 *
 * Provides comprehensive Google Sheets actions for automation workflows:
 * - WriteToGoogleSheets: Write data to specific ranges or append to sheets
 * - ReadFromGoogleSheets: Read data from sheets for workflow decisions
 * - LogToGoogleSheets: Log conversation data and lead information
 * - UpdateGoogleSheetsRow: Update specific rows based on criteria
 */

import {
  ActionHandler,
  ActionConfig,
  ValidationResult,
  ActionConfigSchema,
  ActionResult,
} from "../workflow/actions";
import { WorkflowContext } from "../workflow-execution-engine";
// Import client only on server side
let GoogleSheetsApiClient: any;
let GoogleSheetsRateLimitError: any;

if (typeof window === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const clientModule = require("./google-sheets-client");
  GoogleSheetsApiClient = clientModule.GoogleSheetsApiClient;
  GoogleSheetsRateLimitError = clientModule.GoogleSheetsRateLimitError;
}
import { OAuth2Manager } from "./oauth2-manager";
import { getProvider } from "./providers";
import * as crypto from "crypto";

export interface GoogleSheetsActionConfig extends ActionConfig {
  // Spreadsheet identification
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheetName?: string;

  // Write operations
  writeMode?: "append" | "update" | "overwrite";
  range?: string;
  values?: any[][];
  columnMapping?: Record<string, string>; // Field name to column letter mapping

  // Read operations
  readRange?: string;
  includeHeaders?: boolean;

  // Data logging
  logFields?: string[]; // Fields from trigger data to log
  timestampColumn?: string;

  // General settings
  integrationId?: string;
  retryOnRateLimit?: boolean;
  maxRetries?: number;
  valueInputOption?: "RAW" | "USER_ENTERED";
}

/**
 * Base class for Google Sheets actions with common functionality
 */
abstract class BaseGoogleSheetsAction implements ActionHandler {
  abstract type: string;

  protected oauth2Manager = new OAuth2Manager();

  /**
   * Decrypt token using the same logic as API endpoints
   */
  private decryptToken(encryptedText: string): string {
    const encryptionKey =
      process.env.INTEGRATION_ENCRYPTION_KEY ||
      "default-key-change-in-production";
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync(encryptionKey, "salt", 32);
    const parts = encryptedText.split(":");

    if (parts.length === 2) {
      // New format: iv:encrypted
      const [ivHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv(algorithm, key, iv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } else if (parts.length === 3) {
      // Old GCM format: iv:authTag:encrypted - handle gracefully
      const [, , encrypted] = parts;
      // Use a default IV for legacy data - this is a fallback for old encrypted data
      const defaultIv = Buffer.alloc(16, 0);
      const decipher = crypto.createDecipheriv(algorithm, key, defaultIv);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } else {
      throw new Error("Invalid encrypted data format");
    }
  }

  /**
   * Get integration using server-side Supabase client (for workflow execution)
   */
  private async getIntegrationServerSide(
    integrationId: string,
    userId: string
  ) {
    // Dynamically import server-side client to avoid client-side issues
    const { createClient } = await import("../supabase/supabase");
    const supabase = await createClient();

    const { data: integration, error } = await supabase
      .from("Integration")
      .select("*")
      .eq("id", integrationId)
      .eq("userId", userId)
      .eq("provider", "google")
      .eq("isActive", true)
      .single();

    if (error || !integration) {
      return null;
    }

    // Decrypt tokens before returning
    return {
      ...integration,
      accessToken: this.decryptToken(integration.accessToken),
      refreshToken: integration.refreshToken
        ? this.decryptToken(integration.refreshToken)
        : undefined,
      tokenExpiry: integration.tokenExpiry
        ? new Date(integration.tokenExpiry)
        : undefined,
      createdAt: new Date(integration.createdAt),
      updatedAt: new Date(integration.updatedAt),
    };
  }

  /**
   * Get Google Sheets client for the configured integration (server-side only)
   */
  protected async getGoogleSheetsClient(
    config: GoogleSheetsActionConfig,
    context: WorkflowContext
  ): Promise<any> {
    if (typeof window !== "undefined") {
      throw new Error(
        "Google Sheets client can only be used on the server side"
      );
    }

    if (!config.integrationId) {
      throw new Error("Google Sheets integration ID is required");
    }

    let integration;

    // Use server-side approach if we have userId in context (workflow execution)
    if (context.userId) {
      integration = await this.getIntegrationServerSide(
        config.integrationId,
        context.userId
      );
    } else {
      // Fallback to OAuth2Manager for other cases
      integration = await this.oauth2Manager.getIntegrationById(
        config.integrationId
      );
    }

    if (!integration) {
      throw new Error("Google Sheets integration not found");
    }

    if (!integration.isActive) {
      throw new Error("Google Sheets integration is not active");
    }

    // Check if token needs refresh
    if (integration.tokenExpiry && integration.tokenExpiry < new Date()) {
      const provider = getProvider("google");
      if (!provider) {
        throw new Error("Google provider configuration not found");
      }

      const refreshedIntegration = await this.oauth2Manager.refreshAccessToken(
        config.integrationId,
        provider
      );

      if (!refreshedIntegration) {
        throw new Error("Failed to refresh Google access token");
      }

      return new GoogleSheetsApiClient(refreshedIntegration);
    }

    return new GoogleSheetsApiClient(integration);
  }

  /**
   * Handle rate limiting with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: GoogleSheetsActionConfig
  ): Promise<T> {
    const maxRetries = config.maxRetries || 3;
    const retryOnRateLimit = config.retryOnRateLimit !== false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (
          GoogleSheetsRateLimitError &&
          error instanceof GoogleSheetsRateLimitError &&
          retryOnRateLimit
        ) {
          if (attempt < maxRetries - 1) {
            // Wait for the retry-after period plus a small buffer
            const waitTime =
              ((error as { retryAfter: number }).retryAfter + 1) * 1000;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error("Max retries exceeded");
  }

  /**
   * Get spreadsheet ID from config (either direct ID or extracted from URL)
   */
  protected getSpreadsheetId(config: GoogleSheetsActionConfig): string {
    if (config.spreadsheetId) {
      return config.spreadsheetId;
    }

    if (config.spreadsheetUrl) {
      const id = GoogleSheetsApiClient?.extractSpreadsheetId(
        config.spreadsheetUrl
      );
      if (!id) {
        throw new Error("Invalid Google Sheets URL format");
      }
      return id;
    }

    throw new Error("Either spreadsheetId or spreadsheetUrl is required");
  }

  /**
   * Process template variables in values
   */
  protected processValueTemplates(
    values: any[][],
    context: WorkflowContext
  ): any[][] {
    return values.map((row) =>
      row.map((cell) => {
        if (typeof cell === "string") {
          return this.processTemplate(cell, context);
        }
        return cell;
      })
    );
  }

  /**
   * Process template string with context variables
   */
  protected processTemplate(
    template: string,
    context: WorkflowContext
  ): string {
    let processed = template;

    // Replace context variables
    Object.entries(context.triggerData).forEach(([key, value]) => {
      processed = processed.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        String(value)
      );
    });

    // Replace common variables
    processed = processed.replace(
      /\{\{timestamp\}\}/g,
      new Date().toISOString()
    );
    processed = processed.replace(
      /\{\{date\}\}/g,
      new Date().toLocaleDateString()
    );
    processed = processed.replace(
      /\{\{time\}\}/g,
      new Date().toLocaleTimeString()
    );
    processed = processed.replace(/\{\{executionId\}\}/g, context.executionId);
    processed = processed.replace(/\{\{triggerType\}\}/g, context.triggerId);

    return processed;
  }

  /**
   * Convert trigger data to row values based on column mapping
   */
  protected mapDataToRow(
    data: Record<string, any>,
    columnMapping: Record<string, string>
  ): any[] {
    const row: any[] = [];
    const maxColumn = Math.max(
      ...Object.values(columnMapping).map(
        (col) => GoogleSheetsApiClient?.getColumnIndex(col) || 0
      )
    );

    // Initialize row with empty values
    for (let i = 0; i <= maxColumn; i++) {
      row[i] = "";
    }

    // Fill in mapped values
    Object.entries(columnMapping).forEach(([field, column]) => {
      const columnIndex = GoogleSheetsApiClient?.getColumnIndex(column) || 0;
      row[columnIndex] = data[field] || "";
    });

    return row;
  }

  abstract execute(
    config: GoogleSheetsActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult>;
  abstract validateConfig(config: GoogleSheetsActionConfig): ValidationResult;
  abstract getConfigSchema(): ActionConfigSchema;
}

/**
 * Write to Google Sheets Action
 * Writes data to Google Sheets with flexible modes (append, update, overwrite)
 */
export class WriteToGoogleSheetsAction extends BaseGoogleSheetsAction {
  type = "write_to_google_sheets";

  async execute(
    config: GoogleSheetsActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult> {
    try {
      const client = await this.getGoogleSheetsClient(config, context);
      const spreadsheetId = this.getSpreadsheetId(config);
      const sheetName = config.sheetName || "Sheet1";
      const writeMode = config.writeMode || "append";
      const valueInputOption = config.valueInputOption || "USER_ENTERED";

      let values: any[][];

      if (config.values) {
        // Use provided values with template processing
        values = this.processValueTemplates(config.values, context);
      } else if (config.columnMapping) {
        // Map trigger data to row using column mapping
        const row = this.mapDataToRow(
          context.triggerData,
          config.columnMapping
        );
        values = [row];
      } else {
        // Default: create row from trigger data
        values = [
          [
            context.triggerData.userEmail || "",
            context.triggerData.message || "",
            new Date().toISOString(),
            context.triggerId,
            context.executionId,
          ],
        ];
      }

      let result;
      const range = config.range || `${sheetName}!A:Z`;

      switch (writeMode) {
        case "append":
          result = await this.executeWithRetry(async () => {
            return await client.appendToSheet(
              spreadsheetId,
              range,
              values,
              valueInputOption
            );
          }, config);
          break;

        case "update":
        case "overwrite":
          if (!config.range) {
            throw new Error("Range is required for update/overwrite mode");
          }
          result = await this.executeWithRetry(async () => {
            return await client.writeRange(
              spreadsheetId,
              config.range!,
              values,
              valueInputOption
            );
          }, config);
          break;

        default:
          throw new Error(`Invalid write mode: ${writeMode}`);
      }

      return {
        success: true,
        data: {
          spreadsheetId,
          sheetName,
          writeMode,
          rowsWritten: values.length,
          range: result.tableRange || config.range,
          updatedCells:
            "updates" in result
              ? result.updates.updatedCells
              : result.updatedCells,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to write to Google Sheets",
      };
    }
  }

  validateConfig(config: GoogleSheetsActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push("Google Sheets integration ID is required");
    }

    if (!config.spreadsheetId && !config.spreadsheetUrl) {
      errors.push("Either spreadsheet ID or URL is required");
    }

    if (config.writeMode === "update" && !config.range) {
      errors.push("Range is required for update mode");
    }

    if (!config.values && !config.columnMapping) {
      warnings.push(
        "No values or column mapping specified, will use default trigger data"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: "Write to Google Sheets",
      description: "Write data to a Google Sheets spreadsheet",
      properties: {
        integrationId: {
          type: "string",
          title: "Google Sheets Integration",
          description: "Select the Google Sheets integration to use",
        },
        spreadsheetId: {
          type: "string",
          title: "Spreadsheet ID",
          description: "Google Sheets spreadsheet ID (alternative to URL)",
        },
        spreadsheetUrl: {
          type: "string",
          title: "Spreadsheet URL",
          description: "Full Google Sheets URL (alternative to ID)",
        },
        sheetName: {
          type: "string",
          title: "Sheet Name",
          description: "Name of the sheet tab",
          default: "Sheet1",
        },
        writeMode: {
          type: "string",
          title: "Write Mode",
          description: "How to write the data",
          enum: ["append", "update", "overwrite"],
          default: "append",
        },
        range: {
          type: "string",
          title: "Range",
          description: "Cell range (e.g., A1:C10) - required for update mode",
        },
        columnMapping: {
          type: "object",
          title: "Column Mapping",
          description: "Map trigger data fields to spreadsheet columns",
          properties: {
            userEmail: { type: "string", title: "Email Column (e.g., A)" },
            message: { type: "string", title: "Message Column (e.g., B)" },
            timestamp: { type: "string", title: "Timestamp Column (e.g., C)" },
          },
        },
        valueInputOption: {
          type: "string",
          title: "Value Input Option",
          description: "How values should be interpreted",
          enum: ["RAW", "USER_ENTERED"],
          default: "USER_ENTERED",
        },
        retryOnRateLimit: {
          type: "boolean",
          title: "Retry on Rate Limit",
          default: true,
        },
        maxRetries: {
          type: "number",
          title: "Max Retries",
          default: 3,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["integrationId"],
    };
  }
}

/**
 * Read from Google Sheets Action
 * Reads data from Google Sheets for use in workflow decisions
 */
export class ReadFromGoogleSheetsAction extends BaseGoogleSheetsAction {
  type = "read_from_google_sheets";

  async execute(
    config: GoogleSheetsActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult> {
    try {
      const client = await this.getGoogleSheetsClient(config, context);
      const spreadsheetId = this.getSpreadsheetId(config);
      const range = config.readRange || `${config.sheetName || "Sheet1"}!A:Z`;

      const result = await this.executeWithRetry(async () => {
        if (config.includeHeaders) {
          return await client.readWithHeaders(spreadsheetId, range);
        } else {
          const data = await client.readRange(spreadsheetId, range);
          return data?.values || [];
        }
      }, config);

      return {
        success: true,
        data: {
          spreadsheetId,
          range,
          rowCount: Array.isArray(result) ? result.length : 0,
          data: result,
          hasHeaders: config.includeHeaders || false,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to read from Google Sheets",
      };
    }
  }

  validateConfig(config: GoogleSheetsActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push("Google Sheets integration ID is required");
    }

    if (!config.spreadsheetId && !config.spreadsheetUrl) {
      errors.push("Either spreadsheet ID or URL is required");
    }

    if (!config.readRange && !config.sheetName) {
      warnings.push(
        "No range or sheet name specified, will read entire Sheet1"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: "Read from Google Sheets",
      description: "Read data from a Google Sheets spreadsheet",
      properties: {
        integrationId: {
          type: "string",
          title: "Google Sheets Integration",
          description: "Select the Google Sheets integration to use",
        },
        spreadsheetId: {
          type: "string",
          title: "Spreadsheet ID",
          description: "Google Sheets spreadsheet ID (alternative to URL)",
        },
        spreadsheetUrl: {
          type: "string",
          title: "Spreadsheet URL",
          description: "Full Google Sheets URL (alternative to ID)",
        },
        sheetName: {
          type: "string",
          title: "Sheet Name",
          description: "Name of the sheet tab",
          default: "Sheet1",
        },
        readRange: {
          type: "string",
          title: "Range",
          description: "Cell range to read (e.g., A1:C10)",
        },
        includeHeaders: {
          type: "boolean",
          title: "Include Headers",
          description: "Treat first row as headers and return objects",
          default: false,
        },
        retryOnRateLimit: {
          type: "boolean",
          title: "Retry on Rate Limit",
          default: true,
        },
        maxRetries: {
          type: "number",
          title: "Max Retries",
          default: 3,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["integrationId"],
    };
  }
}

/**
 * Log to Google Sheets Action
 * Specialized action for logging conversation data and lead information
 */
export class LogToGoogleSheetsAction extends BaseGoogleSheetsAction {
  type = "log_to_google_sheets";

  async execute(
    config: GoogleSheetsActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult> {
    try {
      const client = await this.getGoogleSheetsClient(config, context);
      const spreadsheetId = this.getSpreadsheetId(config);
      const sheetName = config.sheetName || "Conversation Log";

      // Build log row from trigger data and specified fields
      const logRow: any[] = [];
      const fieldsToLog = config.logFields || [
        "timestamp",
        "userEmail",
        "message",
        "triggerType",
        "sentimentScore",
        "executionId",
      ];

      fieldsToLog.forEach((field) => {
        let value = "";

        switch (field) {
          case "timestamp":
            value = new Date().toISOString();
            break;
          case "triggerType":
            value = context.triggerId;
            break;
          case "executionId":
            value = context.executionId;
            break;
          default:
            value = String(context.triggerData[field] || "");
        }

        logRow.push(value);
      });

      const range = `${sheetName}!A:${
        GoogleSheetsApiClient?.getColumnLetter(logRow.length - 1) || "Z"
      }`;

      const result = await this.executeWithRetry(async () => {
        return await client.appendToSheet(
          spreadsheetId,
          range,
          [logRow],
          "USER_ENTERED"
        );
      }, config);

      return {
        success: true,
        data: {
          spreadsheetId,
          sheetName,
          fieldsLogged: fieldsToLog,
          loggedAt: new Date().toISOString(),
          range: result.tableRange,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to log to Google Sheets",
      };
    }
  }

  validateConfig(config: GoogleSheetsActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push("Google Sheets integration ID is required");
    }

    if (!config.spreadsheetId && !config.spreadsheetUrl) {
      errors.push("Either spreadsheet ID or URL is required");
    }

    if (!config.logFields || config.logFields.length === 0) {
      warnings.push("No log fields specified, will use default fields");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: "Log to Google Sheets",
      description: "Log conversation data and events to Google Sheets",
      properties: {
        integrationId: {
          type: "string",
          title: "Google Sheets Integration",
          description: "Select the Google Sheets integration to use",
        },
        spreadsheetId: {
          type: "string",
          title: "Spreadsheet ID",
          description: "Google Sheets spreadsheet ID (alternative to URL)",
        },
        spreadsheetUrl: {
          type: "string",
          title: "Spreadsheet URL",
          description: "Full Google Sheets URL (alternative to ID)",
        },
        sheetName: {
          type: "string",
          title: "Sheet Name",
          description: "Name of the sheet tab for logging",
          default: "Conversation Log",
        },
        logFields: {
          type: "array",
          title: "Fields to Log",
          description: "Select which fields to include in the log",
          items: {
            type: "string",
            enum: [
              "timestamp",
              "userEmail",
              "message",
              "triggerType",
              "sentimentScore",
              "executionId",
              "sessionId",
              "chatbotId",
              "imageUrl",
              "metadata",
            ],
          },
          default: [
            "timestamp",
            "userEmail",
            "message",
            "triggerType",
            "sentimentScore",
            "executionId",
          ],
        },
        retryOnRateLimit: {
          type: "boolean",
          title: "Retry on Rate Limit",
          default: true,
        },
        maxRetries: {
          type: "number",
          title: "Max Retries",
          default: 3,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["integrationId"],
    };
  }
}

/**
 * Update Google Sheets Row Action
 * Updates specific rows in Google Sheets based on search criteria
 */
export class UpdateGoogleSheetsRowAction extends BaseGoogleSheetsAction {
  type = "update_google_sheets_row";

  async execute(
    config: GoogleSheetsActionConfig,
    context: WorkflowContext
  ): Promise<ActionResult> {
    try {
      const client = await this.getGoogleSheetsClient(config, context);
      const spreadsheetId = this.getSpreadsheetId(config);
      const sheetName = config.sheetName || "Sheet1";

      if (!config.range) {
        throw new Error("Range is required for row update");
      }

      if (!config.values) {
        throw new Error("Values are required for row update");
      }

      const values = this.processValueTemplates(config.values, context);

      const result = await this.executeWithRetry(async () => {
        return await client.writeRange(
          spreadsheetId,
          config.range!,
          values,
          config.valueInputOption || "USER_ENTERED"
        );
      }, config);

      return {
        success: true,
        data: {
          spreadsheetId,
          sheetName,
          range: config.range,
          updatedRows: result.updatedRows,
          updatedCells: result.updatedCells,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update Google Sheets row",
      };
    }
  }

  validateConfig(config: GoogleSheetsActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push("Google Sheets integration ID is required");
    }

    if (!config.spreadsheetId && !config.spreadsheetUrl) {
      errors.push("Either spreadsheet ID or URL is required");
    }

    if (!config.range) {
      errors.push("Range is required for row update");
    }

    if (!config.values) {
      errors.push("Values are required for row update");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: "Update Google Sheets Row",
      description: "Update specific rows in Google Sheets",
      properties: {
        integrationId: {
          type: "string",
          title: "Google Sheets Integration",
          description: "Select the Google Sheets integration to use",
        },
        spreadsheetId: {
          type: "string",
          title: "Spreadsheet ID",
          description: "Google Sheets spreadsheet ID (alternative to URL)",
        },
        spreadsheetUrl: {
          type: "string",
          title: "Spreadsheet URL",
          description: "Full Google Sheets URL (alternative to ID)",
        },
        sheetName: {
          type: "string",
          title: "Sheet Name",
          description: "Name of the sheet tab",
          default: "Sheet1",
        },
        range: {
          type: "string",
          title: "Range",
          description: "Cell range to update (e.g., A2:C2)",
        },
        values: {
          type: "array",
          title: "Values",
          description: "Array of arrays containing the values to write",
          items: {
            type: "array",
            items: { type: "string" },
          },
        },
        valueInputOption: {
          type: "string",
          title: "Value Input Option",
          description: "How values should be interpreted",
          enum: ["RAW", "USER_ENTERED"],
          default: "USER_ENTERED",
        },
        retryOnRateLimit: {
          type: "boolean",
          title: "Retry on Rate Limit",
          default: true,
        },
        maxRetries: {
          type: "number",
          title: "Max Retries",
          default: 3,
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["integrationId", "range", "values"],
    };
  }
}
