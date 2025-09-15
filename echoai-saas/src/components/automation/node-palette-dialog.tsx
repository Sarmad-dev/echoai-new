"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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

interface NodeType {
  id: string;
  type: "trigger" | "action" | "condition" | "conditionalLogic" | "delay";
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  nodeType?: string; // The actual handler type
}

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

interface NodePaletteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNodeSelect: (nodeType: string, nodeData: { nodeType?: string }) => void;
}

export function NodePaletteDialog({
  isOpen,
  onClose,
  onNodeSelect,
}: NodePaletteDialogProps) {
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

  // Combine static and dynamic nodes
  const allNodes = [...dynamicNodes, ...staticAdvancedNodes];
  
  // Group nodes by type
  const triggers = allNodes.filter(node => node.type === "trigger");
  const actions = allNodes.filter(node => node.type === "action");
  const logicAndDelays = allNodes.filter(node => 
    node.type === "conditionalLogic" || node.type === "delay"
  );

  const handleNodeClick = (node: NodeType) => {
    onNodeSelect(node.type, { nodeType: node.nodeType || node.id });
    onClose();
  };

  const NodeGrid = ({ nodes }: { nodes: NodeType[] }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {nodes.map((node) => (
        <Button
          key={node.id}
          variant="outline"
          className="h-auto p-4 flex flex-col items-start gap-3 hover:shadow-md transition-all"
          onClick={() => handleNodeClick(node)}
        >
          <div className="flex items-center gap-3 w-full">
            <div
              className={`p-2 rounded ${node.color} text-white flex-shrink-0`}
            >
              {node.icon}
            </div>
            <div className="text-left flex-1 min-w-0">
              <div className="font-medium text-sm">{node.label}</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-left w-full">
            {node.description}
          </div>
        </Button>
      ))}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:!max-w-5xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Workflow Node</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="triggers" className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="triggers">
              Triggers ({triggers.length})
            </TabsTrigger>
            <TabsTrigger value="actions">
              Actions ({actions.length})
            </TabsTrigger>
            <TabsTrigger value="logic">
              Logic & Delays ({logicAndDelays.length})
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 overflow-y-auto max-h-[60vh]">
            <TabsContent value="triggers" className="mt-0">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Triggers start your workflow when specific events occur.
                </p>
                <NodeGrid nodes={triggers} />
              </div>
            </TabsContent>

            <TabsContent value="actions" className="mt-0">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Actions perform specific tasks when triggered.
                </p>
                <NodeGrid nodes={actions} />
              </div>
            </TabsContent>

            <TabsContent value="logic" className="mt-0">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Advanced logic and timing controls for complex workflows.
                </p>
                <NodeGrid nodes={logicAndDelays} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}