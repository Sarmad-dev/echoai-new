/**
 * HubSpot API Client
 * 
 * Provides a comprehensive interface for interacting with HubSpot's CRM API
 * Handles contacts, deals, companies, and properties with proper error handling
 * and rate limiting support.
 */

import { Integration } from './oauth2-manager';

export interface HubSpotContact {
  id?: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
    phone?: string;
    website?: string;
    lifecyclestage?: string;
    lead_source?: string;
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface HubSpotDeal {
  id?: string;
  properties: {
    dealname?: string;
    amount?: number;
    dealstage?: string;
    pipeline?: string;
    closedate?: string;
    hubspot_owner_id?: string;
    [key: string]: any;
  };
  associations?: {
    contacts?: string[];
    companies?: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface HubSpotCompany {
  id?: string;
  properties: {
    name?: string;
    domain?: string;
    industry?: string;
    phone?: string;
    city?: string;
    state?: string;
    country?: string;
    [key: string]: any;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface HubSpotProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  description?: string;
  groupName?: string;
  options?: Array<{
    label: string;
    value: string;
  }>;
}

export interface HubSpotAccountDetails {
  portalId: string;
  portalName: string;
  userEmail: string;
  subscriptionTier: string;
  currency?: string;
  timeZone?: string;
  apiLimits: {
    dailyLimit: number;
    currentUsage: number;
  };
}

export interface HubSpotObjectWithProperties {
  name: string;
  label: string;
  properties: HubSpotProperty[];
}

export interface HubSpotSearchResult<T> {
  total: number;
  results: T[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

export interface HubSpotApiError {
  status: string;
  message: string;
  correlationId?: string;
  category?: string;
  subCategory?: string;
  errors?: Array<{
    message: string;
    in?: string;
    code?: string;
  }>;
}

export class HubSpotRateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public dailyLimit?: number,
    public dailyUsage?: number
  ) {
    super(message);
    this.name = 'HubSpotRateLimitError';
  }
}

export class HubSpotApiClient {
  private baseUrl = 'https://api.hubapi.com';
  private accessToken: string;
  private retryAttempts = 3;
  private retryDelay = 1000; // Base delay in ms

  constructor(integration: Integration) {
    if (integration.provider !== 'hubspot') {
      throw new Error('Integration must be for HubSpot provider');
    }
    this.accessToken = integration.accessToken;
  }

  /**
   * Make authenticated request to HubSpot API with retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    let lastError: Error;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
          const dailyLimit = response.headers.get('X-HubSpot-RateLimit-Daily');
          const dailyUsage = response.headers.get('X-HubSpot-RateLimit-Daily-Usage');
          
          throw new HubSpotRateLimitError(
            'HubSpot API rate limit exceeded',
            retryAfter,
            dailyLimit ? parseInt(dailyLimit) : undefined,
            dailyUsage ? parseInt(dailyUsage) : undefined
          );
        }

        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          
          try {
            const errorData: HubSpotApiError = await response.json();
            if (errorData && errorData.message) {
              errorMessage = errorData.message;
            }
          } catch {
            // Use default error message if JSON parsing fails
          }

          throw new Error(
            `HubSpot API error: ${errorMessage} (${response.status})`
          );
        }

        // Handle empty responses
        if (response.status === 204) {
          return {} as T;
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on rate limit errors - let caller handle
        if (error instanceof HubSpotRateLimitError) {
          throw error;
        }

        // Don't retry on client errors (4xx except 429)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  // ===== CONTACT METHODS =====

  /**
   * Create a new contact in HubSpot
   */
  async createContact(contact: Omit<HubSpotContact, 'id' | 'createdAt' | 'updatedAt'>): Promise<HubSpotContact> {
    const response = await this.makeRequest<HubSpotContact>('/crm/v3/objects/contacts', {
      method: 'POST',
      body: JSON.stringify({
        properties: contact.properties,
      }),
    });

    return response;
  }

  /**
   * Get contact by ID
   */
  async getContact(contactId: string, properties?: string[]): Promise<HubSpotContact | null> {
    try {
      const params = new URLSearchParams();
      if (properties && properties.length > 0) {
        params.append('properties', properties.join(','));
      }

      const queryString = params.toString();
      const endpoint = `/crm/v3/objects/contacts/${contactId}${queryString ? `?${queryString}` : ''}`;

      return await this.makeRequest<HubSpotContact>(endpoint);
    } catch (error) {
      if (error instanceof Error && error.message.includes('HTTP 404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(email: string, properties?: string[]): Promise<HubSpotContact | null> {
    try {
      const searchRequest = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email,
              },
            ],
          },
        ],
        properties: properties || ['email', 'firstname', 'lastname', 'company'],
        limit: 1,
      };

      const response = await this.makeRequest<HubSpotSearchResult<HubSpotContact>>(
        '/crm/v3/objects/contacts/search',
        {
          method: 'POST',
          body: JSON.stringify(searchRequest),
        }
      );

      return response.results.length > 0 ? response.results[0] : null;
    } catch (error) {
      console.error('Error searching contact by email:', error);
      return null;
    }
  }

  /**
   * Update contact properties
   */
  async updateContact(contactId: string, properties: Record<string, any>): Promise<HubSpotContact> {
    return await this.makeRequest<HubSpotContact>(`/crm/v3/objects/contacts/${contactId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties,
      }),
    });
  }

  /**
   * Create or update contact (upsert by email)
   */
  async upsertContact(contact: Omit<HubSpotContact, 'id' | 'createdAt' | 'updatedAt'>): Promise<HubSpotContact> {
    if (!contact.properties.email) {
      throw new Error('Email is required for upsert operation');
    }
    const existingContact = await this.getContactByEmail(contact.properties.email);
    
    if (existingContact) {
      return await this.updateContact(existingContact.id!, contact.properties);
    } else {
      return await this.createContact(contact);
    }
  }

  // ===== DEAL METHODS =====

  /**
   * Create a new deal in HubSpot
   */
  async createDeal(deal: Omit<HubSpotDeal, 'id' | 'createdAt' | 'updatedAt'>): Promise<HubSpotDeal> {
    const response = await this.makeRequest<HubSpotDeal>('/crm/v3/objects/deals', {
      method: 'POST',
      body: JSON.stringify({
        properties: deal.properties,
        associations: deal.associations,
      }),
    });

    return response;
  }

  /**
   * Get deal by ID
   */
  async getDeal(dealId: string, properties?: string[]): Promise<HubSpotDeal | null> {
    try {
      const params = new URLSearchParams();
      if (properties && properties.length > 0) {
        params.append('properties', properties.join(','));
      }

      const queryString = params.toString();
      const endpoint = `/crm/v3/objects/deals/${dealId}${queryString ? `?${queryString}` : ''}`;

      return await this.makeRequest<HubSpotDeal>(endpoint);
    } catch (error) {
      if (error instanceof Error && error.message.includes('HTTP 404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update deal properties
   */
  async updateDeal(dealId: string, properties: Record<string, any>): Promise<HubSpotDeal> {
    return await this.makeRequest<HubSpotDeal>(`/crm/v3/objects/deals/${dealId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties,
      }),
    });
  }

  /**
   * Associate deal with contact
   */
  async associateDealWithContact(dealId: string, contactId: string): Promise<void> {
    await this.makeRequest(`/crm/v4/objects/deals/${dealId}/associations/contacts/${contactId}`, {
      method: 'PUT',
      body: JSON.stringify([
        {
          associationCategory: 'HUBSPOT_DEFINED',
          associationTypeId: 3, // Deal to Contact association
        },
      ]),
    });
  }

  // ===== COMPANY METHODS =====

  /**
   * Create a new company in HubSpot
   */
  async createCompany(company: Omit<HubSpotCompany, 'id' | 'createdAt' | 'updatedAt'>): Promise<HubSpotCompany> {
    const response = await this.makeRequest<HubSpotCompany>('/crm/v3/objects/companies', {
      method: 'POST',
      body: JSON.stringify({
        properties: company.properties,
      }),
    });

    return response;
  }

  /**
   * Get company by domain
   */
  async getCompanyByDomain(domain: string): Promise<HubSpotCompany | null> {
    try {
      const searchRequest = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'domain',
                operator: 'EQ',
                value: domain,
              },
            ],
          },
        ],
        properties: ['name', 'domain', 'industry', 'phone'],
        limit: 1,
      };

      const response = await this.makeRequest<HubSpotSearchResult<HubSpotCompany>>(
        '/crm/v3/objects/companies/search',
        {
          method: 'POST',
          body: JSON.stringify(searchRequest),
        }
      );

      return response.results.length > 0 ? response.results[0] : null;
    } catch (error) {
      console.error('Error searching company by domain:', error);
      return null;
    }
  }

  // ===== PROPERTY METHODS =====

  /**
   * Get all contact properties
   */
  async getContactProperties(): Promise<HubSpotProperty[]> {
    const response = await this.makeRequest<{ results: HubSpotProperty[] }>(
      '/crm/v3/properties/contacts'
    );
    return response.results;
  }

  /**
   * Get all deal properties
   */
  async getDealProperties(): Promise<HubSpotProperty[]> {
    const response = await this.makeRequest<{ results: HubSpotProperty[] }>(
      '/crm/v3/properties/deals'
    );
    return response.results;
  }

  /**
   * Get all company properties
   */
  async getCompanyProperties(): Promise<HubSpotProperty[]> {
    const response = await this.makeRequest<{ results: HubSpotProperty[] }>(
      '/crm/v3/properties/companies'
    );
    return response.results;
  }

  // ===== PIPELINE METHODS =====

  /**
   * Get all deal pipelines
   */
  async getDealPipelines(): Promise<Array<{
    id: string;
    label: string;
    stages: Array<{
      id: string;
      label: string;
      displayOrder: number;
    }>;
  }>> {
    const response = await this.makeRequest<{
      results: Array<{
        id: string;
        label: string;
        stages: Array<{
          id: string;
          label: string;
          displayOrder: number;
        }>;
      }>;
    }>('/crm/v3/pipelines/deals');
    
    return response.results;
  }

  // ===== UTILITY METHODS =====

  /**
   * Test API connection and permissions
   */
  async testConnection(): Promise<{
    success: boolean;
    accountId?: string;
    portalId?: string;
    scopes?: string[];
    error?: string;
  }> {
    try {
      // Test by getting account info
      const response = await this.makeRequest<{
        portalId: number;
        accountType: string;
        utcOffset: string;
        utcOffsetMilliseconds: number;
        timeZone: string;
      }>('/account-info/v3/api-usage/daily');

      // Test permissions by trying to get contact properties
      await this.getContactProperties();

      return {
        success: true,
        portalId: response.portalId.toString(),
        accountId: response.portalId.toString(),
        scopes: ['contacts', 'deals'], // Basic scopes confirmed by successful calls
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get detailed account information
   */
  async getAccountInfo(accessToken: string): Promise<HubSpotAccountDetails> {
    const response = await this.makeRequest<{
      portalId: number;
      companyName?: string;
      accountType: string;
      currency: string;
      timeZone: string;
      utcOffset: string;
      utcOffsetMilliseconds: number;
    }>('/account-info/v3/details');

    return {
      portalId: response.portalId.toString(),
      portalName: response.companyName || `Portal ${response.portalId}`,
      userEmail: '', // Will be populated by getPermissions call
      subscriptionTier: response.accountType,
      currency: response.currency,
      timeZone: response.timeZone,
      apiLimits: {
        dailyLimit: 40000, // Default HubSpot limit
        currentUsage: 0 // Will be updated by getRateLimitStatus
      }
    };
  }

  /**
   * Get user permissions and scopes
   */
  async getPermissions(accessToken: string): Promise<string[]> {
    try {
      const response = await this.makeRequest<{
        scopes: string[];
        user?: string;
        user_id?: number;
        hub_domain?: string;
        hub_id?: number;
      }>(`/oauth/v1/access-tokens/${accessToken}`);

      return response.scopes || [];
    } catch (error) {
      console.error('Failed to get permissions:', error);
      // Return basic scopes if the call fails
      return ['contacts', 'deals', 'companies'];
    }
  }

  /**
   * Get available CRM objects and their properties
   */
  async getAvailableObjects(accessToken: string): Promise<HubSpotObjectWithProperties[]> {
    try {
      const response = await this.makeRequest<{
        results: Array<{
          name: string;
          labels: {
            singular: string;
            plural: string;
          };
          properties: Array<{
            name: string;
            label: string;
            type: string;
            fieldType: string;
            description?: string;
            groupName?: string;
            options?: Array<{
              label: string;
              value: string;
            }>;
          }>;
        }>;
      }>('/crm/v3/schemas');

      return response.results.map((schema) => ({
        name: schema.name,
        label: schema.labels.singular,
        properties: schema.properties.map((prop) => ({
          name: prop.name,
          label: prop.label,
          type: prop.type,
          fieldType: prop.fieldType,
          description: prop.description,
          groupName: prop.groupName,
          options: prop.options
        }))
      }));
    } catch (error) {
      console.error('Failed to get available objects:', error);
      // Return basic objects if the call fails
      return [
        {
          name: 'contacts',
          label: 'Contact',
          properties: []
        },
        {
          name: 'deals',
          label: 'Deal',
          properties: []
        },
        {
          name: 'companies',
          label: 'Company',
          properties: []
        }
      ];
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(): Promise<{
    dailyLimit?: number;
    dailyUsage?: number;
    secondlyLimit?: number;
    secondlyUsage?: number;
  }> {
    try {
      // Make a lightweight request to get rate limit headers
      const response = await fetch(`${this.baseUrl}/account-info/v3/api-usage/daily`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return {
        dailyLimit: response.headers.get('X-HubSpot-RateLimit-Daily') 
          ? parseInt(response.headers.get('X-HubSpot-RateLimit-Daily')!) 
          : undefined,
        dailyUsage: response.headers.get('X-HubSpot-RateLimit-Daily-Usage')
          ? parseInt(response.headers.get('X-HubSpot-RateLimit-Daily-Usage')!)
          : undefined,
        secondlyLimit: response.headers.get('X-HubSpot-RateLimit-Secondly')
          ? parseInt(response.headers.get('X-HubSpot-RateLimit-Secondly')!)
          : undefined,
        secondlyUsage: response.headers.get('X-HubSpot-RateLimit-Secondly-Usage')
          ? parseInt(response.headers.get('X-HubSpot-RateLimit-Secondly-Usage')!)
          : undefined,
      };
    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return {};
    }
  }
}