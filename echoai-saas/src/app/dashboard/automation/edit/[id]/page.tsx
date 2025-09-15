"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AutomationBuilder,
  AutomationBuilderRef,
} from "@/components/automation/automation-builder";
import { workflowService } from "@/lib/workflow-service";
import type { ReactFlowDefinition, AutomationWorkflow } from "@/types/database";
import { DashboardLayout } from "@/components/dashboard";

// Helper function to extract actual flow definition from nested structure
const getActualFlowDefinition = (
  flowDefinition: ReactFlowDefinition | { flowDefinition: ReactFlowDefinition }
): ReactFlowDefinition => {
  if ("flowDefinition" in flowDefinition && flowDefinition.flowDefinition) {
    return flowDefinition.flowDefinition;
  }
  return flowDefinition as ReactFlowDefinition;
};

export default function EditAutomationPage() {
  const router = useRouter();
  const params = useParams();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<AutomationWorkflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const builderRef = useRef<AutomationBuilderRef>(null);

  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        // Try API first, fallback to workflow service
        try {
          const response = await fetch(`/api/workflows/${workflowId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setWorkflow(data.data);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          console.log("API not available, using workflow service");
        }

        // Fallback to workflow service
        const dbWorkflow = await workflowService.getWorkflow(workflowId);
        if (dbWorkflow) {
          setWorkflow(dbWorkflow);
        } else {
          // Workflow not found, redirect back
          router.push("/dashboard/automation");
        }
      } catch (error) {
        console.error("Failed to load workflow:", error);
        router.push("/dashboard/automation");
      } finally {
        setIsLoading(false);
      }
    };

    if (workflowId) {
      loadWorkflow();
    }
  }, [workflowId, router]);

  const handleSaveWorkflow = async (workflowData: {
    name: string;
    description?: string;
    flowDefinition: ReactFlowDefinition;
  }) => {
    if (!workflow) return;

    setIsSaving(true);
    try {
      // Try API first, fallback to workflow service
      try {
        const response = await fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workflowData.name || workflow.name,
            description: workflowData.description,
            flowDefinition: workflowData.flowDefinition,
            isActive: workflow.isActive,
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
      await workflowService.updateWorkflow(workflowId, {
        name: workflowData.name || workflow.name,
        description: workflowData.description,
        flowDefinition: workflowData.flowDefinition,
        isActive: workflow.isActive,
      });
    } catch (error) {
      console.error("Failed to save workflow:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWorkflow = async () => {
    try {
      setIsActivating(true);
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workflow?.name,
          description: workflow?.description,
          flowDefinition: getActualFlowDefinition(
            workflow?.flowDefinition as ReactFlowDefinition
          ),
          isActive: !workflow?.isActive,
        }),
      });
    } catch (error) {
      console.log("API not available, using workflow service:", error);
    } finally {
      setIsActivating(false);
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/automation");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading workflow...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!workflow) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Workflow not found</h2>
            <p className="text-muted-foreground mb-4">
              The workflow you&apos;re looking for doesn&apos;t exist or has
              been deleted.
            </p>
            <Button onClick={handleCancel}>Back to Automation</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Extract the actual flow definition handling nested structure
  const actualFlowDefinition = getActualFlowDefinition(workflow.flowDefinition);

  const initialWorkflow = {
    name: workflow.name,
    description: workflow.description,
    nodes: actualFlowDefinition.nodes || [],
    edges: actualFlowDefinition.edges || [],
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                Edit Workflow: {workflow.name}
              </h1>
              <p className="text-muted-foreground">
                Modify your automation workflow by updating triggers and actions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleToggleWorkflow} disabled={isActivating}>
              {workflow.isActive
                ? isActivating
                  ? "Deactivating"
                  : "Deactivate"
                : isActivating
                ? "Activating"
                : "Activate"}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                builderRef.current?.triggerSave();
              }}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Builder */}
        <div className="flex-1 min-h-0">
          <AutomationBuilder
            ref={builderRef}
            workflowId={workflowId}
            onSave={handleSaveWorkflow}
            initialWorkflow={initialWorkflow}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
