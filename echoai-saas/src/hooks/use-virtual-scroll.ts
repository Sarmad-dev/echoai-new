"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  enabled?: boolean;
}

interface VirtualScrollResult<T> {
  virtualItems: Array<{
    index: number;
    item: T;
    offsetTop: number;
  }>;
  totalHeight: number;
  scrollElementProps: {
    style: React.CSSProperties;
    onScroll: (e: React.UIEvent<HTMLElement>) => void;
  };
  containerProps: {
    style: React.CSSProperties;
  };
}

export function useVirtualScroll<T>(
  items: T[],
  options: VirtualScrollOptions
): VirtualScrollResult<T> {
  const {
    itemHeight,
    containerHeight,
    overscan = 5,
    enabled = true
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLElement | null>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    scrollElementRef.current = target;
    setScrollTop(target.scrollTop);
  }, []);

  const virtualItems = useMemo(() => {
    if (!enabled || items.length === 0) {
      return items.map((item, index) => ({
        index,
        item,
        offsetTop: index * itemHeight
      }));
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const virtualItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        index: i,
        item: items[i],
        offsetTop: i * itemHeight
      });
    }

    return virtualItems;
  }, [items, scrollTop, itemHeight, containerHeight, overscan, enabled]);

  const totalHeight = items.length * itemHeight;

  const scrollElementProps = {
    style: {
      height: containerHeight,
      overflow: 'auto' as const,
    },
    onScroll: handleScroll,
  };

  const containerProps = {
    style: {
      height: totalHeight,
      position: 'relative' as const,
    },
  };

  return {
    virtualItems,
    totalHeight,
    scrollElementProps,
    containerProps,
  };
}

interface InfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

export function useInfiniteScroll(
  callback: () => void | Promise<void>,
  options: InfiniteScrollOptions = {}
) {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    enabled = true
  } = options;

  const [isFetching, setIsFetching] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const lastElementRef = useCallback((node: HTMLElement | null) => {
    if (!enabled || isFetching) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting) {
          setIsFetching(true);
          try {
            await callback();
          } finally {
            setIsFetching(false);
          }
        }
      },
      { threshold, rootMargin }
    );

    if (node) {
      elementRef.current = node;
      observerRef.current.observe(node);
    }
  }, [callback, enabled, isFetching, threshold, rootMargin]);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { lastElementRef, isFetching };
}

interface LazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useLazyLoad(options: LazyLoadOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const elementRef = useCallback((node: HTMLElement | null) => {
    if (triggerOnce && hasTriggered) return;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            setHasTriggered(true);
            observerRef.current?.disconnect();
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    if (node) {
      observerRef.current.observe(node);
    }
  }, [threshold, rootMargin, triggerOnce, hasTriggered]);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return { elementRef, isVisible };
}

// Performance monitoring hook for scroll performance
export function useScrollPerformanceMonitor(containerRef: React.RefObject<HTMLElement>) {
  const [metrics, setMetrics] = useState({
    fps: 0,
    scrollDelta: 0,
    isSmooth: true
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const lastScrollTopRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measurePerformance = () => {
      const now = performance.now();
      const deltaTime = now - lastTimeRef.current;
      
      if (deltaTime >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / deltaTime);
        setMetrics(prev => ({
          ...prev,
          fps,
          isSmooth: fps >= 50 // Consider 50+ FPS as smooth
        }));
        
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      
      frameCountRef.current++;
      rafRef.current = requestAnimationFrame(measurePerformance);
    };

    const handleScroll = () => {
      const scrollDelta = Math.abs(container.scrollTop - lastScrollTopRef.current);
      lastScrollTopRef.current = container.scrollTop;
      
      setMetrics(prev => ({
        ...prev,
        scrollDelta
      }));
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    rafRef.current = requestAnimationFrame(measurePerformance);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [containerRef]);

  return metrics;
}