"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  FileText,
  Trash2,
  MessageSquare,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DataConnectionForm } from "./data-connection-form";
import type { ChatbotData } from "@/types/api";

interface ChatbotTrainingProps {
  chatbot: ChatbotData;
  onBack: () => void;
}

export function ChatbotTraining({ chatbot, onBack }: ChatbotTrainingProps) {
  const [hasExistingData, setHasExistingData] = useState(false);
  const [trainingMode, setTrainingMode] = useState<"add" | "replace">("add");
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [instructionCount, setInstructionCount] = useState(0);

  useEffect(() => {
    const fetchInstructionData = async () => {
      try {
        const response = await fetch(
          `/api/chatbots/${chatbot.id}/instructions`
        );
        if (response.ok) {
          const data = await response.json();
          setInstructionCount(data.data.total_instructions || 0);
        }
      } catch (error) {
        console.error("Failed to fetch instruction data:", error);
      }
    };

    // Check if chatbot has existing training data (documents or instructions)
    const hasDocuments = (chatbot._count?.documents || 0) > 0;
    const hasInstructions = !!chatbot.instructions;
    setHasExistingData(hasDocuments || hasInstructions);

    fetchInstructionData();
    setIsLoading(false);
  }, [chatbot]);

  const handleClearTrainingData = async () => {
    setIsClearing(true);
    try {
      const response = await fetch(
        `/api/chatbots/${chatbot.id}/clear-training`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setHasExistingData(false);
        setInstructionCount(0);
        // Update the chatbot data to reflect the cleared documents
        if (chatbot._count) {
          chatbot._count.documents = 0;
        }
      }
    } catch (error) {
      console.error("Failed to clear training data:", error);
    } finally {
      setIsClearing(false);
      setShowClearDialog(false);
    }
  };

  const handleTrainingSubmit = async (data: {
    urls?: string[];
    files?: File[];
    instructions?: string;
  }) => {
    const formData = new FormData();

    // Add chatbot ID and training mode
    formData.append("chatbotId", chatbot.id);
    formData.append("replaceExisting", (trainingMode === "replace").toString());

    // Add URLs if provided
    if (data.urls && data.urls.length > 0) {
      formData.append("urls", JSON.stringify(data.urls));
    }

    // Add files if provided
    if (data.files && data.files.length > 0) {
      data.files.forEach((file) => {
        formData.append("files", file);
      });
    }

    // Add instructions if provided
    if (data.instructions && data.instructions.trim()) {
      formData.append("instructions", data.instructions.trim());
    }

    const response = await fetch("/api/train", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Training failed");
    }

    const result = await response.json();

    // Update the has existing data state
    setHasExistingData(true);

    // Refresh instruction count
    try {
      const instructionResponse = await fetch(
        `/api/chatbots/${chatbot.id}/instructions`
      );
      if (instructionResponse.ok) {
        const instructionData = await instructionResponse.json();
        setInstructionCount(instructionData.data.total_instructions || 0);
      }
    } catch (error) {
      console.error("Failed to refresh instruction count:", error);
    }

    return result;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="h-6 bg-muted rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-32 mt-2 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold">Train {chatbot.name}</h2>
            <p className="text-muted-foreground">
              Add knowledge to your chatbot by uploading documents or providing
              URLs
            </p>
          </div>
        </div>

        {/* Chatbot Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: chatbot.primaryColor }}
              >
                AI
              </div>
              {chatbot.name}
            </CardTitle>
            <CardDescription>Current training status and data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {chatbot._count?.documents || 0} training documents
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {instructionCount} training instructions
                  </span>
                </div>
                <Badge
                  variant={
                    hasExistingData || instructionCount > 0
                      ? "default"
                      : "secondary"
                  }
                >
                  {hasExistingData || instructionCount > 0
                    ? "Trained"
                    : "Not Trained"}
                </Badge>
              </div>
              {(hasExistingData || instructionCount > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClearDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Training Data
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Training Mode Selection */}
        {hasExistingData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Training Mode
              </CardTitle>
              <CardDescription>
                Choose how to handle the new training data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={trainingMode}
                onValueChange={(value) =>
                  setTrainingMode(value as "add" | "replace")
                }
                className="space-y-4"
              >
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="add" id="add" className="mt-1" />
                  <div className="space-y-1">
                    <Label htmlFor="add" className="font-medium">
                      Add to existing data
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      New documents will be added to your existing training
                      data. This will expand your chatbot's knowledge base.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <RadioGroupItem
                    value="replace"
                    id="replace"
                    className="mt-1"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="replace" className="font-medium">
                      Replace existing data
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      All existing training data will be deleted and replaced
                      with the new data. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        {/* Training Information */}
        <Card>
          <CardHeader>
            <CardTitle>How Training Works</CardTitle>
            <CardDescription>
              Your chatbot learns from multiple sources to provide accurate
              responses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Documents</span>
                </div>
                <p className="text-muted-foreground">
                  Upload PDFs, DOCX files, or provide URLs to websites. Content
                  is extracted and used as knowledge base.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Instructions</span>
                </div>
                <p className="text-muted-foreground">
                  Define how your chatbot should behave, respond, and interact
                  with users.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-purple-500" />
                  <span className="font-medium">AI Processing</span>
                </div>
                <p className="text-muted-foreground">
                  All content is processed with AI embeddings for intelligent
                  retrieval during conversations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Training Form */}
        <DataConnectionForm onSubmit={handleTrainingSubmit} />
      </div>

      {/* Clear Training Data Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Training Data</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all training data for "
              {chatbot.name}"? This will delete {chatbot._count?.documents || 0}{" "}
              documents
              {instructionCount > 0
                ? ` and ${instructionCount} training instructions`
                : ""}{" "}
              and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearTrainingData}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? "Clearing..." : "Clear Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
