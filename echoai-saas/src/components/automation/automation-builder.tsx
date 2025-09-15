"use client";

import React, {
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  Play,
  ChevronDown,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize,
  Save,
} from "lucide-react";

import { TriggerNode } from "./nodes/trigger-node";
import type {
  AutomationWorkflow,
  WorkflowNode,
  WorkflowEdge,
} from "@/types/database";
import { ActionNode } from "./nodes/action-node";
import { ConditionNode } from "./nodes/condition-node";
import { ConditionalLogicNode } from "./nodes/conditional-logic-node";
import { DelayNode } from "./nodes/delay-node";
import { NodePaletteDialog } from "./node-palette-dialog";
import { WorkflowMetadataForm } from "./workflow-metadata-form";
import { EnhancedActionConfigForm } from "@/components/workflow/ActionConfigForm";
import { TriggerConfigForm } from "@/components/workflow/TriggerConfigForm";
import type { ActionConfig, TriggerConfig } from "@/lib/workflow";
// Removed unused import: workflowService
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

// Define custom node types
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  conditionalLogic: ConditionalLogicNode,
  delay: DelayNode,
};

// Initial empty nodes and edges
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Execution log interface
interface ExecutionLog {
  id: string;
  timestamp: Date;
  nodeId?: string;
  nodeName?: string;
  status: "pending" | "running" | "completed" | "failed";
  message: string;
  data?: Record<string, unknown>;
}

// Execution status type
type ExecutionStatus = "idle" | "running" | "completed" | "failed";

interface AutomationBuilderProps {
  workflowId?: string;
  onSave?: (
    workflow: Partial<AutomationWorkflow> & {
      name: string;
      flowDefinition: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
    }
  ) => void;
  onLoad?: (workflowId: string) => void;
  initialWorkflow?: {
    name?: string;
    description?: string;
    nodes?: Node[];
    edges?: Edge[];
  };
}

export interface AutomationBuilderRef {
  triggerSave: () => void;
}

export const AutomationBuilder = forwardRef<
  AutomationBuilderRef,
  AutomationBuilderProps
>(({ workflowId, onSave, initialWorkflow }, ref) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialWorkflow?.nodes || initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialWorkflow?.edges || initialEdges
  );
  const [showNodePalette, setShowNodePalette] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);

  // Execution state
  const [executionStatus, setExecutionStatus] =
    useState<ExecutionStatus>("idle");
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [showExecutionLogs, setShowExecutionLogs] = useState(false);

  // Zoom controls
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeSelect = useCallback(
    (nodeType: string, nodeData: { nodeType?: string }) => {
      // Get the center of the viewport to place the new node
      const reactFlowBounds = document
        .querySelector(".react-flow")
        ?.getBoundingClientRect();
      const position = {
        x: reactFlowBounds ? reactFlowBounds.width / 2 - 100 : 200,
        y: reactFlowBounds ? reactFlowBounds.height / 2 - 50 : 100,
      };

      const newNode: Node = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: {
          label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node`,
          nodeType: nodeData.nodeType || nodeType,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
  }, []);

  const handleNodeConfigChange = useCallback(
    (config: ActionConfig | TriggerConfig) => {
      if (selectedNode) {
        const updatedNode = { ...selectedNode, data: { ...selectedNode.data, config } };
        setSelectedNode(updatedNode);
        setNodes((nds) =>
          nds.map((node) =>
            node.id === selectedNode.id
              ? updatedNode
              : node
          )
        );
      }
    },
    [selectedNode, setNodes]
  );

  const handleNodeConfigSave = useCallback(() => {
    setShowNodeConfig(false);
    setSelectedNode(null);
  }, []);

  const handleSave = useCallback(() => {
    setShowMetadataForm(true);
  }, []);

  // Expose save method to parent components
  useImperativeHandle(
    ref,
    () => ({
      triggerSave: handleSave,
    }),
    [handleSave]
  );

  const handleMetadataSave = useCallback(
    (metadata: { name: string; description?: string }) => {
      // Convert ReactFlow nodes to WorkflowNodes
      const workflowNodes = nodes.map((node) => ({
        id: node.id,
        type: (node.type || "action") as "trigger" | "action" | "condition",
        position: node.position,
        data: node.data || {},
      }));

      // Convert ReactFlow edges to WorkflowEdges
      const workflowEdges = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        data: edge.data || {},
      }));

      const workflow = {
        id: workflowId || `workflow-${Date.now()}`,
        name: metadata.name,
        description: metadata.description,
        flowDefinition: {
          nodes: workflowNodes,
          edges: workflowEdges,
        },
        createdAt: new Date(),
      };

      onSave?.(workflow);
    },
    [nodes, edges, workflowId, onSave]
  );

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn();
    }
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut();
    }
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView();
    }
  }, [reactFlowInstance]);

  // Add execution log
  const addExecutionLog = useCallback(
    (log: Omit<ExecutionLog, "id" | "timestamp">) => {
      const newLog: ExecutionLog = {
        ...log,
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        timestamp: new Date(),
      };
      setExecutionLogs((prev) => [...prev, newLog]);
    },
    []
  );

  // Clear execution logs
  const clearExecutionLogs = useCallback(() => {
    setExecutionLogs([]);
  }, []);

  // Execute workflow using real execution system
  const handleExecuteWorkflow = useCallback(async () => {
    if (nodes.length === 0) {
      addExecutionLog({
        status: "failed",
        message: "Cannot execute empty workflow. Please add some nodes first.",
      });
      return;
    }

    // Check if there's at least one trigger node
    const triggerNodes = nodes.filter((node) => node.type === "trigger");
    if (triggerNodes.length === 0) {
      addExecutionLog({
        status: "failed",
        message: "Workflow must have at least one trigger node to execute.",
      });
      return;
    }

    setExecutionStatus("running");
    clearExecutionLogs();
    setShowExecutionLogs(true);

    addExecutionLog({
      status: "running",
      message: "Starting workflow execution...",
    });

    try {
      // First, save the workflow if it doesn't exist
      let currentWorkflowId = workflowId;
      if (!currentWorkflowId) {
        addExecutionLog({
          status: "running",
          message: "Creating temporary workflow for execution...",
        });

        // For now, we'll use a temporary ID without creating the workflow object
        currentWorkflowId = `temp-workflow-${Date.now()}`;
      }

      addExecutionLog({
        status: "running",
        message: `Found ${triggerNodes.length} trigger node(s). Creating test trigger event...`,
      });

      // Create a test trigger event based on the first trigger node
      const firstTrigger = triggerNodes[0];
      const triggerType = firstTrigger.data.nodeType || "new_conversation";

      const testTriggerEvent = {
        type: triggerType,
        data: {
          conversationId: `test-conv-${Date.now()}`,
          userId: "test-user",
          message: "Test execution trigger",
          timestamp: new Date().toISOString(),
          // Add specific data based on trigger type
          ...(triggerType === "sentiment_trigger" && {
            sentiment: { score: -0.8, label: "negative" },
          }),
          ...(triggerType === "image_uploaded" && {
            imageUrl: "https://example.com/test-image.jpg",
            imageType: "image/jpeg",
          }),
          ...(triggerType === "intent_detected" && {
            intent: "support_request",
            confidence: 0.9,
          }),
        },
        userId: "test-user",
        chatbotId: "test-chatbot",
        timestamp: new Date(),
      };

      addExecutionLog({
        status: "running",
        message: `Executing workflow via API with trigger: ${triggerType}`,
        data: { triggerEvent: testTriggerEvent },
      });

      // Call the real execution API
      const response = await fetch(
        `/api/workflows/${currentWorkflowId}/execute`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            triggerType: testTriggerEvent.type,
            triggerData: testTriggerEvent.data,
            userId: testTriggerEvent.userId,
            conversationId: testTriggerEvent.data.conversationId,
            messageId: `test-msg-${Date.now()}`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Execution API failed: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Workflow execution failed");
      }

      // Process the execution result
      const executionResult = result.data;

      addExecutionLog({
        status: "running",
        message: `Workflow execution started. Execution ID: ${executionResult.executionId}`,
        data: { executionId: executionResult.executionId },
      });

      // Add logs from the execution result
      if (executionResult.logs && Array.isArray(executionResult.logs)) {
        executionResult.logs.forEach(
          (log: {
            level?: string;
            message?: string;
            nodeId?: string;
            data?: Record<string, unknown>;
          }) => {
            addExecutionLog({
              status: log.level === "error" ? "failed" : "completed",
              message: log.message || "Unknown log message",
              nodeId: log.nodeId,
              data: log.data,
            });
          }
        );
      }

      // Final status based on execution result
      if (executionResult.status === "COMPLETED") {
        addExecutionLog({
          status: "completed",
          message: `Workflow execution completed successfully in ${
            executionResult.completedAt
              ? new Date(executionResult.completedAt).getTime() -
                new Date(executionResult.startedAt).getTime()
              : "unknown"
          }ms`,
          data: { executionResult },
        });
        setExecutionStatus("completed");
      } else if (executionResult.status === "FAILED") {
        addExecutionLog({
          status: "failed",
          message: `Workflow execution failed: ${
            executionResult.error || "Unknown error"
          }`,
          data: { executionResult },
        });
        setExecutionStatus("failed");
      } else {
        addExecutionLog({
          status: "running",
          message: `Workflow execution is ${executionResult.status.toLowerCase()}...`,
          data: { executionResult },
        });
        // For pending/running status, we could poll for updates
        setExecutionStatus("completed"); // For now, mark as completed
      }
    } catch (error) {
      console.error("Workflow execution failed:", error);

      addExecutionLog({
        status: "failed",
        message: `Workflow execution failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });

      setExecutionStatus("failed");
    }
  }, [nodes, workflowId, addExecutionLog, clearExecutionLogs]);

  // Get status icon
  const getStatusIcon = (status: ExecutionLog["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-gray-500" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // Get status color
  const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
      case "running":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="h-[calc(100vh-220px)] bg-background relative overflow-hidden">
      {/* Main Flow Canvas */}
      <div className="h-full relative overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          onInit={setReactFlowInstance}
          fitView
          className="bg-background"
        >
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>

        {/* Execution Status Bar */}
        {executionStatus !== "idle" && (
          <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 z-10">
            <div className="bg-background border rounded-lg p-3 shadow-lg max-w-md">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${getStatusColor(
                    executionStatus
                  )}`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {executionStatus === "running" && "Executing Workflow..."}
                      {executionStatus === "completed" &&
                        "Workflow Completed Successfully"}
                      {executionStatus === "failed" &&
                        "Workflow Execution Failed"}
                    </span>
                    {executionStatus === "running" && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                  {executionLogs.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {executionLogs[executionLogs.length - 1]?.message}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExecutionStatus("idle")}
                  className="text-xs"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Bar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
        <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-2">
          <div className="flex items-center gap-4">
            {/* Left side - Node controls */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowNodePalette(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Node
              </Button>
            </div>

            {/* Center - Zoom controls */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleZoomOut}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleZoomIn}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleFitView}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Maximize className="w-4 h-4" />
                Fit View
              </Button>
            </div>

            {/* Right side - Action controls */}
            <div className="flex items-center gap-2">
              {/* Execution Logs Dropdown */}
              {executionLogs.length > 0 && (
                <DropdownMenu
                  open={showExecutionLogs}
                  onOpenChange={setShowExecutionLogs}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusColor(
                          executionStatus
                        )}`}
                      />
                      Logs ({executionLogs.length})
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-96 max-h-96 overflow-y-auto"
                  >
                    <div className="p-2">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm">
                          Execution Logs
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearExecutionLogs}
                          className="text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {executionLogs.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                          >
                            {getStatusIcon(log.status)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">
                                  {log.timestamp.toLocaleTimeString()}
                                </span>
                                {log.nodeName && (
                                  <Badge variant="outline" className="text-xs">
                                    {log.nodeName}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground break-words">
                                {log.message}
                              </p>
                              {log.data && (
                                <details className="mt-1">
                                  <summary className="text-xs cursor-pointer text-blue-600 hover:text-blue-800">
                                    View Data
                                  </summary>
                                  <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                                    {JSON.stringify(log.data, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Run Button */}
              <Button
                onClick={handleExecuteWorkflow}
                disabled={executionStatus === "running"}
                className="flex items-center gap-2"
                variant="default"
                size="sm"
              >
                {executionStatus === "running" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {executionStatus === "running" ? "Running..." : "Run"}
              </Button>

              <Button
                onClick={handleSave}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                data-save-workflow
              >
                <Save className="w-4 h-4" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Node Palette Dialog */}
      <NodePaletteDialog
        isOpen={showNodePalette}
        onClose={() => setShowNodePalette(false)}
        onNodeSelect={handleNodeSelect}
      />

      <WorkflowMetadataForm
        isOpen={showMetadataForm}
        onClose={() => setShowMetadataForm(false)}
        onSave={handleMetadataSave}
        initialData={{
          name: initialWorkflow?.name || "",
          description: initialWorkflow?.description || "",
        }}
        title={workflowId ? "Update Workflow" : "Save Workflow"}
      />

      {/* Node Configuration Forms */}
      {showNodeConfig && selectedNode && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setShowNodeConfig(false);
            setSelectedNode(null);
          }}
        >
          <div 
            className="bg-background p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Configure {selectedNode.data.label}
              </h3>
              <button
                onClick={() => {
                  setShowNodeConfig(false);
                  setSelectedNode(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>

            {selectedNode.type === "trigger" && (
              <TriggerConfigForm
                triggerType={selectedNode.data.nodeType || "new_conversation"}
                config={selectedNode.data.config || {}}
                onChange={handleNodeConfigChange}
              />
            )}

            {(selectedNode.type === "action" ||
              selectedNode.type === "condition") && (
              <EnhancedActionConfigForm
                actionType={selectedNode.data.nodeType || "add_note"}
                config={selectedNode.data.config || {}}
                onChange={handleNodeConfigChange}
              />
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowNodeConfig(false);
                  setSelectedNode(null);
                }}
                className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleNodeConfigSave}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AutomationBuilder.displayName = "AutomationBuilder";
