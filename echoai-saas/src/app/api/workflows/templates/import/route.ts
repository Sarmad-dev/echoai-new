import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { workflowService } from '@/lib/workflow-service'
import type { WorkflowTemplate } from '@/types/workflow-templates'

/**
 * POST /api/workflows/templates/import
 * 
 * Imports a workflow template from JSON data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { templateData, chatbotId, createWorkflow = false } = body

    if (!templateData) {
      return NextResponse.json(
        { error: 'Template data is required' },
        { status: 400 }
      )
    }

    // Parse template data if it's a string
    let template: WorkflowTemplate
    try {
      template = typeof templateData === 'string' 
        ? JSON.parse(templateData) 
        : templateData
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON format in template data' },
        { status: 400 }
      )
    }

    // Validate template structure
    const validationResult = validateTemplateStructure(template)
    if (!validationResult.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid template structure',
          details: validationResult.errors
        },
        { status: 400 }
      )
    }

    // If createWorkflow is true, create a workflow from the imported template
    let createdWorkflow = null
    if (createWorkflow && chatbotId) {
      try {
        const workflowRequest = {
          name: `${template.name} (imported)`,
          description: `Imported template: ${template.description}`,
          flowDefinition: template.flowDefinition,
          userId: session.user.id,
          chatbotId,
          isActive: true
        }

        const result = await workflowService.createWorkflow(workflowRequest)
        createdWorkflow = result.workflow
      } catch (error) {
        console.error('Error creating workflow from imported template:', error)
        // Continue with import even if workflow creation fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        template: {
          ...template,
          source: 'imported' as const,
          importedAt: new Date().toISOString(),
          importedBy: session.user.id
        },
        validation: validationResult,
        createdWorkflow
      }
    })
  } catch (error) {
    console.error('Error importing workflow template:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to import workflow template' 
      },
      { status: 500 }
    )
  }
}

/**
 * Validates the structure of an imported template
 */
function validateTemplateStructure(template: any): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!template.id || typeof template.id !== 'string') {
    errors.push('Template must have a valid id')
  }

  if (!template.name || typeof template.name !== 'string') {
    errors.push('Template must have a valid name')
  }

  if (!template.description || typeof template.description !== 'string') {
    errors.push('Template must have a valid description')
  }

  if (!template.category || typeof template.category !== 'string') {
    errors.push('Template must have a valid category')
  }

  if (!template.flowDefinition || typeof template.flowDefinition !== 'object') {
    errors.push('Template must have a valid flowDefinition')
  } else {
    // Validate flow definition structure
    if (!Array.isArray(template.flowDefinition.nodes)) {
      errors.push('flowDefinition must have a nodes array')
    } else if (template.flowDefinition.nodes.length === 0) {
      warnings.push('Template has no nodes defined')
    }

    if (!Array.isArray(template.flowDefinition.edges)) {
      errors.push('flowDefinition must have an edges array')
    }

    // Validate nodes structure
    if (Array.isArray(template.flowDefinition.nodes)) {
      template.flowDefinition.nodes.forEach((node: any, index: number) => {
        if (!node.id || typeof node.id !== 'string') {
          errors.push(`Node at index ${index} must have a valid id`)
        }

        if (!node.type || !['trigger', 'action', 'condition'].includes(node.type)) {
          errors.push(`Node at index ${index} must have a valid type (trigger, action, or condition)`)
        }

        if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
          errors.push(`Node at index ${index} must have valid position coordinates`)
        }

        if (!node.data || typeof node.data !== 'object') {
          errors.push(`Node at index ${index} must have valid data object`)
        }
      })
    }

    // Validate edges structure
    if (Array.isArray(template.flowDefinition.edges)) {
      template.flowDefinition.edges.forEach((edge: any, index: number) => {
        if (!edge.id || typeof edge.id !== 'string') {
          errors.push(`Edge at index ${index} must have a valid id`)
        }

        if (!edge.source || typeof edge.source !== 'string') {
          errors.push(`Edge at index ${index} must have a valid source`)
        }

        if (!edge.target || typeof edge.target !== 'string') {
          errors.push(`Edge at index ${index} must have a valid target`)
        }
      })
    }
  }

  // Optional fields validation
  if (template.complexity && !['Simple', 'Intermediate', 'Advanced'].includes(template.complexity)) {
    warnings.push('Invalid complexity level, should be Simple, Intermediate, or Advanced')
  }

  if (template.tags && !Array.isArray(template.tags)) {
    warnings.push('Tags should be an array of strings')
  }

  if (template.customizationOptions && typeof template.customizationOptions !== 'object') {
    warnings.push('customizationOptions should be an object')
  }

  // Check for potential security issues
  if (template.flowDefinition && Array.isArray(template.flowDefinition.nodes)) {
    template.flowDefinition.nodes.forEach((node: any) => {
      if (node.data && node.data.config) {
        // Check for potentially sensitive data in configs
        const config = node.data.config
        if (typeof config === 'object') {
          Object.keys(config).forEach(key => {
            if (key.toLowerCase().includes('password') || 
                key.toLowerCase().includes('secret') || 
                key.toLowerCase().includes('token')) {
              warnings.push(`Node ${node.id} contains potentially sensitive configuration: ${key}`)
            }
          })
        }
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}