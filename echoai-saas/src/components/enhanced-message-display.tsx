"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Image as ImageIcon,
  Zap,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StreamingText } from "@/components/streaming-text";
import { ConversationStatus } from "@/types/database";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant" | "agent";
  createdAt: Date;
  sentiment?: "positive" | "negative" | "neutral";
  imageUrl?: string;
  status?: "sent" | "delivered" | "failed" | "pending";
  isStreaming?: boolean;
  metadata?: {
    processingTime?: number;
    confidence?: number;
    sources?: string[];
  };
}

interface EnhancedMessageDisplayProps {
  message: ChatMessage;
  primaryColor: string;
  textColor: string;
  isLast?: boolean;
  showTimestamp?: boolean;
  showStatus?: boolean;
  showActions?: boolean;
  conversationStatus?: ConversationStatus;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: "positive" | "negative") => void;
  className?: string;
}

interface MessageActionsProps {
  message: ChatMessage;
  primaryColor: string;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: "positive" | "negative") => void;
}

const MessageStatusIcon = ({ status }: { status?: string }) => {
  const iconProps = { className: "w-3 h-3" };

  switch (status) {
    case "sent":
      return <CheckCircle2 {...iconProps} className="w-3 h-3 text-blue-500" />;
    case "delivered":
      return <CheckCircle2 {...iconProps} className="w-3 h-3 text-green-500" />;
    case "failed":
      return <XCircle {...iconProps} className="w-3 h-3 text-red-500" />;
    case "pending":
      return (
        <Loader2
          {...iconProps}
          className="w-3 h-3 text-gray-400 animate-spin"
        />
      );
    default:
      return null;
  }
};

const SentimentBadge = ({ sentiment }: { sentiment?: string }) => {
  if (!sentiment) return null;

  const sentimentConfig = {
    positive: {
      color:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
      icon: "😊",
      label: "Positive",
    },
    negative: {
      color:
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
      icon: "😔",
      label: "Negative",
    },
    neutral: {
      color:
        "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800",
      icon: "😐",
      label: "Neutral",
    },
  };

  const config = sentimentConfig[sentiment as keyof typeof sentimentConfig];
  if (!config) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium border transition-all duration-200 hover:scale-105",
        config.color
      )}
    >
      <span className="mr-1.5">{config.icon}</span>
      {config.label}
    </Badge>
  );
};

const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  primaryColor,
  onCopy,
  onFeedback,
}) => {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"positive" | "negative" | null>(
    null
  );

  const handleCopy = async () => {
    if (onCopy) {
      onCopy(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFeedback = (type: "positive" | "negative") => {
    if (onFeedback) {
      onFeedback(message.id, type);
      setFeedback(type);
    }
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      {/* Copy Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800"
        title="Copy message"
      >
        {copied ? (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3 text-gray-500" />
        )}
      </Button>

      {/* Feedback Buttons (for assistant and agent messages) */}
      {(message.role === "assistant" || message.role === "agent") && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFeedback("positive")}
            className={cn(
              "h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800",
              feedback === "positive" && "bg-green-100 dark:bg-green-900/20"
            )}
            title="Good response"
          >
            <ThumbsUp
              className={cn(
                "w-3 h-3",
                feedback === "positive"
                  ? "text-green-600 fill-current"
                  : "text-gray-500"
              )}
            />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleFeedback("negative")}
            className={cn(
              "h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-800",
              feedback === "negative" && "bg-red-100 dark:bg-red-900/20"
            )}
            title="Poor response"
          >
            <ThumbsDown
              className={cn(
                "w-3 h-3",
                feedback === "negative"
                  ? "text-red-600 fill-current"
                  : "text-gray-500"
              )}
            />
          </Button>
        </>
      )}
    </div>
  );
};

const TypingAnimation = ({ primaryColor }: { primaryColor: string }) => (
  <div className="flex items-center gap-1 py-2">
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full animate-pulse"
          style={{
            backgroundColor: primaryColor,
            animationDelay: `${i * 0.2}s`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
    <span className="text-xs text-gray-500 ml-2">AI is typing...</span>
  </div>
);

const MessageMetadata = ({ message }: { message: ChatMessage }) => {
  if (!message.metadata) return null;

  const { processingTime, confidence, sources } = message.metadata;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      {processingTime && (
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>{processingTime}ms</span>
        </div>
      )}

      {confidence && (
        <div className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>{Math.round(confidence * 100)}% confident</span>
        </div>
      )}

      {sources && sources.length > 0 && (
        <div className="flex items-center gap-1">
          <span>Sources: {sources.length}</span>
        </div>
      )}
    </div>
  );
};

export const EnhancedMessageDisplay: React.FC<EnhancedMessageDisplayProps> = ({
  message,
  primaryColor,
  textColor,
  isLast = false,
  showTimestamp = true,
  showStatus = true,
  showActions = true,
  conversationStatus = ConversationStatus.AI_HANDLING,
  onCopy,
  onFeedback,
  className,
}) => {
  const messageRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  console.log("Message Display: ", message)

  // Intersection observer for animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (messageRef.current) {
      observer.observe(messageRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const formatTime = (timestamp: Date) => {
    const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
    
    console.log("Message Date: ", timestamp)
    // Check if the date is valid
    // if (isNaN(dateObj.getTime())) {
    //   return "Invalid time";
    // }
    
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(dateObj);
  };

  const formatContent = (content: string) => {
    // Debug logging for content formatting
    console.log("🔧 Format Content Debug:", {
      original: content,
      originalLength: content.length,
      hasSpaces: content.includes(" "),
      spacesCount: (content.match(/ /g) || []).length,
    });

    // Enhanced markdown-like formatting with better styling and proper spacing
    const formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono border">$1</code>'
      )
      .replace(
        /```([\s\S]*?)```/g,
        '<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm font-mono border overflow-x-auto mt-2 mb-2"><code>$1</code></pre>'
      )
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
      )
      .replace(/\n\n/g, "<br><br>") // Handle double line breaks first
      .replace(/\n/g, "<br>") // Then single line breaks
      .trim(); // Remove leading/trailing whitespace but preserve internal spacing

    console.log("🔧 Format Content Result:", {
      formatted: formatted,
      formattedLength: formatted.length,
      hasSpacesAfter: formatted.includes(" "),
      spacesCountAfter: (formatted.match(/ /g) || []).length,
    });

    return formatted;
  };

  return (
    <div
      ref={messageRef}
      className={cn(
        "group flex gap-3 transition-all duration-300 hover:bg-gray-50/50 dark:hover:bg-gray-900/20 p-1 rounded-xl",
        message.role === "user" ? "flex-row-reverse" : "flex-row",
        !isLast && "mb-4",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:shadow-md",
          message.role === "user"
            ? "bg-gradient-to-br from-blue-500 to-blue-600 ring-2 ring-blue-100 dark:ring-blue-900/30"
            : message.role === "agent"
            ? "bg-gradient-to-br from-green-500 to-green-600 ring-2 ring-green-100 dark:ring-green-900/30"
            : "ring-2 ring-gray-100 dark:ring-gray-800"
        )}
        style={
          message.role === "assistant"
            ? ({
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                "--tw-ring-color": `${primaryColor}20`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {message.role === "user" ? (
          <User className="w-4 h-4 text-white" />
        ) : message.role === "agent" ? (
          <Headphones className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "flex-1 min-w-0",
          message.role === "user" ? "text-right" : "text-left"
        )}
      >
        {/* Message Bubble */}
        <div
          className={cn(
            "inline-block max-w-[95%] rounded-2xl px-2 py-2 shadow-sm transition-all duration-200 group-hover:shadow-md relative",
            message.role === "user"
              ? "rounded-tr-md text-white"
              : "rounded-tl-md border backdrop-blur-sm bg-white dark:bg-gray-800"
          )}
          style={
            message.role === "user"
              ? {
                  background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                  color: textColor,
                  boxShadow: `0 4px 12px ${primaryColor}20`,
                }
              : message.role === "agent"
              ? {
                  backgroundColor: "rgb(240 253 244)", // Light green background
                  borderColor: "rgb(34 197 94 / 0.2)", // Green border
                  color: "rgb(15 23 42)", // Dark text for better contrast
                  boxShadow: "0 1px 3px rgba(34, 197, 94, 0.1)",
                }
              : {
                  backgroundColor: "rgb(248 250 252)", // Light gray background
                  borderColor: `${primaryColor}20`,
                  color: "rgb(15 23 42)", // Dark text for better contrast
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }
          }
        >
          {/* Streaming Indicator */}
          {message.isStreaming && message.role === "assistant" && (
            <div className="absolute -top-1 -right-1">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          )}

          {/* Image if present */}
          {message.imageUrl && (
            <div className="mb-3">
              <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 group/image">
                <Image
                  src={message.imageUrl}
                  alt="Message attachment"
                  width={300}
                  height={200}
                  className="max-w-full h-auto object-cover transition-transform duration-200 group-hover/image:scale-105"
                  style={{ maxHeight: "200px" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity duration-200" />
                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200">
                  <ImageIcon className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>
          )}

          {/* Message Text */}
          {message.isStreaming && !message.content && conversationStatus !== ConversationStatus.AWAITING_HUMAN_RESPONSE ? (
            <TypingAnimation primaryColor={primaryColor} />
          ) : message.isStreaming && message.content ? (
            <StreamingText
              content={message.content}
              speed={25}
              enableCursor={true}
              formatMarkdown={true}
              isStreaming={true}
              enableVirtualScroll={message.content.length > 2000}
              containerHeight={300}
              enableAutoScroll={true}
              maxHeight={400}
              className="text-sm leading-relaxed break-words whitespace-pre-wrap"
            />
          ) : message.content.length > 2000 ? (
            <StreamingText
              content={message.content}
              speed={0}
              enableCursor={false}
              formatMarkdown={true}
              isStreaming={false}
              enableVirtualScroll={true}
              containerHeight={300}
              enableAutoScroll={false}
              maxHeight={400}
              className="text-sm leading-relaxed break-words whitespace-pre-wrap"
            />
          ) : (
            <div
              className="text-sm leading-relaxed break-words debug-message-content"
              style={{
                wordSpacing: "normal",
                letterSpacing: "normal",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
              }}
              dangerouslySetInnerHTML={{
                __html: formatContent(message.content),
              }}
            />
          )}

          {/* Agent Label */}
          {message.role === "agent" && (
            <div className="mt-2 flex justify-start">
              <Badge
                variant="outline"
                className="text-xs font-medium border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
              >
                <Headphones className="w-3 h-3 mr-1" />
                Support Agent
              </Badge>
            </div>
          )}

          {/* Sentiment Badge for Assistant Messages */}
          {message.role === "assistant" && message.sentiment && conversationStatus !== ConversationStatus.AWAITING_HUMAN_RESPONSE && (
            <div className="mt-3 flex justify-start">
              <SentimentBadge sentiment={message.sentiment} />
            </div>
          )}

          {/* Message Metadata */}
          <MessageMetadata message={message} />
        </div>

        {/* Message Footer */}
        <div
          className={cn(
            "flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400",
            message.role === "user" ? "justify-end" : "justify-between"
          )}
        >
          {/* Timestamp and Status */}
          <div className="flex items-center gap-2">
            {showTimestamp && (
              <>
                <Clock className="w-3 h-3" />
                <span>{formatTime(message.createdAt)}</span>
              </>
            )}

            {showStatus && message.status && (
              <>
                <Separator orientation="vertical" className="h-3" />
                <MessageStatusIcon status={message.status} />
              </>
            )}
          </div>

          {/* Actions */}
          {showActions && (message.role === "assistant" || message.role === "agent") && (
            <MessageActions
              message={message}
              primaryColor={primaryColor}
              onCopy={onCopy}
              onFeedback={onFeedback}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedMessageDisplay;
