import { inngest } from "./client";
import { workflowService } from "../workflow-service";
import { EventProcessingPipeline } from "../event-processing-pipeline";
import { ExecutionStatus } from "../../types/database";

// Initialize services
const eventPipeline = new EventProcessingPipeline();

// 1. New Conversation Started Event
export const processNewConversation = inngest.createFunction(
  { id: "process-new-conversation" },
  { event: "conversation.started" },
  async ({ event, step }) => {
    const { conversation_id, user_id, chatbot_id } = event.data;

    console.log(`Processing new conversation: ${conversation_id}`);

    // Step 1: Log the conversation start
    await step.run("log-conversation-start", async () => {
      console.log(
        `New conversation started for user ${user_id} with chatbot ${chatbot_id}`
      );
      return { logged: true };
    });

    // Step 2: Process through event pipeline
    await step.run("process-through-pipeline", async () => {
      await eventPipeline.receiveEvent({
        name: "conversation.started",
        data: event.data,
      });
      return { processed: true };
    });

    // Step 3: Trigger any workflows listening for new conversations
    if (chatbot_id) {
      await step.run("trigger-workflows", async () => {
        console.log(
          `Looking for workflows for chatbot: ${chatbot_id}, user: ${user_id}`
        );

        const workflows = await workflowService.listWorkflows({
          chatbotId: chatbot_id,
          isActive: true,
        });

        console.log(
          `Found ${workflows.length} active workflows for chatbot ${chatbot_id}`
        );

        const triggeredWorkflows = [];
        for (const workflow of workflows) {
          try {
            console.log(
              `Executing workflow ${workflow.id} for new conversation trigger`
            );

            const result = await workflowService.executeWorkflow(workflow.id, {
              type: "new_conversation",
              data: event.data,
              userId: user_id,
              chatbotId: chatbot_id,
            });

            console.log(
              `Workflow ${workflow.id} execution result:`,
              result.status
            );

            if (result.status === ExecutionStatus.COMPLETED) {
              triggeredWorkflows.push(workflow.id);
            }
          } catch (error) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error);
          }
        }

        return { triggeredWorkflows };
      });
    }

    return {
      success: true,
      conversationId: conversation_id,
      processedAt: new Date().toISOString(),
    };
  }
);

// 2. Message Created Event
export const processMessageCreated = inngest.createFunction(
  { id: "process-message-created" },
  { event: "message.created" },
  async ({ event, step }) => {
    const {
      conversation_id,
      user_id,
      chatbot_id,
      sentiment,
      trigger_type,
      is_first_message,
      message_count,
    } = event.data;

    console.log(`Processing message in conversation: ${conversation_id}`);
    console.log(
      `Message trigger_type: ${trigger_type}, is_first_message: ${is_first_message}, message_count: ${message_count}`
    );

    // Step 1: Process through event pipeline
    await step.run("process-through-pipeline", async () => {
      await eventPipeline.receiveEvent({
        name: "message.created",
        data: event.data,
      });
      return { processed: true };
    });

    // Step 2: Handle different trigger types based on message data
    if (chatbot_id) {
      await step.run("handle-message-triggers", async () => {
        const workflows = await workflowService.listWorkflows({
          chatbotId: chatbot_id,
          isActive: true,
        });

        console.log(
          `Found ${workflows.length} workflows for chatbot ${chatbot_id}`
        );

        const triggeredWorkflows = [];

        // Check if this is a new conversation (first message)
        if (
          is_first_message ||
          message_count === 1 ||
          trigger_type === "new_conversation"
        ) {
          console.log("Processing as new conversation trigger");

          for (const workflow of workflows) {
            try {
              const result = await workflowService.executeWorkflow(
                workflow.id,
                {
                  type: "new_conversation",
                  data: { ...event.data, trigger_type: "new_conversation" },
                  userId: user_id,
                  chatbotId: chatbot_id,
                }
              );

              if (result.status === ExecutionStatus.COMPLETED) {
                triggeredWorkflows.push({
                  workflowId: workflow.id,
                  trigger: "new_conversation",
                });
              }
            } catch (error) {
              console.error(
                `Failed to execute workflow ${workflow.id} for new_conversation trigger:`,
                error
              );
            }
          }
        }

        // Handle sentiment-based triggers
        if (sentiment && trigger_type && trigger_type.includes("sentiment")) {
          console.log(`Processing sentiment trigger: ${trigger_type}`);

          for (const workflow of workflows) {
            try {
              const result = await workflowService.executeWorkflow(
                workflow.id,
                {
                  type: trigger_type,
                  data: { ...event.data, trigger_type },
                  userId: user_id,
                  chatbotId: chatbot_id,
                }
              );

              if (result.status === ExecutionStatus.COMPLETED) {
                triggeredWorkflows.push({
                  workflowId: workflow.id,
                  trigger: trigger_type,
                });
              }
            } catch (error) {
              console.error(
                `Failed to execute workflow ${workflow.id} for ${trigger_type} trigger:`,
                error
              );
            }
          }
        }

        return { triggeredWorkflows };
      });
    }

    return {
      success: true,
      conversationId: conversation_id,
      processedAt: new Date().toISOString(),
    };
  }
);

// 3. Sentiment Trigger Event
export const processSentimentTrigger = inngest.createFunction(
  { id: "process-sentiment-trigger" },
  { event: "sentiment.trigger" },
  async ({ event, step }) => {
    const { conversation_id, user_id, chatbot_id, trigger_type } = event.data;

    console.log(
      `Processing sentiment trigger: ${trigger_type} for conversation: ${conversation_id}`
    );

    // Step 1: Process through event pipeline
    await step.run("process-through-pipeline", async () => {
      await eventPipeline.receiveEvent({
        name: "sentiment.trigger",
        data: event.data,
      });
      return { processed: true };
    });

    // Step 2: Execute workflows for this specific trigger
    if (chatbot_id) {
      await step.run("execute-trigger-workflows", async () => {
        const workflows = await workflowService.listWorkflows({
          chatbotId: chatbot_id,
          isActive: true,
        });

        const triggeredWorkflows = [];
        for (const workflow of workflows) {
          try {
            const result = await workflowService.executeWorkflow(workflow.id, {
              type: trigger_type,
              data: event.data,
              userId: user_id,
              chatbotId: chatbot_id,
            });

            if (result.status === ExecutionStatus.COMPLETED) {
              triggeredWorkflows.push(workflow.id);
            }
          } catch (error) {
            console.error(
              `Failed to execute workflow ${workflow.id} for sentiment trigger:`,
              error
            );
          }
        }

        return { triggeredWorkflows };
      });
    }

    return {
      success: true,
      triggerType: trigger_type,
      conversationId: conversation_id,
      processedAt: new Date().toISOString(),
    };
  }
);

// 4. Intent Detected Event
export const processIntentDetected = inngest.createFunction(
  { id: "process-intent-detected" },
  { event: "intent.detected" },
  async ({ event, step }) => {
    const { conversation_id, user_id, chatbot_id, intent, confidence } =
      event.data;

    console.log(
      `Processing intent detected: ${intent} (confidence: ${confidence}) for conversation: ${conversation_id}`
    );

    // Step 1: Process through event pipeline
    await step.run("process-through-pipeline", async () => {
      await eventPipeline.receiveEvent({
        name: "intent.detected",
        data: event.data,
      });
      return { processed: true };
    });

    // Step 2: Execute workflows for intent detection
    if (chatbot_id && confidence > 0.7) {
      await step.run("execute-intent-workflows", async () => {
        const workflows = await workflowService.listWorkflows({
          chatbotId: chatbot_id,
          isActive: true,
        });

        const triggeredWorkflows = [];
        for (const workflow of workflows) {
          try {
            const result = await workflowService.executeWorkflow(workflow.id, {
              type: "intent_detected",
              data: event.data,
              userId: user_id,
              chatbotId: chatbot_id,
            });

            if (result.status === ExecutionStatus.COMPLETED) {
              triggeredWorkflows.push(workflow.id);
            }
          } catch (error) {
            console.error(
              `Failed to execute workflow ${workflow.id} for intent detection:`,
              error
            );
          }
        }

        return { triggeredWorkflows };
      });
    }

    return {
      success: true,
      intent,
      confidence,
      conversationId: conversation_id,
      processedAt: new Date().toISOString(),
    };
  }
);

// 5. Image Uploaded Event
export const processImageUploaded = inngest.createFunction(
  { id: "process-image-uploaded" },
  { event: "image.uploaded" },
  async ({ event, step }) => {
    const { conversation_id, user_id, chatbot_id, image_url } = event.data;

    console.log(
      `Processing image uploaded: ${image_url} for conversation: ${conversation_id}`
    );

    // Step 1: Process through event pipeline
    await step.run("process-through-pipeline", async () => {
      await eventPipeline.receiveEvent({
        name: "image.uploaded",
        data: event.data,
      });
      return { processed: true };
    });

    // Step 2: Execute workflows for image upload
    if (chatbot_id) {
      await step.run("execute-image-workflows", async () => {
        const workflows = await workflowService.listWorkflows({
          chatbotId: chatbot_id,
          isActive: true,
        });

        const triggeredWorkflows = [];
        for (const workflow of workflows) {
          try {
            const result = await workflowService.executeWorkflow(workflow.id, {
              type: "image_uploaded",
              data: event.data,
              userId: user_id,
              chatbotId: chatbot_id,
            });

            if (result.status === ExecutionStatus.COMPLETED) {
              triggeredWorkflows.push(workflow.id);
            }
          } catch (error) {
            console.error(
              `Failed to execute workflow ${workflow.id} for image upload:`,
              error
            );
          }
        }

        return { triggeredWorkflows };
      });
    }

    return {
      success: true,
      imageUrl: image_url,
      conversationId: conversation_id,
      processedAt: new Date().toISOString(),
    };
  }
);

// 6. Workflow Execution Event (for workflow-to-workflow communication)
export const processWorkflowExecution = inngest.createFunction(
  { id: "process-workflow-execution" },
  { event: "workflow.executed" },
  async ({ event, step }) => {
    const { workflow_id, execution_id, result, trigger_event } = event.data;

    console.log(
      `Processing workflow execution: ${workflow_id} (execution: ${execution_id})`
    );

    // Step 1: Log execution result
    await step.run("log-execution-result", async () => {
      console.log(
        `Workflow ${workflow_id} execution ${execution_id} completed with result:`,
        result
      );
      return { logged: true };
    });

    // Step 2: Handle workflow chaining if needed
    if (result.success && result.chainWorkflows) {
      await step.run("chain-workflows", async () => {
        const chainedResults = [];

        for (const chainWorkflowId of result.chainWorkflows) {
          try {
            const chainResult = await workflowService.executeWorkflow(
              chainWorkflowId,
              {
                type: "WorkflowChain",
                data: {
                  parentWorkflowId: workflow_id,
                  parentExecutionId: execution_id,
                  parentResult: result,
                  originalTrigger: trigger_event,
                },
                userId: trigger_event.userId,
                chatbotId: trigger_event.chatbotId,
              }
            );

            chainedResults.push({
              workflowId: chainWorkflowId,
              success: chainResult.status === ExecutionStatus.COMPLETED,
            });
          } catch (error) {
            console.error(
              `Failed to chain workflow ${chainWorkflowId}:`,
              error
            );
            chainedResults.push({
              workflowId: chainWorkflowId,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return { chainedResults };
      });
    }

    return {
      success: true,
      workflowId: workflow_id,
      executionId: execution_id,
      processedAt: new Date().toISOString(),
    };
  }
);

// 7. Workflow Error Event
export const processWorkflowError = inngest.createFunction(
  { id: "process-workflow-error" },
  { event: "workflow.error" },
  async ({ event, step }) => {
    const { workflow_id, execution_id, error, trigger_event } = event.data;

    console.log(
      `Processing workflow error: ${workflow_id} (execution: ${execution_id})`
    );

    // Step 1: Log error details
    await step.run("log-error-details", async () => {
      console.error(
        `Workflow ${workflow_id} execution ${execution_id} failed:`,
        error
      );
      return { logged: true };
    });

    // Step 2: Handle error recovery if configured
    await step.run("handle-error-recovery", async () => {
      // Check if workflow has error recovery configured
      const workflow = await workflowService.getWorkflow(workflow_id);

      if (workflow && workflow.flowDefinition.nodes) {
        const errorHandlerNodes = workflow.flowDefinition.nodes.filter(
          (node: { data?: { nodeType?: string } }) =>
            node.data?.nodeType === "errorHandler"
        );

        if (errorHandlerNodes.length > 0) {
          // Execute error recovery workflow
          try {
            const recoveryResult = await workflowService.executeWorkflow(
              workflow_id,
              {
                type: "ErrorRecovery",
                data: {
                  originalError: error,
                  originalTrigger: trigger_event,
                  failedExecutionId: execution_id,
                },
                userId: trigger_event.userId,
                chatbotId: trigger_event.chatbotId,
              }
            );

            return {
              recoveryAttempted: true,
              recoverySuccess:
                recoveryResult.status === ExecutionStatus.COMPLETED,
            };
          } catch (recoveryError) {
            console.error(
              `Error recovery failed for workflow ${workflow_id}:`,
              recoveryError
            );
            return { recoveryAttempted: true, recoverySuccess: false };
          }
        }
      }

      return { recoveryAttempted: false };
    });

    return {
      success: true,
      workflowId: workflow_id,
      executionId: execution_id,
      processedAt: new Date().toISOString(),
    };
  }
);

// 8. Scheduled Workflow Event
export const processScheduledWorkflow = inngest.createFunction(
  { id: "process-scheduled-workflow" },
  { event: "workflow.scheduled" },
  async ({ event, step }) => {
    const { workflow_id, schedule_id, scheduled_time } = event.data;

    console.log(
      `Processing scheduled workflow: ${workflow_id} (schedule: ${schedule_id})`
    );

    // Step 1: Validate schedule timing
    await step.run("validate-schedule", async () => {
      const now = new Date();
      const scheduledTime = new Date(scheduled_time);

      if (scheduledTime > now) {
        throw new Error(
          `Workflow ${workflow_id} is scheduled for future execution: ${scheduled_time}`
        );
      }

      return { validated: true };
    });

    // Step 2: Execute scheduled workflow
    await step.run("execute-scheduled-workflow", async () => {
      try {
        const result = await workflowService.executeWorkflow(workflow_id, {
          type: "ScheduledExecution",
          data: {
            scheduleId: schedule_id,
            scheduledTime: scheduled_time,
            executedTime: new Date().toISOString(),
          },
          userId: "system", // For scheduled executions
          chatbotId: event.data.chatbot_id || "system",
        });

        return {
          success: result.status === ExecutionStatus.COMPLETED,
          executionId: result.executionId,
        };
      } catch (error) {
        console.error(
          `Failed to execute scheduled workflow ${workflow_id}:`,
          error
        );
        throw error;
      }
    });

    return {
      success: true,
      workflowId: workflow_id,
      scheduleId: schedule_id,
      processedAt: new Date().toISOString(),
    };
  }
);

// Export all functions
export const functions = [
  processNewConversation,
  processMessageCreated,
  processSentimentTrigger,
  processIntentDetected,
  processImageUploaded,
  processWorkflowExecution,
  processWorkflowError,
  processScheduledWorkflow,
];
