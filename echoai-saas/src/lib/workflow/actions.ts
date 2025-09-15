/**
 * Workflow Action Handlers
 * 
 * Implements the core action types for automation workflows:
 * - AddNote: Adds internal notes to conversations
 * - TagConversation: Applies tags to conversations for organization
 * - SendSlackMessage: Sends notifications to Slack channels
 * - CreateHubSpotContact: Creates contacts in HubSpot CRM
 * - AutoApproveReturn: Automatically approves return requests
 */

import type { ActionResult, WorkflowContext } from '../workflow-execution-engine';

// Re-export types for use by action implementations
export type { ActionResult, WorkflowContext } from '../workflow-execution-engine';

export interface ActionHandler {
  type: string;
  execute(config: ActionConfig, context: WorkflowContext): Promise<ActionResult>;
  validateConfig(config: ActionConfig): ValidationResult;
  getConfigSchema(): ActionConfigSchema;
}

export interface ActionConfig {
  // Common fields
  message?: string;
  template?: string;
  variables?: Record<string, unknown>;
  
  // AddNote specific
  noteType?: 'info' | 'warning' | 'urgent';
  isPrivate?: boolean;
  
  // TagConversation specific
  tags?: string[];
  removeExisting?: boolean;
  
  // SendSlackMessage specific
  channel?: string;
  user?: string;
  username?: string;
  iconEmoji?: string;
  threadTs?: string;
  
  // CreateHubSpotContact specific
  fields?: Record<string, unknown>;
  dealProperties?: Record<string, unknown>;
  createDeal?: boolean;
  
  // AutoApproveReturn specific
  conditions?: Record<string, unknown>;
  approvalReason?: string;
  notifyCustomer?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ActionConfigSchema {
  type: string;
  title: string;
  description: string;
  properties: Record<string, unknown>;
  required: string[];
}

/**
 * Add Note Action
 * Adds internal notes to conversations for team visibility
 */
export class AddNoteAction implements ActionHandler {
  type = 'add_note';

  async execute(config: ActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const message = this.processTemplate(config.message || config.template || '', context);
      const noteType = config.noteType || 'info';
      
      // In a real implementation, this would save to the database
      const noteData = {
        conversationId: context.triggerData.conversationId,
        content: message,
        type: noteType,
        isPrivate: config.isPrivate ?? true,
        createdBy: 'automation',
        createdAt: new Date().toISOString(),
        metadata: {
          workflowId: context.executionId,
          triggerType: context.triggerId
        }
      };

      // Simulate database save
      console.log('Adding note to conversation:', noteData);

      return {
        success: true,
        data: {
          noteId: `note_${Date.now()}`,
          conversationId: context.triggerData.conversationId,
          content: message,
          type: noteType
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add note'
      };
    }
  }

  validateConfig(config: ActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.message && !config.template) {
      errors.push('Message or template is required');
    }

    if (config.noteType && !['info', 'warning', 'urgent'].includes(config.noteType)) {
      errors.push('Note type must be info, warning, or urgent');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: 'Add Note',
      description: 'Add an internal note to the conversation',
      properties: {
        message: {
          type: 'string',
          title: 'Note Message',
          description: 'The note content (supports template variables)'
        },
        noteType: {
          type: 'string',
          title: 'Note Type',
          enum: ['info', 'warning', 'urgent'],
          default: 'info'
        },
        isPrivate: {
          type: 'boolean',
          title: 'Private Note',
          description: 'Whether the note is visible only to team members',
          default: true
        }
      },
      required: ['message']
    };
  }

  private processTemplate(template: string, context: WorkflowContext): string {
    let processed = template;
    
    // Replace context variables
    Object.entries(context.triggerData).forEach(([key, value]) => {
      processed = processed.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        String(value)
      );
    });

    // Replace common variables
    processed = processed.replace(/\{\{timestamp\}\}/g, new Date().toISOString());
    processed = processed.replace(/\{\{executionId\}\}/g, context.executionId);
    processed = processed.replace(/\{\{triggerType\}\}/g, context.triggerId);
    
    return processed;
  }
}

/**
 * Tag Conversation Action
 * Applies tags to conversations for organization and filtering
 */
export class TagConversationAction implements ActionHandler {
  type = 'tag_conversation';

  async execute(config: ActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const tags = config.tags || [];
      const conversationId = context.triggerData.conversationId as string;

      if (tags.length === 0) {
        return {
          success: false,
          error: 'No tags specified'
        };
      }

      // In a real implementation, this would update the database
      const tagData = {
        conversationId,
        tags,
        removeExisting: config.removeExisting ?? false,
        appliedBy: 'automation',
        appliedAt: new Date().toISOString()
      };

      console.log('Tagging conversation:', tagData);

      return {
        success: true,
        data: {
          conversationId,
          appliedTags: tags,
          totalTags: tags.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to tag conversation'
      };
    }
  }

  validateConfig(config: ActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.tags || config.tags.length === 0) {
      errors.push('At least one tag is required');
    }

    if (config.tags && config.tags.some(tag => typeof tag !== 'string' || tag.trim() === '')) {
      errors.push('All tags must be non-empty strings');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: 'Tag Conversation',
      description: 'Apply tags to the conversation for organization',
      properties: {
        tags: {
          type: 'array',
          title: 'Tags',
          description: 'List of tags to apply',
          items: {
            type: 'string'
          }
        },
        removeExisting: {
          type: 'boolean',
          title: 'Remove Existing Tags',
          description: 'Whether to remove existing tags before applying new ones',
          default: false
        }
      },
      required: ['tags']
    };
  }
}

/**
 * Send Slack Message Action
 * Sends notifications to Slack channels or users
 */
export class SendSlackMessageAction implements ActionHandler {
  type = 'send_slack_message';

  async execute(config: ActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const message = this.processTemplate(config.message || config.template || '', context);
      const channel = config.channel || '#general';

      // In a real implementation, this would use the Slack API
      const slackPayload = {
        channel,
        text: message,
        username: config.username || 'EchoAI Bot',
        icon_emoji: config.iconEmoji || ':robot_face:',
        thread_ts: config.threadTs,
        attachments: this.createAttachments(context)
      };

      console.log('Sending Slack message:', slackPayload);

      // Simulate API call
      const messageId = `slack_${Date.now()}`;

      return {
        success: true,
        data: {
          messageId,
          channel,
          timestamp: new Date().toISOString(),
          text: message
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send Slack message'
      };
    }
  }

  validateConfig(config: ActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.message && !config.template) {
      errors.push('Message or template is required');
    }

    if (!config.channel) {
      warnings.push('No channel specified, will use #general');
    }

    if (config.channel && !config.channel.startsWith('#') && !config.channel.startsWith('@')) {
      warnings.push('Channel should start with # for channels or @ for users');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: 'Send Slack Message',
      description: 'Send a notification to a Slack channel or user',
      properties: {
        message: {
          type: 'string',
          title: 'Message',
          description: 'The message to send (supports template variables)'
        },
        channel: {
          type: 'string',
          title: 'Channel',
          description: 'Slack channel (#channel) or user (@user)',
          default: '#general'
        },
        username: {
          type: 'string',
          title: 'Bot Username',
          default: 'EchoAI Bot'
        },
        iconEmoji: {
          type: 'string',
          title: 'Icon Emoji',
          default: ':robot_face:'
        }
      },
      required: ['message']
    };
  }

  private processTemplate(template: string, context: WorkflowContext): string {
    let processed = template;
    
    // Replace context variables
    Object.entries(context.triggerData).forEach(([key, value]) => {
      processed = processed.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        String(value)
      );
    });

    return processed;
  }

  private createAttachments(context: WorkflowContext): Record<string, unknown>[] {
    const attachments = [];

    // Add context information as attachment
    if (context.triggerData.conversationId) {
      attachments.push({
        color: 'good',
        fields: [
          {
            title: 'Conversation ID',
            value: context.triggerData.conversationId,
            short: true
          },
          {
            title: 'Trigger Type',
            value: context.triggerId,
            short: true
          }
        ]
      });
    }

    return attachments;
  }
}

/**
 * Create HubSpot Contact Action
 * Creates or updates contacts in HubSpot CRM
 */
export class CreateHubSpotContactAction implements ActionHandler {
  type = 'create_hubspot_contact';

  async execute(config: ActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const fields = config.fields || {};
      const email = fields.email || context.triggerData.userEmail;

      if (!email) {
        return {
          success: false,
          error: 'Email is required to create HubSpot contact'
        };
      }

      // In a real implementation, this would use the HubSpot API
      const contactData = {
        email,
        firstname: fields.firstname || context.triggerData.firstName,
        lastname: fields.lastname || context.triggerData.lastName,
        company: fields.company,
        phone: fields.phone,
        website: fields.website,
        lifecyclestage: fields.lifecyclestage || 'lead',
        lead_source: 'chatbot_automation',
        ...fields
      };

      console.log('Creating HubSpot contact:', contactData);

      const contactId = `hubspot_${Date.now()}`;

      // Create deal if configured
      let dealId;
      if (config.createDeal) {
        dealId = await this.createDeal(contactId, config.dealProperties || {}, context);
      }

      return {
        success: true,
        data: {
          contactId,
          email,
          dealId,
          properties: contactData
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create HubSpot contact'
      };
    }
  }

  validateConfig(config: ActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.fields) {
      warnings.push('No field mappings specified');
    }

    if (config.fields && !config.fields.email) {
      warnings.push('Email field not mapped, will use trigger data');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: 'Create HubSpot Contact',
      description: 'Create or update a contact in HubSpot CRM',
      properties: {
        fields: {
          type: 'object',
          title: 'Contact Fields',
          description: 'HubSpot contact properties to set',
          properties: {
            email: { type: 'string', title: 'Email' },
            firstname: { type: 'string', title: 'First Name' },
            lastname: { type: 'string', title: 'Last Name' },
            company: { type: 'string', title: 'Company' },
            phone: { type: 'string', title: 'Phone' },
            website: { type: 'string', title: 'Website' }
          }
        },
        createDeal: {
          type: 'boolean',
          title: 'Create Deal',
          description: 'Whether to create an associated deal',
          default: false
        },
        dealProperties: {
          type: 'object',
          title: 'Deal Properties',
          description: 'Properties for the created deal'
        }
      },
      required: []
    };
  }

  private async createDeal(
    contactId: string, 
    dealProperties: Record<string, unknown>, 
    context: WorkflowContext
  ): Promise<string> {
    // In a real implementation, this would use the HubSpot API
    const dealData = {
      dealname: dealProperties.dealname || `Deal from ${context.triggerData.userEmail}`,
      amount: dealProperties.amount || 0,
      dealstage: dealProperties.dealstage || 'appointmentscheduled',
      pipeline: dealProperties.pipeline || 'default',
      closedate: dealProperties.closedate,
      hubspot_owner_id: dealProperties.hubspot_owner_id,
      associations: {
        contacts: [contactId]
      }
    };

    console.log('Creating HubSpot deal:', dealData);
    return `deal_${Date.now()}`;
  }
}

/**
 * Auto Approve Return Action
 * Automatically approves return requests based on conditions
 */
export class AutoApproveReturnAction implements ActionHandler {
  type = 'auto_approve_return';

  async execute(config: ActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const returnId = context.triggerData.returnId as string;
      const conditions = config.conditions || {};

      if (!returnId) {
        return {
          success: false,
          error: 'Return ID is required'
        };
      }

      // Check approval conditions
      const shouldApprove = this.evaluateConditions(conditions, context);

      if (!shouldApprove) {
        return {
          success: true,
          data: {
            returnId,
            approved: false,
            reason: 'Conditions not met for auto-approval'
          }
        };
      }

      // In a real implementation, this would update the return status
      const approvalData = {
        returnId,
        approved: true,
        approvedBy: 'automation',
        approvedAt: new Date().toISOString(),
        reason: config.approvalReason || 'Auto-approved by workflow',
        notifyCustomer: config.notifyCustomer ?? true
      };

      console.log('Auto-approving return:', approvalData);

      return {
        success: true,
        data: approvalData
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to auto-approve return'
      };
    }
  }

  validateConfig(config: ActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.conditions) {
      warnings.push('No approval conditions specified, will approve all returns');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getConfigSchema(): ActionConfigSchema {
    return {
      type: this.type,
      title: 'Auto Approve Return',
      description: 'Automatically approve return requests based on conditions',
      properties: {
        conditions: {
          type: 'object',
          title: 'Approval Conditions',
          description: 'Conditions that must be met for auto-approval',
          properties: {
            maxAmount: { type: 'number', title: 'Maximum Amount' },
            withinDays: { type: 'number', title: 'Within Days of Purchase' },
            productCategories: { 
              type: 'array', 
              title: 'Allowed Product Categories',
              items: { type: 'string' }
            }
          }
        },
        approvalReason: {
          type: 'string',
          title: 'Approval Reason',
          default: 'Auto-approved by workflow'
        },
        notifyCustomer: {
          type: 'boolean',
          title: 'Notify Customer',
          description: 'Whether to send approval notification to customer',
          default: true
        }
      },
      required: []
    };
  }

  private evaluateConditions(conditions: Record<string, unknown>, context: WorkflowContext): boolean {
    // Check maximum amount condition
    if (typeof conditions.maxAmount === 'number' && context.triggerData.returnAmount) {
      if (Number(context.triggerData.returnAmount) > conditions.maxAmount) {
        return false;
      }
    }

    // Check time-based condition
    if (typeof conditions.withinDays === 'number' && context.triggerData.purchaseDate) {
      const purchaseDate = new Date(context.triggerData.purchaseDate as string);
      const daysSincePurchase = (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePurchase > conditions.withinDays) {
        return false;
      }
    }

    // Check product category condition
    if (Array.isArray(conditions.productCategories) && context.triggerData.productCategory) {
      if (!conditions.productCategories.includes(context.triggerData.productCategory as string)) {
        return false;
      }
    }

    return true;
  }
}

// Import HubSpot actions
import { 
  CreateHubSpotContactAction as EnhancedCreateHubSpotContactAction,
  CreateHubSpotDealAction,
  UpdateHubSpotContactAction,
  CreateHubSpotCompanyAction
} from '../integrations/hubspot-actions';

// Import Slack actions
import {
  SendSlackMessageAction as EnhancedSendSlackMessageAction,
  SendSlackNotificationAction,
  SendSlackThreadReplyAction
} from '../integrations/slack-actions';

// Import Google Sheets actions
import {
  WriteToGoogleSheetsAction,
  ReadFromGoogleSheetsAction,
  LogToGoogleSheetsAction,
  UpdateGoogleSheetsRowAction
} from '../integrations/google-sheets-actions';

/**
 * Action Registry
 * Central registry for all available action handlers
 */
export class ActionRegistry {
  private static actions = new Map<string, ActionHandler>([
    ['add_note', new AddNoteAction()],
    ['send_slack_message', new EnhancedSendSlackMessageAction()],
    ['send_slack_notification', new SendSlackNotificationAction()],
    ['send_slack_thread_reply', new SendSlackThreadReplyAction()],
    ['create_hubspot_contact', new EnhancedCreateHubSpotContactAction()],
    ['create_hubspot_deal', new CreateHubSpotDealAction()],
    ['update_hubspot_contact', new UpdateHubSpotContactAction()],
    ['create_hubspot_company', new CreateHubSpotCompanyAction()],
    ['write_to_google_sheets', new WriteToGoogleSheetsAction()],
    ['read_from_google_sheets', new ReadFromGoogleSheetsAction()],
    ['log_to_google_sheets', new LogToGoogleSheetsAction()],
    ['update_google_sheets_row', new UpdateGoogleSheetsRowAction()],
  ]);

  static getAction(type: string): ActionHandler | undefined {
    return this.actions.get(type);
  }

  static getAllActions(): ActionHandler[] {
    return Array.from(this.actions.values());
  }

  static getActionTypes(): string[] {
    return Array.from(this.actions.keys());
  }

  static registerAction(action: ActionHandler): void {
    this.actions.set(action.type, action);
  }

  static getActionSchema(type: string): ActionConfigSchema | undefined {
    const action = this.getAction(type);
    return action?.getConfigSchema();
  }

  static validateActionConfig(type: string, config: ActionConfig): ValidationResult {
    const action = this.getAction(type);
    if (!action) {
      return {
        isValid: false,
        errors: [`Unknown action type: ${type}`],
        warnings: []
      };
    }
    return action.validateConfig(config);
  }
}