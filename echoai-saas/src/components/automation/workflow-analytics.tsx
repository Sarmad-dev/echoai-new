"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  Activity,
  Users,
  Zap,
  Download,
  RefreshCw,
} from "lucide-react";

interface WorkflowAnalyticsProps {
  workflowId?: string;
  timeRange?: "1h" | "24h" | "7d" | "30d" | "90d";
  onTimeRangeChange?: (range: string) => void;
}

interface AnalyticsMetrics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  throughput: number;
  activeUsers: number;
  costPerExecution: number;
  trend: {
    executions: number;
    successRate: number;
    executionTime: number;
  };
}

interface ExecutionData {
  timestamp: string;
  executions: number;
  successes: number;
  failures: number;
  averageTime: number;
  throughput: number;
}

interface NodePerformance {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  executionCount: number;
  successRate: number;
  averageExecutionTime: number;
  errorCount: number;
  bottleneckScore: number;
}

interface ErrorAnalysis {
  errorType: string;
  count: number;
  percentage: number;
  lastOccurrence: string;
  affectedNodes: string[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export function WorkflowAnalytics({
  workflowId,
  timeRange = "24h",
  onTimeRangeChange,
}: WorkflowAnalyticsProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [executionData, setExecutionData] = useState<ExecutionData[]>([]);
  const [nodePerformance, setNodePerformance] = useState<NodePerformance[]>([]);
  const [errorAnalysis, setErrorAnalysis] = useState<ErrorAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalyticsData();
  }, [workflowId, timeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Simulate API calls - replace with actual API endpoints
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock data - replace with actual API responses
      setMetrics({
        totalExecutions: 1247,
        successRate: 94.2,
        averageExecutionTime: 2340,
        errorRate: 5.8,
        throughput: 52.3,
        activeUsers: 89,
        costPerExecution: 0.023,
        trend: {
          executions: 12.5,
          successRate: -2.1,
          executionTime: -8.3,
        },
      });

      setExecutionData([
        {
          timestamp: "00:00",
          executions: 45,
          successes: 42,
          failures: 3,
          averageTime: 2100,
          throughput: 45,
        },
        {
          timestamp: "04:00",
          executions: 32,
          successes: 31,
          failures: 1,
          averageTime: 1980,
          throughput: 32,
        },
        {
          timestamp: "08:00",
          executions: 78,
          successes: 74,
          failures: 4,
          averageTime: 2450,
          throughput: 78,
        },
        {
          timestamp: "12:00",
          executions: 95,
          successes: 89,
          failures: 6,
          averageTime: 2680,
          throughput: 95,
        },
        {
          timestamp: "16:00",
          executions: 67,
          successes: 63,
          failures: 4,
          averageTime: 2320,
          throughput: 67,
        },
        {
          timestamp: "20:00",
          executions: 54,
          successes: 52,
          failures: 2,
          averageTime: 2150,
          throughput: 54,
        },
      ]);

      setNodePerformance([
        {
          nodeId: "trigger-1",
          nodeName: "Image Upload Trigger",
          nodeType: "trigger",
          executionCount: 1247,
          successRate: 99.8,
          averageExecutionTime: 120,
          errorCount: 2,
          bottleneckScore: 15,
        },
        {
          nodeId: "condition-1",
          nodeName: "Quality Check",
          nodeType: "condition",
          executionCount: 1245,
          successRate: 96.4,
          averageExecutionTime: 890,
          errorCount: 45,
          bottleneckScore: 72,
        },
        {
          nodeId: "action-1",
          nodeName: "Auto Approve",
          nodeType: "action",
          executionCount: 1200,
          successRate: 94.2,
          averageExecutionTime: 1330,
          errorCount: 70,
          bottleneckScore: 89,
        },
        {
          nodeId: "action-2",
          nodeName: "Send Notification",
          nodeType: "action",
          executionCount: 1200,
          successRate: 98.9,
          averageExecutionTime: 450,
          errorCount: 13,
          bottleneckScore: 23,
        },
      ]);

      setErrorAnalysis([
        {
          errorType: "API Timeout",
          count: 45,
          percentage: 38.5,
          lastOccurrence: "2 hours ago",
          affectedNodes: ["action-1", "action-2"],
        },
        {
          errorType: "Validation Error",
          count: 32,
          percentage: 27.4,
          lastOccurrence: "1 hour ago",
          affectedNodes: ["condition-1"],
        },
        {
          errorType: "Rate Limit",
          count: 23,
          percentage: 19.7,
          lastOccurrence: "30 minutes ago",
          affectedNodes: ["action-1"],
        },
        {
          errorType: "Network Error",
          count: 17,
          percentage: 14.5,
          lastOccurrence: "45 minutes ago",
          affectedNodes: ["action-2"],
        },
      ]);
    } catch (error) {
      console.error("Failed to load analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
    setRefreshing(false);
  };

  const exportData = () => {
    const data = {
      metrics,
      executionData,
      nodePerformance,
      errorAnalysis,
      exportedAt: new Date().toISOString(),
      workflowId,
      timeRange,
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `workflow-analytics-${workflowId}-${timeRange}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getMetricTrend = (value: number) => {
    if (value > 0) {
      return { icon: TrendingUp, color: "text-green-600", prefix: "+" };
    } else if (value < 0) {
      return { icon: TrendingDown, color: "text-red-600", prefix: "" };
    } else {
      return { icon: Activity, color: "text-gray-600", prefix: "" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Workflow Analytics</h2>
          <p className="text-muted-foreground">
            Performance insights and monitoring for your automation workflows
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={onTimeRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>

          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Executions
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.totalExecutions.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {(() => {
                  const trend = getMetricTrend(metrics.trend.executions);
                  return (
                    <>
                      <trend.icon className={`w-3 h-3 mr-1 ${trend.color}`} />
                      <span className={trend.color}>
                        {trend.prefix}
                        {Math.abs(metrics.trend.executions)}%
                      </span>
                      <span className="ml-1">from last period</span>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.successRate}%</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {(() => {
                  const trend = getMetricTrend(metrics.trend.successRate);
                  return (
                    <>
                      <trend.icon className={`w-3 h-3 mr-1 ${trend.color}`} />
                      <span className={trend.color}>
                        {trend.prefix}
                        {Math.abs(metrics.trend.successRate)}%
                      </span>
                      <span className="ml-1">from last period</span>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Execution Time
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(metrics.averageExecutionTime / 1000).toFixed(1)}s
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                {(() => {
                  const trend = getMetricTrend(metrics.trend.executionTime);
                  return (
                    <>
                      <trend.icon className={`w-3 h-3 mr-1 ${trend.color}`} />
                      <span className={trend.color}>
                        {trend.prefix}
                        {Math.abs(metrics.trend.executionTime)}%
                      </span>
                      <span className="ml-1">from last period</span>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeUsers}</div>
              <div className="text-xs text-muted-foreground">
                ${metrics.costPerExecution.toFixed(3)} per execution
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
          <TabsTrigger value="nodes">Node Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution Trend</CardTitle>
                <CardDescription>Workflow executions over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={executionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="executions"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success vs Failure Rate</CardTitle>
                <CardDescription>Execution outcomes over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={executionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="successes"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Successes"
                    />
                    <Line
                      type="monotone"
                      dataKey="failures"
                      stroke="#ef4444"
                      strokeWidth={2}
                      name="Failures"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution Time Trend</CardTitle>
                <CardDescription>
                  Average execution time over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={executionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [`${value}ms`, "Execution Time"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="averageTime"
                      stroke="#f59e0b"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Throughput</CardTitle>
                <CardDescription>Executions per hour</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={executionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="throughput" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Distribution</CardTitle>
                <CardDescription>Breakdown of error types</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={errorAnalysis}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ errorType, percentage }) =>
                        `${errorType} (${percentage}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {errorAnalysis.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Details</CardTitle>
                <CardDescription>Recent error analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {errorAnalysis.map((error, index) => (
                    <div
                      key={error.errorType}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                        <div>
                          <div className="font-medium">{error.errorType}</div>
                          <div className="text-sm text-muted-foreground">
                            {error.count} occurrences • Last:{" "}
                            {error.lastOccurrence}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline">{error.percentage}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="nodes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Node Performance Analysis</CardTitle>
              <CardDescription>
                Individual node execution metrics and bottleneck identification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {nodePerformance.map((node) => (
                  <div key={node.nodeId} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{node.nodeType}</Badge>
                        <span className="font-medium">{node.nodeName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {node.bottleneckScore > 70 && (
                          <Badge variant="destructive">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Bottleneck
                          </Badge>
                        )}
                        {node.bottleneckScore > 40 &&
                          node.bottleneckScore <= 70 && (
                            <Badge variant="secondary">
                              <Clock className="w-3 h-3 mr-1" />
                              Slow
                            </Badge>
                          )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Executions</div>
                        <div className="font-medium">
                          {node.executionCount.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Success Rate
                        </div>
                        <div className="font-medium">{node.successRate}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Time</div>
                        <div className="font-medium">
                          {node.averageExecutionTime}ms
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Errors</div>
                        <div className="font-medium text-red-600">
                          {node.errorCount}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
