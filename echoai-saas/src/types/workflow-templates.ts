import type { WorkflowNode, WorkflowEdge } from './database'

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: string
  complexity: 'Simple' | 'Intermediate' | 'Advanced'
  estimatedSetupTime: string
  usageCount?: number
  rating?: number
  tags: string[]
  triggerType: string
  actionTypes: string[]
  flowDefinition: {
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
  }
  customizationOptions?: {
    [key: string]: {
      type: 'text' | 'number' | 'select' | 'boolean'
      label: string
      description?: string
      options?: string[]
      defaultValue?: any
    }
  }
  // Metadata for imported/exported templates
  exportedAt?: string
  version?: string
  author?: string
  source?: 'built-in' | 'imported' | 'custom'
}

export interface TemplateCustomization {
  [key: string]: any
}

export interface CreateWorkflowFromTemplateRequest {
  templateId: string
  chatbotId: string
  workflowName?: string
  customizations?: TemplateCustomization
}

export interface CreateWorkflowFromTemplateResponse {
  workflow: {
    id: string
    name: string
    description?: string
    isActive: boolean
    createdAt: Date
  }
  validation: {
    isValid: boolean
    errors: Array<{ message: string; nodeId?: string }>
    warnings: Array<{ message: string; nodeId?: string }>
  }
  templateUsed: {
    id: string
    name: string
    customizations: TemplateCustomization
  }
}

export interface TemplateListResponse {
  templates: WorkflowTemplate[]
  categories: string[]
  complexities: string[]
  totalCount: number
}

export interface TemplateFilters {
  category?: string
  complexity?: string
  tags?: string[]
  search?: string
}

export interface TemplateMarketplace {
  featured: WorkflowTemplate[]
  popular: WorkflowTemplate[]
  recent: WorkflowTemplate[]
  categories: {
    [category: string]: WorkflowTemplate[]
  }
}

export interface TemplateUsageStats {
  templateId: string
  usageCount: number
  averageRating: number
  lastUsed: Date
  successRate: number
}

export interface TemplateValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  compatibility: {
    requiredIntegrations: string[]
    optionalIntegrations: string[]
    supportedTriggers: string[]
    supportedActions: string[]
  }
}

// Template categories
export const TEMPLATE_CATEGORIES = [
  'Customer Service',
  'Sales',
  'Marketing',
  'Operations',
  'Support',
  'Analytics',
  'Integration',
  'Automation'
] as const

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number]

// Template complexity levels
export const TEMPLATE_COMPLEXITIES = [
  'Simple',
  'Intermediate', 
  'Advanced'
] as const

export type TemplateComplexity = typeof TEMPLATE_COMPLEXITIES[number]

// Common template tags
export const COMMON_TEMPLATE_TAGS = [
  'automation',
  'customer-service',
  'sales',
  'crm',
  'slack',
  'hubspot',
  'sentiment',
  'escalation',
  'returns',
  'leads',
  'notifications',
  'tracking',
  'analytics',
  'image-analysis',
  'inventory',
  'support',
  'welcome',
  'onboarding'
] as const

export type TemplateTag = typeof COMMON_TEMPLATE_TAGS[number]