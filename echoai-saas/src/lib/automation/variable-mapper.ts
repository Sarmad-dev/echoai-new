/**
 * Variable Mapper for Automation Workflows
 *
 * Handles dynamic variable substitution in automation actions
 * Maps conversation data to template variables
 */

export interface ConversationContext {
  // User information
  userEmail?: string;
  userName?: string;
  firstName?: string;
  lastName?: string;
  userPhone?: string;
  company?: string;
  website?: string;

  // Conversation data
  conversationId: string;
  messageId?: string;
  message?: string;
  timestamp: string;

  // Analysis data
  sentimentScore?: number;
  sentimentLabel?: string;
  intent?: string;
  intentConfidence?: number;

  // Image data (if applicable)
  imageUrl?: string;
  imageType?: string;
  analysisResult?: string;

  // Lead qualification data
  leadScore?: number;
  qualificationReason?: string;

  // Additional metadata
  chatbotId: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export class VariableMapper {
  private context: ConversationContext;

  constructor(context: ConversationContext) {
    this.context = context;
  }

  /**
   * Replace template variables in a string with actual values
   */
  replaceVariables(template: string): string {
    if (!template) return "";

    let result = template;

    // Replace all variables using regex
    result = result.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      const value = this.getVariableValue(variableName);
      return value !== undefined ? String(value) : match;
    });

    return result;
  }

  /**
   * Replace variables in an object recursively
   */
  replaceVariablesInObject<T extends Record<string, any>>(obj: T): T {
    const result = { ...obj } as Record<string, any>;

    for (const [key, value] of Object.entries(result)) {
      if (typeof value === "string") {
        result[key] = this.replaceVariables(value);
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        result[key] = this.replaceVariablesInObject(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === "string"
            ? this.replaceVariables(item)
            : typeof item === "object" && item !== null
            ? this.replaceVariablesInObject(item)
            : item
        );
      }
    }

    return result as T;
  }

  /**
   * Get the value for a specific variable name
   */
  private getVariableValue(variableName: string): any {
    switch (variableName.toLowerCase()) {
      // User information
      case "useremail":
        return this.context.userEmail;
      case "username":
        return this.context.userName || this.getFullName();
      case "firstname":
        return this.context.firstName;
      case "lastname":
        return this.context.lastName;
      case "userphone":
        return this.context.userPhone;
      case "company":
        return this.context.company;
      case "website":
        return this.context.website;

      // Conversation data
      case "conversationid":
        return this.context.conversationId;
      case "messageid":
        return this.context.messageId;
      case "message":
        return this.context.message;
      case "timestamp":
        return this.formatTimestamp(this.context.timestamp);

      // Analysis data
      case "sentimentscore":
        return this.context.sentimentScore;
      case "sentimentlabel":
        return this.context.sentimentLabel || this.getSentimentLabel();
      case "intent":
        return this.context.intent;
      case "intentconfidence":
        return this.context.intentConfidence;

      // Image data
      case "imageurl":
        return this.context.imageUrl;
      case "imagetype":
        return this.context.imageType;
      case "analysisresult":
        return this.context.analysisResult;

      // Lead data
      case "leadscore":
        return this.context.leadScore;
      case "qualificationreason":
        return this.context.qualificationReason;

      // System data
      case "chatbotid":
        return this.context.chatbotId;
      case "sessionid":
        return this.context.sessionId;

      // Formatted timestamps
      case "date":
        return this.formatDate(this.context.timestamp);
      case "time":
        return this.formatTime(this.context.timestamp);
      case "datetime":
        return this.formatDateTime(this.context.timestamp);

      default:
        // Check metadata for custom variables
        return this.context.metadata?.[variableName];
    }
  }

  /**
   * Get full name from first and last name
   */
  private getFullName(): string {
    const parts = [];
    if (this.context.firstName) parts.push(this.context.firstName);
    if (this.context.lastName) parts.push(this.context.lastName);
    return parts.join(" ") || this.context.userEmail || "User";
  }

  /**
   * Get sentiment label from score
   */
  private getSentimentLabel(): string {
    if (this.context.sentimentScore === undefined) return "neutral";

    if (this.context.sentimentScore > 0.1) return "positive";
    if (this.context.sentimentScore < -0.1) return "negative";
    return "neutral";
  }

  /**
   * Format timestamp for display
   */
  private formatTimestamp(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  }

  /**
   * Format date only
   */
  private formatDate(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleDateString();
    } catch {
      return timestamp;
    }
  }

  /**
   * Format time only
   */
  private formatTime(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp;
    }
  }

  /**
   * Format full date and time
   */
  private formatDateTime(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  }

  /**
   * Get all available variables for the current context
   */
  getAvailableVariables(): Array<{
    name: string;
    value: any;
    description: string;
  }> {
    const variables = [
      {
        name: "userEmail",
        value: this.context.userEmail,
        description: "User email address",
      },
      {
        name: "userName",
        value: this.getFullName(),
        description: "User full name",
      },
      {
        name: "firstName",
        value: this.context.firstName,
        description: "User first name",
      },
      {
        name: "lastName",
        value: this.context.lastName,
        description: "User last name",
      },
      {
        name: "userPhone",
        value: this.context.userPhone,
        description: "User phone number",
      },
      {
        name: "company",
        value: this.context.company,
        description: "User company",
      },
      {
        name: "website",
        value: this.context.website,
        description: "Company website",
      },
      {
        name: "conversationId",
        value: this.context.conversationId,
        description: "Conversation ID",
      },
      {
        name: "message",
        value: this.context.message,
        description: "Current message content",
      },
      {
        name: "timestamp",
        value: this.formatTimestamp(this.context.timestamp),
        description: "Current timestamp",
      },
      {
        name: "date",
        value: this.formatDate(this.context.timestamp),
        description: "Current date",
      },
      {
        name: "time",
        value: this.formatTime(this.context.timestamp),
        description: "Current time",
      },
      {
        name: "sentimentScore",
        value: this.context.sentimentScore,
        description: "Sentiment score (-1 to 1)",
      },
      {
        name: "sentimentLabel",
        value: this.getSentimentLabel(),
        description: "Sentiment label (positive/negative/neutral)",
      },
      {
        name: "intent",
        value: this.context.intent,
        description: "Detected intent",
      },
      {
        name: "intentConfidence",
        value: this.context.intentConfidence,
        description: "Intent confidence score",
      },
      {
        name: "leadScore",
        value: this.context.leadScore,
        description: "Lead qualification score",
      },
      {
        name: "qualificationReason",
        value: this.context.qualificationReason,
        description: "Lead qualification reason",
      },
    ];

    // Add image-related variables if available
    if (this.context.imageUrl) {
      variables.push(
        {
          name: "imageUrl",
          value: this.context.imageUrl,
          description: "Uploaded image URL",
        },
        {
          name: "imageType",
          value: this.context.imageType,
          description: "Image file type",
        },
        {
          name: "analysisResult",
          value: this.context.analysisResult,
          description: "Image analysis result",
        }
      );
    }

    // Add metadata variables
    if (this.context.metadata) {
      Object.entries(this.context.metadata).forEach(([key, value]) => {
        variables.push({
          name: key,
          value,
          description: `Custom metadata: ${key}`,
        });
      });
    }

    return variables.filter((v) => v.value !== undefined);
  }

  /**
   * Validate template string for variable syntax
   */
  static validateTemplate(template: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for unmatched braces
    const openBraces = (template.match(/\{\{/g) || []).length;
    const closeBraces = (template.match(/\}\}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push("Unmatched template braces {{ }}");
    }

    // Check for invalid variable names
    const variableMatches = template.match(/\{\{(\w+)\}\}/g);
    if (variableMatches) {
      variableMatches.forEach((match) => {
        const variableName = match.replace(/\{\{|\}\}/g, "");
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variableName)) {
          errors.push(`Invalid variable name: ${variableName}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract variable names from a template
   */
  static extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];

    return matches.map((match) => match.replace(/\{\{|\}\}/g, ""));
  }
}

/**
 * Create a variable mapper from trigger data
 */
export function createVariableMapper(
  triggerData: Record<string, any>
): VariableMapper {
  const context: ConversationContext = {
    conversationId: triggerData.conversationId || "unknown",
    chatbotId: triggerData.chatbotId || "unknown",
    timestamp: triggerData.timestamp || new Date().toISOString(),
    userEmail: triggerData.userEmail,
    userName: triggerData.userName,
    firstName: triggerData.firstName,
    lastName: triggerData.lastName,
    userPhone: triggerData.userPhone,
    company: triggerData.company,
    website: triggerData.website,
    messageId: triggerData.messageId,
    message: triggerData.message,
    sentimentScore: triggerData.sentimentScore,
    sentimentLabel: triggerData.sentimentLabel,
    intent: triggerData.intent,
    intentConfidence: triggerData.intentConfidence,
    imageUrl: triggerData.imageUrl,
    imageType: triggerData.imageType,
    analysisResult: triggerData.analysisResult,
    leadScore: triggerData.leadScore,
    qualificationReason: triggerData.qualificationReason,
    sessionId: triggerData.sessionId,
    metadata: triggerData.metadata,
  };

  return new VariableMapper(context);
}
