"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { HubSpotConfigDialog } from "./HubSpotConfigDialog";
import { GoogleSheetsConfigDialog } from "./GoogleSheetsConfigDialog";

interface Provider {
  id: string;
  name: string;
  description: string;
  configured: boolean;
  missingConfig: string[];
  connected: boolean;
  integration: {
    id: string;
    isActive: boolean;
    createdAt: string;
  } | null;
}

interface IntegrationsHubProps {
  userId: string;
}

export function IntegrationsHub({ userId }: IntegrationsHubProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null
  );
  const [testingIntegration, setTestingIntegration] = useState<string | null>(
    null
  );
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [googleSheetsConfigOpen, setGoogleSheetsConfigOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  useEffect(() => {
    fetchIntegrations();

    // Check for OAuth callback results in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const error = urlParams.get("error");
    const provider = urlParams.get("provider");

    if (success && provider) {
      toast.success("Integration Connected", {
        description: `${provider} has been successfully connected.`,
      });
      // Clean up URL params
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh integrations
      setTimeout(fetchIntegrations, 1000);
    } else if (error) {
      toast.error("Integration Failed", { description: error });
      // Clean up URL params
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch(`/api/integrations?userId=${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch integrations");
      }
      const data = await response.json();
      setProviders(data.providers);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      toast.error("Error", { description: "Failed to load integrations" });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    setConnectingProvider(providerId);
    try {
      const response = await fetch("/api/integrations/oauth/authorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: providerId,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate OAuth flow");
      }

      const data = await response.json();

      // Redirect to OAuth provider
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Error connecting integration:", error);
      toast.error("Connection Failed", {
        description: "Failed to initiate connection. Please try again.",
      });
    } finally {
      setConnectingProvider(null);
    }
  };

  const handleTest = async (integrationId: string, providerName: string) => {
    setTestingIntegration(integrationId);
    try {
      const response = await fetch("/api/integrations/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrationId,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to test integration");
      }

      const result = await response.json();

      if (result.success) {
        toast.success("Connection Test Successful", {
          description: `${providerName} integration is working correctly.${
            result.refreshed ? " Token was refreshed." : ""
          }`,
        });
      } else {
        toast.error("Connection Test Failed", {
          description: result.error || "Integration test failed",
        });
      }
    } catch (error) {
      console.error("Error testing integration:", error);
      toast.error("Test Failed", {
        description: "Failed to test integration connection",
      });
    } finally {
      setTestingIntegration(null);
    }
  };

  const handleDisconnect = async (
    integrationId: string,
    providerName: string
  ) => {
    if (
      !confirm(
        `Are you sure you want to disconnect ${providerName}? This will stop all automation workflows using this integration.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/api/integrations?integrationId=${integrationId}&userId=${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to disconnect integration");
      }

      toast("Integration Disconnected", {
        description: `${providerName} has been disconnected.`,
      });

      // Refresh integrations
      fetchIntegrations();
    } catch (error) {
      console.error("Error disconnecting integration:", error);
      toast("Disconnect Failed", {
        description: "Failed to disconnect integration",
      });
    }
  };

  const handleConfigure = (integrationId: string, providerId: string) => {
    setSelectedIntegration(integrationId);
    
    if (providerId === 'hubspot') {
      setConfigDialogOpen(true);
    } else if (providerId === 'google') {
      setGoogleSheetsConfigOpen(true);
    } else {
      toast.info('Configuration UI not yet available for this provider');
    }
  };

  const handleSaveConfig = async (config: any) => {
    if (!selectedIntegration) return;

    try {
      const response = await fetch('/api/integrations/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId: selectedIntegration,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      toast.success('Configuration saved successfully');
      fetchIntegrations(); // Refresh integrations
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground">
          Connect your favorite tools to automate workflows and sync data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => (
          <Card key={provider.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {provider.name}
                  {provider.connected && (
                    <Badge variant="secondary" className="text-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </CardTitle>
                {provider.connected && provider.integration && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleDisconnect(provider.integration!.id, provider.name)
                    }
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <CardDescription>{provider.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!provider.configured && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Missing configuration: {provider.missingConfig.join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              {provider.connected && provider.integration ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Connected on{" "}
                      {new Date(
                        provider.integration.createdAt
                      ).toLocaleDateString()}
                    </span>
                    <Badge
                      variant={
                        provider.integration.isActive ? "default" : "secondary"
                      }
                    >
                      {provider.integration.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleTest(provider.integration!.id, provider.name)
                      }
                      disabled={testingIntegration === provider.integration.id}
                      className="flex-1"
                    >
                      {testingIntegration === provider.integration.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test Connection"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleConfigure(provider.integration!.id, provider.id)
                      }
                      className="flex-1"
                    >
                      Configure
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => handleConnect(provider.id)}
                  disabled={
                    !provider.configured || connectingProvider === provider.id
                  }
                  className="w-full"
                >
                  {connectingProvider === provider.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Connect {provider.name}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {providers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No Integrations Available
            </h3>
            <p className="text-muted-foreground text-center">
              Integration providers are not configured. Please check your
              environment variables.
            </p>
          </CardContent>
        </Card>
      )}

      {/* HubSpot Configuration Dialog */}
      <HubSpotConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        integrationId={selectedIntegration || undefined}
        onSave={handleSaveConfig}
      />

      {/* Google Sheets Configuration Dialog */}
      <GoogleSheetsConfigDialog
        open={googleSheetsConfigOpen}
        onOpenChange={setGoogleSheetsConfigOpen}
        integrationId={selectedIntegration || undefined}
        onSave={handleSaveConfig}
      />
    </div>
  );
}
