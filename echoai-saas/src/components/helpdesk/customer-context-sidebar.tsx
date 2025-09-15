"use client";

import { Conversation, Message } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Globe,
  Clock,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
  Calendar,
  Brain,
  AlertTriangle,
  Target,
  Lightbulb,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useConversationIntelligence } from "@/hooks/use-conversation-intelligence";

interface CustomerContextSidebarProps {
  conversation: Conversation;
  messages: Message[];
  onTakeOver?: () => void;
  onReturnToAI?: () => void;
  onMarkResolved?: () => void;
  isLoading?: boolean;
}

export function CustomerContextSidebar({
  conversation,
  messages,
  onTakeOver,
  onReturnToAI,
  onMarkResolved,
  isLoading = false,
}: CustomerContextSidebarProps) {
  const { intelligence, loading: intelligenceLoading } =
    useConversationIntelligence(conversation.id);
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "AI_HANDLING":
        return "secondary";
      case "AWAITING_HUMAN_RESPONSE":
        return "default";
      case "RESOLVED":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "AI_HANDLING":
        return "AI Handling";
      case "AWAITING_HUMAN_RESPONSE":
        return "Human Response Needed";
      case "RESOLVED":
        return "Resolved";
      default:
        return status;
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "negative":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "neutral":
        return <Minus className="h-4 w-4 text-gray-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getOverallSentiment = () => {
    const sentimentMessages = messages.filter((m) => m.sentiment);
    if (sentimentMessages.length === 0) return "neutral";

    const sentimentCounts = sentimentMessages.reduce((acc, msg) => {
      acc[msg.sentiment!] = (acc[msg.sentiment!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(sentimentCounts).reduce((a, b) =>
      sentimentCounts[a[0]] > sentimentCounts[b[0]] ? a : b
    )[0];
  };

  const getConversationDuration = () => {
    if (messages.length === 0) return "0m";

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    try {
      const firstDate = new Date(firstMessage.createdAt);
      const lastDate = new Date(lastMessage.createdAt);

      if (isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) {
        return "Invalid duration";
      }

      const duration = lastDate.getTime() - firstDate.getTime();
      const minutes = Math.floor(duration / (1000 * 60));
      const seconds = Math.floor((duration % (1000 * 60)) / 1000);

      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }
      return `${seconds}s`;
    } catch {
      return "Invalid duration";
    }
  };

  const overallSentiment = getOverallSentiment();

  const generateAnalysisTags = () => {
    if (!intelligence?.intelligenceData) return [];

    const tags = [];
    const data = intelligence.intelligenceData;

    // Add tags based on topics covered
    if (data.topicsCovered?.length > 0) {
      data.topicsCovered.forEach((topic) => {
        tags.push({
          label: topic.charAt(0).toUpperCase() + topic.slice(1),
          variant: "secondary" as const,
          icon: <MessageSquare className="h-3 w-3" />,
        });
      });
    }

    // Add escalation risk tag
    if (data.escalationRisk > 0.7) {
      tags.push({
        label: "High Escalation Risk",
        variant: "destructive" as const,
        icon: <AlertTriangle className="h-3 w-3" />,
      });
    } else if (data.escalationRisk > 0.4) {
      tags.push({
        label: "Medium Escalation Risk",
        variant: "outline" as const,
        icon: <AlertTriangle className="h-3 w-3" />,
      });
    }

    // Add lead potential tag
    if (data.leadPotential > 0.6) {
      tags.push({
        label: "High Lead Potential",
        variant: "default" as const,
        icon: <Target className="h-3 w-3" />,
      });
    }

    // Add knowledge gaps
    if (data.knowledgeGapsFound?.length > 0) {
      data.knowledgeGapsFound.forEach((gap) => {
        tags.push({
          label: `Gap: ${gap}`,
          variant: "outline" as const,
          icon: <Lightbulb className="h-3 w-3" />,
        });
      });
    }

    // Add user goals
    if (data.userGoalsIdentified?.length > 0) {
      data.userGoalsIdentified.forEach((goal) => {
        tags.push({
          label: `Goal: ${goal}`,
          variant: "secondary" as const,
          icon: <Target className="h-3 w-3" />,
        });
      });
    }

    return tags;
  };

  const analysisMetrics = intelligence?.intelligenceData
    ? [
        {
          label: "Context Understanding",
          value: Math.round(
            intelligence.intelligenceData.contextUnderstanding * 100
          ),
          color:
            intelligence.intelligenceData.contextUnderstanding > 0.7
              ? "text-green-600"
              : intelligence.intelligenceData.contextUnderstanding > 0.4
              ? "text-yellow-600"
              : "text-red-600",
        },
        {
          label: "User Satisfaction",
          value: Math.round(
            intelligence.intelligenceData.userSatisfactionPrediction * 100
          ),
          color:
            intelligence.intelligenceData.userSatisfactionPrediction > 0.7
              ? "text-green-600"
              : intelligence.intelligenceData.userSatisfactionPrediction > 0.4
              ? "text-yellow-600"
              : "text-red-600",
        },
        {
          label: "Conversation Flow",
          value: Math.round(
            intelligence.intelligenceData.conversationFlowScore * 100
          ),
          color:
            intelligence.intelligenceData.conversationFlowScore > 0.7
              ? "text-green-600"
              : intelligence.intelligenceData.conversationFlowScore > 0.4
              ? "text-yellow-600"
              : "text-red-600",
        },
        {
          label: "Lead Potential",
          value: Math.round(intelligence.intelligenceData.leadPotential * 100),
          color:
            intelligence.intelligenceData.leadPotential > 0.6
              ? "text-green-600"
              : intelligence.intelligenceData.leadPotential > 0.3
              ? "text-yellow-600"
              : "text-gray-600",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Customer Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conversation.customerEmail && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{conversation.customerEmail}</span>
            </div>
          )}
          {conversation.source && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{conversation.source}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Started{" "}
              {(() => {
                try {
                  const date = new Date(conversation.createdAt);
                  return isNaN(date.getTime())
                    ? "Invalid date"
                    : format(date, "MMM d, yyyy HH:mm");
                } catch {
                  return "Invalid date";
                }
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {(() => {
                try {
                  const date = new Date(conversation.createdAt);
                  return isNaN(date.getTime())
                    ? "Invalid date"
                    : formatDistanceToNow(date, { addSuffix: true });
                } catch {
                  return "Invalid date";
                }
              })()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={getStatusBadgeVariant(conversation.status)}>
              {getStatusLabel(conversation.status)}
            </Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Sentiment</span>
            <div className="flex items-center gap-1">
              {getSentimentIcon(overallSentiment)}
              <Badge variant="outline" className="capitalize">
                {overallSentiment}
              </Badge>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Messages</span>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{messages.length}</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Duration</span>
            <span className="text-sm">{getConversationDuration()}</span>
          </div>
          {conversation.assignedTo && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Assigned To</span>
              <span className="text-sm font-medium">
                {conversation.assignedTo}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {conversation.status === "AI_HANDLING" && (
            <Button
              className="w-full"
              size="sm"
              onClick={onTakeOver}
              disabled={isLoading}
            >
              Take Over Conversation
            </Button>
          )}
          {conversation.status === "AWAITING_HUMAN_RESPONSE" && (
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={onReturnToAI}
              disabled={isLoading}
            >
              Return to AI
            </Button>
          )}
          {conversation.status !== "RESOLVED" && (
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={onMarkResolved}
              disabled={isLoading}
            >
              Mark as Resolved
            </Button>
          )}
        </CardContent>
      </Card>

      {/* AI Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {intelligenceLoading ? (
            <div className="text-xs text-muted-foreground">
              Loading AI analysis...
            </div>
          ) : intelligence ? (
            <>
              {/* Analysis Tags */}
              <div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {generateAnalysisTags().map((tag, index) => (
                    <Badge
                      key={index}
                      variant={tag.variant}
                      className="text-xs flex items-center gap-1"
                    >
                      {tag.icon}
                      {tag.label}
                    </Badge>
                  ))}
                </div>
                {generateAnalysisTags().length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No specific tags identified
                  </p>
                )}
              </div>

              {/* Topics Covered */}
              {intelligence.intelligenceData.topicsCovered?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Topics Covered
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {intelligence.intelligenceData.topicsCovered.map(
                      (topic, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs"
                        >
                          {topic.charAt(0).toUpperCase() + topic.slice(1)}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Analysis Metrics */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">
                  Performance Metrics
                </h4>
                {analysisMetrics.map((metric, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center"
                  >
                    <span className="text-xs text-muted-foreground">
                      {metric.label}
                    </span>
                    <span className={`text-xs font-medium ${metric.color}`}>
                      {metric.value}%
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                AI-generated analysis based on conversation intelligence
              </p>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">
              No AI analysis available for this conversation
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
