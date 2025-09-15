"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  MessageCircle,
  GitBranch,
  Clock,
  MessageSquare,
  TrendingUp,
  StickyNote,
  Tag,
  Users,
  CheckCircle,
  Slack,
  Mail,
  Database,
  FileText,
  Phone,
  Calendar,
  DollarSign,
  ShoppingCart,
  ThumbsUp,
  ThumbsDown,
  Camera,
  Upload,
  Download,
  Bell,
  Settings,
  Filter,
  Search,
  AlertTriangle,
} from "lucide-react";
import { ActionRegistry, TriggerRegistry } from "@/lib/workflow";

// Icon mapping for different node types
const getIconForNodeType = (nodeType: string, type: string) => {
  // Trigger icons
  if (type === "trigger") {
    switch (nodeType) {
      case "new_conversation":
        return <MessageSquare className="w-4 h-4" />;
      case "intent_detected":
        return <Search className="w-4 h-4" />;
      case "negative_sentiment":
      case "sentiment_trigger":
        return <ThumbsDown className="w-4 h-4" />;
      case "positive_sentiment":
        return <ThumbsUp className="w-4 h-4" />;
      case "image_uploaded":
        return <Camera className="w-4 h-4" />;
      case "high_value_lead":
        return <TrendingUp className="w-4 h-4" />;
      case "escalation_trigger":
        return <AlertTriangle className="w-4 h-4" />;
      case "conversation_triage":
        return <Filter className="w-4 h-4" />;
      case "message_received":
        return <Mail className="w-4 h-4" />;
      case "user_joined":
        return <Users className="w-4 h-4" />;
      case "time_based":
        return <Calendar className="w-4 h-4" />;
      case "webhook":
        return <Zap className="w-4 h-4" />;
      default:
        return <Zap className="w-4 h-4" />;
    }
  }

  // Action icons
  if (type === "action") {
    switch (nodeType) {
      case "add_note":
        return <StickyNote className="w-4 h-4" />;
      case "tag_conversation":
        return <Tag className="w-4 h-4" />;
      case "send_slack_message":
        return <Slack className="w-4 h-4" />;
      case "send_email":
        return <Mail className="w-4 h-4" />;
      case "create_hubspot_contact":
        return <Users className="w-4 h-4" />;
      case "create_ticket":
        return <FileText className="w-4 h-4" />;
      case "auto_approve_return":
        return <CheckCircle className="w-4 h-4" />;
      case "send_notification":
        return <Bell className="w-4 h-4" />;
      case "update_database":
        return <Database className="w-4 h-4" />;
      case "make_phone_call":
        return <Phone className="w-4 h-4" />;
      case "schedule_meeting":
        return <Calendar className="w-4 h-4" />;
      case "process_payment":
        return <DollarSign className="w-4 h-4" />;
      case "update_inventory":
        return <ShoppingCart className="w-4 h-4" />;
      case "send_sms":
        return <MessageCircle className="w-4 h-4" />;
      case "upload_file":
        return <Upload className="w-4 h-4" />;
      case "download_file":
        return <Download className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  }

  // Condition icons
  if (type === "condition") {
    return <Filter className="w-4 h-4" />;
  }

  // Default fallback
  return <Settings className="w-4 h-4" />;
};

// Color mapping for different node types
const getColorForNodeType = (nodeType: string, type: string) => {
  if (type === "trigger") {
    switch (nodeType) {
      case "new_conversation":
        return "bg-green-500";
      case "intent_detected":
        return "bg-blue-500";
      case "negative_sentiment":
      case "sentiment_trigger":
        return "bg-red-500";
      case "positive_sentiment":
        return "bg-green-600";
      case "image_uploaded":
        return "bg-purple-500";
      case "high_value_lead":
        return "bg-yellow-500";
      case "escalation_trigger":
        return "bg-red-600";
      case "conversation_triage":
        return "bg-amber-500";
      case "message_received":
        return "bg-indigo-500";
      case "user_joined":
        return "bg-cyan-500";
      case "time_based":
        return "bg-orange-500";
      case "webhook":
        return "bg-pink-500";
      default:
        return "bg-green-500";
    }
  }

  if (type === "action") {
    switch (nodeType) {
      case "add_note":
        return "bg-indigo-500";
      case "tag_conversation":
        return "bg-cyan-500";
      case "send_slack_message":
        return "bg-green-600";
      case "send_email":
        return "bg-blue-600";
      case "create_hubspot_contact":
        return "bg-orange-500";
      case "create_ticket":
        return "bg-purple-600";
      case "auto_approve_return":
        return "bg-emerald-500";
      case "send_notification":
        return "bg-yellow-600";
      case "update_database":
        return "bg-gray-600";
      case "make_phone_call":
        return "bg-teal-500";
      case "schedule_meeting":
        return "bg-violet-500";
      case "process_payment":
        return "bg-green-700";
      case "update_inventory":
        return "bg-amber-600";
      case "send_sms":
        return "bg-blue-500";
      case "upload_file":
        return "bg-slate-500";
      case "download_file":
        return "bg-stone-500";
      default:
        return "bg-blue-500";
    }
  }

  if (type === "condition") {
    return "bg-gray-500";
  }

  return "bg-gray-500";
};

interface NodeType {
  id: string;
  type: "trigger" | "action" | "condition" | "conditionalLogic" | "delay";
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  nodeType?: string; // The actual handler type
}

// Static advanced workflow nodes
const staticAdvancedNodes: NodeType[] = [
  {
    id: "conditional-logic",
    type: "conditionalLogic",
    label: "Conditional Logic",
    description: "Advanced conditional branching with multiple conditions",
    icon: <GitBranch className="w-4 h-4" />,
    color: "bg-blue-600",
  },
  {
    id: "delay-schedule",
    type: "delay",
    label: "Delay/Schedule",
    description: "Add delays or schedule execution for later",
    icon: <Clock className="w-4 h-4" />,
    color: "bg-orange-600",
  },
];

// const nodeTypes: NodeType[]
// Trigger Nodes
//   {
//     id: "new-conversation",
//     type: "trigger",
//     label: "New Conversation",
//     description: "Triggers when a new conversation starts",
//     icon: <MessageSquare className="w-4 h-4" />,
//     color: "bg-green-500",
//   },
//   {
//     id: "intent-detected",
//     type: "trigger",
//     label: "Intent Detected",
//     description: "Triggers when specific intent is recognized",
//     icon: <Zap className="w-4 h-4" />,
//     color: "bg-blue-500",
//   },
//   {
//     id: "negative-sentiment",
//     type: "trigger",
//     label: "Negative Sentiment",
//     description: "Triggers when negative sentiment is detected",
//     icon: <AlertTriangle className="w-4 h-4" />,
//     color: "bg-red-500",
//   },
//   {
//     id: "image-uploaded",
//     type: "trigger",
//     label: "Image Uploaded",
//     description: "Triggers when user uploads an image",
//     icon: <Image className="w-4 h-4" />, // eslint-disable-line jsx-a11y/alt-text
//     color: "bg-purple-500",
//   },
//   {
//     id: "high-value-lead",
//     type: "trigger",
//     label: "High Value Lead",
//     description: "Triggers when high-value lead is qualified",
//     icon: <TrendingUp className="w-4 h-4" />,
//     color: "bg-yellow-500",
//   },

//   // Action Nodes
//   {
//     id: "add-note",
//     type: "action",
//     label: "Add Note",
//     description: "Add internal note to conversation",
//     icon: <StickyNote className="w-4 h-4" />,
//     color: "bg-indigo-500",
//   },
//   {
//     id: "tag-conversation",
//     type: "action",
//     label: "Tag Conversation",
//     description: "Add tags to conversation for organization",
//     icon: <Tag className="w-4 h-4" />,
//     color: "bg-cyan-500",
//   },
//   {
//     id: "send-slack-message",
//     type: "action",
//     label: "Send Slack Message",
//     description: "Send notification to Slack channel",
//     icon: <MessageCircle className="w-4 h-4" />,
//     color: "bg-green-600",
//   },
//   {
//     id: "create-hubspot-contact",
//     type: "action",
//     label: "Create HubSpot Contact",
//     description: "Create new contact in HubSpot CRM",
//     icon: <Users className="w-4 h-4" />,
//     color: "bg-orange-500",
//   },
//   {
//     id: "auto-approve-return",
//     type: "action",
//     label: "Auto Approve Return",
//     description: "Automatically approve return request",
//     icon: <CheckCircle className="w-4 h-4" />,
//     color: "bg-emerald-500",
//   },

//   // Condition Nodes
//   {
//     id: "if-condition",
//     type: "condition",
//     label: "If Condition",
//     description: "Add conditional logic to workflow",
//     icon: <GitBranch className="w-4 h-4" />,
//     color: "bg-gray-500",
//   },
// ];

interface NodePaletteProps {
  selectedNodeType: string | null;
  onNodeTypeSelect: (nodeType: string | null) => void;
}

export function NodePalette({
  selectedNodeType,
  onNodeTypeSelect,
}: NodePaletteProps) {
  const [dynamicNodes, setDynamicNodes] = useState<NodeType[]>([]);

  useEffect(() => {
    // Load dynamic nodes from registries
    const loadDynamicNodes = () => {
      const triggerTypes = TriggerRegistry.getTriggerTypes();
      const actionTypes = ActionRegistry.getActionTypes();

      const triggers: NodeType[] = triggerTypes.map((type) => ({
        id: type.replace("_", "-"),
        type: "trigger" as const,
        label: type
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        description: `Triggers when ${type.replace("_", " ")} occurs`,
        icon: getIconForNodeType(type, "trigger"),
        color: getColorForNodeType(type, "trigger"),
        nodeType: type,
      }));

      const actions: NodeType[] = actionTypes.map((type) => ({
        id: type.replace("_", "-"),
        type: "action" as const,
        label: type
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
        description: `Executes ${type.replace("_", " ")} action`,
        icon: getIconForNodeType(type, "action"),
        color: getColorForNodeType(type, "action"),
        nodeType: type,
      }));

      setDynamicNodes([...triggers, ...actions]);
    };

    loadDynamicNodes();
  }, []);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  // Combine static and dynamic nodes
  const allNodes = [...dynamicNodes, ...staticAdvancedNodes];
  const groupedNodes = allNodes.reduce((acc, node) => {
    if (!acc[node.type]) {
      acc[node.type] = [];
    }
    acc[node.type].push(node);
    return acc;
  }, {} as Record<string, NodeType[]>);

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Workflow Nodes</h2>

      {Object.entries(groupedNodes).map(([type, nodes]) => (
        <div key={type} className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {type}s
          </h3>

          <div className="space-y-2">
            {nodes.map((node) => (
              <div
                key={node.id}
                draggable
                onDragStart={(event) => {
                  onDragStart(event, node.type);
                  // Also store the specific node type for configuration
                  event.dataTransfer.setData(
                    "nodeType",
                    node.nodeType || node.id
                  );
                }}
                onClick={() =>
                  onNodeTypeSelect(
                    selectedNodeType === node.id ? null : node.id
                  )
                }
                className={`
                  p-3 rounded-lg border cursor-move transition-all
                  hover:shadow-md hover:border-primary/50
                  ${
                    selectedNodeType === node.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-accent"
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-1.5 rounded ${node.color} text-white flex-shrink-0`}
                  >
                    {node.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{node.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {node.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-6 p-3 bg-muted rounded-lg">
        <p className="text-xs text-muted-foreground">
          Drag nodes onto the canvas to build your automation workflow. Connect
          triggers to actions to create automated responses.
        </p>
      </div>
    </div>
  );
}
