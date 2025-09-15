"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  FileSpreadsheet,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const googleSheetsConfigSchema = z.object({
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  defaultSpreadsheet: z.string().optional(),
  defaultSheet: z.string(),
  columnMappings: z.object({
    timestamp: z.string(),
    userEmail: z.string(),
    message: z.string(),
    triggerType: z.string(),
    sentimentScore: z.string().optional(),
    executionId: z.string().optional(),
  }),
  writeSettings: z.object({
    defaultWriteMode: z.enum(['append', 'update', 'overwrite']),
    valueInputOption: z.enum(['RAW', 'USER_ENTERED']),
    includeHeaders: z.boolean(),
    headerRow: z.number().min(1),
  }),
  retrySettings: z.object({
    retryOnRateLimit: z.boolean(),
    maxRetries: z.number().min(1).max(10),
  }),
  autoCreateSheets: z.boolean(),
  timestampFormat: z.string(),
});

type GoogleSheetsConfigForm = z.infer<typeof googleSheetsConfigSchema>;

interface GoogleSpreadsheet {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink: string;
}

interface GoogleSheet {
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

interface GoogleSheetsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId?: string;
  onSave: (config: GoogleSheetsConfigForm) => Promise<void>;
}

const AVAILABLE_SCOPES = [
  {
    id: "https://www.googleapis.com/auth/spreadsheets",
    label: "Read and Write Spreadsheets",
    description: "Full access to Google Sheets for reading and writing data",
    required: true,
  },
  {
    id: "https://www.googleapis.com/auth/drive.readonly",
    label: "Read Drive Files",
    description: "View and list Google Drive files (for spreadsheet discovery)",
    required: false,
  },
];

const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

const DEFAULT_COLUMN_MAPPINGS = {
  timestamp: 'A',
  userEmail: 'B',
  message: 'C',
  triggerType: 'D',
  sentimentScore: 'E',
  executionId: 'F',
};

export function GoogleSheetsConfigDialog({
  open,
  onOpenChange,
  integrationId,
  onSave,
}: GoogleSheetsConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    error?: string;
    userEmail?: string;
  } | null>(null);
  const [spreadsheets, setSpreadsheets] = useState<GoogleSpreadsheet[]>([]);
  const [sheets, setSheets] = useState<GoogleSheet[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);

  const form = useForm<GoogleSheetsConfigForm>({
    resolver: zodResolver(googleSheetsConfigSchema),
    defaultValues: {
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      defaultSheet: "Sheet1",
      columnMappings: DEFAULT_COLUMN_MAPPINGS,
      writeSettings: {
        defaultWriteMode: "append",
        valueInputOption: "USER_ENTERED",
        includeHeaders: true,
        headerRow: 1,
      },
      retrySettings: {
        retryOnRateLimit: true,
        maxRetries: 3,
      },
      autoCreateSheets: false,
      timestampFormat: "YYYY-MM-DD HH:mm:ss",
    },
  });

  useEffect(() => {
    if (open && integrationId) {
      loadGoogleSheetsData();
    }
  }, [open, integrationId]);

  const loadGoogleSheetsData = async () => {
    if (!integrationId) return;

    setLoading(true);
    try {
      // Test connection first
      await testConnection();

      // Load spreadsheets
      const spreadsheetsResponse = await fetch(
        `/api/integrations/google-sheets/spreadsheets?integrationId=${integrationId}`
      );

      if (spreadsheetsResponse.ok) {
        const spreadsheetsData = await spreadsheetsResponse.json();
        setSpreadsheets(spreadsheetsData.spreadsheets || []);
        
        // Set default spreadsheet if available
        if (spreadsheetsData.spreadsheets?.length > 0) {
          form.setValue("defaultSpreadsheet", spreadsheetsData.spreadsheets[0].id);
          await loadSheetsForSpreadsheet(spreadsheetsData.spreadsheets[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading Google Sheets data:", error);
      toast.error("Failed to load Google Sheets configuration data");
    } finally {
      setLoading(false);
    }
  };

  const loadSheetsForSpreadsheet = async (spreadsheetId: string) => {
    if (!integrationId || !spreadsheetId) return;

    setLoadingSheets(true);
    try {
      const response = await fetch(
        `/api/integrations/google-sheets/sheets?integrationId=${integrationId}&spreadsheetId=${spreadsheetId}`
      );

      if (response.ok) {
        const data = await response.json();
        setSheets(data.sheets || []);
        
        // Set default sheet if available
        if (data.sheets?.length > 0) {
          form.setValue("defaultSheet", data.sheets[0].properties.title);
        }
      }
    } catch (error) {
      console.error("Error loading sheets:", error);
      toast.error("Failed to load sheets for spreadsheet");
    } finally {
      setLoadingSheets(false);
    }
  };

  const testConnection = async () => {
    if (!integrationId) return;

    setTestingConnection(true);
    try {
      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrationId,
        }),
      });

      const result = await response.json();
      setConnectionStatus(result);

      if (!result.success) {
        toast.error("Connection Test Failed", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus({
        success: false,
        error: "Failed to test connection",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async (data: GoogleSheetsConfigForm) => {
    try {
      await onSave(data);
      onOpenChange(false);
      toast.success("Google Sheets configuration saved successfully");
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error("Failed to save configuration");
    }
  };

  const handleSpreadsheetChange = (spreadsheetId: string) => {
    form.setValue("defaultSpreadsheet", spreadsheetId);
    loadSheetsForSpreadsheet(spreadsheetId);
  };

  const selectedSpreadsheet = spreadsheets.find(
    (s) => s.id === form.watch("defaultSpreadsheet")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            Google Sheets Integration Configuration
          </DialogTitle>
          <DialogDescription>
            Configure your Google Sheets integration settings, spreadsheet selection, and column mappings for automation workflows.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading Google Sheets configuration...</span>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSave)}
              className="space-y-6"
            >
              {/* Connection Status */}
              {connectionStatus && (
                <Alert
                  className={
                    connectionStatus.success
                      ? "border-green-200"
                      : "border-red-200"
                  }
                >
                  {connectionStatus.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <AlertDescription>
                    {connectionStatus.success ? (
                      <div>
                        <strong>Connection successful!</strong>
                        {connectionStatus.userEmail && (
                          <span className="ml-2">
                            Account: {connectionStatus.userEmail}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        <strong>Connection failed:</strong>{" "}
                        {connectionStatus.error}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Scopes Selection */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Permissions & Scopes</h3>
                  <p className="text-sm text-muted-foreground">
                    Select the Google Sheets permissions your automation workflows will need.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="scopes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-1 gap-4">
                          {AVAILABLE_SCOPES.map((scope) => (
                            <div
                              key={scope.id}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                                field.value.includes(scope.id)
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              }`}
                              onClick={() => {
                                if (scope.required) return;

                                const newValue = field.value.includes(scope.id)
                                  ? field.value.filter((s) => s !== scope.id)
                                  : [...field.value, scope.id];
                                field.onChange(newValue);
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {scope.label}
                                    </span>
                                    {scope.required && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        Required
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {scope.description}
                                  </p>
                                </div>
                                <div
                                  className={`w-4 h-4 rounded border-2 ${
                                    field.value.includes(scope.id)
                                      ? "bg-primary border-primary"
                                      : "border-border"
                                  }`}
                                >
                                  {field.value.includes(scope.id) && (
                                    <CheckCircle className="w-3 h-3 text-white" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Spreadsheet Selection */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Default Spreadsheet</h3>
                  <p className="text-sm text-muted-foreground">
                    Select the default spreadsheet and sheet for automation workflows.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="defaultSpreadsheet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Spreadsheet</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={handleSpreadsheetChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select spreadsheet" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {spreadsheets.map((spreadsheet) => (
                              <SelectItem
                                key={spreadsheet.id}
                                value={spreadsheet.id}
                              >
                                <div className="flex flex-col">
                                  <span>{spreadsheet.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Modified: {new Date(spreadsheet.modifiedTime).toLocaleDateString()}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedSpreadsheet && (
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(selectedSpreadsheet.webViewLink, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Open in Sheets
                            </Button>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defaultSheet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Sheet</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={loadingSheets || sheets.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sheet" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sheets.map((sheet) => (
                              <SelectItem
                                key={sheet.properties.sheetId}
                                value={sheet.properties.title}
                              >
                                <div className="flex flex-col">
                                  <span>{sheet.properties.title}</span>
                                  {sheet.properties.gridProperties && (
                                    <span className="text-xs text-muted-foreground">
                                      {sheet.properties.gridProperties.rowCount} rows × {sheet.properties.gridProperties.columnCount} cols
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {loadingSheets && (
                          <div className="flex items-center gap-2 mt-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-xs text-muted-foreground">Loading sheets...</span>
                          </div>
                        )}
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Column Mappings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Column Mappings</h3>
                  <p className="text-sm text-muted-foreground">
                    Map conversation data fields to spreadsheet columns. These mappings will be used as defaults in automation workflows.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="columnMappings.timestamp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Timestamp</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COLUMN_LETTERS.map((letter) => (
                              <SelectItem key={letter} value={letter}>
                                Column {letter}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="columnMappings.userEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">User Email</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COLUMN_LETTERS.map((letter) => (
                              <SelectItem key={letter} value={letter}>
                                Column {letter}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="columnMappings.message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Message</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COLUMN_LETTERS.map((letter) => (
                              <SelectItem key={letter} value={letter}>
                                Column {letter}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="columnMappings.triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Trigger Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COLUMN_LETTERS.map((letter) => (
                              <SelectItem key={letter} value={letter}>
                                Column {letter}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="columnMappings.sentimentScore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Sentiment Score</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {COLUMN_LETTERS.map((letter) => (
                              <SelectItem key={letter} value={letter}>
                                Column {letter}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="columnMappings.executionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Execution ID</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {COLUMN_LETTERS.map((letter) => (
                              <SelectItem key={letter} value={letter}>
                                Column {letter}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Write Settings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Write Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure how data is written to spreadsheets by default.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="writeSettings.defaultWriteMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Write Mode</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="append">Append (add to end)</SelectItem>
                            <SelectItem value="update">Update (specific range)</SelectItem>
                            <SelectItem value="overwrite">Overwrite (replace data)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How new data should be written to sheets by default
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="writeSettings.valueInputOption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Value Input Option</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USER_ENTERED">User Entered (parse formulas)</SelectItem>
                            <SelectItem value="RAW">Raw (literal values)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          How values should be interpreted when writing
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="writeSettings.headerRow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Header Row</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Row number containing column headers
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="timestampFormat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timestamp Format</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="YYYY-MM-DD HH:mm:ss" />
                        </FormControl>
                        <FormDescription>
                          Format for timestamp values in sheets
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="writeSettings.includeHeaders"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Include Headers</FormLabel>
                        <FormDescription>
                          Automatically add column headers when creating new sheets
                        </FormDescription>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Advanced Settings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Advanced Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure error handling and advanced behavior options.
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="autoCreateSheets"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Auto-Create Sheets</FormLabel>
                          <FormDescription>
                            Automatically create new sheets when specified sheet doesn't exist
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrySettings.retryOnRateLimit"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Retry on Rate Limit</FormLabel>
                          <FormDescription>
                            Automatically retry operations when rate limited by Google Sheets API
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retrySettings.maxRetries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Retries</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum number of retry attempts for failed operations
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={testConnection}
                  disabled={testingConnection || !integrationId}
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
                <Button type="submit" disabled={!connectionStatus?.success}>
                  Save Configuration
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}