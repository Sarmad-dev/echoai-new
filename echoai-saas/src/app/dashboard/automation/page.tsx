"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChatbotSelector } from "@/components/dashboard/chatbot-selector";
import { WorkflowTemplates } from "@/components/automation/workflow-templates";
import { workflowService } from "@/lib/workflow-service";
import type { ChatbotData } from "@/types/api";
import type {
  ReactFlowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from "@/types/database";
import { DashboardLayout } from "@/components/dashboard";
import { ExecutionLogDisplay } from "@/components/automation/execution-log-display";
import { WorkflowPerformanceMetrics } from "@/components/automation/workflow-performance-metrics";
import { RealTimeExecutionStatus } from "@/components/automation/real-time-execution-status";
import { WorkflowAnalytics } from "@/components/automation/workflow-analytics";
import { ABTestingFramework } from "@/components/automation/ab-testing-framework";
import { useAuth } from "@/contexts/auth-context";

interface AutomationWorkflow {
  id: string;
  name: string;
  description?: string;
  chatbotId: string;
  chatbotName: string;
  isActive: boolean;
  triggerCount: number;
  successRate: number;
  lastTriggered?: string;
  createdAt: string;
  flowDefinition: ReactFlowDefinition | { flowDefinition: ReactFlowDefinition }; // Allow for nested structure
}

// Helper function to extract actual flow definition from nested structure
const getActualFlowDefinition = (
  flowDefinition: ReactFlowDefinition | { flowDefinition: ReactFlowDefinition }
): ReactFlowDefinition => {
  if ("flowDefinition" in flowDefinition && flowDefinition.flowDefinition) {
    return flowDefinition.flowDefinition;
  }
  return flowDefinition as ReactFlowDefinition;
};

export default function AutomationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotData | null>(
    null
  );
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [allChatbots, setAllChatbots] = useState<ChatbotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "workflows" | "monitoring" | "analytics" | "testing"
  >("workflows");

  // Load workflows using workflow service with chatbot filtering
  const loadWorkflows = useCallback(
    async (chatbotId?: string) => {
      if (!user?.id) {
        console.warn("User not authenticated, skipping workflow load");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Build query parameters for API call
        const params = new URLSearchParams();
        params.append("userId", user.id);

        if (chatbotId) {
          params.append("chatbotId", chatbotId);
        }

        // Try API first, fallback to workflow service
        try {
          const response = await fetch(`/api/workflows?${params.toString()}`);
          if (response.ok) {
            const data = await response.json();
            console.log("Data: ", data);
            if (data.success) {
              // Transform API data to match our interface
              const transformedWorkflows = data.data.map(
                (w: Record<string, unknown>) => ({
                  id: w.id,
                  name: w.name,
                  description: w.description,
                  chatbotId: w.chatbotId || "unknown",
                  chatbotName: w.chatbotName || "Unknown Bot",
                  isActive: w.isActive,
                  triggerCount: w.triggerCount || 0,
                  successRate: w.successRate || 0,
                  lastTriggered: w.lastTriggered,
                  createdAt: w.createdAt,
                  flowDefinition: w.flowDefinition || {
                    nodes: [] as WorkflowNode[],
                    edges: [] as WorkflowEdge[],
                  },
                })
              );
              setWorkflows(transformedWorkflows);
              return;
            }
          }
        } catch {
          console.log("API not available, using workflow service");
        }

        // Fallback to workflow service
        const dbWorkflows = await workflowService.listWorkflows({
          userId: user.id,
          chatbotId: chatbotId,
        });

        const transformedWorkflows = dbWorkflows.map(
          (w: {
            id: string;
            name: string;
            description?: string;
            chatbotId?: string;
            isActive: boolean;
            createdAt: Date;
            flowDefinition:
              | ReactFlowDefinition
              | { flowDefinition: ReactFlowDefinition };
          }) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            chatbotId: w.chatbotId || "unknown",
            chatbotName: "Unknown Bot", // TODO: Get chatbot name from API
            isActive: w.isActive,
            triggerCount: 0, // TODO: Get from execution logs
            successRate: 85, // TODO: Calculate from execution logs
            lastTriggered: undefined, // TODO: Get from execution logs
            createdAt: w.createdAt.toISOString().split("T")[0],
            flowDefinition: w.flowDefinition,
          })
        );

        setWorkflows(transformedWorkflows);
      } catch (error) {
        console.error("Failed to load workflows:", error);
        setWorkflows([]);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id]
  );

  // Load all chatbots for copy functionality
  const loadChatbots = async () => {
    try {
      const response = await fetch("/api/chatbots");
      if (response.ok) {
        const data = await response.json();
        setAllChatbots(data.chatbots || []);
      }
    } catch (error) {
      console.error("Failed to load chatbots:", error);
    }
  };

  useEffect(() => {
    loadWorkflows(selectedChatbot?.id);
    loadChatbots();
  }, [selectedChatbot, loadWorkflows]);

  // Refresh workflows when returning to this page
  useEffect(() => {
    const handleFocus = () => {
      loadWorkflows(selectedChatbot?.id);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [selectedChatbot, loadWorkflows]);

  const filteredWorkflows = selectedChatbot
    ? workflows.filter((w) => w.chatbotId === selectedChatbot.id)
    : workflows;

  console.log("Workflows: ", workflows);
  console.log("FIltered Workflows: ", filteredWorkflows);

  const handleCreateWorkflow = () => {
    // Pass selected chatbot to create page
    const params = new URLSearchParams();
    if (selectedChatbot) {
      params.append("chatbotId", selectedChatbot.id);
      params.append("chatbotName", selectedChatbot.name);
    }

    const url = params.toString()
      ? `/dashboard/automation/create?${params.toString()}`
      : "/dashboard/automation/create";

    router.push(url);
  };

  const handleSelectTemplate = (template: {
    name: string;
    description?: string;
    flowDefinition: ReactFlowDefinition;
  }) => {
    // Navigate to create page with template data and selected chatbot
    const templateData = encodeURIComponent(
      JSON.stringify(template.flowDefinition)
    );
    const params = new URLSearchParams({
      templateName: template.name,
      templateDescription: template.description || "",
      templateData: templateData,
    });

    if (selectedChatbot) {
      params.append("chatbotId", selectedChatbot.id);
      params.append("chatbotName", selectedChatbot.name);
    }

    router.push(`/dashboard/automation/create?${params.toString()}`);
  };

  const handleEditWorkflow = (workflow: AutomationWorkflow) => {
    router.push(`/dashboard/automation/edit/${workflow.id}`);
  };

  const handleToggleWorkflow = async (
    workflowId: string,
    isActive: boolean
  ) => {
    try {
      // Find the current workflow to get its existing data
      const currentWorkflow = workflows.find((w) => w.id === workflowId);
      if (!currentWorkflow) {
        console.error("Workflow not found:", workflowId);
        return;
      }

      // Try API first, fallback to workflow service
      try {
        const response = await fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: currentWorkflow.name,
            description: currentWorkflow.description,
            flowDefinition: getActualFlowDefinition(currentWorkflow.flowDefinition),
            isActive 
          }),
        });

        if (response.ok) {
          setWorkflows((prev) =>
            prev.map((w) => (w.id === workflowId ? { ...w, isActive } : w))
          );
          return;
        } else {
          const errorData = await response.json();
          console.error("API error:", errorData);
        }
      } catch (error) {
        console.log("API not available, using workflow service:", error);
      }

      // Fallback to workflow service
      await workflowService.updateWorkflow(workflowId, { isActive });
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflowId ? { ...w, isActive } : w))
      );
    } catch (error) {
      console.error("Failed to toggle workflow:", error);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      // Try API first, fallback to workflow service
      try {
        const response = await fetch(`/api/workflows/${workflowId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
          return;
        }
      } catch {
        console.log("API not available, using workflow service");
      }

      // Fallback to workflow service
      const deleted = await workflowService.deleteWorkflow(workflowId);
      if (deleted) {
        setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
      }
    } catch (error) {
      console.error("Failed to delete workflow:", error);
    }
  };

  const handleDuplicateWorkflow = async (workflow: AutomationWorkflow) => {
    if (!user?.id) {
      alert("You must be logged in to duplicate workflows");
      return;
    }

    try {
      // Use the currently selected chatbot or the workflow's original chatbot
      const targetChatbotId = selectedChatbot?.id || workflow.chatbotId;
      const targetChatbotName = selectedChatbot?.name || workflow.chatbotName;

      // Try API first, fallback to workflow service
      try {
        const response = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${workflow.name} (Copy)`,
            description: workflow.description,
            flowDefinition: getActualFlowDefinition(workflow.flowDefinition),
            userId: user?.id,
            chatbotId: targetChatbotId,
            isActive: false,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const duplicatedWorkflow: AutomationWorkflow = {
            id: result.data.workflow.id,
            name: result.data.workflow.name,
            description: result.data.workflow.description,
            chatbotId: targetChatbotId,
            chatbotName: targetChatbotName,
            isActive: false,
            triggerCount: 0,
            successRate: 0,
            createdAt: new Date().toISOString().split("T")[0],
            flowDefinition: workflow.flowDefinition,
          };

          // Only add to current list if it matches the current filter
          if (!selectedChatbot || targetChatbotId === selectedChatbot.id) {
            setWorkflows((prev) => [...prev, duplicatedWorkflow]);
          }
          return;
        }
      } catch {
        console.log("API not available, using workflow service");
      }

      // Fallback to workflow service
      const { workflow: duplicatedWorkflow } =
        await workflowService.createWorkflow({
          name: `${workflow.name} (Copy)`,
          description: workflow.description,
          flowDefinition: getActualFlowDefinition(workflow.flowDefinition),
          userId: user.id,
          chatbotId: targetChatbotId,
          isActive: false,
        });

      const newWorkflow: AutomationWorkflow = {
        id: duplicatedWorkflow.id,
        name: duplicatedWorkflow.name,
        description: duplicatedWorkflow.description,
        chatbotId: targetChatbotId,
        chatbotName: targetChatbotName,
        isActive: false,
        triggerCount: 0,
        successRate: 0,
        createdAt: duplicatedWorkflow.createdAt.toISOString().split("T")[0],
        flowDefinition: workflow.flowDefinition,
      };

      // Only add to current list if it matches the current filter
      if (!selectedChatbot || targetChatbotId === selectedChatbot.id) {
        setWorkflows((prev) => [...prev, newWorkflow]);
      }
    } catch (error) {
      console.error("Failed to duplicate workflow:", error);
    }
  };

  const handleTestWorkflow = async (workflow: AutomationWorkflow) => {
    try {
      // Create a test trigger event
      const testEvent = {
        type: "test_trigger",
        data: {
          message: "Test message",
          timestamp: new Date().toISOString(),
        },
        userId: user?.id || "",
        conversationId: "test-conversation",
      };

      // Execute workflow using workflow service
      const result = await workflowService.executeWorkflow(
        workflow.id,
        testEvent
      );

      console.log("Workflow execution result:", result);

      // Update trigger count for UI feedback
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflow.id
            ? {
                ...w,
                triggerCount: w.triggerCount + 1,
                lastTriggered: new Date().toISOString().split("T")[0],
              }
            : w
        )
      );
    } catch (error) {
      console.error("Failed to test workflow:", error);
    }
  };

  const handleCopyToChatbot = async (
    workflow: AutomationWorkflow,
    targetChatbot: ChatbotData
  ) => {
    try {
      // Try API first, fallback to workflow service
      try {
        const response = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${workflow.name} (from ${workflow.chatbotName})`,
            description: workflow.description,
            flowDefinition: getActualFlowDefinition(workflow.flowDefinition),
            userId: user?.id,
            chatbotId: targetChatbot.id,
            isActive: false,
          }),
        });

        if (response.ok) {
          // Show success message or notification
          console.log(`Workflow copied to ${targetChatbot.name}`);

          // If we're currently viewing the target chatbot, refresh the list
          if (selectedChatbot?.id === targetChatbot.id) {
            loadWorkflows(targetChatbot.id);
          }
          return;
        }
      } catch {
        console.log("API not available, using workflow service");
      }

      // Fallback to workflow service
      await workflowService.createWorkflow({
        name: `${workflow.name} (from ${workflow.chatbotName})`,
        description: workflow.description,
        flowDefinition: getActualFlowDefinition(workflow.flowDefinition),
        userId: user?.id || "",
        chatbotId: targetChatbot.id,
        isActive: false,
      });

      console.log(`Workflow copied to ${targetChatbot.name}`);

      // If we're currently viewing the target chatbot, refresh the list
      if (selectedChatbot?.id === targetChatbot.id) {
        loadWorkflows(targetChatbot.id);
      }
    } catch (error) {
      console.error("Failed to copy workflow to chatbot:", error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Automation Workflows</h1>
            <p className="text-muted-foreground">
              Create intelligent automation rules for your chatbots
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ChatbotSelector
              selectedChatbotId={selectedChatbot?.id}
              onSelect={setSelectedChatbot}
              placeholder="All chatbots"
              className="w-64"
            />

            <div className="flex gap-2">
              <WorkflowTemplates onSelectTemplate={handleSelectTemplate} />

              <Button onClick={handleCreateWorkflow}>
                <Plus className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === "workflows" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("workflows")}
          >
            Workflows
          </Button>
          <Button
            variant={activeTab === "monitoring" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("monitoring")}
          >
            Monitoring
          </Button>
          <Button
            variant={activeTab === "analytics" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("analytics")}
          >
            Analytics
          </Button>
          <Button
            variant={activeTab === "testing" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("testing")}
          >
            A/B Testing
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "workflows" && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {selectedChatbot ? "Workflows" : "Total Workflows"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredWorkflows.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {filteredWorkflows.filter((w) => w.isActive).length} active
                    {selectedChatbot && ` for ${selectedChatbot.name}`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Triggers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredWorkflows.reduce(
                      (sum, w) => sum + w.triggerCount,
                      0
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This month
                    {selectedChatbot && ` for ${selectedChatbot.name}`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Success Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredWorkflows.length > 0
                      ? Math.round(
                          filteredWorkflows.reduce(
                            (sum, w) => sum + w.successRate,
                            0
                          ) / filteredWorkflows.length
                        )
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average{selectedChatbot && ` for ${selectedChatbot.name}`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Workflows
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredWorkflows.filter((w) => w.isActive).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Currently running
                    {selectedChatbot && ` for ${selectedChatbot.name}`}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Workflows List */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="grid gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-4 bg-muted rounded w-1/3"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-2">
                          <div className="h-6 bg-muted rounded w-16"></div>
                          <div className="h-6 bg-muted rounded w-20"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredWorkflows.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                        <Play className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-medium">
                        No workflows found
                      </h3>
                      <p className="text-muted-foreground max-w-md">
                        {selectedChatbot
                          ? `No automation workflows found for ${selectedChatbot.name}. Create your first workflow for this chatbot to get started.`
                          : "Create your first automation workflow to start automating your chatbot responses. Select a chatbot above to get started."}
                      </p>
                      <Button onClick={handleCreateWorkflow}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Workflow
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredWorkflows.map((workflow) => (
                    <Card key={workflow.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">
                                {workflow.name}
                              </CardTitle>
                              <Badge
                                variant={
                                  workflow.isActive ? "default" : "secondary"
                                }
                              >
                                {workflow.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            {workflow.description && (
                              <CardDescription>
                                {workflow.description}
                              </CardDescription>
                            )}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>Chatbot: {workflow.chatbotName}</span>
                              <span>•</span>
                              <span>Created: {workflow.createdAt}</span>
                              {workflow.lastTriggered && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Last triggered: {workflow.lastTriggered}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditWorkflow(workflow)}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleTestWorkflow(workflow)}
                              >
                                <Play className="w-4 h-4 mr-2" />
                                Test Run
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDuplicateWorkflow(workflow)
                                }
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>

                              {allChatbots.length > 1 && (
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <ArrowRight className="w-4 h-4 mr-2" />
                                    Copy to Chatbot
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {allChatbots
                                      .filter(
                                        (chatbot) =>
                                          chatbot.id !== workflow.chatbotId
                                      )
                                      .map((chatbot) => (
                                        <DropdownMenuItem
                                          key={chatbot.id}
                                          onClick={() =>
                                            handleCopyToChatbot(
                                              workflow,
                                              chatbot
                                            )
                                          }
                                        >
                                          <div
                                            className="w-3 h-3 rounded-full mr-2"
                                            style={{
                                              backgroundColor:
                                                chatbot.primaryColor,
                                            }}
                                          />
                                          {chatbot.name}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                              )}

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() =>
                                  handleToggleWorkflow(
                                    workflow.id,
                                    !workflow.isActive
                                  )
                                }
                              >
                                {workflow.isActive ? (
                                  <>
                                    <Pause className="w-4 h-4 mr-2" />
                                    Pause
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleDeleteWorkflow(workflow.id)
                                }
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>

                      <CardContent>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold">
                              {workflow.triggerCount}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Triggers
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-2xl font-bold text-green-600">
                              {workflow.successRate}%
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Success Rate
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="text-sm text-muted-foreground">
                              {(() => {
                                const actualFlow = getActualFlowDefinition(
                                  workflow.flowDefinition
                                );
                                return `${
                                  actualFlow.nodes?.length || 0
                                } nodes, ${
                                  actualFlow.edges?.length || 0
                                } connections`;
                              })()}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Monitoring Tab */}
        {activeTab === "monitoring" && (
          <div className="space-y-6">
            <RealTimeExecutionStatus
              workflowId={undefined}
              chatbotId={selectedChatbot?.id}
            />

            <ExecutionLogDisplay
              workflowId={undefined}
              chatbotId={selectedChatbot?.id}
            />
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div className="space-y-8">
            {/* Advanced Workflow Analytics */}
            <WorkflowAnalytics
              workflowId={undefined}
              timeRange="24h"
              onTimeRangeChange={(range) =>
                console.log("Time range changed:", range)
              }
            />

            {/* Legacy Performance Metrics */}
            <WorkflowPerformanceMetrics
              workflowId={undefined}
              chatbotId={selectedChatbot?.id}
            />
          </div>
        )}

        {/* A/B Testing Tab */}
        {activeTab === "testing" && (
          <ABTestingFramework
            workflowId={undefined}
            onCreateTest={(test) => console.log("Creating A/B test:", test)}
            onUpdateTest={(testId, updates) =>
              console.log("Updating A/B test:", testId, updates)
            }
          />
        )}
      </div>
    </DashboardLayout>
  );
}
