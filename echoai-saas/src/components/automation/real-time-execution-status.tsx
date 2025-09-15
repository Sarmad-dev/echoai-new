"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExecutionStatus } from "@/types/database";

interface ActiveExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  chatbotName: string;
  triggerId: string;
  status: ExecutionStatus;
  startedAt: Date;
  progress?: {
    currentStep: string;
    totalSteps: number;
    completedSteps: number;
  };
}



interface RealTimeExecutionStatusProps {
  workflowId?: string;
  chatbotId?: string;
  className?: string;
}

export function RealTimeExecutionStatus({
  workflowId,
  chatbotId,
  className,
}: RealTimeExecutionStatusProps) {
  const [activeExecutions, setActiveExecutions] = useState<ActiveExecution[]>([]);
  const [recentCompletions, setRecentCompletions] = useState<ActiveExecution[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const loadActiveExecutions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: ExecutionStatus.RUNNING,
        limit: "20",
      });

      if (workflowId) {
        params.append("workflowId", workflowId);
      }

      if (chatbotId) {
        params.append("chatbotId", chatbotId);
      }

      const response = await fetch(`/api/workflows/executions?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const executions = data.data.executions.map((exec: Record<string, unknown>) => ({
            id: exec.id,
            workflowId: exec.workflowId,
            workflowName: exec.workflowName,
            chatbotName: exec.chatbotName,
            triggerId: exec.triggerId,
            status: exec.status,
            startedAt: new Date(exec.startedAt as string),
            progress: generateMockProgress(), // In real implementation, this would come from the execution log
          }));

          setActiveExecutions(executions);
        }
      }
    } catch (error) {
      console.error("Error loading active executions:", error);
    }
  }, [workflowId, chatbotId]);

  const generateMockProgress = () => {
    const totalSteps = Math.floor(Math.random() * 5) + 3;
    const completedSteps = Math.floor(Math.random() * totalSteps);
    return {
      currentStep: `Step ${completedSteps + 1}`,
      totalSteps,
      completedSteps,
    };
  };

  const updateProgress = useCallback((currentProgress?: ActiveExecution['progress']) => {
    if (!currentProgress) return generateMockProgress();
    
    const newCompleted = Math.min(
      currentProgress.completedSteps + 1,
      currentProgress.totalSteps
    );
    
    return {
      ...currentProgress,
      completedSteps: newCompleted,
      currentStep: `Step ${newCompleted + 1}`,
    };
  }, []);

  const simulateExecutionUpdates = useCallback(() => {
    // Simulate some executions completing
    setActiveExecutions(prev => {
      const updated = [...prev];
      const toComplete = updated.splice(0, Math.floor(Math.random() * 2));
      
      // Move completed executions to recent completions
      const completed = toComplete.map(exec => ({
        ...exec,
        status: Math.random() > 0.2 ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED,
      }));

      setRecentCompletions(prevRecent => {
        const newRecent = [...completed, ...prevRecent].slice(0, 10);
        return newRecent;
      });

      // Update progress for remaining executions
      return updated.map(exec => ({
        ...exec,
        progress: updateProgress(exec.progress),
      }));
    });
  }, [updateProgress]);

  // Simulate WebSocket connection for real-time updates
  // In a real implementation, this would connect to a WebSocket server
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let pollInterval: NodeJS.Timeout;

    const connectToUpdates = () => {
      setIsConnected(true);
      setConnectionError(null);

      // Poll for active executions every 2 seconds
      pollInterval = setInterval(async () => {
        try {
          await loadActiveExecutions();
        } catch (error) {
          console.error("Error polling active executions:", error);
          setConnectionError("Failed to fetch execution updates");
        }
      }, 2000);

      // Simulate real-time updates every 5 seconds
      interval = setInterval(() => {
        simulateExecutionUpdates();
      }, 5000);
    };

    const disconnect = () => {
      setIsConnected(false);
      if (interval) clearInterval(interval);
      if (pollInterval) clearInterval(pollInterval);
    };

    connectToUpdates();

    return disconnect;
  }, [workflowId, chatbotId, loadActiveExecutions, simulateExecutionUpdates]);

  const stopExecution = async (executionId: string) => {
    try {
      const response = await fetch(`/api/workflows/executions?executionId=${executionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setActiveExecutions(prev => prev.filter(exec => exec.id !== executionId));
      }
    } catch (error) {
      console.error("Error stopping execution:", error);
    }
  };

  const getStatusIcon = (status: ExecutionStatus) => {
    switch (status) {
      case ExecutionStatus.RUNNING:
        return <Play className="w-4 h-4 text-blue-500 animate-pulse" />;
      case ExecutionStatus.COMPLETED:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case ExecutionStatus.FAILED:
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getProgressPercentage = (progress?: ActiveExecution['progress']) => {
    if (!progress) return 0;
    return (progress.completedSteps / progress.totalSteps) * 100;
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Real-Time Execution Status
                {isConnected && (
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </CardTitle>
              <CardDescription>
                Monitor active workflow executions and recent completions
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              
              {activeExecutions.length > 0 && (
                <Badge variant="secondary">
                  {activeExecutions.length} active
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {connectionError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">{connectionError}</span>
            </div>
          )}

          {/* Active Executions */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Active Executions ({activeExecutions.length})
            </h4>
            
            {activeExecutions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No active executions</p>
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {activeExecutions.map((execution) => (
                    <div
                      key={execution.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(execution.status)}
                          <span className="font-medium text-sm">
                            {execution.workflowName}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {execution.chatbotName}
                          </Badge>
                        </div>
                        
                        <div className="text-xs text-muted-foreground mb-2">
                          Trigger: <code>{execution.triggerId}</code> • 
                          Started: {format(execution.startedAt, "HH:mm:ss")}
                        </div>
                        
                        {execution.progress && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span>{execution.progress.currentStep}</span>
                              <span>
                                {execution.progress.completedSteps}/{execution.progress.totalSteps}
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                style={{
                                  width: `${getProgressPercentage(execution.progress)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => stopExecution(execution.id)}
                        className="ml-3"
                      >
                        <Pause className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Recent Completions */}
          {recentCompletions.length > 0 && (
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Recent Completions
              </h4>
              
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {recentCompletions.map((execution) => (
                    <div
                      key={execution.id}
                      className={`flex items-center justify-between p-2 border rounded text-sm ${
                        execution.status === ExecutionStatus.COMPLETED
                          ? "bg-green-50/50 border-green-200"
                          : "bg-red-50/50 border-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(execution.status)}
                        <span className="font-medium">{execution.workflowName}</span>
                        <Badge variant="outline" className="text-xs">
                          {execution.chatbotName}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {format(execution.startedAt, "HH:mm:ss")}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}