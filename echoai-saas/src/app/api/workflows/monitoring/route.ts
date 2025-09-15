/**
 * Workflow Monitoring API
 * 
 * Provides endpoints for accessing workflow performance metrics,
 * analytics, and system health information.
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/workflow/performance-monitor';
import { defaultRateLimiters } from '@/lib/workflow/rate-limiter';

// GET /api/workflows/monitoring - Get monitoring dashboard data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const workflowId = searchParams.get('workflowId');
    const chatbotId = searchParams.get('chatbotId');
    const limit = parseInt(searchParams.get('limit') || '100');

    switch (type) {
      case 'overview':
        return NextResponse.json({
          success: true,
          data: {
            systemMetrics: performanceMonitor.getSystemMetrics(),
            activeAlerts: performanceMonitor.getActiveAlerts(),
            rateLimitUsage: defaultRateLimiters.perUser.getAllEntries(),
            insights: performanceMonitor.getPerformanceInsights()
          }
        });

      case 'workflow':
        if (!workflowId) {
          return NextResponse.json(
            { success: false, error: 'Workflow ID is required for workflow metrics' },
            { status: 400 }
          );
        }

        const workflowAnalytics = performanceMonitor.getWorkflowAnalytics(workflowId);
        const workflowHistory = performanceMonitor.getPerformanceHistory(workflowId, undefined, limit);
        const workflowInsights = performanceMonitor.getPerformanceInsights(workflowId);

        return NextResponse.json({
          success: true,
          data: {
            analytics: workflowAnalytics,
            history: workflowHistory,
            insights: workflowInsights
          }
        });

      case 'chatbot':
        if (!chatbotId) {
          return NextResponse.json(
            { success: false, error: 'Chatbot ID is required for chatbot metrics' },
            { status: 400 }
          );
        }

        const chatbotHistory = performanceMonitor.getPerformanceHistory(undefined, chatbotId, limit);
        
        return NextResponse.json({
          success: true,
          data: {
            history: chatbotHistory,
            rateLimitUsage: defaultRateLimiters.perChatbot.getCurrentUsage('system', chatbotId)
          }
        });

      case 'alerts':
        return NextResponse.json({
          success: true,
          data: {
            activeAlerts: performanceMonitor.getActiveAlerts(),
            alertRules: [] // Would need to expose alert rules from monitor
          }
        });

      case 'export':
        const format = searchParams.get('format') as 'json' | 'csv' || 'json';
        const exportData = performanceMonitor.exportMetrics(format);
        
        const contentType = format === 'csv' 
          ? 'text/csv' 
          : 'application/json';
        
        const filename = `workflow-metrics-${new Date().toISOString().split('T')[0]}.${format}`;
        
        return new NextResponse(exportData, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown monitoring type: ${type}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in monitoring API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/workflows/monitoring - Create alert rules or update configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create_alert':
        const alertId = performanceMonitor.createAlertRule(data);
        return NextResponse.json({
          success: true,
          data: { alertId }
        });

      case 'update_alert':
        const { id, ...updates } = data;
        const updated = performanceMonitor.updateAlertRule(id, updates);
        
        if (!updated) {
          return NextResponse.json(
            { success: false, error: 'Alert rule not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Alert rule updated successfully'
        });

      case 'delete_alert':
        const deleted = performanceMonitor.deleteAlertRule(data.id);
        
        if (!deleted) {
          return NextResponse.json(
            { success: false, error: 'Alert rule not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Alert rule deleted successfully'
        });

      case 'update_rate_limits':
        const { tier, config } = data;
        
        if (tier && config) {
          defaultRateLimiters.tiered.updateTierConfig(tier, config);
          return NextResponse.json({
            success: true,
            message: 'Rate limit configuration updated'
          });
        }

        return NextResponse.json(
          { success: false, error: 'Tier and config are required' },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in monitoring API POST:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process monitoring request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/workflows/monitoring - Reset metrics or clear alerts
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const chatbotId = searchParams.get('chatbotId');

    switch (action) {
      case 'reset_rate_limits':
        if (userId) {
          defaultRateLimiters.perUser.reset(userId, chatbotId || undefined);
          return NextResponse.json({
            success: true,
            message: 'Rate limits reset successfully'
          });
        }

        return NextResponse.json(
          { success: false, error: 'User ID is required' },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in monitoring API DELETE:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process monitoring delete request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}