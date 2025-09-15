"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Settings } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useIntegrations } from "@/hooks/useIntegrations";

// Import IntegrationStatus from the hook

// Loading skeleton component for integration cards
function IntegrationCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// Error boundary component
function IntegrationError({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        <button
          onClick={retry}
          className="text-sm underline hover:no-underline"
        >
          Try again
        </button>
      </AlertDescription>
    </Alert>
  );
}

// Success/Error message handler component
function CallbackMessageHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const provider = searchParams.get("provider");

    if (success && provider) {
      toast.success(`Successfully connected ${provider}!`, {
        description: success,
        icon: <CheckCircle className="h-4 w-4" />,
      });
    }

    if (error) {
      toast.error("Connection failed", {
        description: error,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    }
  }, [searchParams]);

  return null;
}

// Main integrations page content
function IntegrationsPageContent() {
  const { user, loading: authLoading } = useAuth();

  console.log("🔐 Auth state:", {
    user: user ? { id: user.id, email: user.email } : null,
    authLoading,
  });

  const {
    integrations,
    isLoading,
    error,
    refetch,
    initiateOAuth,
    disconnectIntegration,
    testConnection,
    isConnecting,
    isDisconnecting,
    isTesting,
  } = useIntegrations({
    userId: user?.id,
    onSuccess: (_message) => {
      // Success messages are handled by the hook via toast
    },
    onError: (_error) => {
      // Error messages are handled by the hook via toast
    },
  });

  console.log("📊 Integrations state:", {
    integrationsCount: integrations.length,
    isLoading,
    error,
  });

  // Show loading while authentication is being determined
  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">
            Connect your external services to enhance your chatbot&apos;s
            capabilities
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <IntegrationCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Show error if user is not authenticated
  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You must be logged in to view integrations. Please sign in and try
          again.
        </AlertDescription>
      </Alert>
    );
  }

  const handleConnect = async (providerId: string) => {
    await initiateOAuth(providerId);
  };

  const handleDisconnect = async (integrationId: string) => {
    await disconnectIntegration(integrationId);
  };

  const handleTestConnection = async (integrationId: string) => {
    await testConnection(integrationId);
  };

  if (error) {
    return <IntegrationError error={error} retry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your external services to enhance your chatbot&apos;s
          capabilities
        </p>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? // Loading skeletons
            Array.from({ length: 6 }).map((_, i) => (
              <IntegrationCardSkeleton key={i} />
            ))
          : // Integration cards
            integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onTestConnection={handleTestConnection}
                isLoading={isConnecting || isDisconnecting || isTesting}
              />
            ))}
      </div>

      {/* Empty state */}
      {!isLoading && integrations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Settings className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No integrations available</h3>
              <p className="text-muted-foreground max-w-md">
                Integration providers are not configured. Please check your
                environment configuration.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Main page component with Suspense boundary
export default function IntegrationsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <Suspense fallback={<div>Loading...</div>}>
          <CallbackMessageHandler />
          <IntegrationsPageContent />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
