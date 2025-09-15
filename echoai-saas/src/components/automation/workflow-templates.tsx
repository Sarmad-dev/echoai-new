"use client";

import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkflowNode, WorkflowEdge } from "@/types/database";
import {
  AlertTriangle,
  MessageSquare,
  TrendingUp,
  CheckCircle,
  Download,
  Upload,
  Settings,
  Star,
  Clock,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  triggerType: string;
  actionTypes: string[];
  complexity: "Simple" | "Intermediate" | "Advanced";
  estimatedSetupTime: string;
  usageCount?: number;
  rating?: number;
  tags: string[];
  flowDefinition: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
  };
  customizationOptions?: {
    [key: string]: {
      type: "text" | "number" | "select" | "boolean" | "slider";
      label: string;
      description?: string;
      options?: string[];
      defaultValue?: unknown;
    };
  };
}

const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "auto-return-approval",
    name: "Auto Return Approval",
    description:
      "Automatically approve returns for products in good condition based on image analysis",
    category: "Customer Service",
    icon: <CheckCircle className="w-5 h-5" />,
    triggerType: "Image Uploaded",
    actionTypes: ["Auto Approve Return", "Send Notification"],
    complexity: "Intermediate",
    estimatedSetupTime: "10-15 minutes",
    usageCount: 1247,
    rating: 4.8,
    tags: ["returns", "automation", "image-analysis", "customer-service"],
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
    icon: <TrendingUp className="w-5 h-5" />,
    triggerType: "High Value Lead",
    actionTypes: ["Create HubSpot Contact", "Send Slack Message", "Add Note"],
    complexity: "Advanced",
    estimatedSetupTime: "15-20 minutes",
    usageCount: 892,
    rating: 4.9,
    tags: ["sales", "crm", "lead-scoring", "hubspot", "automation"],
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
    icon: <AlertTriangle className="w-5 h-5" />,
    triggerType: "Negative Sentiment",
    actionTypes: ["Tag Conversation", "Send Slack Message", "Assign Agent"],
    complexity: "Intermediate",
    estimatedSetupTime: "8-12 minutes",
    usageCount: 1563,
    rating: 4.7,
    tags: ["support", "escalation", "sentiment", "urgent", "customer-service"],
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
  {
    id: "new-conversation-welcome",
    name: "New Conversation Welcome & Tracking",
    description:
      "Automatically greet new customers and set up conversation tracking",
    category: "Customer Service",
    icon: <MessageSquare className="w-5 h-5" />,
    triggerType: "New Conversation",
    actionTypes: ["Add Note", "Tag Conversation", "Send Welcome"],
    complexity: "Simple",
    estimatedSetupTime: "5-8 minutes",
    usageCount: 2341,
    rating: 4.6,
    tags: ["welcome", "onboarding", "tracking", "customer-service"],
    flowDefinition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 100, y: 100 },
          data: {
            label: "New Conversation Started",
            nodeType: "new_conversation",
            config: {
              triggerType: "new_conversation",
              firstTimeUser: true,
            },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 400, y: 50 },
          data: {
            label: "Add Welcome Note",
            nodeType: "add_note",
            config: {
              actionType: "add_note",
              note: "New conversation started at {{timestamp}}",
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 400, y: 150 },
          data: {
            label: "Tag Conversation",
            nodeType: "tag_conversation",
            config: {
              actionType: "tag_conversation",
              tags: ["new-customer", "welcome"],
            },
          },
        },
      ],
      edges: [
        { id: "e1-2", source: "trigger-1", target: "action-1" },
        { id: "e1-3", source: "trigger-1", target: "action-2" },
      ],
    },
    customizationOptions: {
      welcomeMessage: {
        type: "text",
        label: "Welcome Message",
        description: "Custom welcome message for new conversations",
        defaultValue: "Welcome! How can we help you today?",
      },
      trackingTags: {
        type: "text",
        label: "Tracking Tags",
        description: "Comma-separated tags to add to new conversations",
        defaultValue: "new-customer,welcome",
      },
    },
  },
  {
    id: "inventory-alert-system",
    name: "Inventory Alert System",
    description:
      "Monitor inventory levels through image analysis and send alerts when stock is low",
    category: "Operations",
    icon: <Zap className="w-5 h-5" />,
    triggerType: "Image Uploaded",
    actionTypes: ["Analyze Inventory", "Send Alert", "Update Sheets"],
    complexity: "Advanced",
    estimatedSetupTime: "20-25 minutes",
    usageCount: 456,
    rating: 4.5,
    tags: ["inventory", "monitoring", "alerts", "operations", "image-analysis"],
    flowDefinition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 100, y: 100 },
          data: {
            label: "Inventory Image Uploaded",
            nodeType: "image_uploaded",
            config: {
              triggerType: "image_uploaded",
              analysisType: "inventory_count",
              category: "inventory",
            },
          },
        },
        {
          id: "condition-1",
          type: "condition",
          position: { x: 300, y: 100 },
          data: {
            label: "Check Stock Level",
            nodeType: "condition_check",
            config: {
              conditionType: "inventory_count",
              field: "count",
              operator: "lt",
              value: 10,
            },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 500, y: 50 },
          data: {
            label: "Send Low Stock Alert",
            nodeType: "send_slack_message",
            config: {
              actionType: "send_slack_message",
              channel: "#inventory-alerts",
              message:
                "📦 Low stock alert: {{productName}} - Only {{count}} items remaining",
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 500, y: 150 },
          data: {
            label: "Update Inventory Sheet",
            nodeType: "update_google_sheets",
            config: {
              actionType: "update_google_sheets",
              spreadsheetId: "inventory-tracker",
              range: "A:C",
              values: ["{{productName}}", "{{count}}", "{{timestamp}}"],
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
      lowStockThreshold: {
        type: "number",
        label: "Low Stock Threshold",
        description: "Number of items below which to trigger alert",
        defaultValue: 10,
      },
      alertChannel: {
        type: "text",
        label: "Alert Channel",
        description: "Slack channel for inventory alerts",
        defaultValue: "#inventory-alerts",
      },
      spreadsheetId: {
        type: "text",
        label: "Google Sheets ID",
        description: "ID of the Google Sheets document to update",
        defaultValue: "",
      },
    },
  },
  {
    id: "help-desk-automation",
    name: "Help Desk Automation",
    description:
      "Automatically escalate and triage customer conversations based on sentiment, keywords, and response times",
    category: "Customer Support",
    icon: <AlertTriangle className="w-5 h-5" />,
    triggerType: "escalation_trigger",
    actionTypes: ["tag_conversation", "send_slack_message", "add_note"],
    complexity: "Advanced",
    estimatedSetupTime: "15-20 minutes",
    usageCount: 892,
    rating: 4.8,
    tags: [
      "help-desk",
      "escalation",
      "triage",
      "automation",
      "customer-service",
      "sentiment",
    ],
    flowDefinition: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 100, y: 100 },
          data: {
            label: "Escalation Trigger",
            nodeType: "escalation_trigger",
            config: {
              sentimentThreshold: -0.3,
              keywords: ["urgent", "emergency", "lawsuit", "refund"],
              conditions: {
                responseTimeMinutes: 30,
                notifyTeam: true,
                autoAssign: true,
              },
            },
          },
        },
        {
          id: "trigger-2",
          type: "trigger",
          position: { x: 100, y: 300 },
          data: {
            label: "Conversation Triage",
            nodeType: "conversation_triage",
            config: {
              sentimentThreshold: -0.6,
              keywords: ["critical", "important", "asap"],
              conditions: {
                messageCount: 5,
                responseTimeMinutes: 30,
                defaultPriority: "medium",
                addToPriorityQueue: true,
                notifyAgents: true,
              },
            },
          },
        },
        {
          id: "condition-1",
          type: "condition",
          position: { x: 350, y: 100 },
          data: {
            label: "Check Urgency Level",
            nodeType: "condition_check",
            config: {
              conditionType: "urgency_level",
              field: "urgencyLevel",
              operator: "eq",
              value: "critical",
            },
          },
        },
        {
          id: "action-1",
          type: "action",
          position: { x: 600, y: 50 },
          data: {
            label: "Tag as Critical",
            nodeType: "tag_conversation",
            config: {
              actionType: "tag_conversation",
              tags: ["critical", "escalated", "urgent-response"],
            },
          },
        },
        {
          id: "action-2",
          type: "action",
          position: { x: 600, y: 150 },
          data: {
            label: "Notify Support Team",
            nodeType: "send_slack_message",
            config: {
              actionType: "send_slack_message",
              channel: "#support-urgent",
              message:
                "🚨 Critical conversation escalated: {{conversationId}} - Sentiment: {{sentimentScore}} - Reason: {{escalationReason}}",
            },
          },
        },
        {
          id: "action-3",
          type: "action",
          position: { x: 350, y: 300 },
          data: {
            label: "Add Triage Note",
            nodeType: "add_note",
            config: {
              actionType: "add_note",
              note: "Conversation triaged with priority: {{priority}} - Reason: {{triageReason}} - Added to priority queue at {{timestamp}}",
              visibility: "internal",
            },
          },
        },
        {
          id: "action-4",
          type: "action",
          position: { x: 600, y: 300 },
          data: {
            label: "Update Priority Queue",
            nodeType: "tag_conversation",
            config: {
              actionType: "tag_conversation",
              tags: ["triaged", "priority-queue", "{{priority}}"],
            },
          },
        },
      ],
      edges: [
        {
          id: "e1-2",
          source: "trigger-1",
          target: "condition-1",
          type: "default",
        },
        {
          id: "e2-3",
          source: "condition-1",
          target: "action-1",
          type: "default",
          data: { label: "Critical" },
        },
        {
          id: "e2-4",
          source: "condition-1",
          target: "action-2",
          type: "default",
          data: { label: "Critical" },
        },
        {
          id: "e3-5",
          source: "trigger-2",
          target: "action-3",
          type: "default",
        },
        {
          id: "e4-6",
          source: "action-3",
          target: "action-4",
          type: "default",
        },
      ],
    },
    customizationOptions: {
      sentimentThreshold: {
        type: "number",
        label: "Escalation Sentiment Threshold",
        description: "Sentiment score below which conversations are escalated",
        defaultValue: -0.3,
      },
      triageSentimentThreshold: {
        type: "number",
        label: "Triage Sentiment Threshold",
        description: "Sentiment score below which conversations are triaged",
        defaultValue: -0.6,
      },
      responseTimeMinutes: {
        type: "number",
        label: "Response Time Threshold (minutes)",
        description: "Time after which conversations are escalated/triaged",
        defaultValue: 30,
      },
      slackChannel: {
        type: "text",
        label: "Slack Notification Channel",
        description: "Channel to send escalation notifications",
        defaultValue: "#support-urgent",
      },
    },
  },
];

interface WorkflowTemplatesProps {
  onSelectTemplate: (
    template: WorkflowTemplate,
    customizations?: Record<string, unknown>
  ) => void;
  onImportTemplate?: (templateData: string) => void;
  onExportTemplate?: (template: WorkflowTemplate) => void;
}

export function WorkflowTemplates({
  onSelectTemplate,
  onImportTemplate,
  onExportTemplate,
}: WorkflowTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedComplexity, setSelectedComplexity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkflowTemplate | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customizations, setCustomizations] = useState<Record<string, unknown>>(
    {}
  );
  const [importData, setImportData] = useState("");

  const categories = [
    "all",
    ...Array.from(new Set(workflowTemplates.map((t) => t.category))),
  ];
  const complexities = ["all", "Simple", "Intermediate", "Advanced"];

  const filteredTemplates = workflowTemplates.filter((template) => {
    const matchesCategory =
      selectedCategory === "all" || template.category === selectedCategory;
    const matchesComplexity =
      selectedComplexity === "all" ||
      template.complexity === selectedComplexity;
    const matchesSearch =
      searchQuery === "" ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );

    return matchesCategory && matchesComplexity && matchesSearch;
  });

  const handleCustomizeTemplate = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setCustomizations(
      Object.entries(template.customizationOptions || {}).reduce(
        (acc, [key, option]) => ({
          ...acc,
          [key]: option.defaultValue,
        }),
        {}
      )
    );
    setShowCustomization(true);
  };

  const handleApplyTemplate = () => {
    if (selectedTemplate) {
      onSelectTemplate(selectedTemplate, customizations);
      setShowCustomization(false);
      setSelectedTemplate(null);
      setCustomizations({});
    }
  };

  const handleExportTemplate = (template: WorkflowTemplate) => {
    const exportData = {
      ...template,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${template.name
      .toLowerCase()
      .replace(/\s+/g, "-")}-template.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Template Exported", {
      description: `${template.name} template has been downloaded.`,
    });

    onExportTemplate?.(template);
  };

  const handleImportTemplate = () => {
    try {
      const templateData = JSON.parse(importData);

      // Validate template structure
      if (
        !templateData.id ||
        !templateData.name ||
        !templateData.flowDefinition
      ) {
        throw new Error("Invalid template format");
      }

      onImportTemplate?.(importData);
      setImportData("");

      toast.success("Template Imported", {
        description: `${templateData.name} template has been imported successfully.`,
      });
    } catch {
      toast.error("Import Failed", {
        description: "Invalid template format. Please check your JSON data.",
      });
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case "Simple":
        return "bg-green-100 text-green-800";
      case "Intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "Advanced":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Use Template</Button>
        </DialogTrigger>
        <DialogContent className="sm:!max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Templates</DialogTitle>
            <DialogDescription>
              Choose from pre-built workflow templates to get started quickly
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="browse" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browse">Browse Templates</TabsTrigger>
              <TabsTrigger value="import">Import Template</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="space-y-4">
              {/* Filters */}
              <div className="space-y-4">
                <div className="flex gap-4 items-center flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      /* Import functionality */
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <div className="flex gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Category:
                    </span>
                    {categories.map((category) => (
                      <Button
                        key={category}
                        variant={
                          selectedCategory === category ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedCategory(category)}
                      >
                        {category === "all" ? "All" : category}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <div className="flex gap-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Complexity:
                    </span>
                    {complexities.map((complexity) => (
                      <Button
                        key={complexity}
                        variant={
                          selectedComplexity === complexity
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedComplexity(complexity)}
                      >
                        {complexity === "all" ? "All" : complexity}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Templates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-primary/10 text-primary rounded-lg">
                            {template.icon}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-base">
                              {template.name}
                            </CardTitle>
                            <div className="flex gap-1 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {template.category}
                              </Badge>
                              <Badge
                                className={`text-xs ${getComplexityColor(
                                  template.complexity
                                )}`}
                              >
                                {template.complexity}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportTemplate(template)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                      <CardDescription className="text-sm">
                        {template.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {template.estimatedSetupTime}
                          </div>
                          {template.usageCount && (
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {template.usageCount.toLocaleString()} uses
                            </div>
                          )}
                          {template.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              {template.rating}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Trigger
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {template.triggerType}
                          </Badge>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Actions
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {template.actionTypes.slice(0, 2).map((action) => (
                              <Badge
                                key={action}
                                variant="outline"
                                className="text-xs"
                              >
                                {action}
                              </Badge>
                            ))}
                            {template.actionTypes.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{template.actionTypes.length - 2} more
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            size="sm"
                            onClick={() => onSelectTemplate(template)}
                          >
                            Use Template
                          </Button>
                          {template.customizationOptions && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCustomizeTemplate(template)}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No templates found matching your criteria.</p>
                  <p className="text-sm">
                    Try adjusting your filters or search terms.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="import" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="import-data">Template JSON Data</Label>
                  <Textarea
                    id="import-data"
                    placeholder="Paste your exported template JSON data here..."
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleImportTemplate}
                    disabled={!importData.trim()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import Template
                  </Button>
                  <Button variant="outline" onClick={() => setImportData("")}>
                    Clear
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Template Customization Dialog */}
      <Dialog open={showCustomization} onOpenChange={setShowCustomization}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Customize Template: {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Adjust the template settings to match your specific needs
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              {Object.entries(selectedTemplate.customizationOptions || {}).map(
                ([key, option]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{option.label}</Label>
                    {option.description && (
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    )}

                    {option.type === "text" && (
                      <Input
                        id={key}
                        value={String(customizations[key] || "")}
                        onChange={(e) =>
                          setCustomizations((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    )}

                    {option.type === "number" && (
                      <Input
                        id={key}
                        type="number"
                        value={String(customizations[key] || "")}
                        onChange={(e) =>
                          setCustomizations((prev) => ({
                            ...prev,
                            [key]: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    )}

                    {option.type === "select" && option.options && (
                      <select
                        id={key}
                        value={String(customizations[key] || "")}
                        onChange={(e) =>
                          setCustomizations((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        {option.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {option.type === "boolean" && (
                      <div className="flex items-center space-x-2">
                        <input
                          id={key}
                          type="checkbox"
                          checked={Boolean(customizations[key] || false)}
                          onChange={(e) =>
                            setCustomizations((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                        />
                        <Label htmlFor={key} className="text-sm">
                          {option.label}
                        </Label>
                      </div>
                    )}

                    {option.type === "slider" && (
                      <div className="space-y-2">
                        <input
                          id={key}
                          type="range"
                          min="-1"
                          max="1"
                          step="0.1"
                          value={String(
                            customizations[key] || option.defaultValue || 0
                          )}
                          onChange={(e) =>
                            setCustomizations((prev) => ({
                              ...prev,
                              [key]: parseFloat(e.target.value),
                            }))
                          }
                          className="w-full"
                        />
                        <div className="text-sm text-muted-foreground text-center">
                          Value:{" "}
                          {String(customizations[key] || option.defaultValue)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={handleApplyTemplate}>Apply Template</Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCustomization(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
