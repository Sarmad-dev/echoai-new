"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAutoScroll } from "@/hooks/use-smooth-scroll";
import { useVirtualScroll } from "@/hooks/use-virtual-scroll";

export interface StreamingTextProps {
  /** The content to stream/display */
  content: string;
  /** Speed of typing animation in milliseconds per character */
  speed?: number;
  /** Whether to show a blinking cursor */
  enableCursor?: boolean;
  /** Whether to format markdown content */
  formatMarkdown?: boolean;
  /** Callback when streaming completes */
  onComplete?: () => void;
  /** Whether to start streaming immediately */
  autoStart?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Whether the text is currently being streamed from server */
  isStreaming?: boolean;
  /** Callback for each character typed */
  onCharacterTyped?: (char: string, index: number) => void;
  /** Enable virtual scrolling for long content */
  enableVirtualScroll?: boolean;
  /** Container height for virtual scrolling */
  containerHeight?: number;
  /** Enable auto-scroll to bottom during streaming */
  enableAutoScroll?: boolean;
  /** Maximum height before enabling virtual scroll */
  maxHeight?: number;
}

interface StreamingTextState {
  displayedContent: string;
  currentIndex: number;
  isComplete: boolean;
  isTyping: boolean;
}

export const StreamingText: React.FC<StreamingTextProps> = ({
  content,
  speed = 30,
  enableCursor = true,
  formatMarkdown = true,
  onComplete,
  autoStart = true,
  className,
  isStreaming = false,
  onCharacterTyped,
  enableVirtualScroll = false,
  containerHeight = 400,
  enableAutoScroll = true,
  maxHeight = 600,
}) => {
  const [state, setState] = useState<StreamingTextState>({
    displayedContent: "",
    currentIndex: 0,
    isComplete: false,
    isTyping: false,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<string>("");
  const hasStartedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentLinesRef = useRef<string[]>([]);

  // Split content into lines for virtual scrolling
  const contentLines = React.useMemo(() => {
    const lines = (state.displayedContent || "").split("\n");
    contentLinesRef.current = lines;
    return lines;
  }, [state.displayedContent]);

  // Determine if we should use virtual scrolling
  const shouldUseVirtualScroll =
    enableVirtualScroll && contentLines.length > 20;
  const estimatedLineHeight = 24; // Approximate line height in pixels

  // Virtual scroll setup
  const virtualScrollResult = useVirtualScroll(contentLines, {
    itemHeight: estimatedLineHeight,
    containerHeight: containerHeight,
    overscan: 5,
    enabled: shouldUseVirtualScroll,
  });

  // Auto-scroll setup
  useAutoScroll(
    state.displayedContent, // Dependency to trigger auto-scroll
    containerRef as React.RefObject<HTMLElement>,
    {
      enabled: enableAutoScroll && (state.isTyping || isStreaming),
      delay: 50,
      threshold: 100,
      behavior: "smooth",
    }
  );

  // Format content with markdown-like styling
  const formatContent = useCallback(
    (text: string) => {
      if (!formatMarkdown) return text;

      // Debug logging for streaming text formatting
      console.log("🌊 Streaming Format Debug:", {
        original: text,
        hasSpaces: text.includes(" "),
        spacesCount: (text.match(/ /g) || []).length,
      });

      const formatted = text
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

      console.log("🌊 Streaming Format Result:", {
        formatted: formatted,
        hasSpacesAfter: formatted.includes(" "),
        spacesCountAfter: (formatted.match(/ /g) || []).length,
      });

      return formatted;
    },
    [formatMarkdown]
  );

  // Start typing animation
  const startTyping = useCallback(() => {
    if (intervalRef.current || state.isComplete || !content) return;

    setState((prev) => ({ ...prev, isTyping: true }));

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        const nextIndex = prev.currentIndex + 1;
        const nextChar = content[prev.currentIndex];
        const newDisplayedContent = content.slice(0, nextIndex);

        // Call character typed callback
        if (nextChar && onCharacterTyped) {
          onCharacterTyped(nextChar, prev.currentIndex);
        }

        // Check if we've reached the end
        if (nextIndex >= content.length) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          // Call completion callback
          setTimeout(() => {
            onComplete?.();
          }, 100);

          return {
            ...prev,
            displayedContent: newDisplayedContent,
            currentIndex: nextIndex,
            isComplete: true,
            isTyping: false,
          };
        }

        return {
          ...prev,
          displayedContent: newDisplayedContent,
          currentIndex: nextIndex,
        };
      });
    }, speed);
  }, [content, speed, onCharacterTyped, onComplete, state.isComplete]);

  // Stop typing animation
  const stopTyping = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState((prev) => ({ ...prev, isTyping: false }));
  }, []);

  // Reset animation
  const reset = useCallback(() => {
    stopTyping();
    setState({
      displayedContent: "",
      currentIndex: 0,
      isComplete: false,
      isTyping: false,
    });
    hasStartedRef.current = false;
  }, [stopTyping]);

  // Handle content changes
  useEffect(() => {
    // If content changed and we're not streaming, reset and start over
    if (content !== contentRef.current) {
      contentRef.current = content;

      if (!isStreaming) {
        // Content changed completely, reset and start over
        reset();
        if (autoStart && content) {
          setTimeout(startTyping, 50);
          hasStartedRef.current = true;
        }
      } else {
        // We're streaming, just update the target content
        // The typing will continue naturally
      }
    }
  }, [content, isStreaming, autoStart, reset, startTyping]);

  // Handle streaming state changes
  useEffect(() => {
    if (isStreaming && !hasStartedRef.current && content) {
      // Start typing when streaming begins
      startTyping();
      hasStartedRef.current = true;
    } else if (!isStreaming && state.isTyping && content) {
      // When streaming stops, make sure we show all content
      setState((prev) => ({
        ...prev,
        displayedContent: content,
        currentIndex: content.length,
        isComplete: true,
        isTyping: false,
      }));
      stopTyping();
      onComplete?.();
    }
  }, [
    isStreaming,
    content,
    state.isTyping,
    startTyping,
    stopTyping,
    onComplete,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Render virtual scrolled content
  const renderVirtualContent = () => {
    return (
      <div
        ref={containerRef}
        className={cn("relative overflow-auto", className)}
        {...virtualScrollResult.scrollElementProps}
        style={{
          ...virtualScrollResult.scrollElementProps.style,
          maxHeight: maxHeight,
        }}
      >
        <div {...virtualScrollResult.containerProps}>
          {virtualScrollResult.virtualItems.map(
            ({ index, item, offsetTop }) => (
              <div
                key={index}
                className="absolute left-0 right-0 text-sm leading-relaxed break-words"
                style={{
                  top: offsetTop,
                  height: estimatedLineHeight,
                  wordSpacing: "normal",
                  letterSpacing: "normal",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                }}
                dangerouslySetInnerHTML={{
                  __html: formatContent(item),
                }}
              />
            )
          )}

          {/* Cursor at the end of content */}
          {enableCursor && (state.isTyping || isStreaming) && (
            <div
              className="absolute"
              style={{
                top: (contentLines.length - 1) * estimatedLineHeight,
                left: 0,
              }}
            >
              <span
                className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
                style={{
                  backgroundColor: "currentColor",
                  animation: "blink 1s infinite",
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render regular content
  const renderRegularContent = () => {
    const displayContent = state.displayedContent || "";
    const formattedContent = formatContent(displayContent);
    const showCursor = enableCursor && (state.isTyping || isStreaming);

    return (
      <div
        ref={containerRef}
        className={cn("relative", className)}
        style={{
          maxHeight: enableAutoScroll ? maxHeight : undefined,
          overflowY: enableAutoScroll ? "auto" : "visible",
        }}
      >
        <div
          className="text-sm leading-relaxed break-words"
          style={{
            wordSpacing: "normal",
            letterSpacing: "normal",
            lineHeight: "1.6",
            whiteSpace: "pre-wrap",
          }}
          dangerouslySetInnerHTML={{
            __html: formattedContent,
          }}
        />

        {showCursor && (
          <span
            className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
            style={{
              backgroundColor: "currentColor",
              animation: "blink 1s infinite",
            }}
          />
        )}
      </div>
    );
  };

  // If no content, show nothing
  if (!content && !isStreaming) {
    return null;
  }

  return (
    <>
      {shouldUseVirtualScroll ? renderVirtualContent() : renderRegularContent()}

      <style jsx>{`
        @keyframes blink {
          0%,
          50% {
            opacity: 1;
          }
          51%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
};

export default StreamingText;
