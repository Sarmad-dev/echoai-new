import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { workflowService } from "@/lib/workflow-service";
import type { WorkflowTemplate } from "@/types/workflow-templates";

// Define the customization option type
type CustomizationOption = {
  type: "number" | "boolean" | "text" | "select";
  label: string;
  description?: string;
  options?: string[];
  defaultValue?: any;
};

type CustomizationOptions = {
  [key: string]: CustomizationOption;
};

/**
 * GET /api/workflows/[id]/export
 *
 * Exports a workflow as a reusable template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: workflowId } = await params;
    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    // Get the workflow
    const workflow = await workflowService.getWorkflow(
      workflowId,
      session.user.id
    );
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found or access denied" },
        { status: 404 }
      );
    }

    // Convert workflow to template format
    const template: WorkflowTemplate = {
      id: `custom-${workflow.id}`,
      name: workflow.name,
      description: workflow.description || "Custom workflow template",
      category: "Custom",
      complexity: determineComplexity(workflow),
      estimatedSetupTime: estimateSetupTime(workflow),
      tags: extractTags(workflow),
      triggerType: extractTriggerType(workflow),
      actionTypes: extractActionTypes(workflow),
      flowDefinition: workflow.flowDefinition,
      source: "custom",
      exportedAt: new Date().toISOString(),
      version: "1.0",
      author: session.user.email || session.user.id,
    };

    // Generate customization options based on workflow configuration
    const customizationOptions = generateCustomizationOptions(workflow);
    if (Object.keys(customizationOptions).length > 0) {
      template.customizationOptions = customizationOptions;
    }

    return NextResponse.json({
      success: true,
      data: {
        template,
        exportMetadata: {
          exportedBy: session.user.id,
          exportedAt: new Date().toISOString(),
          originalWorkflowId: workflow.id,
          workflowCreatedAt: workflow.createdAt,
          workflowUpdatedAt: workflow.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Error exporting workflow as template:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export workflow as template",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows/[id]/export
 *
 * Exports a workflow as a template with custom metadata
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id: workflowId } = await params;
    const body = await request.json();
    const {
      templateName,
      templateDescription,
      category,
      complexity,
      tags = [],
      includeCustomizationOptions = true,
    } = body;

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 }
      );
    }

    // Get the workflow
    const workflow = await workflowService.getWorkflow(
      workflowId,
      session.user.id
    );
    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found or access denied" },
        { status: 404 }
      );
    }

    // Create template with custom metadata
    const template: WorkflowTemplate = {
      id: `custom-${workflow.id}-${Date.now()}`,
      name: templateName || workflow.name,
      description:
        templateDescription ||
        workflow.description ||
        "Custom workflow template",
      category: category || "Custom",
      complexity: complexity || determineComplexity(workflow),
      estimatedSetupTime: estimateSetupTime(workflow),
      tags: tags.length > 0 ? tags : extractTags(workflow),
      triggerType: extractTriggerType(workflow),
      actionTypes: extractActionTypes(workflow),
      flowDefinition: workflow.flowDefinition,
      source: "custom",
      exportedAt: new Date().toISOString(),
      version: "1.0",
      author: session.user.email || session.user.id,
    };

    // Generate customization options if requested
    if (includeCustomizationOptions) {
      const customizationOptions = generateCustomizationOptions(workflow);
      if (Object.keys(customizationOptions).length > 0) {
        template.customizationOptions = customizationOptions;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        template,
        exportMetadata: {
          exportedBy: session.user.id,
          exportedAt: new Date().toISOString(),
          originalWorkflowId: workflow.id,
          customMetadata: {
            templateName,
            templateDescription,
            category,
            complexity,
            tags,
            includeCustomizationOptions,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error exporting workflow as template with metadata:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to export workflow as template",
      },
      { status: 500 }
    );
  }
}

/**
 * Determines the complexity level of a workflow based on its structure
 */
function determineComplexity(workflow: {
  flowDefinition?: { nodes?: Array<{ type: string }> };
}): "Simple" | "Intermediate" | "Advanced" {
  const nodeCount = workflow.flowDefinition?.nodes?.length || 0;
  const hasConditions =
    workflow.flowDefinition?.nodes?.some((node) => node.type === "condition") ||
    false;

  if (nodeCount <= 3 && !hasConditions) {
    return "Simple";
  } else if (nodeCount <= 6 || hasConditions) {
    return "Intermediate";
  } else {
    return "Advanced";
  }
}

/**
 * Estimates setup time based on workflow complexity
 */
function estimateSetupTime(workflow: {
  flowDefinition?: { nodes?: Array<{ type: string }> };
}): string {
  const complexity = determineComplexity(workflow);
  const nodeCount = workflow.flowDefinition?.nodes?.length || 0;

  switch (complexity) {
    case "Simple":
      return "5-8 minutes";
    case "Intermediate":
      return nodeCount > 4 ? "10-15 minutes" : "8-12 minutes";
    case "Advanced":
      return nodeCount > 8 ? "20-30 minutes" : "15-20 minutes";
    default:
      return "10-15 minutes";
  }
}

/**
 * Extracts relevant tags from workflow configuration
 */
function extractTags(workflow: {
  flowDefinition?: {
    nodes?: Array<{ type: string; data?: { nodeType?: string } }>;
  };
}): string[] {
  const tags: string[] = ["custom"];

  // Add tags based on node types and configurations
  if (workflow.flowDefinition?.nodes) {
    workflow.flowDefinition.nodes.forEach((node) => {
      if (node.type === "trigger") {
        const nodeType = node.data?.nodeType || "";
        if (nodeType.includes("sentiment")) tags.push("sentiment");
        if (nodeType.includes("image")) tags.push("image-analysis");
        if (nodeType.includes("lead")) tags.push("leads");
        if (nodeType.includes("conversation")) tags.push("customer-service");
      }

      if (node.type === "action") {
        const nodeType = node.data?.nodeType || "";
        if (nodeType.includes("slack")) tags.push("slack");
        if (nodeType.includes("hubspot")) tags.push("hubspot", "crm");
        if (nodeType.includes("tag")) tags.push("tracking");
        if (nodeType.includes("note")) tags.push("notes");
        if (nodeType.includes("return")) tags.push("returns");
      }
    });
  }

  return Array.from(new Set(tags)); // Remove duplicates
}

/**
 * Extracts the primary trigger type from workflow
 */
function extractTriggerType(workflow: {
  flowDefinition?: {
    nodes?: Array<{ type: string; data?: { nodeType?: string } }>;
  };
}): string {
  const triggerNodes =
    workflow.flowDefinition?.nodes?.filter((node) => node.type === "trigger") ||
    [];

  if (triggerNodes.length === 0) {
    return "Unknown Trigger";
  }

  const firstTrigger = triggerNodes[0];
  const nodeType = firstTrigger.data?.nodeType || "";

  // Map node types to user-friendly trigger names
  const triggerTypeMap: Record<string, string> = {
    new_conversation: "New Conversation",
    sentiment_trigger: "Negative Sentiment",
    image_uploaded: "Image Uploaded",
    high_value_lead: "High Value Lead",
    intent_detected: "Intent Detected",
  };

  return triggerTypeMap[nodeType] || "Custom Trigger";
}

/**
 * Extracts action types from workflow
 */
function extractActionTypes(workflow: {
  flowDefinition?: {
    nodes?: Array<{ type: string; data?: { nodeType?: string } }>;
  };
}): string[] {
  const actionNodes =
    workflow.flowDefinition?.nodes?.filter((node) => node.type === "action") ||
    [];

  const actionTypeMap: Record<string, string> = {
    send_slack_message: "Send Slack Message",
    create_hubspot_contact: "Create HubSpot Contact",
    tag_conversation: "Tag Conversation",
    add_note: "Add Note",
    auto_approve_return: "Auto Approve Return",
    assign_agent: "Assign Agent",
    update_google_sheets: "Update Google Sheets",
  };

  return actionNodes.map((node) => {
    const nodeType = node.data?.nodeType || "";
    return actionTypeMap[nodeType] || "Custom Action";
  });
}

/**
 * Generates customization options based on workflow configuration
 */
function generateCustomizationOptions(workflow: {
  flowDefinition?: {
    nodes?: Array<{
      data?: { config?: Record<string, unknown>; nodeType?: string };
    }>;
  };
}): CustomizationOptions {
  const options: CustomizationOptions = {};

  if (workflow.flowDefinition?.nodes) {
    workflow.flowDefinition.nodes.forEach((node) => {
      const config = node.data?.config || {};
      const nodeType = node.data?.nodeType || "";

      // Generate options based on common configurable parameters
      if (config.channel && nodeType.includes("slack")) {
        options.slackChannel = {
          type: "text",
          label: "Slack Channel",
          description: "Channel to send notifications to",
          defaultValue: config.channel,
        };
      }

      if (config.sentimentThreshold !== undefined) {
        options.sentimentThreshold = {
          type: "number",
          label: "Sentiment Threshold",
          description: "Sentiment score threshold for triggering (-1.0 to 1.0)",
          defaultValue: config.sentimentThreshold,
        };
      }

      if (config.minConfidence !== undefined) {
        options.minConfidence = {
          type: "number",
          label: "Minimum Confidence",
          description: "Minimum confidence score required (0.0 to 1.0)",
          defaultValue: config.minConfidence,
        };
      }

      if (config.tags && Array.isArray(config.tags)) {
        options.tags = {
          type: "text",
          label: "Tags",
          description: "Comma-separated list of tags to apply",
          defaultValue: config.tags.join(", "),
        };
      }

      if (config.pipeline) {
        options.pipeline = {
          type: "select",
          label: "Pipeline",
          description: "Which pipeline to use",
          options: ["sales", "marketing", "support"],
          defaultValue: config.pipeline,
        };
      }
    });
  }

  return options;
}
