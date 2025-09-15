"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  User,
  History,
  Search,
  Clock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Hash,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  sentiment?: "positive" | "negative" | "neutral";
  imageUrl?: string;
  status?: "sent" | "delivered" | "failed" | "pending";
  metadata?: {
    processingTime?: number;
    confidence?: number;
    sources?: string[];
    [key: string]: any;
  };
}

export interface ConversationHistory {
  id: string;
  sessionId: string;
  preview: string;
  createdAt: Date;
  messageCount: number;
  chatbotName?: string;
  lastMessage?: string;
  status?: "active" | "archived" | "expired";
}

interface ConversationHistoryProps {
  conversations: ConversationHistory[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onConversationSelect: (conversation: ConversationHistory) => void;
  primaryColor: string;
  className?: string;
}

interface MessageDisplayProps {
  message: ChatMessage;
  primaryColor: string;
  textColor: string;
  isLast?: boolean;
}

const MessageStatusIcon = ({ status }: { status?: string }) => {
  switch (status) {
    case "sent":
      return <CheckCircle2 className="w-3 h-3 text-blue-500" />;
    case "delivered":
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    case "failed":
      return <XCircle className="w-3 h-3 text-red-500" />;
    case "pending":
      return <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />;
    default:
      return null;
  }
};

const SentimentBadge = ({ sentiment }: { sentiment?: string }) => {
  if (!sentiment) return null;

  const colors = {
    positive: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    negative: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    neutral: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800",
  };

  const icons = {
    positive: "😊",
    negative: "😔", 
    neutral: "😐",
  };

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium border", colors[sentiment as keyof typeof colors])}
    >
      <span className="mr-1">{icons[sentiment as keyof typeof icons]}</span>
      {sentiment}
    </Badge>
  );
};

const MessageDisplay: React.FC<MessageDisplayProps> = ({ 
  message, 
  primaryColor, 
  textColor, 
  isLast 
}) => {
  const formatTime = (timestamp: Date) => {
    const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(dateObj);
  };

  const formatContent = (content: string) => {
    // Basic markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div
      className={cn(
        "group flex gap-3 transition-all duration-200 hover:bg-gray-50/50 dark:hover:bg-gray-900/20 p-3 rounded-lg",
        message.role === "user" ? "flex-row-reverse" : "flex-row",
        !isLast && "mb-4"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-transform group-hover:scale-105",
          message.role === "user" 
            ? "bg-gradient-to-br from-blue-500 to-blue-600" 
            : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800"
        )}
        style={message.role === "assistant" ? { 
          background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` 
        } : undefined}
      >
        {message.role === "user" ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={cn(
        "flex-1 min-w-0",
        message.role === "user" ? "text-right" : "text-left"
      )}>
        {/* Message Bubble */}
        <div
          className={cn(
            "inline-block max-w-[85%] rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 group-hover:shadow-md",
            message.role === "user"
              ? "rounded-tr-md text-white"
              : "rounded-tl-md border"
          )}
          style={
            message.role === "user"
              ? {
                  background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                  color: textColor,
                }
              : {
                  background: "var(--background)",
                  borderColor: `${primaryColor}20`,
                  color: "var(--foreground)",
                }
          }
        >
          {/* Image if present */}
          {message.imageUrl && (
            <div className="mb-3">
              <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                <Image
                  src={message.imageUrl}
                  alt="Message attachment"
                  width={300}
                  height={200}
                  className="max-w-full h-auto object-cover"
                  style={{ maxHeight: '200px' }}
                />
                <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                  <ImageIcon className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>
          )}

          {/* Message Text */}
          <div 
            className="text-sm leading-relaxed break-words"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
          />

          {/* Sentiment Badge for Assistant Messages */}
          {message.role === "assistant" && message.sentiment && (
            <div className="mt-2 flex justify-start">
              <SentimentBadge sentiment={message.sentiment} />
            </div>
          )}
        </div>

        {/* Message Metadata */}
        <div className={cn(
          "flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400",
          message.role === "user" ? "justify-end" : "justify-start"
        )}>
          <Clock className="w-3 h-3" />
          <span>{formatTime(message.timestamp)}</span>
          
          {/* Message Status */}
          {message.status && (
            <>
              <Separator orientation="vertical" className="h-3" />
              <MessageStatusIcon status={message.status} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ConversationCard = ({ 
  conversation, 
  primaryColor, 
  onClick 
}: { 
  conversation: ConversationHistory; 
  primaryColor: string; 
  onClick: () => void; 
}) => {
  const formatDate = (date: Date) => {
    const now = new Date();
    const dateObj = date instanceof Date ? date : new Date(date);
    const diffInHours = (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(dateObj);
    } else if (diffInHours < 168) { // 7 days
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(dateObj);
    } else {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(dateObj);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400";
      case "archived":
        return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400";
      case "expired":
        return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400";
    }
  };

  return (
    <Button
      variant="ghost"
      className="w-full h-auto p-0 hover:bg-transparent group"
      onClick={onClick}
    >
      <div 
        className="w-full p-4 rounded-lg border transition-all duration-200 group-hover:shadow-md group-hover:border-opacity-60 text-left"
        style={{
          borderColor: `${primaryColor}20`,
          background: "var(--background)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 
              className="font-medium text-sm truncate group-hover:text-opacity-80 transition-colors"
              style={{ color: primaryColor }}
            >
              {conversation.preview}
            </h4>
            {conversation.lastMessage && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {conversation.lastMessage}
              </p>
            )}
          </div>
          
          {conversation.status && (
            <Badge 
              variant="outline" 
              className={cn("text-xs ml-2 flex-shrink-0", getStatusColor(conversation.status))}
            >
              {conversation.status}
            </Badge>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(conversation.createdAt)}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              <span>{conversation.messageCount}</span>
            </div>
          </div>

          {conversation.chatbotName && (
            <Badge 
              variant="secondary" 
              className="text-xs"
              style={{
                backgroundColor: `${primaryColor}10`,
                color: primaryColor,
                borderColor: `${primaryColor}30`,
              }}
            >
              {conversation.chatbotName}
            </Badge>
          )}
        </div>
      </div>
    </Button>
  );
};

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  conversations,
  isLoading,
  searchQuery,
  onSearchChange,
  onConversationSelect,
  primaryColor,
  className,
}) => {
  const [filteredConversations, setFilteredConversations] = useState<ConversationHistory[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv =>
        conv.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.chatbotName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConversations(filtered);
    }
  }, [conversations, searchQuery]);

  const LoadingSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full" />
            </div>
            <Skeleton className="h-5 w-16 ml-2" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-5 w-12" />
          </div>
        </div>
      ))}
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-12">
      <div 
        className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${primaryColor}10` }}
      >
        <History className="w-8 h-8" style={{ color: primaryColor }} />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        {searchQuery.trim() ? "No conversations found" : "No conversation history"}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {searchQuery.trim() 
          ? "Try adjusting your search terms or clear the search to see all conversations."
          : "Start chatting to see your conversation history here."
        }
      </p>
      {searchQuery.trim() && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSearchChange("")}
          style={{ borderColor: primaryColor, color: primaryColor }}
        >
          Clear search
        </Button>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:border-opacity-60"
            style={{ 
              focusBorderColor: primaryColor,
              '--tw-ring-color': `${primaryColor}20`
            } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredConversations.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-3">
                {filteredConversations.map((conversation) => (
                  <ConversationCard
                    key={conversation.id}
                    conversation={conversation}
                    primaryColor={primaryColor}
                    onClick={() => onConversationSelect(conversation)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer Stats */}
      {!isLoading && filteredConversations.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              <span>
                {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
                {searchQuery.trim() && ` found`}
              </span>
            </div>
            
            {searchQuery.trim() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSearchChange("")}
                className="h-auto p-1 text-xs hover:bg-transparent"
                style={{ color: primaryColor }}
              >
                Show all
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { MessageDisplay };