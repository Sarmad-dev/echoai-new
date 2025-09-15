"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Save,
  Palette,
  MessageSquare,
  Type,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { ChatWidgetPreview } from "./chat-widget-preview";
import { useAuth } from "@/contexts/auth-context";
import { User } from "@prisma/client";

// Form validation schema
const customizationSchema = z.object({
  chatbotName: z
    .string()
    .min(1, "Chatbot name is required")
    .max(50, "Chatbot name must be less than 50 characters"),
  welcomeMessage: z
    .string()
    .min(1, "Welcome message is required")
    .max(200, "Welcome message must be less than 200 characters"),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Primary color must be a valid hex color"),
});

type CustomizationFormData = z.infer<typeof customizationSchema>;

interface CustomizationFormProps {
  onSave?: (settings: CustomizationFormData) => void;
}

export function CustomizationForm({ onSave }: CustomizationFormProps) {
  const { user } = useAuth();
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const [saveMessage, setSaveMessage] = useState("");

  const form = useForm<CustomizationFormData>({
    resolver: zodResolver(customizationSchema),
    defaultValues: {
      chatbotName: "EchoAI Assistant",
      welcomeMessage: "Hello! How can I help you today?",
      primaryColor: "#3B82F6",
    },
  });

  const watchedValues = form.watch();

  // Load existing settings from chatbots
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Get the user's chatbots
        const response = await fetch("/api/chatbots");

        if (response.ok) {
          const data = await response.json();
          // Use the first active chatbot's settings, or create default if none exist
          const activeChatbot = data.chatbots.find((c: any) => c.isActive) || data.chatbots[0];
          
          if (activeChatbot) {
            form.reset({
              chatbotName: activeChatbot.name,
              welcomeMessage: activeChatbot.welcomeMessage,
              primaryColor: activeChatbot.primaryColor,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        setSaveStatus("error");
        setSaveMessage("Failed to load existing settings");
      } finally {
        setIsLoading(false);
      }
    };

    const loadUser = async () => {
      try {
        const response = await fetch("/api/user");

        if (response.ok) {
          const user = await response.json();
          setDbUser(user);
        }
      } catch {
        console.error("Error fetching User");
      }
    };

    loadSettings();
    loadUser();
  }, [user, form]);

  // Handle form submission
  const handleSubmit = async (data: CustomizationFormData) => {
    setSaving(true);
    setSaveStatus("idle");
    setSaveMessage("");

    try {
      // Get the user's chatbots to find which one to update
      const chatbotsResponse = await fetch("/api/chatbots");
      if (!chatbotsResponse.ok) {
        throw new Error("Failed to fetch chatbots");
      }
      
      const chatbotsData = await chatbotsResponse.json();
      const activeChatbot = chatbotsData.chatbots.find((c: any) => c.isActive) || chatbotsData.chatbots[0];
      
      if (!activeChatbot) {
        throw new Error("No chatbot found to update");
      }

      // Update the chatbot settings
      const response = await fetch(`/api/chatbots/${activeChatbot.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.chatbotName,
          welcomeMessage: data.welcomeMessage,
          primaryColor: data.primaryColor,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }

      await response.json();

      setSaveStatus("success");
      setSaveMessage("Settings saved successfully!");

      // Call optional callback
      onSave?.(data);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus("idle");
        setSaveMessage("");
      }, 3000);
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">
            Loading customization settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form Section */}
      <div className="space-y-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Chatbot Name */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Chatbot Identity
                </CardTitle>
                <CardDescription>
                  Customize your chatbot&apos;s name and personality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="chatbotName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chatbot Name</FormLabel>
                      <FormControl>
                        <Input placeholder="EchoAI Assistant" {...field} />
                      </FormControl>
                      <FormDescription>
                        This name will appear in the chat widget header
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="welcomeMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Welcome Message</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Hello! How can I help you today?"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The first message visitors will see when they open the
                        chat
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Appearance
                </CardTitle>
                <CardDescription>
                  Customize colors to match your brand
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        This color will be used for the chat widget header and
                        user messages
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Save Status */}
            {saveStatus !== "idle" && (
              <div
                className={`flex items-center gap-2 p-3 border rounded-lg ${
                  saveStatus === "success"
                    ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                    : "border-destructive/50 bg-destructive/10 text-destructive"
                }`}
              >
                {saveStatus === "success" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <p className="text-sm">{saveMessage}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSaving || !form.formState.isDirty}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving Settings...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Customization
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>

      {/* Preview Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Live Preview
            </CardTitle>
            <CardDescription>
              See how your chatbot will appear to visitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 min-h-[400px]">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_50%,rgba(156,146,172,0.1)_0%,transparent_50%)]"></div>
              <div className="relative">
                <p className="text-sm text-muted-foreground mb-4">
                  This is how your chat widget will appear on your website:
                </p>
                {dbUser?.apiKey ? (
                  <ChatWidgetPreview
                    settings={{
                      chatbotName: watchedValues.chatbotName,
                      welcomeMessage: watchedValues.welcomeMessage,
                      primaryColor: watchedValues.primaryColor,
                    }}
                    apiKey={dbUser.apiKey}
                  />
                ) : (
                  <div className="flex items-center justify-center min-h-[200px] bg-muted/50 rounded-lg border-2 border-dashed">
                    <div className="text-center space-y-2">
                      <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Loading chat widget...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {!dbUser ? "Fetching user data..." : "API key not available"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
