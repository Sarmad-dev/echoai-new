"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
  XCircle,
  Activity,
  Zap,
  Target,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface WorkflowMetrics {
  workflowId: string;
  workflowName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number; // milliseconds
  successRate: number; // percentage
  lastExecuted?: Date;
  executionsToday: number;
  executionsThisWeek: number;
  executionsThisMonth: number;
}

interface ExecutionTrend {
  date: string;
  executions: number;
  successful: number;
  failed: number;
  averageTime: number;
}

interface TriggerStats {
  triggerId: string;
  count: number;
  successRate: number;
}

interface WorkflowPerformanceMetricsProps {
  workflowId?: string;
  chatbotId?: string;
  className?: string;
}

export function WorkflowPerformanceMetrics({
  workflowId,
  chatbotId,
  className,
}: WorkflowPerformanceMetricsProps) {
  const [metrics, setMetrics] = useState<WorkflowMetrics[]>([]);
  const [trends, setTrends] = useState<ExecutionTrend[]>([]);
  const [triggerStats, setTriggerStats] = useState<TriggerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [selectedMetric, setSelectedMetric] = useState<"executions" | "success_rate" | "avg_time">("executions");

  // Load performance metrics
  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        timeRange,
      });

      if (workflowId) {
        params.append("workflowId", workflowId);
      }

      if (chatbotId) {
        params.append("chatbotId", chatbotId);
      }

      const [metricsResponse, trendsResponse, triggersResponse] = await Promise.all([
        fetch(`/api/workflows/metrics?${params.toString()}`),
        fetch(`/api/workflows/trends?${params.toString()}`),
        fetch(`/api/workflows/trigger-stats?${params.toString()}`),
      ]);

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        if (metricsData.success) {
          setMetrics(metricsData.data);
        }
      }

      if (trendsResponse.ok) {
        const trendsData = await trendsResponse.json();
        if (trendsData.success) {
          setTrends(trendsData.data);
        }
      }

      if (triggersResponse.ok) {
        const triggersData = await triggersResponse.json();
        if (triggersData.success) {
          setTriggerStats(triggersData.data);
        }
      }
    } catch (error) {
      console.error("Error loading performance metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [workflowId, chatbotId, timeRange]);

  // Calculate aggregate metrics
  const aggregateMetrics = metrics.reduce(
    (acc, metric) => ({
      totalExecutions: acc.totalExecutions + metric.totalExecutions,
      successfulExecutions: acc.successfulExecutions + metric.successfulExecutions,
      failedExecutions: acc.failedExecutions + metric.failedExecutions,
      averageExecutionTime: acc.averageExecutionTime + metric.averageExecutionTime,
      executionsToday: acc.executionsToday + metric.executionsToday,
      executionsThisWeek: acc.executionsThisWeek + metric.executionsThisWeek,
      executionsThisMonth: acc.executionsThisMonth + metric.executionsThisMonth,
    }),
    {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionsToday: 0,
      executionsThisWeek: 0,
      executionsThisMonth: 0,
    }
  );

  const overallSuccessRate = aggregateMetrics.totalExecutions > 0
    ? (aggregateMetrics.successfulExecutions / aggregateMetrics.totalExecutions) * 100
    : 0;

  const avgExecutionTime = metrics.length > 0
    ? aggregateMetrics.averageExecutionTime / metrics.length
    : 0;

  // Prepare chart data
  const chartData = trends.map(trend => ({
    ...trend,
    date: format(new Date(trend.date), "MMM dd"),
  }));

  // Status distribution for pie chart
  const statusData = [
    { name: "Successful", value: aggregateMetrics.successfulExecutions, color: "#10b981" },
    { name: "Failed", value: aggregateMetrics.failedExecutions, color: "#ef4444" },
  ];

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Time Range Selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Performance Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Monitor workflow execution performance and trends
          </p>
        </div>
        
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(aggregateMetrics.totalExecutions)}</div>
            <p className="text-xs text-muted-foreground">
              {aggregateMetrics.executionsToday} today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {overallSuccessRate.toFixed(1)}%
              {overallSuccessRate >= 90 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : overallSuccessRate < 70 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {aggregateMetrics.successfulExecutions} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(avgExecutionTime)}</div>
            <p className="text-xs text-muted-foreground">
              Per workflow execution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workflows</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.length}</div>
            <p className="text-xs text-muted-foreground">
              With executions in period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Execution Trends Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Execution Trends</CardTitle>
                <CardDescription>Daily execution volume and success rate</CardDescription>
              </div>
              
              <Select value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as typeof selectedMetric)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executions">Executions</SelectItem>
                  <SelectItem value="success_rate">Success Rate</SelectItem>
                  <SelectItem value="avg_time">Avg Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {selectedMetric === "executions" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="successful" stackId="a" fill="#10b981" name="Successful" />
                  <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                </BarChart>
              ) : selectedMetric === "success_rate" ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Success Rate"]} />
                  <Line
                    type="monotone"
                    dataKey={(data) => data.executions > 0 ? (data.successful / data.executions) * 100 : 0}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Success Rate"
                  />
                </LineChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatDuration(Number(value)), "Avg Time"]} />
                  <Line
                    type="monotone"
                    dataKey="averageTime"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Avg Execution Time"
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Status Distribution</CardTitle>
            <CardDescription>Breakdown of execution outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatNumber(Number(value)), "Executions"]} />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="flex justify-center gap-4 mt-4">
              {statusData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">
                    {entry.name}: {formatNumber(entry.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Performance Table */}
      {!workflowId && metrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Performance Breakdown</CardTitle>
            <CardDescription>Individual workflow performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.map((metric) => (
                <div
                  key={metric.workflowId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{metric.workflowName}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{metric.totalExecutions} executions</span>
                      <span>•</span>
                      <span>{metric.successRate.toFixed(1)}% success rate</span>
                      <span>•</span>
                      <span>{formatDuration(metric.averageExecutionTime)} avg time</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={metric.successRate >= 90 ? "default" : metric.successRate >= 70 ? "secondary" : "destructive"}>
                      {metric.successRate >= 90 ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : metric.successRate < 70 ? (
                        <XCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <Clock className="w-3 h-3 mr-1" />
                      )}
                      {metric.successRate.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trigger Statistics */}
      {triggerStats.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Trigger Performance</CardTitle>
            <CardDescription>Most frequently used triggers and their success rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {triggerStats.slice(0, 10).map((trigger) => (
                <div
                  key={trigger.triggerId}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <code className="text-sm bg-background px-2 py-1 rounded">
                      {trigger.triggerId}
                    </code>
                    <span className="text-sm text-muted-foreground">
                      {trigger.count} executions
                    </span>
                  </div>
                  
                  <Badge variant={trigger.successRate >= 90 ? "default" : trigger.successRate >= 70 ? "secondary" : "destructive"}>
                    {trigger.successRate.toFixed(1)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}