/**
 * Enterprise-grade performance monitoring hooks
 * Real-time performance tracking and optimization
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook for measuring component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    
    if (renderTime > 16) { // Slower than 60fps
      console.warn(`Slow render detected in ${componentName}:`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        renderCount: renderCount.current,
        timestamp: new Date().toISOString(),
      });
    }

    // Track performance metrics
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(`${componentName}-render-${renderCount.current}`);
    }
  });

  return {
    renderCount: renderCount.current,
    measureRender: useCallback(<T>(operation: string, fn: () => T): T => {
      const start = performance.now();
      const result = fn();
      const duration = performance.now() - start;

      console.log(`${componentName} ${operation}:`, `${duration.toFixed(2)}ms`);
      return result;
    }, [componentName]),
  };
}

/**
 * Hook for monitoring API performance
 */
export function useApiPerformance() {
  const metrics = useRef<Map<string, number[]>>(new Map());

  const recordApiCall = useCallback((endpoint: string, duration: number) => {
    if (!metrics.current.has(endpoint)) {
      metrics.current.set(endpoint, []);
    }
    
    const durations = metrics.current.get(endpoint)!;
    durations.push(duration);
    
    // Keep only last 100 measurements
    if (durations.length > 100) {
      durations.shift();
    }

    // Alert on slow API calls
    if (duration > 3000) {
      console.warn(`Slow API call detected:`, {
        endpoint,
        duration: `${duration}ms`,
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
      });
    }
  }, []);

  const getMetrics = useCallback((endpoint: string) => {
    const durations = metrics.current.get(endpoint) || [];
    if (durations.length === 0) return null;

    const sorted = [...durations].sort((a, b) => a - b);
    return {
      count: durations.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  }, []);

  return { recordApiCall, getMetrics };
}

/**
 * Hook for measuring bundle size and loading performance
 */
export function useLoadingPerformance() {
  const { data: performanceData } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      if (typeof window === 'undefined' || !window.performance) {
        return null;
      }

      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      // Calculate key metrics
      const metrics = {
        // Core Web Vitals
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstContentfulPaint: 0,
        
        // Resource loading
        totalResources: resources.length,
        slowResources: resources.filter(r => r.duration > 1000).length,
        
        // Bundle analysis
        jsSize: resources
          .filter(r => r.name.includes('.js'))
          .reduce((sum, r) => sum + (r.transferSize || 0), 0),
        cssSize: resources
          .filter(r => r.name.includes('.css'))
          .reduce((sum, r) => sum + (r.transferSize || 0), 0),
        
        // Network timing
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnection: navigation.connectEnd - navigation.connectStart,
        serverResponse: navigation.responseEnd - navigation.requestStart,
      };

      // Get First Contentful Paint if available
      const fcpEntries = performance.getEntriesByName('first-contentful-paint');
      if (fcpEntries.length > 0) {
        metrics.firstContentfulPaint = fcpEntries[0].startTime;
      }

      return metrics;
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  return performanceData;
}

/**
 * Hook for monitoring memory usage
 */
export function useMemoryMonitoring() {
  const { data: memoryData } = useQuery({
    queryKey: ['memory-usage'],
    queryFn: async () => {
      if (typeof window === 'undefined' || !('memory' in performance)) {
        return null;
      }

      const memory = (performance as any).memory;
      
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    },
    refetchInterval: 5000, // Check every 5 seconds
    refetchOnWindowFocus: false,
  });

  // Alert on high memory usage
  useEffect(() => {
    if (memoryData && memoryData.usagePercentage > 80) {
      console.warn('High memory usage detected:', {
        usage: `${memoryData.usagePercentage.toFixed(1)}%`,
        used: `${(memoryData.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
        total: `${(memoryData.totalJSHeapSize / 1024 / 1024).toFixed(1)}MB`,
      });
    }
  }, [memoryData]);

  return memoryData;
}

/**
 * Hook for debouncing expensive operations
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for optimizing re-renders with shallow comparison
 */
export function useShallowMemo<T extends object>(obj: T): T {
  const ref = useRef<T>(obj);

  // Shallow comparison
  const hasChanged = Object.keys(obj).some(
    key => obj[key as keyof T] !== ref.current[key as keyof T]
  ) || Object.keys(ref.current).length !== Object.keys(obj).length;

  if (hasChanged) {
    ref.current = obj;
  }

  return ref.current;
}
