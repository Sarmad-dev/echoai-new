/**
 * Action Configuration Form Components
 *
 * Provides UI components for configuring different action types
 * in the workflow automation builder.
 */

"use client";

import React, {
  useState,
  useEffect,
  Component,
  ErrorInfo,
  ReactNode,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, X } from "lucide-react";
import type {
  ActionConfig,
  ActionConfigSchema,
  ValidationResult,
} from "@/lib/workflow/actions";
import { SlackNotificationConfigForm } from "./SlackNotificationConfigForm";
import { SlackThreadReplyConfigForm } from "./SlackThreadReplyConfigForm";
import { useSlackConnection } from "@/hooks/useSlackConnection";
import { useSlackChannels } from "@/hooks/useSlackChannels";
import { useSlackUsers } from "@/hooks/useSlackUsers";
import { SlackConnectionStatusCard } from "@/components/integrations/slack/SlackConnectionStatusCard";
import { SlackChannelSelector } from "@/components/integrations/slack/SlackChannelSelector";
import { SlackUserSelector } from "@/components/integrations/slack/SlackUserSelector";
import type { SlackActionConfig } from "@/lib/integrations/slack-actions";

interface ActionConfigFormProps {
  actionType: string;
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
  onValidation?: (validation: ValidationResult) => void;
}

export function ActionConfigForm({
  actionType,
  config,
  onChange,
  onValidation,
}: ActionConfigFormProps) {
  const [schema, setSchema] = useState<ActionConfigSchema | null>(null);
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });

  useEffect(() => {
    // Load schema for the action type
    loadActionSchema(actionType).then(setSchema);
  }, [actionType]);

  useEffect(() => {
    // Validate configuration when it changes
    validateConfig(actionType, config).then((result) => {
      setValidation(result);
      onValidation?.(result);
    });
  }, [actionType, config, onValidation]);

  if (!schema) {
    return <div>Loading configuration...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{schema.title}</CardTitle>
        <CardDescription>{schema.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderConfigFields(schema, config, onChange)}

        {validation.errors.length > 0 && (
          <div className="space-y-2">
            {validation.errors.map((error, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-red-600 text-sm"
              >
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            ))}
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="space-y-2">
            {validation.warnings.map((warning, index) => (
              <div
                key={index}
                className="flex items-center gap-2 text-yellow-600 text-sm"
              >
                <AlertCircle className="h-4 w-4" />
                {warning}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function renderConfigFields(
  schema: ActionConfigSchema,
  config: ActionConfig,
  onChange: (config: ActionConfig) => void
): React.ReactNode {
  const { properties, required } = schema;

  return Object.entries(properties).map(([fieldName, fieldSchema]) => {
    const isRequired = required.includes(fieldName);
    const value = config[fieldName as keyof ActionConfig];

    return (
      <div key={fieldName} className="space-y-2">
        <Label htmlFor={fieldName} className="flex items-center gap-2">
          {(fieldSchema as any).title}
          {isRequired && (
            <Badge variant="destructive" className="text-xs">
              Required
            </Badge>
          )}
        </Label>

        {(fieldSchema as any).description && (
          <p className="text-sm text-muted-foreground">
            {(fieldSchema as any).description}
          </p>
        )}

        {renderField(fieldName, fieldSchema, value, (newValue) => {
          onChange({ ...config, [fieldName]: newValue });
        })}
      </div>
    );
  });
}

function renderField(
  fieldName: string,
  fieldSchema: any,
  value: any,
  onChange: (value: any) => void
): React.ReactNode {
  switch (fieldSchema.type) {
    case "string":
      if (fieldSchema.enum) {
        return (
          <Select value={value || fieldSchema.default} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={`Select ${fieldSchema.title}`} />
            </SelectTrigger>
            <SelectContent>
              {fieldSchema.enum.map((option: string) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      if (fieldName === "message" || fieldName === "template") {
        return (
          <Textarea
            id={fieldName}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldSchema.description}
            rows={3}
          />
        );
      }

      return (
        <Input
          id={fieldName}
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fieldSchema.description}
        />
      );

    case "boolean":
      return (
        <div className="flex items-center space-x-2">
          <Switch
            id={fieldName}
            checked={value ?? fieldSchema.default ?? false}
            onCheckedChange={onChange}
          />
          <Label htmlFor={fieldName}>{fieldSchema.title}</Label>
        </div>
      );

    case "number":
      return (
        <Input
          id={fieldName}
          type="number"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={fieldSchema.description}
        />
      );

    case "array":
      return (
        <ArrayField
          value={value || []}
          onChange={onChange}
          itemSchema={fieldSchema.items}
          placeholder={`Add ${fieldSchema.title}`}
        />
      );

    case "object":
      return (
        <ObjectField
          value={value || {}}
          onChange={onChange}
          properties={fieldSchema.properties}
        />
      );

    default:
      return (
        <Input
          id={fieldName}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fieldSchema.description}
        />
      );
  }
}

interface ArrayFieldProps {
  value: any[];
  onChange: (value: any[]) => void;
  itemSchema: any;
  placeholder: string;
}

function ArrayField({
  value,
  onChange,
  itemSchema: _itemSchema,
  placeholder,
}: ArrayFieldProps) {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...value, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          onKeyPress={(e) => e.key === "Enter" && addItem()}
        />
        <Button type="button" onClick={addItem} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {value.map((item, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex items-center gap-1"
          >
            {String(item)}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 hover:bg-transparent"
              onClick={() => removeItem(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

interface ObjectFieldProps {
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  properties: Record<string, any>;
}

function ObjectField({ value, onChange, properties }: ObjectFieldProps) {
  const updateField = (fieldName: string, fieldValue: any) => {
    onChange({ ...value, [fieldName]: fieldValue });
  };

  return (
    <div className="space-y-3 p-3 border rounded-md">
      {Object.entries(properties).map(([fieldName, fieldSchema]) => (
        <div key={fieldName} className="space-y-1">
          <Label className="text-sm">{fieldSchema.title}</Label>
          {renderField(fieldName, fieldSchema, value[fieldName], (newValue) => {
            updateField(fieldName, newValue);
          })}
        </div>
      ))}
    </div>
  );
}

// Utility functions for loading schemas and validation

async function loadActionSchema(
  actionType: string
): Promise<ActionConfigSchema | null> {
  try {
    const { ActionRegistry } = await import("@/lib/workflow/actions");
    return ActionRegistry.getActionSchema(actionType) || null;
  } catch (error) {
    console.error("Failed to load action schema:", error);
    return null;
  }
}

async function validateConfig(
  actionType: string,
  config: ActionConfig
): Promise<ValidationResult> {
  try {
    const { ActionRegistry } = await import("@/lib/workflow/actions");
    return ActionRegistry.validateActionConfig(actionType, config);
  } catch (error) {
    return {
      isValid: false,
      errors: ["Failed to validate configuration"],
      warnings: [],
    };
  }
}

// Error Boundary for specialized form components
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  actionType: string;
}

class ActionConfigErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `Error in specialized form for ${this.props.actionType}:`,
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Enhanced action configuration forms with integration support

export function EnhancedActionConfigForm({
  actionType,
  config,
  onChange,
}: {
  actionType: string;
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
}) {
  // Generic fallback form
  const fallbackForm = (
    <ActionConfigForm
      actionType={actionType}
      config={config}
      onChange={onChange}
    />
  );

  // Route to specialized forms based on action type with error handling
  switch (actionType) {
    case "send_slack_message":
      return (
        <ActionConfigErrorBoundary
          actionType={actionType}
          fallback={fallbackForm}
        >
          <SlackMessageConfigForm config={config} onChange={onChange} />
        </ActionConfigErrorBoundary>
      );
    case "send_slack_notification":
      return (
        <ActionConfigErrorBoundary
          actionType={actionType}
          fallback={fallbackForm}
        >
          <SlackNotificationConfigForm config={config} onChange={onChange} />
        </ActionConfigErrorBoundary>
      );
    case "send_slack_thread_reply":
      return (
        <ActionConfigErrorBoundary
          actionType={actionType}
          fallback={fallbackForm}
        >
          <SlackThreadReplyConfigForm config={config} onChange={onChange} />
        </ActionConfigErrorBoundary>
      );
    case "create_hubspot_contact":
      return (
        <ActionConfigErrorBoundary
          actionType={actionType}
          fallback={fallbackForm}
        >
          <HubSpotContactConfigForm config={config} onChange={onChange} />
        </ActionConfigErrorBoundary>
      );
    case "log_to_google_sheets":
      return (
        <ActionConfigErrorBoundary
          actionType={actionType}
          fallback={fallbackForm}
        >
          <GoogleSheetsConfigForm config={config} onChange={onChange} />
        </ActionConfigErrorBoundary>
      );
    default:
      // Fall back to the generic form for unknown action types
      return fallbackForm;
  }
}

// Specialized configuration forms for complex actions

export function SlackMessageConfigForm({
  config,
  onChange,
}: {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
}) {
  // Cast config to SlackActionConfig for type safety
  const slackConfig = config as SlackActionConfig;

  // Use shared hooks for connection, channels, and users
  const connectionState = useSlackConnection();
  const channelsState = useSlackChannels(
    connectionState.status,
    connectionState.selectedIntegrationId
  );
  const usersState = useSlackUsers(
    connectionState.status,
    connectionState.selectedIntegrationId
  );

  // Helper function to update configuration
  const updateConfig = (updates: Partial<SlackActionConfig>) => {
    const updatedConfig = { ...slackConfig, ...updates };

    // Always include the selected integration ID in the config
    if (connectionState.selectedIntegrationId) {
      updatedConfig.integrationId = connectionState.selectedIntegrationId;
    }

    onChange(updatedConfig);
  };

  // Show connection status card if not connected
  if (connectionState.status !== "connected") {
    return (
      <div className="space-y-4">
        <SlackConnectionStatusCard
          connectionState={connectionState}
          onRetry={connectionState.checkConnection}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="message">Message Template</Label>
        <Textarea
          id="message"
          value={slackConfig.message || ""}
          onChange={(e) => updateConfig({ message: e.target.value })}
          placeholder="Enter your message. Use {{variable}} for dynamic content."
          rows={4}
        />
        <p className="text-sm text-muted-foreground mt-1">
          Available variables:{" "}
          {`{{userEmail}}, {{userName}}, {{userPhone}}, {{conversationId}}, {{message}}, {{timestamp}}, {{sentimentScore}}, {{company}}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="channel">Channel</Label>
          <SlackChannelSelector
            channels={channelsState.channels}
            loading={channelsState.loading}
            value={slackConfig.channel || ""}
            onChange={(channelId) => updateConfig({ channel: channelId })}
            placeholder="Select a channel"
            error={channelsState.error}
          />
          <p className="text-sm text-muted-foreground mt-1">
            Select a channel to send the message to
          </p>
        </div>

        <div>
          <Label htmlFor="user">Direct Message User (Optional)</Label>
          <SlackUserSelector
            users={usersState.users}
            loading={usersState.loading}
            value={slackConfig.user || ""}
            onChange={(userId) => updateConfig({ user: userId })}
            placeholder="Select a user for DM"
            error={usersState.error}
          />
          <p className="text-sm text-muted-foreground mt-1">
            Alternatively, send a direct message to a specific user
          </p>
        </div>
      </div>

      <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
        <p className="font-medium mb-1">Dynamic Recipients:</p>
        <p>
          You can also use variables like{" "}
          <code className="bg-background px-1 rounded">{`{{userEmail}}`}</code>{" "}
          to send messages dynamically based on trigger data.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="username">Bot Username</Label>
          <Input
            id="username"
            value={slackConfig.username || "EchoAI Bot"}
            onChange={(e) => updateConfig({ username: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="iconEmoji">Icon Emoji</Label>
          <Input
            id="iconEmoji"
            value={slackConfig.iconEmoji || ":robot_face:"}
            onChange={(e) => updateConfig({ iconEmoji: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="includeAttachment"
          checked={slackConfig.includeContext || false}
          onCheckedChange={(checked) =>
            updateConfig({ includeContext: checked })
          }
        />
        <Label htmlFor="includeAttachment">
          Include rich attachment with conversation details
        </Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="mentionUser"
          checked={slackConfig.includeTriggerData || false}
          onCheckedChange={(checked) =>
            updateConfig({ includeTriggerData: checked })
          }
        />
        <Label htmlFor="mentionUser">
          Include trigger data and workflow information
        </Label>
      </div>
    </div>
  );
}

export function GoogleSheetsConfigForm({
  config,
  onChange,
}: {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
}) {
  const [spreadsheets, setSpreadsheets] = useState<
    Array<{
      id: string;
      name: string;
      sheets: Array<{ id: string; title: string }>;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");

  const checkGoogleSheetsConnection = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/integrations/google-sheets/status");
      const data = await response.json();

      if (data.connected) {
        setConnectionStatus("connected");
        await loadSpreadsheets();
      } else {
        setConnectionStatus("disconnected");
      }
    } catch (error) {
      console.error("Error checking Google Sheets connection:", error);
      setConnectionStatus("disconnected");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkGoogleSheetsConnection();
  }, [checkGoogleSheetsConnection]);

  const loadSpreadsheets = async () => {
    try {
      const response = await fetch(
        "/api/integrations/google-sheets/spreadsheets"
      );
      if (response.ok) {
        const data = await response.json();
        setSpreadsheets(data.spreadsheets || []);
      }
    } catch (error) {
      console.error("Error loading spreadsheets:", error);
    }
  };

  if (connectionStatus === "disconnected") {
    return (
      <div className="space-y-4">
        <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">
              Google Sheets Not Connected
            </h3>
          </div>
          <p className="text-sm text-yellow-700 mb-3">
            You need to connect your Google account before configuring this
            action.
          </p>
          <Button
            onClick={() => window.open("/integrations", "_blank")}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            Connect Google Account
          </Button>
        </div>
      </div>
    );
  }

  const selectedSpreadsheet = spreadsheets.find(
    (s) => s.id === (config as any).spreadsheetId
  );

  return (
    <div className="space-y-4">
      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="font-medium text-green-800 mb-1">Data Logging</h4>
        <p className="text-sm text-green-700">
          Log conversation data to Google Sheets. Use variables like{" "}
          {`{{userEmail}}, {{message}}, {{timestamp}}`}
        </p>
      </div>

      <div>
        <Label htmlFor="spreadsheet">Spreadsheet</Label>
        <Select
          value={(config as any).spreadsheetId || ""}
          onValueChange={(value) =>
            onChange({
              ...config,
              spreadsheetId: value,
              sheetId: "",
            } as ActionConfig)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a spreadsheet" />
          </SelectTrigger>
          <SelectContent>
            {spreadsheets.map((spreadsheet) => (
              <SelectItem key={spreadsheet.id} value={spreadsheet.id}>
                {spreadsheet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSpreadsheet && (
        <div>
          <Label htmlFor="sheet">Sheet</Label>
          <Select
            value={(config as any).sheetId || ""}
            onValueChange={(value) =>
              onChange({ ...config, sheetId: value } as ActionConfig)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a sheet" />
            </SelectTrigger>
            <SelectContent>
              {selectedSpreadsheet.sheets.map((sheet) => (
                <SelectItem key={sheet.id} value={sheet.id}>
                  {sheet.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="operation">Operation</Label>
        <Select
          value={(config as any).operation || "append"}
          onValueChange={(value) =>
            onChange({ ...config, operation: value } as ActionConfig)
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="append">Append new row</SelectItem>
            <SelectItem value="update">Update existing row</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Data Mapping</Label>
        <div className="space-y-2 mt-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Column A (e.g., Email)"
              value={(config as any).columnA || "{{userEmail}}"}
              onChange={(e) =>
                onChange({ ...config, columnA: e.target.value } as ActionConfig)
              }
            />
            <Input
              placeholder="Column B (e.g., Name)"
              value={(config as any).columnB || "{{userName}}"}
              onChange={(e) =>
                onChange({ ...config, columnB: e.target.value } as ActionConfig)
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Column C (e.g., Message)"
              value={(config as any).columnC || "{{message}}"}
              onChange={(e) =>
                onChange({ ...config, columnC: e.target.value } as ActionConfig)
              }
            />
            <Input
              placeholder="Column D (e.g., Timestamp)"
              value={(config as any).columnD || "{{timestamp}}"}
              onChange={(e) =>
                onChange({ ...config, columnD: e.target.value } as ActionConfig)
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Column E (e.g., Sentiment)"
              value={(config as any).columnE || "{{sentimentScore}}"}
              onChange={(e) =>
                onChange({ ...config, columnE: e.target.value } as ActionConfig)
              }
            />
            <Input
              placeholder="Column F (e.g., Company)"
              value={(config as any).columnF || "{{company}}"}
              onChange={(e) =>
                onChange({ ...config, columnF: e.target.value } as ActionConfig)
              }
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Map conversation data to spreadsheet columns. Leave empty to skip
          columns.
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="includeHeaders"
          checked={(config as any).includeHeaders !== false}
          onCheckedChange={(checked) =>
            onChange({ ...config, includeHeaders: checked } as ActionConfig)
          }
        />
        <Label htmlFor="includeHeaders">
          Include headers in first row (if sheet is empty)
        </Label>
      </div>
    </div>
  );
}

export function HubSpotContactConfigForm({
  config,
  onChange,
}: {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
}) {
  const [properties, setProperties] = useState<
    Array<{
      name: string;
      label: string;
      type: string;
      options?: Array<{ label: string; value: string }>;
    }>
  >([]);
  const [pipelines, setPipelines] = useState<
    Array<{
      id: string;
      label: string;
      stages: Array<{ id: string; label: string }>;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");

  const fields = config.fields || {};

  const checkHubSpotConnection = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/integrations/hubspot/status");
      const data = await response.json();

      if (data.connected) {
        setConnectionStatus("connected");
        await loadHubSpotData();
      } else {
        setConnectionStatus("disconnected");
      }
    } catch (error) {
      console.error("Error checking HubSpot connection:", error);
      setConnectionStatus("disconnected");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHubSpotConnection();
  }, [checkHubSpotConnection]);

  const loadHubSpotData = async () => {
    try {
      // Load contact properties
      const propertiesResponse = await fetch(
        "/api/integrations/hubspot/properties/contacts"
      );
      if (propertiesResponse.ok) {
        const propertiesData = await propertiesResponse.json();
        setProperties(propertiesData.properties || []);
      }

      // Load deal pipelines
      const pipelinesResponse = await fetch(
        "/api/integrations/hubspot/pipelines/deals"
      );
      if (pipelinesResponse.ok) {
        const pipelinesData = await pipelinesResponse.json();
        setPipelines(pipelinesData.pipelines || []);
      }
    } catch (error) {
      console.error("Error loading HubSpot data:", error);
    }
  };

  const updateField = (fieldName: string, value: string) => {
    onChange({
      ...config,
      fields: { ...fields, [fieldName]: value },
    });
  };

  if (connectionStatus === "disconnected") {
    return (
      <div className="space-y-4">
        <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <h3 className="font-medium text-yellow-800">
              HubSpot Not Connected
            </h3>
          </div>
          <p className="text-sm text-yellow-700 mb-3">
            You need to connect your HubSpot account before configuring this
            action.
          </p>
          <Button
            onClick={() => window.open("/integrations", "_blank")}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            Connect HubSpot Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-1">Contact Information</h4>
        <p className="text-sm text-blue-700">
          Use variables from the conversation like{" "}
          {`{{userEmail}}, {{userName}}, {{userPhone}}, {{company}}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            value={(fields as any).email || "{{userEmail}}"}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="{{userEmail}}"
          />
        </div>

        <div>
          <Label htmlFor="firstname">First Name</Label>
          <Input
            id="firstname"
            value={(fields as any).firstname || "{{firstName}}"}
            onChange={(e) => updateField("firstname", e.target.value)}
            placeholder="{{firstName}}"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="lastname">Last Name</Label>
          <Input
            id="lastname"
            value={(fields as any).lastname || "{{lastName}}"}
            onChange={(e) => updateField("lastname", e.target.value)}
            placeholder="{{lastName}}"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={(fields as any).phone || "{{userPhone}}"}
            onChange={(e) => updateField("phone", e.target.value)}
            placeholder="{{userPhone}}"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={(fields as any).company || "{{company}}"}
            onChange={(e) => updateField("company", e.target.value)}
            placeholder="{{company}}"
          />
        </div>

        <div>
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={(fields as any).website || ""}
            onChange={(e) => updateField("website", e.target.value)}
            placeholder="{{website}}"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="lifecyclestage">Lifecycle Stage</Label>
        <Select
          value={(fields as any).lifecyclestage || "lead"}
          onValueChange={(value) => updateField("lifecyclestage", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subscriber">Subscriber</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="marketingqualifiedlead">
              Marketing Qualified Lead
            </SelectItem>
            <SelectItem value="salesqualifiedlead">
              Sales Qualified Lead
            </SelectItem>
            <SelectItem value="opportunity">Opportunity</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="lead_source">Lead Source</Label>
        <Input
          id="lead_source"
          value={(fields as any).lead_source || "EchoAI Chatbot"}
          onChange={(e) => updateField("lead_source", e.target.value)}
          placeholder="EchoAI Chatbot"
        />
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="createDeal"
            checked={(config as any).createDeal || false}
            onCheckedChange={(checked) =>
              onChange({ ...config, createDeal: checked } as ActionConfig)
            }
          />
          <Label htmlFor="createDeal">Create associated deal</Label>
        </div>

        {(config as any).createDeal && (
          <div className="space-y-4 pl-6 border-l-2 border-blue-200">
            <div>
              <Label htmlFor="dealname">Deal Name</Label>
              <Input
                id="dealname"
                value={
                  (config as any).dealName || "{{company}} - {{timestamp}}"
                }
                onChange={(e) =>
                  onChange({
                    ...config,
                    dealName: e.target.value,
                  } as ActionConfig)
                }
                placeholder="{{company}} - {{timestamp}}"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Deal Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  value={(config as any).dealAmount || ""}
                  onChange={(e) =>
                    onChange({
                      ...config,
                      dealAmount: e.target.value,
                    } as ActionConfig)
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="pipeline">Pipeline</Label>
                <Select
                  value={(config as any).pipeline || ""}
                  onValueChange={(value) =>
                    onChange({ ...config, pipeline: value } as ActionConfig)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(config as any).pipeline && (
              <div>
                <Label htmlFor="dealstage">Deal Stage</Label>
                <Select
                  value={(config as any).dealStage || ""}
                  onValueChange={(value) =>
                    onChange({ ...config, dealStage: value } as ActionConfig)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines
                      .find((p) => p.id === (config as any).pipeline)
                      ?.stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="updateExisting"
          checked={(config as any).updateExisting !== false}
          onCheckedChange={(checked) =>
            onChange({ ...config, updateExisting: checked } as ActionConfig)
          }
        />
        <Label htmlFor="updateExisting">Update existing contact if found</Label>
      </div>
    </div>
  );
}
