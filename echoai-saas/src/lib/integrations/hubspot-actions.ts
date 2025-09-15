/**
 * HubSpot Integration Action Handlers
 * 
 * Provides comprehensive HubSpot CRM actions for automation workflows:
 * - CreateHubSpotContact: Create or update contacts with full field mapping
 * - CreateHubSpotDeal: Create deals with contact associations
 * - UpdateHubSpotContact: Update existing contact properties
 * - CreateHubSpotCompany: Create companies and associate with contacts
 * - AddHubSpotNote: Add timeline notes to contacts/deals
 */

import { ActionHandler, ActionConfig, ValidationResult, ActionConfigSchema, ActionResult } from '../workflow/actions';
import { WorkflowContext } from '../workflow-execution-engine';
import { HubSpotApiClient, HubSpotRateLimitError } from './hubspot-client';
import { OAuth2Manager } from './oauth2-manager';
import { getProvider } from './providers';
import * as crypto from 'crypto';

export interface HubSpotActionConfig extends ActionConfig {
  // Contact fields
  contactFields?: Record<string, any>;
  updateExisting?: boolean;
  
  // Deal fields
  dealFields?: Record<string, any>;
  dealPipeline?: string;
  dealStage?: string;
  associateWithContact?: boolean;
  
  // Company fields
  companyFields?: Record<string, any>;
  associateCompanyWithContact?: boolean;
  
  // Note fields
  noteContent?: string;
  hubspotNoteType?: 'NOTE' | 'TASK' | 'MEETING' | 'CALL' | 'EMAIL';
  
  // General settings
  integrationId?: string;
  retryOnRateLimit?: boolean;
  maxRetries?: number;
}

/**
 * Base class for HubSpot actions with common functionality
 */
abstract class BaseHubSpotAction implements ActionHandler {
  abstract type: string;
  
  protected oauth2Manager = new OAuth2Manager();

  /**
   * Decrypt token using the same logic as API endpoints
   */
  private decryptToken(encryptedText: string): string {
    const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY || 'default-key-change-in-production'
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(encryptionKey, 'salt', 32)
    const parts = encryptedText.split(':')

    if (parts.length === 2) {
      // New format: iv:encrypted
      const [ivHex, encrypted] = parts
      const iv = Buffer.from(ivHex, 'hex')
      const decipher = crypto.createDecipheriv(algorithm, key, iv)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } else if (parts.length === 3) {
      // Old GCM format: iv:authTag:encrypted - handle gracefully
      const [, , encrypted] = parts
      // Use a default IV for legacy data - this is a fallback for old encrypted data
      const defaultIv = Buffer.alloc(16, 0)
      const decipher = crypto.createDecipheriv(algorithm, key, defaultIv)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } else {
      throw new Error('Invalid encrypted data format')
    }
  }

  /**
   * Get integration using server-side Supabase client (for workflow execution)
   */
  private async getIntegrationServerSide(integrationId: string, userId: string) {
    // Dynamically import server-side client to avoid client-side issues
    const { createClient } = await import('../supabase/supabase');
    const supabase = await createClient();

    const { data: integration, error } = await supabase
      .from("Integration")
      .select("*")
      .eq("id", integrationId)
      .eq("userId", userId)
      .eq("provider", "hubspot")
      .eq("isActive", true)
      .single();

    if (error || !integration) {
      return null;
    }

    // Decrypt tokens before returning
    return {
      ...integration,
      accessToken: this.decryptToken(integration.accessToken),
      refreshToken: integration.refreshToken ? this.decryptToken(integration.refreshToken) : undefined,
      tokenExpiry: integration.tokenExpiry ? new Date(integration.tokenExpiry) : undefined,
      createdAt: new Date(integration.createdAt),
      updatedAt: new Date(integration.updatedAt),
    };
  }

  /**
   * Get HubSpot client for the configured integration
   */
  protected async getHubSpotClient(config: HubSpotActionConfig, context: WorkflowContext): Promise<HubSpotApiClient> {
    if (!config.integrationId) {
      throw new Error('HubSpot integration ID is required');
    }

    let integration;

    // Use server-side approach if we have userId in context (workflow execution)
    if (context.userId) {
      integration = await this.getIntegrationServerSide(config.integrationId, context.userId);
    } else {
      // Fallback to OAuth2Manager for other cases
      integration = await this.oauth2Manager.getIntegrationById(config.integrationId);
    }

    if (!integration) {
      throw new Error('HubSpot integration not found');
    }

    if (!integration.isActive) {
      throw new Error('HubSpot integration is not active');
    }

    // Check if token needs refresh
    if (integration.tokenExpiry && integration.tokenExpiry < new Date()) {
      const provider = getProvider('hubspot');
      if (!provider) {
        throw new Error('HubSpot provider configuration not found');
      }

      const refreshedIntegration = await this.oauth2Manager.refreshAccessToken(
        config.integrationId,
        provider
      );

      if (!refreshedIntegration) {
        throw new Error('Failed to refresh HubSpot access token');
      }

      return new HubSpotApiClient(refreshedIntegration);
    }

    return new HubSpotApiClient(integration);
  }

  /**
   * Handle rate limiting with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: HubSpotActionConfig
  ): Promise<T> {
    const maxRetries = config.maxRetries || 3;
    const retryOnRateLimit = config.retryOnRateLimit !== false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error instanceof HubSpotRateLimitError && retryOnRateLimit) {
          if (attempt < maxRetries - 1) {
            // Wait for the retry-after period plus a small buffer
            const waitTime = (error.retryAfter + 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  /**
   * Process template variables in field values
   */
  protected processFieldTemplates(
    fields: Record<string, any>,
    context: WorkflowContext
  ): Record<string, any> {
    const processed: Record<string, any> = {};

    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'string') {
        processed[key] = this.processTemplate(value, context);
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  /**
   * Process template string with context variables
   */
  protected processTemplate(template: string, context: WorkflowContext): string {
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

  abstract execute(config: HubSpotActionConfig, context: WorkflowContext): Promise<ActionResult>;
  abstract validateConfig(config: HubSpotActionConfig): ValidationResult;
  abstract getConfigSchema(): ActionConfigSchema;
}

/**
 * Create HubSpot Contact Action
 * Creates or updates contacts in HubSpot with comprehensive field mapping
 */
export class CreateHubSpotContactAction extends BaseHubSpotAction {
  type = 'create_hubspot_contact';

  async execute(config: HubSpotActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const client = await this.getHubSpotClient(config, context);
      
      const contactFields = this.processFieldTemplates(
        config.contactFields || {},
        context
      );

      // Ensure email is present
      const email = contactFields.email || context.triggerData.userEmail || context.triggerData.email;
      if (!email) {
        return {
          success: false,
          error: 'Email is required to create HubSpot contact'
        };
      }

      contactFields.email = email as string;

      // Set default lead source if not provided
      if (!contactFields.lead_source) {
        contactFields.lead_source = 'chatbot_automation';
      }

      const result = await this.executeWithRetry(async () => {
        if (config.updateExisting) {
          return await client.upsertContact({ properties: contactFields });
        } else {
          return await client.createContact({ properties: contactFields });
        }
      }, config);

      return {
        success: true,
        data: {
          contactId: result.id,
          email: contactFields.email,
          properties: result.properties,
          created: !config.updateExisting,
          hubspotUrl: `https://app.hubspot.com/contacts/contacts/${result.id}`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create HubSpot contact'
      };
    }
  }

  validateConfig(config: HubSpotActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push('HubSpot integration ID is required');
    }

    if (!config.contactFields || Object.keys(config.contactFields).length === 0) {
      warnings.push('No contact fields specified, will use trigger data');
    }

    if (config.contactFields && !config.contactFields.email) {
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
        integrationId: {
          type: 'string',
          title: 'HubSpot Integration',
          description: 'Select the HubSpot integration to use'
        },
        contactFields: {
          type: 'object',
          title: 'Contact Fields',
          description: 'HubSpot contact properties to set (supports template variables)',
          properties: {
            email: { type: 'string', title: 'Email' },
            firstname: { type: 'string', title: 'First Name' },
            lastname: { type: 'string', title: 'Last Name' },
            company: { type: 'string', title: 'Company' },
            phone: { type: 'string', title: 'Phone' },
            website: { type: 'string', title: 'Website' },
            lifecyclestage: { 
              type: 'string', 
              title: 'Lifecycle Stage',
              enum: ['subscriber', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', 'customer', 'evangelist', 'other']
            },
            lead_source: { type: 'string', title: 'Lead Source' }
          }
        },
        updateExisting: {
          type: 'boolean',
          title: 'Update Existing',
          description: 'Update contact if email already exists',
          default: true
        },
        retryOnRateLimit: {
          type: 'boolean',
          title: 'Retry on Rate Limit',
          description: 'Automatically retry when rate limited',
          default: true
        },
        maxRetries: {
          type: 'number',
          title: 'Max Retries',
          description: 'Maximum number of retry attempts',
          default: 3,
          minimum: 1,
          maximum: 10
        }
      },
      required: ['integrationId']
    };
  }
}

/**
 * Create HubSpot Deal Action
 * Creates deals in HubSpot with contact associations
 */
export class CreateHubSpotDealAction extends BaseHubSpotAction {
  type = 'create_hubspot_deal';

  async execute(config: HubSpotActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const client = await this.getHubSpotClient(config, context);
      
      const dealFields = this.processFieldTemplates(
        config.dealFields || {},
        context
      );

      // Set default deal name if not provided
      if (!dealFields.dealname) {
        dealFields.dealname = `Deal from ${context.triggerData.userEmail || 'Chatbot'}`;
      }

      // Set pipeline and stage if provided
      if (config.dealPipeline) {
        dealFields.pipeline = config.dealPipeline;
      }
      if (config.dealStage) {
        dealFields.dealstage = config.dealStage;
      }

      const result = await this.executeWithRetry(async () => {
        return await client.createDeal({ properties: dealFields });
      }, config);

      // Associate with contact if requested and contact info is available
      let contactAssociation = null;
      if (config.associateWithContact && context.triggerData.contactId) {
        try {
          await client.associateDealWithContact(
            result.id!,
            context.triggerData.contactId as string
          );
          contactAssociation = context.triggerData.contactId;
        } catch (error) {
          console.warn('Failed to associate deal with contact:', error);
        }
      }

      return {
        success: true,
        data: {
          dealId: result.id,
          dealName: dealFields.dealname,
          properties: result.properties,
          contactAssociation,
          hubspotUrl: `https://app.hubspot.com/contacts/deals/${result.id}`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create HubSpot deal'
      };
    }
  }

  validateConfig(config: HubSpotActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push('HubSpot integration ID is required');
    }

    if (!config.dealFields || Object.keys(config.dealFields).length === 0) {
      warnings.push('No deal fields specified, will use default values');
    }

    if (config.associateWithContact && !config.dealFields?.contactId) {
      warnings.push('Contact association requested but no contact ID field mapped');
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
      title: 'Create HubSpot Deal',
      description: 'Create a deal in HubSpot CRM',
      properties: {
        integrationId: {
          type: 'string',
          title: 'HubSpot Integration',
          description: 'Select the HubSpot integration to use'
        },
        dealFields: {
          type: 'object',
          title: 'Deal Fields',
          description: 'HubSpot deal properties to set (supports template variables)',
          properties: {
            dealname: { type: 'string', title: 'Deal Name' },
            amount: { type: 'number', title: 'Deal Amount' },
            closedate: { type: 'string', title: 'Close Date (YYYY-MM-DD)' },
            hubspot_owner_id: { type: 'string', title: 'Owner ID' }
          }
        },
        dealPipeline: {
          type: 'string',
          title: 'Pipeline',
          description: 'HubSpot pipeline ID'
        },
        dealStage: {
          type: 'string',
          title: 'Deal Stage',
          description: 'HubSpot deal stage ID'
        },
        associateWithContact: {
          type: 'boolean',
          title: 'Associate with Contact',
          description: 'Associate deal with contact from trigger data',
          default: false
        },
        retryOnRateLimit: {
          type: 'boolean',
          title: 'Retry on Rate Limit',
          default: true
        },
        maxRetries: {
          type: 'number',
          title: 'Max Retries',
          default: 3,
          minimum: 1,
          maximum: 10
        }
      },
      required: ['integrationId']
    };
  }
}

/**
 * Update HubSpot Contact Action
 * Updates existing contact properties in HubSpot
 */
export class UpdateHubSpotContactAction extends BaseHubSpotAction {
  type = 'update_hubspot_contact';

  async execute(config: HubSpotActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const client = await this.getHubSpotClient(config, context);
      
      const contactId = context.triggerData.contactId as string;
      const email = context.triggerData.userEmail || context.triggerData.email;

      if (!contactId && !email) {
        return {
          success: false,
          error: 'Contact ID or email is required to update HubSpot contact'
        };
      }

      const updateFields = this.processFieldTemplates(
        config.contactFields || {},
        context
      );

      if (Object.keys(updateFields).length === 0) {
        return {
          success: false,
          error: 'No fields specified for update'
        };
      }

      const result = await this.executeWithRetry(async () => {
        if (contactId) {
          return await client.updateContact(contactId, updateFields);
        } else {
          // Find contact by email first
          const contact = await client.getContactByEmail(email as string);
          if (!contact) {
            throw new Error(`Contact with email ${email} not found`);
          }
          return await client.updateContact(contact.id!, updateFields);
        }
      }, config);

      return {
        success: true,
        data: {
          contactId: result.id,
          updatedFields: updateFields,
          properties: result.properties,
          hubspotUrl: `https://app.hubspot.com/contacts/contacts/${result.id}`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update HubSpot contact'
      };
    }
  }

  validateConfig(config: HubSpotActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push('HubSpot integration ID is required');
    }

    if (!config.contactFields || Object.keys(config.contactFields).length === 0) {
      errors.push('Contact fields are required for update');
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
      title: 'Update HubSpot Contact',
      description: 'Update an existing contact in HubSpot CRM',
      properties: {
        integrationId: {
          type: 'string',
          title: 'HubSpot Integration',
          description: 'Select the HubSpot integration to use'
        },
        contactFields: {
          type: 'object',
          title: 'Fields to Update',
          description: 'HubSpot contact properties to update (supports template variables)',
          properties: {
            firstname: { type: 'string', title: 'First Name' },
            lastname: { type: 'string', title: 'Last Name' },
            company: { type: 'string', title: 'Company' },
            phone: { type: 'string', title: 'Phone' },
            website: { type: 'string', title: 'Website' },
            lifecyclestage: { 
              type: 'string', 
              title: 'Lifecycle Stage',
              enum: ['subscriber', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', 'customer', 'evangelist', 'other']
            }
          }
        },
        retryOnRateLimit: {
          type: 'boolean',
          title: 'Retry on Rate Limit',
          default: true
        },
        maxRetries: {
          type: 'number',
          title: 'Max Retries',
          default: 3,
          minimum: 1,
          maximum: 10
        }
      },
      required: ['integrationId', 'contactFields']
    };
  }
}

/**
 * Create HubSpot Company Action
 * Creates companies in HubSpot and optionally associates with contacts
 */
export class CreateHubSpotCompanyAction extends BaseHubSpotAction {
  type = 'create_hubspot_company';

  async execute(config: HubSpotActionConfig, context: WorkflowContext): Promise<ActionResult> {
    try {
      const client = await this.getHubSpotClient(config, context);
      
      const companyFields = this.processFieldTemplates(
        config.companyFields || {},
        context
      );

      if (!companyFields.name) {
        return {
          success: false,
          error: 'Company name is required'
        };
      }

      const result = await this.executeWithRetry(async () => {
        return await client.createCompany({ properties: companyFields });
      }, config);

      return {
        success: true,
        data: {
          companyId: result.id,
          companyName: companyFields.name,
          properties: result.properties,
          hubspotUrl: `https://app.hubspot.com/contacts/companies/${result.id}`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create HubSpot company'
      };
    }
  }

  validateConfig(config: HubSpotActionConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.integrationId) {
      errors.push('HubSpot integration ID is required');
    }

    if (!config.companyFields || !config.companyFields.name) {
      errors.push('Company name is required');
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
      title: 'Create HubSpot Company',
      description: 'Create a company in HubSpot CRM',
      properties: {
        integrationId: {
          type: 'string',
          title: 'HubSpot Integration',
          description: 'Select the HubSpot integration to use'
        },
        companyFields: {
          type: 'object',
          title: 'Company Fields',
          description: 'HubSpot company properties to set (supports template variables)',
          properties: {
            name: { type: 'string', title: 'Company Name' },
            domain: { type: 'string', title: 'Domain' },
            industry: { type: 'string', title: 'Industry' },
            phone: { type: 'string', title: 'Phone' },
            city: { type: 'string', title: 'City' },
            state: { type: 'string', title: 'State' },
            country: { type: 'string', title: 'Country' }
          }
        },
        associateCompanyWithContact: {
          type: 'boolean',
          title: 'Associate with Contact',
          description: 'Associate company with contact from trigger data',
          default: false
        },
        retryOnRateLimit: {
          type: 'boolean',
          title: 'Retry on Rate Limit',
          default: true
        },
        maxRetries: {
          type: 'number',
          title: 'Max Retries',
          default: 3,
          minimum: 1,
          maximum: 10
        }
      },
      required: ['integrationId', 'companyFields']
    };
  }
}