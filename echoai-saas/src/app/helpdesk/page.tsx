"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoleBasedAccess } from "@/hooks/use-role-based-access";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Headphones,
  MessageSquare,
  Users,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { ConversationTable } from "@/components/helpdesk/conversation-table";
import {
  ConversationFiltersComponent,
  useConversationFilters,
} from "@/components/helpdesk/conversation-filters";
import { ConversationStatus } from "@/types/database";
import { useRealtimeConversations } from "@/hooks/use-realtime-conversations";
import { useConversationsApi } from "@/hooks/use-conversations-api";

export default function HelpDeskPage() {
  const { hasHelpDeskAccess } = useRoleBasedAccess();
  const { loading, userProfile, user } = useAuth();
  const router = useRouter();

  // API hook for fetching conversations
  const {
    conversations: apiConversations,
    loading: apiLoading,
    error: apiError,
    totalCount,
    hasMore,
    currentPage,
    refetch,
    setFilters: setApiFilters,
    nextPage,
    prevPage,
  } = useConversationsApi({
    initialParams: {
      page: 1,
      limit: 50, // Fetch more conversations for better real-time integration
      sortBy: "updatedAt",
      sortOrder: "desc",
    },
    autoFetch: true,
  });

  // Real-time conversations hook - now uses API data as initial data
  const {
    conversations: realtimeConversations,
    connectionStatus,
    highlightedRows,
    reconnect: reconnectRealtime,
  } = useRealtimeConversations({
    initialConversations: apiConversations,
    onConversationUpdate: (conversation) => {
      console.log("🔄 Conversation updated:", conversation.id);
    },
    onNewConversation: (conversation) => {
      console.log("🆕 New conversation:", conversation.id);
      // Optionally refetch to ensure we have the latest data
      refetch();
    },
    onConversationStatusChange: (conversationId, status) => {
      console.log("📊 Status changed:", conversationId, status);
    },
  });

  // Conversation filters hook
  const {
    filters,
    filteredConversations,
    setFilters,
    setFilteredConversations,
  } = useConversationFilters(realtimeConversations);

  // Update realtime conversations when API data changes
  useEffect(() => {
    if (apiConversations.length > 0) {
      // The useRealtimeConversations hook will automatically update when initialConversations change
    }
  }, [apiConversations]);

  useEffect(() => {
    // Only redirect if we're not loading and we have a user but no profile or no access
    if (!loading && user && (!userProfile || !hasHelpDeskAccess())) {
      console.log('🚫 Redirecting to unauthorized - user:', !!user, 'profile:', !!userProfile, 'hasAccess:', hasHelpDeskAccess());
      router.push("/unauthorized");
    }
  }, [hasHelpDeskAccess, loading, router, user, userProfile]);

  // Handle filter changes by updating API filters
  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
    // Also update API filters to fetch filtered data from server
    setApiFilters({
      status: newFilters.status,
      assignedTo: newFilters.assignedTo,
      search: newFilters.search,
    });
  };

  if (loading || apiLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasHelpDeskAccess()) {
    return null; // Will redirect to unauthorized
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Help Desk</h1>
          </div>
          <Button asChild variant="outline">
            <a href="/dashboard">Back to Dashboard</a>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Error Alert */}
          {apiError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Failed to load conversations: {apiError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refetch}
                  className="ml-2"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Overview Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Conversations
                </CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {
                    filteredConversations.filter(
                      (c) =>
                        c.status === ConversationStatus.AI_HANDLING ||
                        c.status === ConversationStatus.AWAITING_HUMAN_RESPONSE
                    ).length
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Awaiting Response
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {
                    filteredConversations.filter(
                      (c) =>
                        c.status === ConversationStatus.AWAITING_HUMAN_RESPONSE
                    ).length
                  }
                </div>
                <p className="text-xs text-muted-foreground">Needs attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Assigned Conversations
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {filteredConversations.filter((c) => c.assignedTo).length}
                </div>
                <p className="text-xs text-muted-foreground">With agents</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Conversations
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCount}</div>
                <p className="text-xs text-muted-foreground">
                  {filteredConversations.length > 0
                    ? `Avg: ${Math.round(
                        filteredConversations.reduce(
                          (acc, c) => acc + c.duration,
                          0
                        ) / filteredConversations.length
                      )}m`
                    : "No data"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Conversation Filters */}
          <ConversationFiltersComponent
            conversations={realtimeConversations}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onFilteredConversationsChange={setFilteredConversations}
          />

          {/* Pagination Controls */}
          {(hasMore || currentPage > 1) && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filteredConversations.length} of {totalCount}{" "}
                conversations
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={currentPage <= 1 || apiLoading}
                >
                  Previous
                </Button>
                <span className="text-sm">Page {currentPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={!hasMore || apiLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Conversation Table */}
          <ConversationTable
            conversations={filteredConversations}
            loading={apiLoading}
            highlightedRows={highlightedRows}
            connectionStatus={connectionStatus}
            onReconnect={reconnectRealtime}
          />
        </div>
      </main>
    </div>
  );
}
