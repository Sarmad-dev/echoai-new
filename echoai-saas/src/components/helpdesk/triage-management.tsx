"use client";

/**
 * Triage Management Component
 *
 * Provides UI for managing automated conversation triage rules,
 * viewing priority queue, and monitoring triage analytics.
 *
 * Requirements: 6.3, 6.4
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, TrendingUp, Settings, Plus } from "lucide-react";
import { toast } from "sonner";

interface TriageRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  priority: "low" | "medium" | "high" | "critical";
  conditions: any;
  actions: any;
  createdAt: Date;
  updatedAt: Date;
}

interface PriorityQueueItem {
  conversationId: string;
  priority: "low" | "medium" | "high" | "critical";
  escalationReason: string;
  customerEmail?: string;
  source?: string;
  sentimentScore?: number;
  waitTime: number;
  assignedTo?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface TriageAnalytics {
  totalTriaged: number;
  triageByRule: Record<string, number>;
  triageByPriority: Record<string, number>;
  averageWaitTime: number;
  escalationRate: number;
  resolutionRate: number;
  topEscalationReasons: Array<{
    reason: string;
    count: number;
    averageWaitTime: number;
  }>;
}

// Utility function to get priority color classes
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "low":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export default function TriageManagement() {
  const [rules, setRules] = useState<TriageRule[]>([]);
  const [priorityQueue, setPriorityQueue] = useState<PriorityQueueItem[]>([]);
  const [analytics, setAnalytics] = useState<TriageAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTriageData();
  }, []);

  const loadTriageData = async () => {
    try {
      setIsLoading(true);

      // Load rules, queue, and analytics in parallel
      const [rulesResponse, queueResponse, analyticsResponse] =
        await Promise.all([
          fetch("/api/helpdesk/triage?type=rules"),
          fetch("/api/helpdesk/triage?type=queue"),
          fetch("/api/helpdesk/triage?type=analytics"),
        ]);

      if (rulesResponse.ok) {
        const rulesData = await rulesResponse.json();
        setRules(rulesData.rules || []);
      }

      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        setPriorityQueue(queueData.queue?.items || []);
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData.analytics);
      }
    } catch (error) {
      toast.error("Failed to load triage data");
      console.error("Error loading triage data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading triage management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Triage Management
          </h2>
          <p className="text-gray-600">
            Manage automated conversation triage and priority queue
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Triage Rule
        </Button>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Priority Queue</TabsTrigger>
          <TabsTrigger value="rules">Triage Rules</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <PriorityQueueView items={priorityQueue} onRefresh={loadTriageData} />
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <TriageRulesView rules={rules} onRefresh={loadTriageData} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <TriageAnalyticsView analytics={analytics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Priority Queue View Component
function PriorityQueueView({
  items,
  onRefresh,
}: {
  items: PriorityQueueItem[];
  onRefresh: () => void;
}) {
  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Priority Queue ({items.length})
        </h3>
        <Button variant="outline" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No conversations in queue
            </h3>
            <p className="text-gray-600 text-center">
              All conversations are being handled by AI or have been resolved.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.conversationId}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={getPriorityColor(item.priority)}>
                      {item.priority}
                    </Badge>
                    <div>
                      <p className="font-medium">{item.escalationReason}</p>
                      <p className="text-sm text-gray-600">
                        {item.customerEmail} • {item.source}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatWaitTime(item.waitTime)}
                    </div>
                    {item.sentimentScore && (
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {item.sentimentScore.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
                {item.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Triage Rules View Component
function TriageRulesView({
  rules,
  onRefresh,
}: {
  rules: TriageRule[];
  onRefresh: () => void;
}) {
  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/helpdesk/triage/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (response.ok) {
        toast.success(`Rule ${isActive ? "enabled" : "disabled"}`);
        onRefresh();
      } else {
        toast.error("Failed to update rule");
      }
    } catch (error) {
      toast.error("Failed to update rule");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Triage Rules ({rules.length})</h3>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No triage rules configured
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Create triage rules to automatically escalate conversations based
              on various conditions.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <CardDescription>{rule.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(rule.priority)}>
                      {rule.priority}
                    </Badge>
                    <Button
                      variant={rule.isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleRule(rule.id, !rule.isActive)}
                    >
                      {rule.isActive ? "Active" : "Inactive"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  <div className="flex items-center gap-4">
                    <span>
                      Conditions:{" "}
                      <strong>{Object.keys(rule.conditions).length}</strong>
                    </span>
                    <span>
                      Actions:{" "}
                      <strong>{Object.keys(rule.actions).length}</strong>
                    </span>
                    <span>
                      Created:{" "}
                      <strong>
                        {new Date(rule.createdAt).toLocaleDateString()}
                      </strong>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Triage Analytics View Component
function TriageAnalyticsView({
  analytics,
}: {
  analytics: TriageAnalytics | null;
}) {
  if (!analytics) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-600">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Triage Analytics</h3>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Triaged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalTriaged}</div>
            <p className="text-xs text-gray-600">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Wait Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.averageWaitTime}m
            </div>
            <p className="text-xs text-gray-600">Before escalation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Escalation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.escalationRate * 100)}%
            </div>
            <p className="text-xs text-gray-600">Of total conversations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Resolution Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(analytics.resolutionRate * 100)}%
            </div>
            <p className="text-xs text-gray-600">
              Triaged conversations resolved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Escalation Reasons */}
      <Card>
        <CardHeader>
          <CardTitle>Top Escalation Reasons</CardTitle>
          <CardDescription>
            Most common reasons for conversation escalation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.topEscalationReasons.map((reason, index) => (
              <div
                key={reason.reason}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-xs font-medium flex items-center justify-center">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{reason.reason}</p>
                    <p className="text-sm text-gray-600">
                      {reason.count} escalations
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {reason.averageWaitTime.toFixed(1)}m
                  </p>
                  <p className="text-xs text-gray-600">avg wait time</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
