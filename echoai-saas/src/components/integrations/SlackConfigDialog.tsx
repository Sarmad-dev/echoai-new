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
import { Loader2, CheckCircle, AlertTriangle, Hash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const slackConfigSchema = z.object({
  scopes: z.array(z.string()).min(1, "At least one scope is required"),
  defaultChannel: z.string().optional(),
  defaultUsername: z.string(),
  defaultIconEmoji: z.string(),
  notificationSettings: z.object({
    enableNotifications: z.boolean(),
    urgentChannel: z.string().optional(),
    errorChannel: z.string().optional(),
    generalChannel: z.string().optional(),
  }),
  messageTemplates: z.object({
    newConversation: z.string().optional(),
    negativeSentiment: z.string().optional(),
    highValueLead: z.string().optional(),
    imageUploaded: z.string().optional(),
  }),
  autoJoinChannels: z.boolean(),
  includeContextByDefault: z.boolean(),
  retryOnRateLimit: z.boolean(),
  maxRetries: z.number().min(1).max(10),
});

type SlackConfigForm = z.infer<typeof slackConfigSchema>;

interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_private: boolean;
  is_archived: boolean;
  is_member: boolean;
  num_members?: number;
}

// interface SlackUser {
//   id: string;
//   name: string;
//   real_name: string;
//   is_bot: boolean;
//   deleted: boolean;
//   profile: {
//     display_name: string;
//     email?: string;
//     image_24: string;
//   };
// }

interface SlackConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId?: string;
  onSave: (config: SlackConfigForm) => Promise<void>;
}

const AVAILABLE_SCOPES = [
  {
    id: "chat:write",
    label: "Send Messages",
    description: "Send messages to channels and users",
    required: true,
  },
  {
    id: "chat:write.public",
    label: "Send to Public Channels",
    description: "Send messages to public channels without joining",
    required: true,
  },
  {
    id: "channels:read",
    label: "Read Public Channels",
    description: "View information about public channels",
    required: false,
  },
  {
    id: "groups:read",
    label: "Read Private Channels",
    description: "View information about private channels",
    required: false,
  },
  {
    id: "im:read",
    label: "Read Direct Messages",
    description: "View information about direct messages",
    required: false,
  },
  {
    id: "users:read",
    label: "Read Users",
    description: "View information about workspace users",
    required: false,
  },
  {
    id: "users:read.email",
    label: "Read User Emails",
    description: "View user email addresses",
    required: false,
  },
];

const DEFAULT_MESSAGE_TEMPLATES = {
  newConversation:
    "🆕 New conversation started with {{userEmail}}\\n\\n*First message:* {{message}}",
  negativeSentiment:
    "😟 Negative sentiment detected ({{sentimentScore}}) from {{userEmail}}\\n\\n*Message:* {{message}}",
  highValueLead:
    "💎 High-value lead qualified: {{userEmail}}\\n\\n*Company:* {{company}}\\n*Lead Score:* {{leadScore}}",
  imageUploaded:
    "📷 Image uploaded by {{userEmail}}\\n\\n*Analysis:* {{analysisResult}}",
};

export function SlackConfigDialog({
  open,
  onOpenChange,
  integrationId,
  onSave,
}: SlackConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean;
    error?: string;
    teamName?: string;
    userName?: string;
  } | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  // const [users] = useState<SlackUser[]>([]);

  const form = useForm<SlackConfigForm>({
    resolver: zodResolver(slackConfigSchema),
    defaultValues: {
      scopes: ["chat:write", "chat:write.public"],
      defaultUsername: "EchoAI Bot",
      defaultIconEmoji: ":robot_face:",
      notificationSettings: {
        enableNotifications: true,
      },
      messageTemplates: DEFAULT_MESSAGE_TEMPLATES,
      autoJoinChannels: false,
      includeContextByDefault: true,
      retryOnRateLimit: true,
      maxRetries: 3,
    },
  });

  useEffect(() => {
    if (open && integrationId) {
      loadSlackData();
    }
  }, [open, integrationId]);

  const loadSlackData = async () => {
    if (!integrationId) return;

    setLoading(true);
    try {
      // Test connection first
      await testConnection();

      // Load channels and users in parallel
      const [channelsResponse, usersResponse] = await Promise.all([
        fetch(
          `/api/integrations/slack/channels?integrationId=${integrationId}`
        ),
        fetch(`/api/integrations/slack/users?integrationId=${integrationId}`),
      ]);

      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        setChannels(channelsData.channels || []);

        // Set default channel if available
        const generalChannel = channelsData.channels?.find(
          (c: SlackChannel) => c.name === "general" || c.name === "random"
        );
        if (generalChannel) {
          form.setValue("defaultChannel", `#${generalChannel.name}`);
          form.setValue(
            "notificationSettings.generalChannel",
            `#${generalChannel.name}`
          );
        }
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        // setUsers(usersData.users || []);
        console.log("Users loaded:", usersData.users?.length || 0);
      }
    } catch (error) {
      console.error("Error loading Slack data:", error);
      toast.error("Failed to load Slack configuration data");
    } finally {
      setLoading(false);
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
      setConnectionStatus({
        success: false,
        error: "Failed to test connection",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async (data: SlackConfigForm) => {
    try {
      await onSave(data);
      onOpenChange(false);
      toast.success("Slack configuration saved successfully");
    } catch (error) {
      console.error("Failed to save configuration:", error);
      toast.error("Failed to save configuration");
    }
  };

  const formatChannelOption = (channel: SlackChannel) => {
    const prefix = channel.is_private ? "🔒" : "#";
    const memberCount = channel.num_members
      ? ` (${channel.num_members} members)`
      : "";
    return `${prefix}${channel.name}${memberCount}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img
              src="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png"
              alt="Slack"
              className="w-6 h-6"
            />
            Slack Integration Configuration
          </DialogTitle>
          <DialogDescription>
            Configure your Slack integration settings, channels, and message
            templates for automation workflows.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading Slack configuration...</span>
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
                        {connectionStatus.teamName && (
                          <span className="ml-2">
                            Workspace: {connectionStatus.teamName}
                          </span>
                        )}
                        {connectionStatus.userName && (
                          <span className="ml-2">
                            • User: {connectionStatus.userName}
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
                    Select the Slack permissions your automation workflows will
                    need.
                  </p>
                </div>

                <FormField
                  control={form.control as any}
                  name="scopes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                  ? field.value.filter(
                                      (s: string) => s !== scope.id
                                    )
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

              {/* Default Settings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Default Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure default values for Slack messages sent by
                    automation workflows.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="defaultChannel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Channel</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select default channel" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {channels
                              .filter((channel) => !channel.is_archived)
                              .map((channel) => (
                                <SelectItem
                                  key={channel.id}
                                  value={`#${channel.name}`}
                                >
                                  <div className="flex items-center gap-2">
                                    {channel.is_private ? (
                                      <div className="w-4 h-4 flex items-center justify-center">
                                        🔒
                                      </div>
                                    ) : (
                                      <Hash className="w-4 h-4" />
                                    )}
                                    <span>{channel.name}</span>
                                    {channel.num_members && (
                                      <span className="text-xs text-muted-foreground">
                                        ({channel.num_members})
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Default channel for automation messages when none is
                          specified
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defaultUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Bot Username</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="EchoAI Bot" />
                        </FormControl>
                        <FormDescription>
                          Username displayed for bot messages
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defaultIconEmoji"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Icon Emoji</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder=":robot_face:" />
                        </FormControl>
                        <FormDescription>
                          Emoji icon for bot messages (e.g., :robot_face:)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Notification Channels */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Notification Channels</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure specific channels for different types of
                    notifications.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="notificationSettings.enableNotifications"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Enable Notifications
                        </FormLabel>
                        <FormDescription>
                          Allow automation workflows to send Slack notifications
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

                {form.watch("notificationSettings.enableNotifications") && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="notificationSettings.generalChannel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>General Notifications</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select channel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {channels
                                .filter((channel) => !channel.is_archived)
                                .map((channel) => (
                                  <SelectItem
                                    key={channel.id}
                                    value={`#${channel.name}`}
                                  >
                                    {formatChannelOption(channel)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notificationSettings.urgentChannel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Urgent Notifications</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select channel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {channels
                                .filter((channel) => !channel.is_archived)
                                .map((channel) => (
                                  <SelectItem
                                    key={channel.id}
                                    value={`#${channel.name}`}
                                  >
                                    {formatChannelOption(channel)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notificationSettings.errorChannel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Error Notifications</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select channel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {channels
                                .filter((channel) => !channel.is_archived)
                                .map((channel) => (
                                  <SelectItem
                                    key={channel.id}
                                    value={`#${channel.name}`}
                                  >
                                    {formatChannelOption(channel)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Message Templates */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Message Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    Customize default message templates for different trigger
                    types. Use template variables like{" "}
                    {`{{userEmail}}, {{message}}, {{timestamp}}`}.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="messageTemplates.newConversation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Conversation</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Template for new conversation notifications"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="messageTemplates.negativeSentiment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Negative Sentiment</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Template for negative sentiment alerts"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="messageTemplates.highValueLead"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>High-Value Lead</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Template for high-value lead notifications"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="messageTemplates.imageUploaded"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image Uploaded</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Template for image upload notifications"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Advanced Settings */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Advanced Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure advanced behavior and error handling options.
                  </p>
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="includeContextByDefault"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Include Context by Default
                          </FormLabel>
                          <FormDescription>
                            Include workflow context information in messages by
                            default
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
                    name="autoJoinChannels"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Auto-Join Channels
                          </FormLabel>
                          <FormDescription>
                            Automatically join channels when sending messages
                            (if bot has permission)
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="retryOnRateLimit"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Retry on Rate Limit
                            </FormLabel>
                            <FormDescription>
                              Automatically retry when rate limited
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
                      name="maxRetries"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Retries</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum number of retry attempts (1-10)
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>
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
