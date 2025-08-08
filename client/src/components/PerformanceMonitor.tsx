/**
 * Enterprise-grade performance monitoring component
 * Real-time performance metrics and diagnostics
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Clock,
  HardDrive,
  MemoryStick,
  Zap,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useLoadingPerformance, useMemoryMonitoring } from '@/hooks/usePerformance';

interface PerformanceMonitorProps {
  show?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

/**
 * Real-time performance monitoring overlay
 */
export function PerformanceMonitor({ 
  show = false, 
  position = 'bottom-right',
  className 
}: PerformanceMonitorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [performanceAlerts, setPerformanceAlerts] = useState<string[]>([]);
  
  const loadingPerformance = useLoadingPerformance();
  const memoryData = useMemoryMonitoring();

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  // Performance thresholds
  const thresholds = {
    domContentLoaded: 1500, // 1.5s
    loadComplete: 3000, // 3s
    firstContentfulPaint: 1800, // 1.8s
    memoryUsage: 80, // 80%
    slowResources: 5, // 5 slow resources
  };

  // Check for performance issues
  useEffect(() => {
    const alerts: string[] = [];

    if (loadingPerformance) {
      if (loadingPerformance.domContentLoaded > thresholds.domContentLoaded) {
        alerts.push('Slow DOM loading detected');
      }
      if (loadingPerformance.loadComplete > thresholds.loadComplete) {
        alerts.push('Slow page load detected');
      }
      if (loadingPerformance.firstContentfulPaint > thresholds.firstContentfulPaint) {
        alerts.push('Slow First Contentful Paint');
      }
      if (loadingPerformance.slowResources > thresholds.slowResources) {
        alerts.push(`${loadingPerformance.slowResources} slow resources`);
      }
    }

    if (memoryData && memoryData.usagePercentage > thresholds.memoryUsage) {
      alerts.push('High memory usage');
    }

    setPerformanceAlerts(alerts);
  }, [loadingPerformance, memoryData]);

  if (!show) return null;

  // Format file size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Get performance status
  const getPerformanceStatus = () => {
    if (performanceAlerts.length === 0) return 'good';
    if (performanceAlerts.length <= 2) return 'warning';
    return 'poor';
  };

  const status = getPerformanceStatus();

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-50 ${className}`}
      style={{ maxWidth: isExpanded ? '400px' : '200px' }}
    >
      {!isExpanded ? (
        // Collapsed view
        <Card className="shadow-lg cursor-pointer" onClick={() => setIsExpanded(true)}>
          <CardContent className="p-3">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span className="text-sm font-medium">Performance</span>
              <Badge 
                variant={status === 'good' ? 'default' : status === 'warning' ? 'secondary' : 'destructive'}
                className="ml-auto"
              >
                {status === 'good' && <CheckCircle className="h-3 w-3 mr-1" />}
                {status !== 'good' && <AlertTriangle className="h-3 w-3 mr-1" />}
                {status.toUpperCase()}
              </Badge>
            </div>
            
            {memoryData && (
              <div className="mt-2 text-xs text-muted-foreground">
                Memory: {memoryData.usagePercentage.toFixed(1)}%
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        // Expanded view
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center space-x-2">
                <Activity className="h-4 w-4" />
                <span>Performance Monitor</span>
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-3">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-3">
                <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                <TabsTrigger value="loading" className="text-xs">Loading</TabsTrigger>
                <TabsTrigger value="memory" className="text-xs">Memory</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-2">
                {/* Performance alerts */}
                {performanceAlerts.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-destructive">Issues Detected:</h4>
                    {performanceAlerts.map((alert, index) => (
                      <div key={index} className="flex items-center space-x-1 text-xs">
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {loadingPerformance && (
                    <>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>DOM: {formatDuration(loadingPerformance.domContentLoaded)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Zap className="h-3 w-3" />
                        <span>Load: {formatDuration(loadingPerformance.loadComplete)}</span>
                      </div>
                    </>
                  )}
                  
                  {memoryData && (
                    <>
                      <div className="flex items-center space-x-1">
                        <MemoryStick className="h-3 w-3" />
                        <span>Memory: {memoryData.usagePercentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center space-x-1">
                      <HardDrive className="h-3 w-3" />
                        <span>Heap: {formatBytes(memoryData.usedJSHeapSize)}</span>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="loading" className="space-y-2">
                {loadingPerformance ? (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>DOM Ready:</div>
                      <div className="font-mono">{formatDuration(loadingPerformance.domContentLoaded)}</div>
                      
                      <div>Load Complete:</div>
                      <div className="font-mono">{formatDuration(loadingPerformance.loadComplete)}</div>
                      
                      <div>First Paint:</div>
                      <div className="font-mono">
                        {loadingPerformance.firstContentfulPaint > 0 
                          ? formatDuration(loadingPerformance.firstContentfulPaint)
                          : 'N/A'
                        }
                      </div>
                      
                      <div>DNS Lookup:</div>
                      <div className="font-mono">{formatDuration(loadingPerformance.dnsLookup)}</div>
                      
                      <div>TCP Connect:</div>
                      <div className="font-mono">{formatDuration(loadingPerformance.tcpConnection)}</div>
                      
                      <div>Server Response:</div>
                      <div className="font-mono">{formatDuration(loadingPerformance.serverResponse)}</div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="grid grid-cols-2 gap-2">
                        <div>Resources:</div>
                        <div className="font-mono">{loadingPerformance.totalResources}</div>
                        
                        <div>Slow Resources:</div>
                        <div className="font-mono text-destructive">{loadingPerformance.slowResources}</div>
                        
                        <div>JS Size:</div>
                        <div className="font-mono">{formatBytes(loadingPerformance.jsSize)}</div>
                        
                        <div>CSS Size:</div>
                        <div className="font-mono">{formatBytes(loadingPerformance.cssSize)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Loading performance data...</div>
                )}
              </TabsContent>

              <TabsContent value="memory" className="space-y-2">
                {memoryData ? (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>Used Heap:</div>
                      <div className="font-mono">{formatBytes(memoryData.usedJSHeapSize)}</div>
                      
                      <div>Total Heap:</div>
                      <div className="font-mono">{formatBytes(memoryData.totalJSHeapSize)}</div>
                      
                      <div>Heap Limit:</div>
                      <div className="font-mono">{formatBytes(memoryData.jsHeapSizeLimit)}</div>
                      
                      <div>Usage:</div>
                      <div className={`font-mono ${memoryData.usagePercentage > 80 ? 'text-destructive' : ''}`}>
                        {memoryData.usagePercentage.toFixed(1)}%
                      </div>
                    </div>
                    
                    {/* Memory usage bar */}
                    <div className="mt-2">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            memoryData.usagePercentage > 80 
                              ? 'bg-destructive' 
                              : memoryData.usagePercentage > 60 
                                ? 'bg-yellow-500' 
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(memoryData.usagePercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Memory data not available</div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
