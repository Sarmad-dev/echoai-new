"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  MessageSquare,
  Users,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  Filter,
  Download,
  WifiOff,
  Wifi,
  ZoomIn,
} from "lucide-react";
import { useRealtimeAnalytics } from "@/hooks/useRealtimeAnalytics";
import { format as formatDate, subDays, startOfDay, endOfDay } from "date-fns";

interface AnalyticsDashboardProps {
  chatbotId?: string;
  userId?: string;
}

export function AnalyticsDashboard({
  chatbotId,
  userId,
}: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date()),
  });

  const [conversationTypeFilter, setConversationTypeFilter] =
    useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("all");
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "reconnecting"
  >("connected");

  // Memoize the connection change handler to prevent infinite re-renders
  const handleConnectionChange = React.useCallback(
    (status: "connected" | "disconnected" | "reconnecting") => {
      setConnectionStatus(status);
    },
    []
  );

  // Memoize the analytics options to prevent infinite re-renders
  const analyticsOptions = React.useMemo(
    () => ({
      chatbotId,
      userId,
      dateRange,
      conversationType:
        conversationTypeFilter !== "all" ? conversationTypeFilter : undefined,
      refreshInterval: 30000, // Refresh every 30 seconds
      onConnectionChange: handleConnectionChange,
    }),
    [
      chatbotId,
      userId,
      dateRange,
      conversationTypeFilter,
      handleConnectionChange,
    ]
  );

  const {
    metrics,
    conversationAnalytics,
    workflowAnalytics,
    isLoading,
    error,
    lastUpdated,
    refreshData,
  } = useRealtimeAnalytics(analyticsOptions);

  // Color scheme for charts
  const colors = {
    primary: "#3b82f6",
    secondary: "#10b981",
    accent: "#f59e0b",
    danger: "#ef4444",
    muted: "#6b7280",
  };

  // Prepare data for sentiment trend chart
  const sentimentTrendData = conversationAnalytics.map((conv, index) => ({
    conversation: `Conv ${index + 1}`,
    sentiment: conv.averageSentiment,
    messages: conv.messageCount,
  }));

  // Prepare data for workflow performance chart
  const workflowPerformanceData = workflowAnalytics.map((workflow) => ({
    workflow: `Workflow ${workflow.workflowId.slice(-8)}`,
    executions: workflow.executionCount,
    successRate: workflow.successRate,
    avgTime: Math.round(workflow.averageExecutionTime / 1000), // Convert to seconds
  }));

  // Prepare data for conversation duration distribution
  const durationDistribution = conversationAnalytics.reduce((acc, conv) => {
    const bucket =
      conv.duration < 5
        ? "0-5 min"
        : conv.duration < 15
        ? "5-15 min"
        : conv.duration < 30
        ? "15-30 min"
        : "30+ min";
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const durationData = Object.entries(durationDistribution).map(
    ([duration, count]) => ({
      duration,
      count,
    })
  );

  // Filter workflow analytics based on the selected filter
  const filteredWorkflowAnalytics = workflowFilter === "all" 
    ? workflowAnalytics 
    : workflowAnalytics.filter(w => w.workflowId.includes(workflowFilter));

  // Prepare data for top intents pie chart
  const intentData = metrics.topIntents.map((intent, index) => ({
    ...intent,
    color: [
      colors.primary,
      colors.secondary,
      colors.accent,
      colors.danger,
      colors.muted,
    ][index % 5],
  }));

  const handleRefresh = () => {
    refreshData();
  };

  const handleDateRangeChange = (days: number) => {
    setDateRange({
      start: startOfDay(subDays(new Date(), days)),
      end: endOfDay(new Date()),
    });
  };

  const handleExportData = async (format: "csv" | "json") => {
    try {
      const exportData = {
        metrics,
        conversationAnalytics,
        workflowAnalytics,
        filters: {
          dateRange,
          conversationType: conversationTypeFilter,
          workflow: workflowFilter,
          chatbotId,
          userId,
        },
        exportedAt: new Date().toISOString(),
      };

      if (format === "json") {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics-${formatDate(
          new Date(),
          "yyyy-MM-dd-HHmm"
        )}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === "csv") {
        // Convert metrics to CSV format
        const csvData = [
          ["Metric", "Value"],
          ["Total Conversations", metrics.totalConversations.toString()],
          ["Average Sentiment", metrics.averageSentiment.toString()],
          ["Resolution Rate", `${metrics.resolutionRate}%`],
          ["Automation Triggers", metrics.automationTriggers.toString()],
          ["Active Users", metrics.activeUsers.toString()],
          [""],
          ["Top Intents", ""],
          ...metrics.topIntents.map((intent) => [
            intent.intent,
            intent.count.toString(),
          ]),
          [""],
          ["Conversation Analytics", ""],
          [
            "Conversation ID",
            "Messages",
            "Sentiment",
            "Duration (min)",
            "Resolved",
            "Automation Triggered",
          ],
          ...conversationAnalytics.map((conv) => [
            conv.conversationId,
            conv.messageCount.toString(),
            conv.averageSentiment.toString(),
            conv.duration.toString(),
            conv.resolved.toString(),
            conv.automationTriggered.toString(),
          ]),
        ];

        const csvContent = csvData.map((row) => row.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics-${formatDate(
          new Date(),
          "yyyy-MM-dd-HHmm"
        )}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const handleMetricDrillDown = (metricType: string, value?: string | number) => {
    setSelectedMetric(metricType);
    // In a real implementation, this would filter data or navigate to detailed view
    console.log("Drilling down into metric:", metricType, value);
  };

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Error Loading Analytics
            </h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Analytics Dashboard
          </h2>
          <p className="text-muted-foreground">
            Real-time insights into your chatbot performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Controls */}
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <Button
              variant={
                dateRange.start.getTime() ===
                startOfDay(subDays(new Date(), 1)).getTime()
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => handleDateRangeChange(1)}
            >
              24h
            </Button>
            <Button
              variant={
                dateRange.start.getTime() ===
                startOfDay(subDays(new Date(), 7)).getTime()
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => handleDateRangeChange(7)}
            >
              7d
            </Button>
            <Button
              variant={
                dateRange.start.getTime() ===
                startOfDay(subDays(new Date(), 30)).getTime()
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => handleDateRangeChange(30)}
            >
              30d
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4" />
            <Select
              value={conversationTypeFilter}
              onValueChange={setConversationTypeFilter}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workflows</SelectItem>
                {workflowAnalytics.map((workflow) => (
                  <SelectItem
                    key={workflow.workflowId}
                    value={workflow.workflowId}
                  >
                    {workflow.workflowId.slice(-8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportData("csv")}>
                CSV Format
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportData("json")}>
                JSON Format
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Refresh */}
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Connection Status and Last Updated */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            {connectionStatus === "connected" && (
              <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Real-time Connected</span>
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              </>
            )}
            {connectionStatus === "disconnected" && (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-red-600">Connection Lost</span>
                <div className="h-2 w-2 bg-red-500 rounded-full" />
              </>
            )}
            {connectionStatus === "reconnecting" && (
              <>
                <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
                <span className="text-yellow-600">Reconnecting...</span>
                <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
              </>
            )}
          </div>

          {/* Last Updated */}
          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              Last updated: {formatDate(lastUpdated, "HH:mm:ss")}
            </div>
          )}
        </div>

        {/* Active Filters Indicator */}
        {(conversationTypeFilter !== "all" ||
          workflowFilter !== "all" ||
          selectedMetric) && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Active filters:
            </span>
            {conversationTypeFilter !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Type: {conversationTypeFilter}
              </Badge>
            )}
            {workflowFilter !== "all" && (
              <Badge variant="secondary" className="text-xs">
                Workflow: {workflowFilter.slice(-8)}
              </Badge>
            )}
            {selectedMetric && (
              <Badge variant="secondary" className="text-xs">
                <ZoomIn className="h-3 w-3 mr-1" />
                Drill-down: {selectedMetric}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConversationTypeFilter("all");
                setWorkflowFilter("all");
                setSelectedMetric(null);
              }}
              className="h-6 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Connection Issues Alert */}
      {connectionStatus === "disconnected" && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Real-time connection lost. Data may not be current. The system will
            automatically retry connecting and fall back to periodic updates.
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedMetric === "conversations" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() =>
            handleMetricDrillDown("conversations", metrics.totalConversations)
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Conversations
            </CardTitle>
            <div className="flex items-center gap-1">
              {selectedMetric === "conversations" && (
                <ZoomIn className="h-3 w-3 text-primary" />
              )}
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.totalConversations}
            </div>
            <p className="text-xs text-muted-foreground">
              Active conversations in selected period
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedMetric === "sentiment" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() =>
            handleMetricDrillDown("sentiment", metrics.averageSentiment)
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Average Sentiment
            </CardTitle>
            <div className="flex items-center gap-1">
              {selectedMetric === "sentiment" && (
                <ZoomIn className="h-3 w-3 text-primary" />
              )}
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.averageSentiment.toFixed(2)}
            </div>
            <div className="flex items-center gap-1">
              <Badge
                variant={
                  metrics.averageSentiment > 0.2
                    ? "default"
                    : metrics.averageSentiment > -0.2
                    ? "secondary"
                    : "destructive"
                }
              >
                {metrics.averageSentiment > 0.2
                  ? "Positive"
                  : metrics.averageSentiment > -0.2
                  ? "Neutral"
                  : "Negative"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedMetric === "resolution" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() =>
            handleMetricDrillDown("resolution", metrics.resolutionRate)
          }
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Resolution Rate
            </CardTitle>
            <div className="flex items-center gap-1">
              {selectedMetric === "resolution" && (
                <ZoomIn className="h-3 w-3 text-primary" />
              )}
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.resolutionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Conversations marked as resolved
            </p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            selectedMetric === "users" ? "ring-2 ring-primary" : ""
          }`}
          onClick={() => handleMetricDrillDown("users", metrics.activeUsers)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <div className="flex items-center gap-1">
              {selectedMetric === "users" && (
                <ZoomIn className="h-3 w-3 text-primary" />
              )}
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Users with active sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment Analysis</TabsTrigger>
          <TabsTrigger value="workflows">Automation</TabsTrigger>
          <TabsTrigger value="intents">Top Intents</TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Conversation Duration Distribution</CardTitle>
                <CardDescription>
                  How long conversations typically last
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={durationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="duration" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill={colors.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversation Metrics</CardTitle>
                <CardDescription>
                  Message count and resolution status
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Messages</span>
                    <span className="font-semibold">
                      {conversationAnalytics.reduce(
                        (sum, conv) => sum + conv.messageCount,
                        0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">
                      Avg Messages per Conversation
                    </span>
                    <span className="font-semibold">
                      {conversationAnalytics.length > 0
                        ? (
                            conversationAnalytics.reduce(
                              (sum, conv) => sum + conv.messageCount,
                              0
                            ) / conversationAnalytics.length
                          ).toFixed(1)
                        : "0"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Resolved Conversations</span>
                    <span className="font-semibold">
                      {
                        conversationAnalytics.filter((conv) => conv.resolved)
                          .length
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Automation Triggered</span>
                    <span className="font-semibold">
                      {
                        conversationAnalytics.filter(
                          (conv: { automationTriggered: boolean }) => conv.automationTriggered
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Trend</CardTitle>
              <CardDescription>
                Sentiment scores across recent conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={sentimentTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="conversation" />
                  <YAxis domain={[-1, 1]} />
                  <Tooltip
                    formatter={(value: number) => [
                      value.toFixed(2),
                      "Sentiment Score",
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sentiment"
                    stroke={colors.primary}
                    strokeWidth={2}
                    dot={{ fill: colors.primary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Performance</CardTitle>
                <CardDescription>
                  Execution count and success rates
                  {workflowFilter !== "all" && (
                    <Badge variant="outline" className="ml-2">
                      Filtered: {workflowFilter.slice(-8)}
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={
                      workflowFilter === "all"
                        ? workflowPerformanceData
                        : workflowPerformanceData.filter((item: { workflow: string }) =>
                            filteredWorkflowAnalytics.some(
                              (w: { workflowId: string }) =>
                                item.workflow ===
                                `Workflow ${w.workflowId.slice(-8)}`
                            )
                          )
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="workflow" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="executions"
                      fill={colors.primary}
                      name="Executions"
                    />
                    <Bar
                      dataKey="successRate"
                      fill={colors.secondary}
                      name="Success Rate %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Automation Summary</CardTitle>
                <CardDescription>
                  Overall automation performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Total Triggers</span>
                    <span className="font-semibold">
                      {metrics.automationTriggers}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active Workflows</span>
                    <span className="font-semibold">
                      {filteredWorkflowAnalytics.length}
                      {workflowFilter !== "all" && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (filtered)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Success Rate</span>
                    <span className="font-semibold">
                      {filteredWorkflowAnalytics.length > 0
                        ? (
                            filteredWorkflowAnalytics.reduce(
                              (sum: number, w: { successRate: number }) => sum + w.successRate,
                              0
                            ) / filteredWorkflowAnalytics.length
                          ).toFixed(1)
                        : "0"}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Execution Time</span>
                    <span className="font-semibold">
                      {filteredWorkflowAnalytics.length > 0
                        ? Math.round(
                            filteredWorkflowAnalytics.reduce(
                              (sum: number, w: { averageExecutionTime: number }) => sum + w.averageExecutionTime,
                              0
                            ) /
                              filteredWorkflowAnalytics.length /
                              1000
                          )
                        : "0"}
                      s
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="intents" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Intents</CardTitle>
                <CardDescription>
                  Most frequently detected user intents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={intentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ intent, percent }) =>
                        `${intent} ${((percent || 0) * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {intentData.map((entry: { color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Intent Details</CardTitle>
                <CardDescription>Breakdown of detected intents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.topIntents.map((intent: { intent: string; count: number }, index: number) => (
                    <div
                      key={intent.intent}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor:
                              intentData[index]?.color || colors.muted,
                          }}
                        />
                        <span className="text-sm font-medium">
                          {intent.intent}
                        </span>
                      </div>
                      <Badge variant="secondary">{intent.count}</Badge>
                    </div>
                  ))}
                  {metrics.topIntents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No intents detected yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
