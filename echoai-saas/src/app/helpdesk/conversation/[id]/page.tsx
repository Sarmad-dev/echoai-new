"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useRoleBasedAccess } from "@/hooks/use-role-based-access";
import { useAuth } from "@/contexts/auth-context";
import { useConversationDetail } from "@/hooks/use-conversation-detail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageHistory } from "@/components/helpdesk/message-history";
import { MessageInput } from "@/components/helpdesk/message-input";
import { CustomerContextSidebar } from "@/components/helpdesk/customer-context-sidebar";
import { ArrowLeft, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ConversationStatus } from "@/types/database";

export default function ConversationDetailPage() {
  const { hasHelpDeskAccess } = useRoleBasedAccess();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const conversationId = params.id as string;

  const { 
    conversation, 
    messages, 
    loading, 
    error, 
    refetch,
    updateConversationStatus,
    sendMessage,
  } = useConversationDetail(conversationId);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !hasHelpDeskAccess()) {
      router.push("/unauthorized");
    }
  }, [hasHelpDeskAccess, authLoading, router]);

  const handleSendMessage = async (content: string) => {
    if (!user || !conversation) return;

    try {
      await sendMessage(content);
      toast.success("Message sent successfully");
    } catch (error) {
      toast.error("Failed to send message", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
      throw error;
    }
  };

  const handleTakeOver = async () => {
    if (!user || !conversation) return;

    try {
      setIsActionLoading(true);
      await updateConversationStatus(ConversationStatus.AWAITING_HUMAN_RESPONSE, user.email);
      toast.success("Conversation taken over successfully");
    } catch (error) {
      toast.error("Failed to take over conversation", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReturnToAI = async () => {
    if (!conversation) return;

    try {
      setIsActionLoading(true);
      await updateConversationStatus(ConversationStatus.AI_HANDLING, null);
      toast.success("Conversation returned to AI successfully");
    } catch (error) {
      toast.error("Failed to return conversation to AI", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!conversation) return;

    try {
      setIsActionLoading(true);
      await updateConversationStatus(ConversationStatus.RESOLVED);
      toast.success("Conversation marked as resolved");
    } catch (error) {
      toast.error("Failed to mark conversation as resolved", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasHelpDeskAccess()) {
    return null; // Will redirect to unauthorized
  }

  if (error) {
    const isNotFound = error.includes("404") || error.includes("not found");
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {isNotFound ? "Conversation Not Found" : "Error Loading Conversation"}
          </h2>
          <p className="text-muted-foreground mb-4">
            {isNotFound 
              ? "The conversation you're looking for doesn't exist or you don't have access to it."
              : error
            }
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => router.push("/helpdesk")} variant="outline">
              Back to Help Desk
            </Button>
            {!isNotFound && (
              <Button onClick={() => refetch()}>Try Again</Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!conversation && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Conversation Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The conversation you're looking for doesn't exist.
          </p>
          <Button onClick={() => router.push("/helpdesk")}>
            Back to Help Desk
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: ConversationStatus) => {
    switch (status) {
      case ConversationStatus.AI_HANDLING:
        return "secondary";
      case ConversationStatus.AWAITING_HUMAN_RESPONSE:
        return "default";
      case ConversationStatus.RESOLVED:
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: ConversationStatus) => {
    switch (status) {
      case ConversationStatus.AI_HANDLING:
        return "AI Handling";
      case ConversationStatus.AWAITING_HUMAN_RESPONSE:
        return "Human Response Needed";
      case ConversationStatus.RESOLVED:
        return "Resolved";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/helpdesk")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Help Desk
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-xl font-semibold">
                Conversation #{conversationId.slice(-8)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {conversation?.customerEmail
                  ? `Customer: ${conversation.customerEmail}`
                  : "Customer support conversation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(conversation?.status || ConversationStatus.AI_HANDLING)}>
              {getStatusLabel(conversation?.status || ConversationStatus.AI_HANDLING)}
            </Badge>
            {conversation?.status === ConversationStatus.AI_HANDLING && (
              <Button
                size="sm"
                onClick={handleTakeOver}
                disabled={isActionLoading}
              >
                Take Over
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-7xl mx-auto">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Conversation Messages */}
          <div className="lg:col-span-3">
            <Card className="h-[calc(100vh-200px)] flex flex-col">
              <CardHeader className="border-b flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversation History
                </CardTitle>
              </CardHeader>

              {/* Messages Area */}
              <CardContent className="flex-1 p-0 overflow-hidden">
                <div className="h-full flex flex-col">
                  {/* Message List - with proper height constraint */}
                  <div className="flex-1 overflow-hidden">
                    <MessageHistory
                      messages={messages}
                      loading={loading}
                      className="h-full"
                      conversationId={conversationId}
                    />
                  </div>

                  {/* Message Input - fixed at bottom */}
                  <div className="flex-shrink-0">
                    <MessageInput
                      onSendMessage={handleSendMessage}
                      disabled={conversation?.status === ConversationStatus.RESOLVED}
                      placeholder={
                        conversation?.status === ConversationStatus.RESOLVED
                          ? "This conversation has been resolved"
                          : conversation?.status === ConversationStatus.AWAITING_HUMAN_RESPONSE
                          ? "Type your response here..."
                          : "Type your message here..."
                      }
                      conversationId={conversationId}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Customer Context Sidebar */}
          {conversation && (
            <CustomerContextSidebar
              conversation={conversation}
              messages={messages}
              onTakeOver={handleTakeOver}
              onReturnToAI={handleReturnToAI}
              onMarkResolved={handleMarkResolved}
              isLoading={isActionLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}
