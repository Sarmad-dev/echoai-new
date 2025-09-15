"use client";

import { useCallback, useRef, useEffect } from "react";

interface SmoothScrollOptions {
  behavior?: "smooth" | "auto";
  block?: "start" | "center" | "end" | "nearest";
  inline?: "start" | "center" | "end" | "nearest";
  offset?: number;
}

export function useSmoothScroll(options: SmoothScrollOptions = {}) {
  const {
    behavior = "smooth",
    block = "end",
    inline = "nearest",
    offset = 0,
  } = options;

  const scrollToElement = useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;

      // Use native scrollIntoView with smooth behavior
      element.scrollIntoView({
        behavior,
        block,
        inline,
      });

      // Apply offset if needed
      if (offset !== 0) {
        setTimeout(() => {
          const container =
            element.closest("[data-scroll-container]") || window;
          if (container === window) {
            window.scrollBy(0, offset);
          } else {
            (container as HTMLElement).scrollTop += offset;
          }
        }, 100);
      }
    },
    [behavior, block, inline, offset]
  );

  const scrollToBottom = useCallback(
    (container?: HTMLElement | null) => {
      if (container) {
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const maxScrollTop = scrollHeight - clientHeight;

        if (behavior === "smooth") {
          container.scrollTo({
            top: maxScrollTop,
            behavior: "smooth",
          });
        } else {
          container.scrollTop = maxScrollTop;
        }
      } else {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior,
        });
      }
    },
    [behavior]
  );

  const scrollToTop = useCallback(
    (container?: HTMLElement | null) => {
      if (container) {
        if (behavior === "smooth") {
          container.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        } else {
          container.scrollTop = 0;
        }
      } else {
        window.scrollTo({
          top: 0,
          behavior,
        });
      }
    },
    [behavior]
  );

  return {
    scrollToElement,
    scrollToBottom,
    scrollToTop,
  };
}

export function useAutoScroll(
  dependency: any,
  containerRef: React.RefObject<HTMLElement>,
  options: SmoothScrollOptions & {
    enabled?: boolean;
    delay?: number;
    threshold?: number;
  } = {}
) {
  const { enabled = true, delay = 100, threshold = 50 } = options;
  const { scrollToBottom } = useSmoothScroll(options);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track user scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isUserScrollingRef.current = true;

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Reset user scrolling flag after a delay
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 1000);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [containerRef]);

  // Auto-scroll when dependency changes
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const scrollTop = container.scrollTop;
    const maxScrollTop = scrollHeight - clientHeight;

    // Only auto-scroll if user is near the bottom or not actively scrolling
    const isNearBottom = maxScrollTop - scrollTop <= threshold;
    const shouldAutoScroll = !isUserScrollingRef.current || isNearBottom;

    if (shouldAutoScroll) {
      const timeoutId = setTimeout(() => {
        scrollToBottom(container);
      }, delay);

      return () => clearTimeout(timeoutId);
    }
  }, [dependency, enabled, delay, threshold, scrollToBottom, containerRef]);
}

export function useScrollPerformance(
  containerRef: React.RefObject<HTMLElement>
) {
  const rafRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScrollStart = () => {
      if (!isScrollingRef.current) {
        isScrollingRef.current = true;
        // Add scrolling class for performance optimizations
        container.classList.add("is-scrolling");
      }
    };

    const handleScrollEnd = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        isScrollingRef.current = false;
        container.classList.remove("is-scrolling");
      });
    };

    const handleScroll = () => {
      handleScrollStart();
      handleScrollEnd();
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [containerRef]);

  return {
    isScrolling: isScrollingRef.current,
  };
}
