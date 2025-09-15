/**
 * Workflow Trigger Matching System
 *
 * Comprehensive trigger evaluation logic for different event types:
 * - Conversation start trigger matching
 * - Sentiment-based trigger evaluation
 * - Image upload trigger matching
 * - Intent detection trigger evaluation
 */

import type { TriggerEvent } from "./workflow-execution-engine";
import type { AutomationWorkflow, WorkflowNode } from "../types/database";

export interface TriggerMatchResult {
  matches: boolean;
  confidence: number;
  matchedConditions: string[];
  context: Record<string, any>;
}

export interface TriggerCondition {
  type: "exact" | "contains" | "threshold" | "regex" | "range" | "in";
  field: string;
  value: any;
  operator?: "eq" | "gt" | "lt" | "gte" | "lte" | "in" | "not_in";
}

export interface TriggerConfiguration {
  triggerType: string;
  conditions: TriggerCondition[];
  requireAll?: boolean; // AND vs OR logic
  metadata?: Record<string, any>;
}

/**
 * Main trigger matching system that evaluates events against workflow triggers
 */
export class WorkflowTriggerMatcher {
  private conversationMatcher: ConversationStartMatcher;
  private sentimentMatcher: SentimentTriggerMatcher;
  private imageMatcher: ImageUploadMatcher;
  private intentMatcher: IntentDetectionMatcher;
  private escalationMatcher: EscalationTriggerMatcher;
  private triageMatcher: ConversationTriageMatcher;

  constructor() {
    this.conversationMatcher = new ConversationStartMatcher();
    this.sentimentMatcher = new SentimentTriggerMatcher();
    this.imageMatcher = new ImageUploadMatcher();
    this.intentMatcher = new IntentDetectionMatcher();
    this.escalationMatcher = new EscalationTriggerMatcher();
    this.triageMatcher = new ConversationTriageMatcher();
  }

  /**
   * Evaluates if a workflow should be triggered by the given event
   */
  async evaluateWorkflowTrigger(
    workflow: AutomationWorkflow,
    event: TriggerEvent
  ): Promise<TriggerMatchResult> {
    try {
      console.log(
        `Evaluating workflow ${workflow.id} against event ${event.type}`
      );

      // Validate workflow structure
      if (
        !workflow.flowDefinition ||
        !workflow.flowDefinition.nodes ||
        !Array.isArray(workflow.flowDefinition.nodes)
      ) {
        console.error(
          `Invalid workflow structure for ${workflow.id}: missing or invalid nodes array`
        );
        return {
          matches: false,
          confidence: 0,
          matchedConditions: [],
          context: {
            error: "Invalid workflow structure: missing or invalid nodes array",
          },
        };
      }

      // Find trigger nodes in the workflow
      const triggerNodes = workflow.flowDefinition.nodes.filter(
        (node) => node && node.type === "trigger"
      );

      console.log(
        `Found ${triggerNodes.length} trigger nodes in workflow ${workflow.id}`
      );

      if (triggerNodes.length === 0) {
        console.log(`No trigger nodes found in workflow ${workflow.id}`);
        return {
          matches: false,
          confidence: 0,
          matchedConditions: [],
          context: {
            reason: "No trigger nodes found in workflow",
          },
        };
      }

      // Evaluate each trigger node
      const results: TriggerMatchResult[] = [];

      for (const triggerNode of triggerNodes) {
        try {
          console.log(
            `Evaluating trigger node ${triggerNode.id} with nodeType: ${triggerNode.data?.nodeType}`
          );
          const result = await this.evaluateTriggerNode(triggerNode, event);
          console.log(`Trigger node ${triggerNode.id} result:`, result);
          results.push(result);
        } catch (nodeError) {
          console.error(
            `Error evaluating trigger node ${triggerNode.id}:`,
            nodeError
          );
          results.push({
            matches: false,
            confidence: 0,
            matchedConditions: [],
            context: {
              error: `Node evaluation failed: ${
                nodeError instanceof Error ? nodeError.message : "Unknown error"
              }`,
            },
          });
        }
      }

      // Combine results (OR logic - any trigger can activate the workflow)
      const hasMatch = results.some((r) => r.matches);
      const maxConfidence =
        results.length > 0 ? Math.max(...results.map((r) => r.confidence)) : 0;
      const allMatchedConditions = results.flatMap((r) => r.matchedConditions);
      const combinedContext = results.reduce(
        (acc, r) => ({ ...acc, ...r.context }),
        {}
      );

      console.log(
        `Workflow ${workflow.id} final evaluation: matches=${hasMatch}, confidence=${maxConfidence}`
      );

      return {
        matches: hasMatch,
        confidence: maxConfidence,
        matchedConditions: allMatchedConditions,
        context: combinedContext,
      };
    } catch (error) {
      console.error(
        `Error evaluating workflow trigger for ${workflow.id}:`,
        error
      );
      return {
        matches: false,
        confidence: 0,
        matchedConditions: [],
        context: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Evaluates a single trigger node against an event
   */
  async evaluateTriggerNode(
    triggerNode: WorkflowNode,
    event: TriggerEvent
  ): Promise<TriggerMatchResult> {
    const triggerConfig = this.parseTriggerConfiguration(triggerNode);

    console.log(
      `Evaluating trigger node ${triggerNode.id} with type ${triggerConfig.triggerType} against event ${event.type}`
    );

    // Route to appropriate matcher based on trigger type
    switch (triggerConfig.triggerType) {
      case "NewConversation":
      case "new_conversation":
      case "conversation_started":
        console.log("Using conversation matcher");
        return this.conversationMatcher.evaluate(event, triggerConfig);

      case "SentimentTrigger":
      case "sentiment_trigger":
      case "NegativeSentiment":
      case "negative_sentiment":
      case "VeryNegativeSentiment":
      case "very_negative_sentiment":
      case "PositiveSentiment":
      case "positive_sentiment":
      case "HighEmotion":
      case "high_emotion":
        console.log("Using sentiment matcher");
        return this.sentimentMatcher.evaluate(event, triggerConfig);

      case "ImageUploaded":
      case "image_uploaded":
        console.log("Using image matcher");
        return this.imageMatcher.evaluate(event, triggerConfig);

      case "IntentDetected":
      case "intent_detected":
        console.log("Using intent matcher");
        return this.intentMatcher.evaluate(event, triggerConfig);

      case "EscalationTrigger":
      case "escalation_trigger":
      case "escalation":
      case "sentiment_escalation":
        console.log("Using escalation matcher");
        return this.escalationMatcher.evaluate(event, triggerConfig);

      case "ConversationTriage":
      case "conversation_triage":
      case "triage":
      case "priority_triage":
        console.log("Using triage matcher");
        return this.triageMatcher.evaluate(event, triggerConfig);

      default:
        console.warn(`Unknown trigger type: ${triggerConfig.triggerType}`);
        return {
          matches: false,
          confidence: 0,
          matchedConditions: [],
          context: {
            error: `Unknown trigger type: ${triggerConfig.triggerType}`,
          },
        };
    }
  }

  /**
   * Parses trigger configuration from workflow node data
   */
  private parseTriggerConfiguration(
    triggerNode: WorkflowNode
  ): TriggerConfiguration {
    const data = triggerNode.data || {};
    const config = (data as { config?: Record<string, unknown> }).config || {};
    const nodeType = (data as { nodeType?: string }).nodeType;

    return {
      triggerType:
        nodeType ||
        (config as { triggerType?: string }).triggerType ||
        "unknown",
      conditions:
        (config as { conditions?: TriggerCondition[] }).conditions || [],
      requireAll: (config as { requireAll?: boolean }).requireAll !== false, // Default to AND logic
      metadata:
        (config as { metadata?: Record<string, unknown> }).metadata || {},
    };
  }

  /**
   * Gets all supported trigger types
   */
  getSupportedTriggerTypes(): string[] {
    return [
      "new_conversation",
      "sentiment_trigger",
      "negative_sentiment",
      "very_negative_sentiment",
      "positive_sentiment",
      "high_emotion",
      "image_uploaded",
      "intent_detected",
      "escalation_trigger",
      "conversation_triage",
    ];
  }
}

/**
 * Handles conversation start trigger matching
 */
export class ConversationStartMatcher {
  async evaluate(
    event: TriggerEvent,
    config: TriggerConfiguration
  ): Promise<TriggerMatchResult> {
    console.log(`ConversationStartMatcher evaluating event: ${event.type}`);

    // Check if this is a conversation start event
    const isConversationStart = this.isConversationStartEvent(event);

    console.log(`Is conversation start event: ${isConversationStart}`);

    if (!isConversationStart) {
      return {
        matches: false,
        confidence: 0,
        matchedConditions: [],
        context: {
          reason: `Event type ${event.type} is not a conversation start event`,
        },
      };
    }

    // Evaluate additional conditions
    const conditionsArray = Array.isArray(config.conditions)
      ? config.conditions
      : [];
    const conditionResults = await this.evaluateConditions(
      event,
      conditionsArray
    );

    // If no conditions are specified, match by default
    const matches =
      conditionsArray.length === 0
        ? true
        : config.requireAll
        ? conditionResults.every((r) => r.matches)
        : conditionResults.some((r) => r.matches);

    const matchedConditions = conditionResults
      .filter((r) => r.matches)
      .map((r) => r.condition);

    // Add default condition if no specific conditions
    if (conditionsArray.length === 0) {
      matchedConditions.push("default_conversation_start");
    }

    const confidence = matches ? this.calculateConfidence(conditionResults) : 0;

    console.log(
      `ConversationStartMatcher result: matches=${matches}, confidence=${confidence}`
    );

    return {
      matches,
      confidence,
      matchedConditions,
      context: {
        eventType: "conversation_start",
        conversationId: event.conversationId,
        userId: event.userId,
        isNewUser: event.data.isNewUser,
        timestamp: event.data.timestamp,
        triggerType: event.data.trigger_type,
      },
    };
  }

  private isConversationStartEvent(event: TriggerEvent): boolean {
    const isMatch =
      event.type === "NewConversation" ||
      event.type === "new_conversation" ||
      event.type === "conversation_started" ||
      event.data.eventName === "conversation.started" ||
      event.data.trigger_type === "new_conversation" ||
      event.data.is_first_message === true ||
      event.data.message_count === 1;

    console.log(
      `Checking if event is conversation start: ${event.type} -> ${isMatch}`
    );
    console.log(`Event trigger_type: ${event.data.trigger_type}`);
    console.log(`Event is_first_message: ${event.data.is_first_message}`);
    console.log(`Event message_count: ${event.data.message_count}`);

    return isMatch;
  }

  private async evaluateConditions(
    event: TriggerEvent,
    conditions: TriggerCondition[]
  ): Promise<Array<{ matches: boolean; condition: string }>> {
    const results = [];

    // Ensure conditions is an array
    const conditionsArray = Array.isArray(conditions) ? conditions : [];

    for (const condition of conditionsArray) {
      const matches = await this.evaluateCondition(event, condition);
      results.push({
        matches,
        condition: `${condition.field} ${
          condition.operator || condition.type
        } ${condition.value}`,
      });
    }

    return results;
  }

  private async evaluateCondition(
    event: TriggerEvent,
    condition: TriggerCondition
  ): Promise<boolean> {
    const fieldValue = this.getFieldValue(event, condition.field);

    switch (condition.type) {
      case "exact":
        return fieldValue === condition.value;

      case "contains":
        return String(fieldValue)
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());

      case "threshold":
        const numValue = Number(fieldValue);
        const threshold = Number(condition.value);
        switch (condition.operator) {
          case "gt":
            return numValue > threshold;
          case "gte":
            return numValue >= threshold;
          case "lt":
            return numValue < threshold;
          case "lte":
            return numValue <= threshold;
          default:
            return numValue === threshold;
        }

      default:
        return false;
    }
  }

  private getFieldValue(event: TriggerEvent, field: string): any {
    // Support nested field access with dot notation
    const parts = field.split(".");
    let value: any = event;

    for (const part of parts) {
      value = value?.[part];
    }

    return value;
  }

  private calculateConfidence(
    results: Array<{ matches: boolean; condition: string }>
  ): number {
    if (results.length === 0) return 1.0;

    const matchCount = results.filter((r) => r.matches).length;
    return matchCount / results.length;
  }
}

/**
 * Handles sentiment-based trigger matching
 */
export class SentimentTriggerMatcher {
  async evaluate(
    event: TriggerEvent,
    config: TriggerConfiguration
  ): Promise<TriggerMatchResult> {
    // Check if this is a sentiment event
    const isSentimentEvent = this.isSentimentEvent(event);

    if (!isSentimentEvent) {
      return {
        matches: false,
        confidence: 0,
        matchedConditions: [],
        context: {},
      };
    }

    const sentiment = this.extractSentimentData(event);
    const matches = this.matchesSentimentCriteria(sentiment, config);

    if (!matches) {
      return {
        matches: false,
        confidence: 0,
        matchedConditions: [],
        context: { sentiment },
      };
    }

    // Calculate confidence based on sentiment strength
    const confidence = this.calculateSentimentConfidence(sentiment, config);
    const matchedConditions = this.getMatchedSentimentConditions(
      sentiment,
      config
    );

    return {
      matches: true,
      confidence,
      matchedConditions,
      context: {
        eventType: "sentiment_trigger",
        sentiment,
        triggerType: config.triggerType,
        conversationId: event.conversationId,
        messageId: event.messageId,
      },
    };
  }

  private isSentimentEvent(event: TriggerEvent): boolean {
    return (
      event.type === "SentimentTrigger" ||
      event.type === "sentiment_trigger" ||
      event.type === "negative_sentiment" ||
      event.type === "very_negative_sentiment" ||
      event.type === "positive_sentiment" ||
      event.type === "high_emotion" ||
      event.type === "sentiment_analyzed" ||
      event.data.eventName === "sentiment.trigger" ||
      event.data.sentiment !== undefined
    );
  }

  private extractSentimentData(event: TriggerEvent): any {
    return (
      event.data.sentiment || {
        score: event.data.sentimentScore,
        label: event.data.sentimentLabel,
        trigger_type: event.data.trigger_type,
      }
    );
  }

  private matchesSentimentCriteria(
    sentiment: any,
    config: TriggerConfiguration
  ): boolean {
    const triggerType = config.triggerType;
    const sentimentScore = Number(
      sentiment.score || sentiment.sentimentScore || 0
    );
    const sentimentLabel = sentiment.label || sentiment.sentiment;
    const triggerTypeFromEvent = sentiment.trigger_type;

    // Match based on trigger type
    switch (triggerType) {
      case "NegativeSentiment":
      case "negative_sentiment":
        return (
          sentimentScore < -0.2 ||
          sentimentLabel === "negative" ||
          triggerTypeFromEvent === "NegativeSentiment" ||
          triggerTypeFromEvent === "negative_sentiment"
        );

      case "VeryNegativeSentiment":
      case "very_negative_sentiment":
        return (
          sentimentScore < -0.6 ||
          triggerTypeFromEvent === "VeryNegativeSentiment" ||
          triggerTypeFromEvent === "very_negative_sentiment"
        );

      case "PositiveSentiment":
      case "positive_sentiment":
        return (
          sentimentScore > 0.2 ||
          sentimentLabel === "positive" ||
          triggerTypeFromEvent === "PositiveSentiment" ||
          triggerTypeFromEvent === "positive_sentiment"
        );

      case "HighEmotion":
      case "high_emotion":
        return (
          Math.abs(sentimentScore) > 0.7 ||
          triggerTypeFromEvent === "HighEmotion" ||
          triggerTypeFromEvent === "high_emotion"
        );

      default:
        return triggerTypeFromEvent === triggerType;
    }
  }

  private calculateSentimentConfidence(
    sentiment: any,
    _config: TriggerConfiguration
  ): number {
    const sentimentScore = Math.abs(
      Number(sentiment.score || sentiment.sentimentScore || 0)
    );

    // Higher absolute sentiment scores = higher confidence
    return Math.min(sentimentScore * 1.5, 1.0);
  }

  private getMatchedSentimentConditions(
    sentiment: any,
    config: TriggerConfiguration
  ): string[] {
    const conditions = [];
    const triggerType = config.triggerType;
    const sentimentScore = Number(
      sentiment.score || sentiment.sentimentScore || 0
    );

    conditions.push(`trigger_type: ${triggerType}`);
    conditions.push(`sentiment_score: ${sentimentScore}`);

    if (sentiment.label) {
      conditions.push(`sentiment_label: ${sentiment.label}`);
    }

    return conditions;
  }
}

/**
 * Handles image upload trigger matching
 */
export class ImageUploadMatcher {
  async evaluate(
    event: TriggerEvent,
    config: TriggerConfiguration
  ): Promise<TriggerMatchResult> {
    // Check if this is an image upload event
    const isImageEvent = this.isImageUploadEvent(event);

    if (!isImageEvent) {
      return {
        matches: false,
        confidence: 0,
        matchedConditions: [],
        context: {},
      };
    }

    const imageData = this.extractImageData(event);
    const conditionResults = await this.evaluateImageConditions(
      imageData,
      config.conditions
    );

    const matches = config.requireAll
      ? conditionResults.every((r) => r.matches)
      : conditionResults.some((r) => r.matches) ||
        conditionResults.length === 0; // Match if no conditions

    const matchedConditions = conditionResults
      .filter((r) => r.matches)
      .map((r) => r.condition);

    const confidence = matches
      ? this.calculateImageConfidence(imageData, conditionResults)
      : 0;

    return {
      matches,
      confidence,
      matchedConditions,
      context: {
        eventType: "image_upload",
        imageData,
        conversationId: event.conversationId,
        messageId: event.messageId,
      },
    };
  }

  private isImageUploadEvent(event: TriggerEvent): boolean {
    return (
      event.type === "ImageUploaded" ||
      event.type === "image_uploaded" ||
      event.data.eventName === "image.uploaded" ||
      event.data.image_url !== undefined ||
      event.data.imageUrl !== undefined
    );
  }

  private extractImageData(event: TriggerEvent): any {
    return {
      url: event.data.image_url || event.data.imageUrl,
      type: event.data.imageType,
      size: event.data.fileSize,
      fileName: event.data.fileName,
      analysisResult: event.data.analysis_result || event.data.analysisResult,
    };
  }

  private async evaluateImageConditions(
    imageData: any,
    conditions: TriggerCondition[]
  ): Promise<Array<{ matches: boolean; condition: string }>> {
    const results = [];

    for (const condition of conditions) {
      let matches = false;

      switch (condition.field) {
        case "imageType":
        case "type":
          matches = this.matchImageType(imageData.type, condition);
          break;

        case "fileSize":
        case "size":
          matches = this.matchFileSize(imageData.size, condition);
          break;

        case "fileName":
          matches = this.matchFileName(imageData.fileName, condition);
          break;

        default:
          matches = false;
      }

      results.push({
        matches,
        condition: `${condition.field} ${
          condition.operator || condition.type
        } ${condition.value}`,
      });
    }

    return results;
  }

  private matchImageType(
    imageType: string,
    condition: TriggerCondition
  ): boolean {
    if (!imageType) return false;

    switch (condition.type) {
      case "exact":
        return imageType === condition.value;
      case "contains":
        return imageType.includes(condition.value);
      case "in":
        return (
          Array.isArray(condition.value) && condition.value.includes(imageType)
        );
      default:
        return false;
    }
  }

  private matchFileSize(
    fileSize: number,
    condition: TriggerCondition
  ): boolean {
    if (fileSize === undefined || fileSize === null) return false;

    const size = Number(fileSize);
    const threshold = Number(condition.value);

    switch (condition.operator) {
      case "gt":
        return size > threshold;
      case "gte":
        return size >= threshold;
      case "lt":
        return size < threshold;
      case "lte":
        return size <= threshold;
      case "eq":
        return size === threshold;
      default:
        return size === threshold;
    }
  }

  private matchFileName(
    fileName: string,
    condition: TriggerCondition
  ): boolean {
    if (!fileName) return false;

    switch (condition.type) {
      case "exact":
        return fileName === condition.value;
      case "contains":
        return fileName.toLowerCase().includes(condition.value.toLowerCase());
      case "regex":
        try {
          const regex = new RegExp(condition.value);
          return regex.test(fileName);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private calculateImageConfidence(
    _imageData: unknown,
    results: Array<{ matches: boolean }>
  ): number {
    if (results.length === 0) return 1.0; // Full confidence if no conditions to check

    const matchCount = results.filter((r) => r.matches).length;
    return matchCount / results.length;
  }
}

/**
 * Handles intent detection trigger matching
 */
export class IntentDetectionMatcher {
  async evaluate(
    event: TriggerEvent,
    config: TriggerConfiguration
  ): Promise<TriggerMatchResult> {
    // Check if this is an intent detection event
    const isIntentEvent = this.isIntentDetectionEvent(event);

    if (!isIntentEvent) {
      return {
        matches: false,
        confidence: 0,
        matchedConditions: [],
        context: {},
      };
    }

    const intentData = this.extractIntentData(event);
    const matches = this.matchesIntentCriteria(intentData, config);

    if (!matches) {
      return {
        matches: false,
        confidence: 0,
        matchedConditions: [],
        context: { intentData },
      };
    }

    const confidence = this.calculateIntentConfidence(intentData, config);
    const matchedConditions = this.getMatchedIntentConditions(
      intentData,
      config
    );

    return {
      matches: true,
      confidence,
      matchedConditions,
      context: {
        eventType: "intent_detection",
        intentData,
        conversationId: event.conversationId,
        messageId: event.messageId,
      },
    };
  }

  private isIntentDetectionEvent(event: TriggerEvent): boolean {
    return (
      event.type === "IntentDetected" ||
      event.type === "intent_detected" ||
      event.data.eventName === "intent.detected" ||
      event.data.intent !== undefined
    );
  }

  private extractIntentData(event: TriggerEvent): any {
    return {
      intent: event.data.intent,
      confidence: event.data.confidence,
      message: event.data.message || event.data.content,
      matchedKeywords: event.data.matchedKeywords,
    };
  }

  private matchesIntentCriteria(
    intentData: any,
    config: TriggerConfiguration
  ): boolean {
    // Check if specific intent is configured
    const targetIntent =
      config.metadata?.intent || config.metadata?.targetIntent;
    if (targetIntent && intentData.intent !== targetIntent) {
      return false;
    }

    // Check confidence threshold
    const minConfidence = config.metadata?.minConfidence || 0.5;
    if (intentData.confidence < minConfidence) {
      return false;
    }

    // Check keyword matching if configured
    const requiredKeywords =
      config.metadata?.keywords || config.metadata?.requiredKeywords;
    if (requiredKeywords && Array.isArray(requiredKeywords)) {
      const message = (intentData.message || "").toLowerCase();
      const hasRequiredKeywords = requiredKeywords.some((keyword) =>
        message.includes(keyword.toLowerCase())
      );
      if (!hasRequiredKeywords) {
        return false;
      }
    }

    return true;
  }

  private calculateIntentConfidence(
    intentData: unknown,
    config: TriggerConfiguration
  ): number {
    const typedIntentData = intentData as {
      confidence?: number;
      matchedKeywords?: string[];
    };

    // Use the intent detection confidence as base
    let confidence = Number(typedIntentData.confidence || 0.5);

    // Boost confidence if keywords match
    const requiredKeywords = config.metadata?.keywords || [];
    if (requiredKeywords.length > 0 && typedIntentData.matchedKeywords) {
      const keywordMatchRatio =
        typedIntentData.matchedKeywords.length / requiredKeywords.length;
      confidence = Math.min(confidence * (1 + keywordMatchRatio * 0.5), 1.0);
    }

    return confidence;
  }

  private getMatchedIntentConditions(
    intentData: any,
    _config: TriggerConfiguration
  ): string[] {
    const conditions = [];

    conditions.push(`intent: ${intentData.intent}`);
    conditions.push(`confidence: ${intentData.confidence}`);

    if (intentData.matchedKeywords && intentData.matchedKeywords.length > 0) {
      conditions.push(
        `matched_keywords: ${intentData.matchedKeywords.join(", ")}`
      );
    }

    return conditions;
  }
}

/**
 * Handles escalation trigger matching
 * Integrates with the escalation trigger system for sentiment-based and keyword-based escalation
 */
export class EscalationTriggerMatcher {
  async evaluate(
    event: TriggerEvent,
    config: TriggerConfiguration
  ): Promise<TriggerMatchResult> {
    console.log("EscalationTriggerMatcher evaluating event:", event.type);

    const matches: string[] = [];
    let confidence = 0;
    let shouldEscalate = false;

    // Check sentiment-based escalation
    if (
      event.type === "sentiment_analyzed" ||
      event.data.sentimentScore !== undefined
    ) {
      const sentimentScore = event.data.sentimentScore as number;
      if (sentimentScore !== undefined) {
        const threshold = this.getSentimentThreshold(config);
        if (sentimentScore < threshold) {
          shouldEscalate = true;
          matches.push(
            `sentiment_below_threshold: ${sentimentScore} < ${threshold}`
          );
          confidence = Math.max(
            confidence,
            Math.abs(sentimentScore - threshold) * 2
          );
        }
      }
    }

    // Check keyword-based escalation
    if (event.type === "message_received" || event.type === "message_created") {
      const message = (event.data.message ||
        event.data.content ||
        "") as string;
      const keywords = this.getKeywords(config);
      if (message && keywords.length > 0) {
        const keywordMatches = this.checkKeywords(
          message,
          keywords
        );
        if (keywordMatches.length > 0) {
          shouldEscalate = true;
          matches.push(`escalation_keywords: ${keywordMatches.join(", ")}`);
          confidence = Math.max(confidence, 0.9); // High confidence for keyword matches
        }
      }
    }

    // Check duration-based escalation
    if (event.data.waitTimeMinutes !== undefined) {
      const waitTime = event.data.waitTimeMinutes as number;
      const threshold = this.getResponseTimeThreshold(config);
      if (waitTime >= threshold) {
        shouldEscalate = true;
        matches.push(`response_timeout: ${waitTime} >= ${threshold} minutes`);
        confidence = Math.max(confidence, Math.min(waitTime / threshold, 1.0));
      }
    }

    return {
      matches: shouldEscalate,
      confidence: Math.min(confidence, 1.0),
      matchedConditions: matches,
      context: {
        triggerType: "escalation",
        sentimentScore: event.data.sentimentScore,
        waitTimeMinutes: event.data.waitTimeMinutes,
        message: event.data.message,
      },
    };
  }

  private getSentimentThreshold(config: TriggerConfiguration): number {
    const sentimentCondition = config.conditions.find(c => c.field === 'sentimentScore' && c.type === 'threshold');
    return sentimentCondition ? (sentimentCondition.value as number) : -0.3;
  }

  private getKeywords(config: TriggerConfiguration): string[] {
    const keywordCondition = config.conditions.find(c => c.field === 'keywords' && c.type === 'in');
    return keywordCondition ? (keywordCondition.value as string[]) : [];
  }

  private getResponseTimeThreshold(config: TriggerConfiguration): number {
    const timeCondition = config.conditions.find(c => c.field === 'responseTimeMinutes' && c.type === 'threshold');
    return timeCondition ? (timeCondition.value as number) : 30;
  }

  private getMessageCountThreshold(config: TriggerConfiguration): number {
    const countCondition = config.conditions.find(c => c.field === 'messageCount' && c.type === 'threshold');
    return countCondition ? (countCondition.value as number) : 5;
  }

  private checkKeywords(message: string, keywords: string[]): string[] {
    const messageText = message.toLowerCase();
    return keywords.filter((keyword) =>
      messageText.includes(keyword.toLowerCase())
    );
  }
}

/**
 * Handles conversation triage trigger matching
 * Integrates with the conversation triage system for priority-based routing
 */
export class ConversationTriageMatcher {
  async evaluate(
    event: TriggerEvent,
    config: TriggerConfiguration
  ): Promise<TriggerMatchResult> {
    console.log("ConversationTriageMatcher evaluating event:", event.type);

    const matches: string[] = [];
    let confidence = 0;
    let shouldTriage = false;

    // Check high-priority sentiment triage
    if (event.data.sentimentScore !== undefined) {
      const sentimentScore = event.data.sentimentScore as number;
      const threshold = this.getSentimentThreshold(config);
      if (sentimentScore < threshold) {
        shouldTriage = true;
        matches.push(
          `high_priority_sentiment: ${sentimentScore} < ${threshold}`
        );
        confidence = Math.max(
          confidence,
          Math.abs(sentimentScore - threshold) * 1.5
        );
      }
    }

    // Check critical keyword triage
    if (event.type === "message_received" || event.type === "message_created") {
      const message = (event.data.message ||
        event.data.content ||
        "") as string;
      const keywords = this.getKeywords(config);
      if (message && keywords.length > 0) {
        const criticalKeywords = [
          "urgent",
          "emergency",
          "critical",
          "lawsuit",
          "legal",
          "refund",
          "cancel subscription",
        ];
        const configKeywords = keywords.concat(criticalKeywords);
        const keywordMatches = this.checkKeywords(message, configKeywords);
        if (keywordMatches.length > 0) {
          shouldTriage = true;
          matches.push(`critical_keywords: ${keywordMatches.join(", ")}`);
          confidence = Math.max(confidence, 0.95); // Very high confidence for critical keywords
        }
      }
    }

    // Check message count triage
    if (event.data.messageCount !== undefined) {
      const messageCount = event.data.messageCount as number;
      const threshold = this.getMessageCountThreshold(config);
      if (messageCount >= threshold) {
        shouldTriage = true;
        matches.push(`multiple_messages: ${messageCount} >= ${threshold}`);
        confidence = Math.max(
          confidence,
          Math.min(messageCount / (threshold * 2), 0.8)
        );
      }
    }

    // Check response time triage
    if (event.data.waitTimeMinutes !== undefined) {
      const waitTime = event.data.waitTimeMinutes as number;
      const threshold = this.getResponseTimeThreshold(config);
      if (waitTime >= threshold) {
        shouldTriage = true;
        matches.push(`long_response_time: ${waitTime} >= ${threshold} minutes`);
        confidence = Math.max(
          confidence,
          Math.min(waitTime / (threshold * 2), 0.7)
        );
      }
    }

    return {
      matches: shouldTriage,
      confidence: Math.min(confidence, 1.0),
      matchedConditions: matches,
      context: {
        triggerType: "triage",
        priority: this.calculatePriority(event, config),
        sentimentScore: event.data.sentimentScore,
        messageCount: event.data.messageCount,
        waitTimeMinutes: event.data.waitTimeMinutes,
      },
    };
  }

  private checkKeywords(message: string, keywords: string[]): string[] {
    const messageText = message.toLowerCase();
    return keywords.filter((keyword) =>
      messageText.includes(keyword.toLowerCase())
    );
  }

  private calculatePriority(
    event: TriggerEvent,
    config: TriggerConfiguration
  ): string {
    const sentimentScore = event.data.sentimentScore as number;
    const messageCount = event.data.messageCount as number;
    const waitTime = event.data.waitTimeMinutes as number;

    // Critical priority conditions
    if (sentimentScore && sentimentScore < -0.8) return "critical";
    if (
      event.data.message &&
      this.hasCriticalKeywords(event.data.message as string)
    )
      return "critical";

    // High priority conditions
    if (sentimentScore && sentimentScore < -0.6) return "high";
    if (messageCount && messageCount >= 8) return "high";

    // Medium priority conditions
    if (sentimentScore && sentimentScore < -0.4) return "medium";
    if (messageCount && messageCount >= 5) return "medium";
    if (waitTime && waitTime >= 30) return "medium";

    return "low";
  }

  private hasCriticalKeywords(message: string): boolean {
    const criticalKeywords = [
      "urgent",
      "emergency",
      "critical",
      "lawsuit",
      "legal",
    ];
    const messageText = message.toLowerCase();
    return criticalKeywords.some((keyword) => messageText.includes(keyword));
  }

  private getSentimentThreshold(config: TriggerConfiguration): number {
    const sentimentCondition = config.conditions.find(c => c.field === 'sentimentScore' && c.type === 'threshold');
    return sentimentCondition ? (sentimentCondition.value as number) : -0.6;
  }

  private getKeywords(config: TriggerConfiguration): string[] {
    const keywordCondition = config.conditions.find(c => c.field === 'keywords' && c.type === 'in');
    return keywordCondition ? (keywordCondition.value as string[]) : [];
  }

  private getResponseTimeThreshold(config: TriggerConfiguration): number {
    const timeCondition = config.conditions.find(c => c.field === 'responseTimeMinutes' && c.type === 'threshold');
    return timeCondition ? (timeCondition.value as number) : 30;
  }

  private getMessageCountThreshold(config: TriggerConfiguration): number {
    const countCondition = config.conditions.find(c => c.field === 'messageCount' && c.type === 'threshold');
    return countCondition ? (countCondition.value as number) : 5;
  }
}

// Export singleton instance
export const workflowTriggerMatcher = new WorkflowTriggerMatcher();
