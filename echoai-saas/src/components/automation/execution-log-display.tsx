"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  RefreshCw,
  Download,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExecutionStatus } from "@/types/database";

// Utility function to format execution duration
const formatExecutionDuration = (duration?: number) => {
  if (!duration) return "N/A";
  
  if (duration < 1000) {
    return `${duration}ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)}s`;
  } else {
    return `${(duration / 60000).toFixed(1)}m`;
  }
};

interface ExecutionRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  chatbotId: string;
  chatbotName: string;
  triggerId: string;
  triggerData?: Record<string, any>;
  status: ExecutionStatus;
  executionLog?: {
    logs: Array<{
      timestamp: Date;
      level: "info" | "warn" | "error";
      message: string;
      nodeId?: string;
      data?: Record<string, unknown>;
    }>;
    totalLogs: number;
    lastUpdated: string;
    error?: string;
  };
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in milliseconds
}

interface ExecutionLogDisplayProps {
  workflowId?: string;
  chatbotId?: string;
  className?: string;
}

export function ExecutionLogDisplay({
  workflowId,
  chatbotId,
  className,
}: ExecutionLogDisplayProps) {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  const pageSize = 20;

  // Load execution history
  const loadExecutions = async (page = 1) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
      });

      if (workflowId) {
        params.append("workflowId", workflowId);
      }

      if (chatbotId) {
        params.append("chatbotId", chatbotId);
      }

      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      const response = await fetch(`/api/workflows/executions?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setExecutions(data.data.executions);
          setTotalPages(Math.ceil(data.data.total / pageSize));
        }
      } else {
        console.error("Failed to load execution history");
        setExecutions([]);
      }
    } catch (error) {
      console.error("Error loading execution history:", error);
      setExecutions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isAutoRefresh) {
      interval = setInterval(() => {
        loadExecutions(currentPage);
      }, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isAutoRefresh, currentPage, workflowId, chatbotId, statusFilter, searchQuery]);

  // Initial load and filter changes
  useEffect(() => {
    setCurrentPage(1);
    loadExecutions(1);
  }, [workflowId, chatbotId, statusFilter, searchQuery]);

  // Page changes
  useEffect(() => {
    loadExecutions(currentPage);
  }, [currentPage]);

  const getStatusIcon = (status: ExecutionStatus) => {
    switch (status) {
      case ExecutionStatus.PENDING:
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case ExecutionStatus.RUNNING:
        return <Play className="w-4 h-4 text-blue-500" />;
      case ExecutionStatus.COMPLETED:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case ExecutionStatus.FAILED:
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: ExecutionStatus) => {
    const variants = {
      [ExecutionStatus.PENDING]: "secondary",
      [ExecutionStatus.RUNNING]: "default",
      [ExecutionStatus.COMPLETED]: "default",
      [ExecutionStatus.FAILED]: "destructive",
    } as const;

    return (
      <Badge variant={variants[status] || "secondary"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };



  const exportExecutions = () => {
    const csvContent = [
      ["ID", "Workflow", "Chatbot", "Trigger", "Status", "Started At", "Completed At", "Duration"].join(","),
      ...executions.map(execution => [
        execution.id,
        execution.workflowName,
        execution.chatbotName,
        execution.triggerId,
        execution.status,
        format(execution.startedAt, "yyyy-MM-dd HH:mm:ss"),
        execution.completedAt ? format(execution.completedAt, "yyyy-MM-dd HH:mm:ss") : "",
        formatExecutionDuration(execution.duration),
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-executions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Execution History
              </CardTitle>
              <CardDescription>
                Monitor workflow execution logs and performance metrics
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                className={isAutoRefresh ? "bg-green-50 border-green-200" : ""}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isAutoRefresh ? "animate-spin" : ""}`} />
                Auto Refresh
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={exportExecutions}
                disabled={executions.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by workflow name, trigger, or execution ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ExecutionStatus | "ALL")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value={ExecutionStatus.PENDING}>Pending</SelectItem>
                <SelectItem value={ExecutionStatus.RUNNING}>Running</SelectItem>
                <SelectItem value={ExecutionStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={ExecutionStatus.FAILED}>Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Execution Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Chatbot</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-6 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                      <TableCell><div className="h-8 bg-muted rounded animate-pulse" /></TableCell>
                    </TableRow>
                  ))
                ) : executions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No execution records found
                    </TableCell>
                  </TableRow>
                ) : (
                  executions.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell>
                        {getStatusBadge(execution.status)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {execution.workflowName}
                      </TableCell>
                      <TableCell>
                        {execution.chatbotName}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {execution.triggerId}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(execution.startedAt, "MMM dd, HH:mm:ss")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatExecutionDuration(execution.duration)}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedExecution(execution)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Execution Details</DialogTitle>
                              <DialogDescription>
                                Detailed logs and information for execution {execution.id}
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedExecution && (
                              <ExecutionDetailsView execution={selectedExecution} />
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExecutionDetailsView({ execution }: { execution: ExecutionRecord }) {
  return (
    <div className="space-y-6">
      {/* Execution Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Execution Info</h4>
          <div className="space-y-2 text-sm">
            <div><strong>ID:</strong> {execution.id}</div>
            <div><strong>Workflow:</strong> {execution.workflowName}</div>
            <div><strong>Chatbot:</strong> {execution.chatbotName}</div>
            <div><strong>Status:</strong> {execution.status}</div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-2">Timing</h4>
          <div className="space-y-2 text-sm">
            <div><strong>Started:</strong> {format(execution.startedAt, "PPpp")}</div>
            {execution.completedAt && (
              <div><strong>Completed:</strong> {format(execution.completedAt, "PPpp")}</div>
            )}
            <div><strong>Duration:</strong> {formatExecutionDuration(execution.duration)}</div>
          </div>
        </div>
      </div>

      {/* Trigger Data */}
      {execution.triggerData && (
        <div>
          <h4 className="font-medium mb-2">Trigger Data</h4>
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-32">
            {JSON.stringify(execution.triggerData, null, 2)}
          </pre>
        </div>
      )}

      {/* Execution Logs */}
      {execution.executionLog?.logs && (
        <div>
          <h4 className="font-medium mb-2">Execution Logs</h4>
          <ScrollArea className="h-64 border rounded">
            <div className="p-3 space-y-2">
              {execution.executionLog.logs.map((log, index) => (
                <div
                  key={index}
                  className={`text-xs p-2 rounded border-l-2 ${
                    log.level === "error"
                      ? "bg-red-50 border-red-500"
                      : log.level === "warn"
                      ? "bg-yellow-50 border-yellow-500"
                      : "bg-blue-50 border-blue-500"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-muted-foreground">
                      {format(log.timestamp, "HH:mm:ss.SSS")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {log.level.toUpperCase()}
                    </Badge>
                    {log.nodeId && (
                      <Badge variant="secondary" className="text-xs">
                        {log.nodeId}
                      </Badge>
                    )}
                  </div>
                  <div className="font-mono">{log.message}</div>
                  {log.data && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground">
                        Show data
                      </summary>
                      <pre className="mt-1 text-xs bg-muted p-2 rounded">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Error Details */}
      {execution.executionLog?.error && (
        <div>
          <h4 className="font-medium mb-2 text-red-600">Error Details</h4>
          <div className="bg-red-50 border border-red-200 p-3 rounded text-sm">
            {execution.executionLog.error}
          </div>
        </div>
      )}
    </div>
  );
}