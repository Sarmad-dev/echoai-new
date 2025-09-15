/**
 * WorkflowCompiler Service
 *
 * Converts React Flow graphs to XState machine definitions and provides
 * workflow validation and execution capabilities.
 */

import { createMachine, assign, fromPromise } from "xstate";
import type {
  ReactFlowDefinition,
  WorkflowNode,
  WorkflowEdge,
  XStateDefinition,
} from "../types/database";

// Workflow validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type:
    | "missing_trigger"
    | "orphaned_node"
    | "invalid_connection"
    | "missing_config";
  nodeId?: string;
  edgeId?: string;
  message: string;
}

export interface ValidationWarning {
  type: "performance" | "best_practice" | "deprecated";
  nodeId?: string;
  message: string;
}

// Workflow execution context
export interface WorkflowContext {
  triggerId: string;
  triggerData: Record<string, unknown>;
  executionId: string;
  userId: string;
  variables: Record<string, unknown>;
  errors: string[];
}

// Node type definitions
export interface TriggerNodeData {
  triggerType:
    | "new_conversation"
    | "intent_detected"
    | "negative_sentiment"
    | "image_uploaded"
    | "high_value_lead";
  config: {
    threshold?: number;
    sentimentThreshold?: number; // Added for negative sentiment triggers
    keywords?: string[];
    conditions?: Record<string, unknown>;
  };
}

export interface ActionNodeData {
  actionType:
    | "add_note"
    | "tag_conversation"
    | "send_slack"
    | "create_hubspot_contact"
    | "auto_approve_return";
  config: {
    message?: string;
    tags?: string[];
    channel?: string;
    fields?: Record<string, unknown>;
  };
}

export interface ConditionNodeData {
  conditionType: "if_then" | "switch" | "filter";
  config: {
    expression: string;
    branches?: Array<{
      condition: string;
      target: string;
    }>;
  };
}

export class WorkflowCompiler {
  /**
   * Validates a React Flow workflow definition
   */
  static validateWorkflow(
    flowDefinition: ReactFlowDefinition | { flowDefinition: ReactFlowDefinition }
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Handle nested flowDefinition structure that may come from frontend
    let actualFlowDefinition: ReactFlowDefinition;

    // Check if it's a nested structure with proper type checking
    if (typeof flowDefinition === 'object' && flowDefinition !== null && 'flowDefinition' in flowDefinition) {
      // Nested structure: { flowDefinition: { nodes: [], edges: [] } }
      actualFlowDefinition = (flowDefinition as { flowDefinition: ReactFlowDefinition }).flowDefinition;
    } else if (typeof flowDefinition === 'object' && flowDefinition !== null && 'nodes' in flowDefinition && 'edges' in flowDefinition) {
      // Direct structure: { nodes: [], edges: [] }
      actualFlowDefinition = flowDefinition as ReactFlowDefinition;
    } else {
      errors.push({
        type: "missing_trigger",
        message: "Invalid workflow definition structure",
      });
      return { isValid: false, errors, warnings };
    }

    const { nodes, edges } = actualFlowDefinition;

    // Enhanced validation with better error messages
    if (!nodes || !Array.isArray(nodes)) {
      errors.push({
        type: "missing_trigger",
        message: "Workflow definition must contain a valid nodes array",
      });
      return { isValid: false, errors, warnings };
    }

    if (nodes.length === 0) {
      errors.push({
        type: "missing_trigger",
        message: "Workflow must contain at least one node",
      });
      return { isValid: false, errors, warnings };
    }

    // Check for at least one trigger node
    const triggerNodes =
      nodes?.filter((node: WorkflowNode) => node.type === "trigger") || [];

    if (triggerNodes.length === 0) {
      errors.push({
        type: "missing_trigger",
        message: `Workflow must have at least one trigger node. Found ${
          nodes.length
        } nodes with types: ${nodes.map((n) => n.type).join(", ")}`,
      });
    }

    // Check for orphaned nodes (nodes with no connections)
    const connectedNodeIds = new Set([
      ...(edges?.map((edge: WorkflowEdge) => edge.source) || []),
      ...(edges?.map((edge: WorkflowEdge) => edge.target) || []),
    ]);

    const orphanedNodes =
      nodes?.filter(
        (node: WorkflowNode) =>
          !connectedNodeIds.has(node.id) && node.type !== "trigger"
      ) || [];

    orphanedNodes.forEach((node: WorkflowNode) => {
      errors.push({
        type: "orphaned_node",
        nodeId: node.id,
        message: `Node "${node.data.label}" is not connected to any other nodes`,
      });
    });

    // Validate node configurations
    nodes?.forEach((node: WorkflowNode) => {
      const configErrors = this.validateNodeConfig(node);
      errors.push(...configErrors);
    });

    // Check for invalid connections
    edges?.forEach((edge: WorkflowEdge) => {
      const sourceNode = nodes?.find((n: WorkflowNode) => n.id === edge.source);
      const targetNode = nodes?.find((n: WorkflowNode) => n.id === edge.target);

      if (!sourceNode || !targetNode) {
        errors.push({
          type: "invalid_connection",
          edgeId: edge.id,
          message: "Edge connects to non-existent node",
        });
        return;
      }

      // Validate connection types
      if (sourceNode.type === "action" && targetNode.type === "trigger") {
        errors.push({
          type: "invalid_connection",
          edgeId: edge.id,
          message: "Actions cannot connect to triggers",
        });
      }
    });

    // Performance warnings
    if (nodes && nodes.length > 50) {
      warnings.push({
        type: "performance",
        message:
          "Large workflows may impact performance. Consider breaking into smaller workflows.",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates individual node configuration
   */
  private static validateNodeConfig(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!node.data.config) {
      errors.push({
        type: "missing_config",
        nodeId: node.id,
        message: `Node "${node.data.label}" is missing configuration`,
      });
      return errors;
    }

    switch (node.type) {
      case "trigger":
        errors.push(...this.validateTriggerNode(node));
        break;
      case "action":
        errors.push(...this.validateActionNode(node));
        break;
      case "condition":
        errors.push(...this.validateConditionNode(node));
        break;
    }

    return errors;
  }

  private static validateTriggerNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.data.config as TriggerNodeData["config"];

    // Debug logging for troubleshooting
    console.log(`Validating trigger node ${node.id}:`, {
      nodeType: node.data.nodeType,
      config: config
    });

    if (!node.data.nodeType) {
      errors.push({
        type: "missing_config",
        nodeId: node.id,
        message: "Trigger node must specify triggerType",
      });
    }

    // Validate specific trigger configurations
    switch (node.data.nodeType) {
      case "negative_sentiment":
        // Check both 'threshold' and 'sentimentThreshold' for backward compatibility
        const thresholdValue = config.sentimentThreshold ?? config.threshold;
        
        // Convert threshold to number if it's a string
        const threshold = typeof thresholdValue === 'string' 
          ? parseFloat(thresholdValue) 
          : thresholdValue;
        
        if (
          threshold === undefined ||
          isNaN(threshold) ||
          threshold < -1 ||
          threshold > 1
        ) {
          errors.push({
            type: "missing_config",
            nodeId: node.id,
            message:
              "Negative sentiment trigger requires threshold between -1 and 1",
          });
        }
        break;
      case "intent_detected":
        if (!config.keywords || config.keywords.length === 0) {
          errors.push({
            type: "missing_config",
            nodeId: node.id,
            message: "Intent detection trigger requires keywords",
          });
        }
        break;
    }

    return errors;
  }

  private static validateActionNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.data.config as ActionNodeData["config"];

    if (!node.data.nodeType) {
      errors.push({
        type: "missing_config",
        nodeId: node.id,
        message: "Action node must specify actionType",
      });
    }

    // Validate specific action configurations
    switch (node.data.nodeType) {
      case "send_slack":
        if (!config.channel || !config.message) {
          errors.push({
            type: "missing_config",
            nodeId: node.id,
            message: "Slack action requires channel and message",
          });
        }
        break;
      case "create_hubspot_contact":
        if (!config.fields || Object.keys(config.fields).length === 0) {
          errors.push({
            type: "missing_config",
            nodeId: node.id,
            message: "HubSpot contact action requires field mappings",
          });
        }
        break;
    }

    return errors;
  }

  private static validateConditionNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.data.config as ConditionNodeData["config"];

    if (!config.expression) {
      errors.push({
        type: "missing_config",
        nodeId: node.id,
        message: "Condition node requires expression",
      });
    }

    return errors;
  }

  /**
   * Compiles React Flow definition to XState machine
   */
  static compileToStateMachine(
    flowDefinition: ReactFlowDefinition | { flowDefinition: ReactFlowDefinition },
    workflowId: string
  ): XStateDefinition {
    // Handle nested flowDefinition structure that may come from frontend
    let actualFlowDefinition: ReactFlowDefinition;

    // Check if it's a nested structure with proper type checking
    if (typeof flowDefinition === 'object' && flowDefinition !== null && 'flowDefinition' in flowDefinition) {
      // Nested structure: { flowDefinition: { nodes: [], edges: [] } }
      actualFlowDefinition = (flowDefinition as { flowDefinition: ReactFlowDefinition }).flowDefinition;
    } else if (typeof flowDefinition === 'object' && flowDefinition !== null && 'nodes' in flowDefinition && 'edges' in flowDefinition) {
      // Direct structure: { nodes: [], edges: [] }
      actualFlowDefinition = flowDefinition as ReactFlowDefinition;
    } else {
      throw new Error("Invalid workflow definition structure");
    }

    const { nodes, edges } = actualFlowDefinition;

    // Validate input
    if (!nodes || !Array.isArray(nodes)) {
      throw new Error("Flow definition must contain a valid nodes array");
    }

    if (!edges || !Array.isArray(edges)) {
      throw new Error("Flow definition must contain a valid edges array");
    }

    // Find trigger nodes (entry points)
    const triggerNodes = nodes.filter(
      (node: WorkflowNode) => node.type === "trigger"
    );

    // Build state machine states
    const states: Record<string, unknown> = {};

    // Add initial idle state
    states.idle = {
      on: {} as Record<string, unknown>,
    };

    // Add trigger states
    triggerNodes.forEach((trigger: WorkflowNode) => {
      const idleState = states.idle as { on: Record<string, unknown> };
      idleState.on[`TRIGGER_${trigger.data.nodeType?.toUpperCase()}`] = {
        target: trigger.id,
        actions: assign({
          triggerId: trigger.id,
          triggerData: ({ event }) =>
            (event as unknown as { data: Record<string, unknown> }).data,
        }),
      };
    });

    // Convert nodes to states
    nodes.forEach((node: WorkflowNode) => {
      states[node.id] = this.nodeToState(node, edges, nodes);
    });

    // Add final states
    states.completed = {
      type: "final",
    };

    states.failed = {
      type: "final",
    };

    const machineConfig = {
      id: workflowId,
      initial: "idle",
      context: {
        triggerId: "",
        triggerData: {},
        executionId: "",
        userId: "",
        variables: {},
        errors: [],
      },
      states,
    };

    return {
      id: workflowId,
      initial: "idle",
      states,
      context: machineConfig.context,
    };
  }

  /**
   * Converts a workflow node to an XState state
   */
  private static nodeToState(
    node: WorkflowNode,
    edges: WorkflowEdge[],
    _allNodes: WorkflowNode[]
  ): Record<string, unknown> {
    const outgoingEdges = edges.filter((edge) => edge.source === node.id);

    switch (node.type) {
      case "trigger":
        return {
          invoke: {
            src: "processTrigger",
            input: {
              nodeId: node.id,
              config: node.data.config,
            },
            onDone: {
              target: outgoingEdges[0]?.target || "completed",
            },
            onError: {
              target: "failed",
              actions: assign({
                errors: ({ context, event }) => [
                  ...context.errors,
                  `Trigger failed: ${event.error?.message || "Unknown error"}`,
                ],
              }),
            },
          },
        };

      case "action":
        return {
          invoke: {
            src: "executeAction",
            input: {
              nodeId: node.id,
              actionType: node.data.nodeType,
              config: node.data.config,
            },
            onDone: {
              target: outgoingEdges[0]?.target || "completed",
            },
            onError: {
              target: "failed",
              actions: assign({
                errors: ({ context, event }) => [
                  ...context.errors,
                  `Action failed: ${event.error?.message || "Unknown error"}`,
                ],
              }),
            },
          },
        };

      case "condition":
        const branches: Record<string, { target: string }> = {};

        outgoingEdges.forEach((edge) => {
          const condition = edge.data?.condition || "default";
          branches[condition.toUpperCase()] = {
            target: edge.target,
          };
        });

        return {
          invoke: {
            src: "evaluateCondition",
            input: {
              nodeId: node.id,
              expression: node.data.config.expression,
            },
            onDone: [
              ...Object.entries(branches).map(([condition, target]) => ({
                guard: ({ event }: { event: unknown }) =>
                  (event as { output: { result: string } }).output.result ===
                  condition,
                ...target,
              })),
              {
                target: "completed", // Default fallback
              },
            ],
            onError: {
              target: "failed",
              actions: assign({
                errors: ({ context, event }) => [
                  ...context.errors,
                  `Condition evaluation failed: ${
                    event.error?.message || "Unknown error"
                  }`,
                ],
              }),
            },
          },
        };

      default:
        return {
          always: {
            target: "completed",
          },
        };
    }
  }

  /**
   * Creates an executable XState machine from workflow definition
   */
  static createExecutableMachine(xstateDefinition: XStateDefinition) {
    return createMachine(xstateDefinition, {
      actors: {
        processTrigger: fromPromise(
          async ({ input }: { input: Record<string, unknown> }) => {
            // This will be implemented by the workflow execution engine
            return { success: true, data: input };
          }
        ),

        executeAction: fromPromise(
          async ({ input }: { input: Record<string, unknown> }) => {
            // This will be implemented by the workflow execution engine
            return { success: true, data: input };
          }
        ),

        evaluateCondition: fromPromise(
          async ({ input }: { input: Record<string, unknown> }) => {
            // This will be implemented by the workflow execution engine
            return { result: "default", data: input };
          }
        ),
      },
    });
  }
}
