"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutomationBuilder, AutomationBuilderRef } from "@/components/automation/automation-builder";
import { ChatbotSelector } from "@/components/dashboard/chatbot-selector";
import { workflowService } from "@/lib/workflow-service";
import type { ReactFlowDefinition } from "@/types/database";
import type { ChatbotData } from "@/types/api";
import { DashboardLayout } from "@/components/dashboard";
import { useAuth } from "@/contexts/auth-context";

function CreateAutomationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotData | null>(null);
  const builderRef = useRef<AutomationBuilderRef>(null);
  
  // Get template data from URL params if coming from template selection
  const templateName = searchParams.get("templateName");
  const templateDescription = searchParams.get("templateDescription");
  const templateData = searchParams.get("templateData");
  const preselectedChatbotId = searchParams.get("chatbotId");
  const preselectedChatbotName = searchParams.get("chatbotName");
  
  // Set preselected chatbot if provided
  useEffect(() => {
    if (preselectedChatbotId && preselectedChatbotName) {
      // Create a minimal chatbot object for preselection
      setSelectedChatbot({
        id: preselectedChatbotId,
        name: preselectedChatbotName,
        primaryColor: "#3b82f6", // Default color
        isActive: true,
        _count: { documents: 0, conversations: 0 }
      } as ChatbotData);
    }
  }, [preselectedChatbotId, preselectedChatbotName]);
  
  const initialWorkflow = templateData ? {
    name: templateName || "New Workflow",
    description: templateDescription || "",
    nodes: JSON.parse(decodeURIComponent(templateData)).nodes || [],
    edges: JSON.parse(decodeURIComponent(templateData)).edges || [],
  } : undefined;

  const handleSaveWorkflow = async (workflowData: {
    name?: string;
    description?: string;
    nodes?: unknown[];
    edges?: unknown[];
  }) => {
    if (!selectedChatbot) {
      alert("Please select a chatbot for this workflow");
      return;
    }

    if (!user?.id) {
      alert("You must be logged in to create workflows");
      return;
    }

    setIsSaving(true);
    try {
      // Try API first, fallback to workflow service
      try {
        const response = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workflowData.name || "New Workflow",
            description: workflowData.description,
            flowDefinition: workflowData as ReactFlowDefinition,
            userId: user.id,
            chatbotId: selectedChatbot.id,
            isActive: false,
          }),
        });

        if (response.ok) {
          router.push("/dashboard/automation");
          return;
        }
      } catch {
        console.log("API not available, using workflow service");
      }

      // Fallback to workflow service
      await workflowService.createWorkflow({
        name: workflowData.name || "New Workflow",
        description: workflowData.description,
        flowDefinition: workflowData as ReactFlowDefinition,
        userId: user.id,
        chatbotId: selectedChatbot.id,
        isActive: false,
      });

      // Navigate back to automation page
      router.push("/dashboard/automation");
    } catch (error) {
      console.error("Failed to save workflow:", error);
      alert("Failed to save workflow. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/automation");
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Create Automation Workflow</h1>
              <p className="text-muted-foreground">
                Build your automation workflow by connecting triggers and actions
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">For:</span>
              <ChatbotSelector
                selectedChatbotId={selectedChatbot?.id}
                onSelect={setSelectedChatbot}
                placeholder="Select chatbot"
                className="w-48"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  builderRef.current?.triggerSave();
                }}
                disabled={isSaving || !selectedChatbot}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save Workflow"}
              </Button>
            </div>
          </div>
        </div>

        {/* Builder */}
        <div className="flex-1 min-h-0">
          <AutomationBuilder
            ref={builderRef}
            onSave={handleSaveWorkflow}
            initialWorkflow={initialWorkflow}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CreateAutomationPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading automation builder...</p>
          </div>
        </div>
      </DashboardLayout>
    }>
      <CreateAutomationContent />
    </Suspense>
  );
}