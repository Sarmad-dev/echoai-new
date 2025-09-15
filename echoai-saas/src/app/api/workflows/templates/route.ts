import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { workflowService } from "@/lib/workflow-service";
import type { WorkflowTemplate } from "@/types/workflow-templates";

// Built-in workflow templates
const BUILT_IN_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "auto-return-approval",
    name: "Auto Return Approval",
    description:
      "Automatically approve returns for products in good condition based on image analysis",
    category: "Customer Service",
    complexity: "Intermediate",
    estimatedSetupTime: "10-15 minutes",
    usageCount: 1247,
    rating: 4.8,
    tags: ["returns", "automation", "image-analysis", "customer-service"],
    triggerType: "Image Uploaded",
    actionTypes: ["Auto Approve Return", "Send Notification"],
    flowDefinition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 100, y: 100 },
          data: {
            label: "Image Uploaded",
            nodeType: "image_uploaded",
            config: {
              triggerType: "image_uploaded",
              analysisType: "product_condition",
              minConfidence: 0.8,
            },
          },
        },
        {
          id: "condition-1",
          type: "condition",
          position: { x: 300, y: 100 },
          data: {
            label: "Check Product Condition",
            nodeType: "condition_check",
            config: {
              conditionType: "image_analysis_result",
              field: "condition",
              operator: "equals",
              value: "good",
            },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 500, y: 50 },
          data: {
            label: "Auto Approve Return",
            nodeType: "auto_approve_return",
            config: {
              actionType: "auto_approve_return",
              approvalReason: "Product condition verified as good",
              notifyCustomer: true,
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 500, y: 150 },
          data: {
            label: "Send Notification",
            nodeType: "send_slack_message",
            config: {
              actionType: "send_slack_message",
              channel: "#customer-service",
              message: "Return automatically approved for {{customerEmail}}",
            },
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "condition-1" },
        { id: "e2-3", source: "condition-1", target: "action-1" },
        { id: "e2-4", source: "condition-1", target: "action-2" },
      ],
    },
    customizationOptions: {
      minConfidence: {
        type: "number",
        label: "Minimum Confidence Score",
        description:
          "Minimum confidence required for automatic approval (0.0 - 1.0)",
        defaultValue: 0.8,
      },
      slackChannel: {
        type: "text",
        label: "Slack Channel",
        description: "Channel to send notifications to",
        defaultValue: "#customer-service",
      },
      notifyCustomer: {
        type: "boolean",
        label: "Notify Customer",
        description:
          "Send email notification to customer when return is approved",
        defaultValue: true,
      },
    },
  },
  {
    id: "lead-prioritization",
    name: "Lead Prioritization & CRM Integration",
    description:
      "Identify high-value leads and automatically create contacts in your CRM with priority scoring",
    category: "Sales",
    complexity: "Advanced",
    estimatedSetupTime: "15-20 minutes",
    usageCount: 892,
    rating: 4.9,
    tags: ["sales", "crm", "lead-scoring", "hubspot", "automation"],
    triggerType: "High Value Lead",
    actionTypes: ["Create HubSpot Contact", "Send Slack Message", "Add Note"],
    flowDefinition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 100, y: 100 },
          data: {
            label: "High Value Lead Detected",
            nodeType: "high_value_lead",
            config: {
              triggerType: "high_value_lead",
              minScore: 80,
              keywords: ["enterprise", "demo", "bulk order", "integration"],
            },
          },
        },
        {
          id: "condition-1",
          type: "condition",
          position: { x: 300, y: 100 },
          data: {
            label: "Check Lead Score",
            nodeType: "condition_check",
            config: {
              conditionType: "lead_score",
              field: "score",
              operator: "gte",
              value: 90,
            },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 500, y: 50 },
          data: {
            label: "Create HubSpot Contact",
            nodeType: "create_hubspot_contact",
            config: {
              actionType: "create_hubspot_contact",
              pipeline: "sales",
              dealStage: "qualified-lead",
              priority: "high",
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 500, y: 120 },
          data: {
            label: "Notify Sales Team",
            nodeType: "send_slack_message",
            config: {
              actionType: "send_slack_message",
              channel: "#sales-alerts",
              message:
                "🔥 High-priority lead detected: {{leadEmail}} (Score: {{leadScore}})",
            },
          },
        },
        {
          id: "action-3",
          type: "action",
          position: { x: 500, y: 190 },
          data: {
            label: "Add Internal Note",
            nodeType: "add_note",
            config: {
              actionType: "add_note",
              note: "High-value lead automatically processed. Score: {{leadScore}}",
            },
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "condition-1" },
        { id: "e2-3", source: "condition-1", target: "action-1" },
        { id: "e2-4", source: "condition-1", target: "action-2" },
        { id: "e2-5", source: "condition-1", target: "action-3" },
      ],
    },
    customizationOptions: {
      minLeadScore: {
        type: "number",
        label: "Minimum Lead Score",
        description: "Minimum score to trigger high-value lead actions (0-100)",
        defaultValue: 80,
      },
      salesChannel: {
        type: "text",
        label: "Sales Slack Channel",
        description: "Slack channel for sales notifications",
        defaultValue: "#sales-alerts",
      },
      hubspotPipeline: {
        type: "select",
        label: "HubSpot Pipeline",
        description: "Which pipeline to add leads to",
        options: ["sales", "marketing", "enterprise"],
        defaultValue: "sales",
      },
    },
  },
  {
    id: "customer-support-escalation",
    name: "Customer Support Escalation",
    description:
      "Detect negative sentiment and escalate urgent issues to senior support agents",
    category: "Customer Service",
    complexity: "Intermediate",
    estimatedSetupTime: "8-12 minutes",
    usageCount: 1563,
    rating: 4.7,
    tags: ["support", "escalation", "sentiment", "urgent", "customer-service"],
    triggerType: "Negative Sentiment",
    actionTypes: ["Tag Conversation", "Send Slack Message", "Assign Agent"],
    flowDefinition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 100, y: 100 },
          data: {
            label: "Negative Sentiment Detected",
            nodeType: "sentiment_trigger",
            config: {
              triggerType: "sentiment_trigger",
              sentimentThreshold: -0.6,
              consecutiveMessages: 2,
            },
          },
        },
        {
          id: "condition-1",
          type: "condition",
          position: { x: 300, y: 100 },
          data: {
            label: "Check Severity",
            nodeType: "condition_check",
            config: {
              conditionType: "sentiment_score",
              field: "sentiment",
              operator: "lt",
              value: -0.8,
            },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 500, y: 50 },
          data: {
            label: "Tag as Urgent",
            nodeType: "tag_conversation",
            config: {
              actionType: "tag_conversation",
              tags: ["urgent", "negative-sentiment", "escalated"],
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 500, y: 120 },
          data: {
            label: "Alert Support Team",
            nodeType: "send_slack_message",
            config: {
              actionType: "send_slack_message",
              channel: "#support-urgent",
              message:
                "⚠️ Urgent: Negative sentiment detected for {{customerEmail}}",
            },
          },
        },
        {
          id: "action-3",
          type: "action",
          position: { x: 500, y: 190 },
          data: {
            label: "Assign Senior Agent",
            nodeType: "assign_agent",
            config: {
              actionType: "assign_agent",
              agentTier: "senior",
              priority: "high",
            },
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "condition-1" },
        { id: "e2-3", source: "condition-1", target: "action-1" },
        { id: "e2-4", source: "condition-1", target: "action-2" },
        { id: "e2-5", source: "condition-1", target: "action-3" },
      ],
    },
    customizationOptions: {
      sentimentThreshold: {
        type: "number",
        label: "Sentiment Threshold",
        description:
          "Sentiment score threshold for triggering escalation (-1.0 to 1.0)",
        defaultValue: -0.6,
      },
      urgentChannel: {
        type: "text",
        label: "Urgent Support Channel",
        description: "Slack channel for urgent support notifications",
        defaultValue: "#support-urgent",
      },
      autoAssign: {
        type: "boolean",
        label: "Auto-assign Senior Agent",
        description:
          "Automatically assign conversation to senior support agent",
        defaultValue: true,
      },
    },
  },
];

/**
 * GET /api/workflows/templates
 *
 * Retrieves available workflow templates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const complexity = searchParams.get("complexity");
    const tags = searchParams.get("tags")?.split(",");

    let filteredTemplates = [...BUILT_IN_TEMPLATES];

    // Apply filters
    if (category && category !== "all") {
      filteredTemplates = filteredTemplates.filter(
        (t) => t.category === category
      );
    }

    if (complexity && complexity !== "all") {
      filteredTemplates = filteredTemplates.filter(
        (t) => t.complexity === complexity
      );
    }

    if (tags && tags.length > 0) {
      filteredTemplates = filteredTemplates.filter((t) =>
        tags.some((tag) => t.tags.includes(tag))
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        templates: filteredTemplates,
        categories: Array.from(new Set(BUILT_IN_TEMPLATES.map((t) => t.category))),
        complexities: ["Simple", "Intermediate", "Advanced"],
        totalCount: filteredTemplates.length,
      },
    });
  } catch (error) {
    console.error("Error fetching workflow templates:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch workflow templates",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows/templates
 *
 * Creates a workflow from a template with optional customizations
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { templateId, chatbotId, customizations = {}, workflowName } = body;

    if (!templateId || !chatbotId) {
      return NextResponse.json(
        { error: "Template ID and Chatbot ID are required" },
        { status: 400 }
      );
    }

    // Find the template
    const template = BUILT_IN_TEMPLATES.find((t) => t.id === templateId);
    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Apply customizations to the template
    let customizedFlowDefinition = { ...template.flowDefinition };

    if (
      template.customizationOptions &&
      Object.keys(customizations).length > 0
    ) {
      // Apply customizations to node configurations
      customizedFlowDefinition = {
        ...customizedFlowDefinition,
        nodes: customizedFlowDefinition.nodes.map((node) => {
          const updatedConfig = { ...node.data.config };

          // Apply relevant customizations based on node type and config
          Object.entries(customizations).forEach(([key, value]) => {
            if (template.customizationOptions?.[key]) {
              // Map customization keys to config properties
              switch (key) {
                case "minConfidence":
                  if (node.data.nodeType === "image_uploaded") {
                    updatedConfig.minConfidence = value;
                  }
                  break;
                case "slackChannel":
                case "salesChannel":
                case "urgentChannel":
                  if (node.data.nodeType === "send_slack_message") {
                    updatedConfig.channel = value;
                  }
                  break;
                case "sentimentThreshold":
                  if (node.data.nodeType === "sentiment_trigger") {
                    updatedConfig.sentimentThreshold = value;
                  }
                  break;
                case "minLeadScore":
                  if (node.data.nodeType === "high_value_lead") {
                    updatedConfig.minScore = value;
                  }
                  break;
                case "hubspotPipeline":
                  if (node.data.nodeType === "create_hubspot_contact") {
                    updatedConfig.pipeline = value;
                  }
                  break;
                case "notifyCustomer":
                case "autoAssign":
                  updatedConfig[key] = value;
                  break;
              }
            }
          });

          return {
            ...node,
            data: {
              ...node.data,
              config: updatedConfig,
            },
          };
        }),
      };
    }

    // Create the workflow using the workflow service
    const workflowRequest = {
      name: workflowName || `${template.name} (from template)`,
      description: `Created from template: ${template.name}. ${template.description}`,
      flowDefinition: customizedFlowDefinition,
      userId: session.user.id,
      chatbotId,
      isActive: true,
    };

    const result = await workflowService.createWorkflow(workflowRequest);

    return NextResponse.json({
      success: true,
      data: {
        workflow: result.workflow,
        validation: result.validation,
        templateUsed: {
          id: template.id,
          name: template.name,
          customizations,
        },
      },
    });
  } catch (error) {
    console.error("Error creating workflow from template:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create workflow from template",
      },
      { status: 500 }
    );
  }
}
