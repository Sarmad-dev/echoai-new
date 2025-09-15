"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Clock,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { ConversationStatus } from "@/types/database";
import { formatDistanceToNow } from "date-fns";

// Extended conversation type with metadata for the table
export interface ConversationWithMetadata {
  id: string;
  customerEmail?: string;
  source?: string;
  status: ConversationStatus;
  assignedTo?: string;
  sentimentScore?: number;
  duration: number; // in minutes
  lastMessage: string;
  lastMessageTimestamp: Date;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationTableProps {
  conversations: ConversationWithMetadata[];
  loading?: boolean;
  onConversationClick?: (conversationId: string) => void;
  highlightedRows?: Set<string>;
  connectionStatus?: {
    connected: boolean;
    error?: string;
    lastConnected?: Date;
    reconnectAttempts: number;
  };
  onReconnect?: () => void;
}

type SortField = keyof ConversationWithMetadata;
type SortDirection = "asc" | "desc";

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export function ConversationTable({
  conversations,
  loading = false,
  onConversationClick,
  highlightedRows = new Set(),
  connectionStatus,
  onReconnect,
}: ConversationTableProps) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "updatedAt",
    direction: "desc",
  });

  // Sort conversations based on current sort config
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return 1;
      if (bValue === undefined) return -1;

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;

      return sortConfig.direction === "desc" ? -comparison : comparison;
    });
  }, [conversations, sortConfig]);

  const handleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleRowClick = (conversationId: string) => {
    if (onConversationClick) {
      onConversationClick(conversationId);
    } else {
      router.push(`/helpdesk/conversation/${conversationId}`);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const getStatusBadge = (status: ConversationStatus) => {
    switch (status) {
      case ConversationStatus.AI_HANDLING:
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            AI Handling
          </Badge>
        );
      case ConversationStatus.AWAITING_HUMAN_RESPONSE:
        return (
          <Badge variant="destructive" className="bg-orange-100 text-orange-800">
            Needs Response
          </Badge>
        );
      case ConversationStatus.RESOLVED:
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Resolved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSentimentBadge = (sentimentScore?: number) => {
    if (sentimentScore === undefined) {
      return <Badge variant="outline">Unknown</Badge>;
    }

    if (sentimentScore > 0.1) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          Positive
        </Badge>
      );
    } else if (sentimentScore < -0.1) {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800">
          Negative
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="bg-gray-100 text-gray-800">
          Neutral
        </Badge>
      );
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex space-x-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No conversations found</p>
            <p className="text-sm">
              Conversations will appear here when customers start chatting with
              your embedded widgets.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connection status indicator component
  const ConnectionStatusIndicator = () => {
    if (!connectionStatus) return null;

    return (
      <div className="flex items-center gap-2 text-sm">
        {connectionStatus.connected ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-green-600">Live</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-red-600">
              {connectionStatus.error || "Disconnected"}
            </span>
            {onReconnect && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReconnect}
                className="h-6 px-2"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversations ({conversations.length})
          </CardTitle>
          <ConnectionStatusIndicator />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("id")}
                >
                  ID
                  {getSortIcon("id")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("customerEmail")}
                >
                  Customer
                  {getSortIcon("customerEmail")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("source")}
                >
                  Source
                  {getSortIcon("source")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("status")}
                >
                  Status
                  {getSortIcon("status")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("sentimentScore")}
                >
                  Sentiment
                  {getSortIcon("sentimentScore")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("duration")}
                >
                  Duration
                  {getSortIcon("duration")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("lastMessageTimestamp")}
                >
                  Last Message
                  {getSortIcon("lastMessageTimestamp")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => handleSort("assignedTo")}
                >
                  Assigned To
                  {getSortIcon("assignedTo")}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedConversations.map((conversation) => {
              const isHighlighted = highlightedRows.has(conversation.id);
              return (
              <TableRow
                key={conversation.id}
                className={`cursor-pointer hover:bg-muted/50 transition-colors duration-300 ${
                  isHighlighted 
                    ? "bg-blue-50 border-l-4 border-l-blue-500 animate-pulse" 
                    : ""
                }`}
                onClick={() => handleRowClick(conversation.id)}
              >
                <TableCell className="font-mono text-sm">
                  {conversation.id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[150px]">
                      {conversation.customerEmail || "Anonymous"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[120px] block">
                    {conversation.source || "Unknown"}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(conversation.status)}</TableCell>
                <TableCell>{getSentimentBadge(conversation.sentimentScore)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formatDuration(conversation.duration)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm truncate max-w-[200px]">
                      {conversation.lastMessage}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(conversation.lastMessageTimestamp, {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {conversation.assignedTo ? (
                    <Badge variant="outline">{conversation.assignedTo}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Unassigned
                    </span>
                  )}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}