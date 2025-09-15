"use client";

/**
 * Escalation Trigger Configuration Interface
 * 
 * Provides UI for configuring escalation triggers including sentiment thresholds,
 * keywords, and automation rules.
 * 
 * Requirements: 6.1, 6.2
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Plus, Settings, Trash2, Save, Eye, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

interface EscalationTriggerConfig {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  triggerType: 'sentiment' | 'keywords' | 'duration' | 'custom';
  conditions: {
    sentimentThreshold?: number;
    keywords?: string[];
    durationMinutes?: number;
    customCondition?: string;
  };
  actions: {
    changeStatus: boolean;
    assignToAgent?: string;
    addNote?: string;
    notifyTeam?: boolean;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}

interface EscalationAnalytics {
  totalEscalations: number;
  escalationsByTrigger: Record<string, number>;
  escalationsByPriority: Record<string, number>;
  averageResponseTime: number;
  resolutionRate: number;
}

export default function EscalationConfigurationPanel() {
  const [configs, setConfigs] = useState<EscalationTriggerConfig[]>([]);
  const [analytics, setAnalytics] = useState<EscalationAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingConfig, setEditingConfig] = useState<EscalationTriggerConfig | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Load configurations and analytics on component mount
  useEffect(() => {
    loadConfigurations();
    loadAnalytics();
  }, []);

  const loadConfigurations = async () => {
    try {
      setIsLoading(true);
      // In a real implementation, this would fetch from API
      const mockConfigs: EscalationTriggerConfig[] = [
        {
          id: 'sentiment-negative',
          name: 'Negative Sentiment Detection',
          description: 'Escalate conversations with negative sentiment below -0.3',
          isActive: true,
          triggerType: 'sentiment',
          conditions: {
            sentimentThreshold: -0.3
          },
          actions: {
            changeStatus: true,
            addNote: 'Conversation escalated due to negative sentiment ({{sentimentScore}}) detected at {{timestamp}}. Reason: {{triggerReason}}'
          },
          priority: 'high',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'sentiment-critical',
          name: 'Critical Negative Sentiment',
          description: 'Escalate conversations with very negative sentiment below -0.7',
          isActive: true,
          triggerType: 'sentiment',
          conditions: {
            sentimentThreshold: -0.7
          },
          actions: {
            changeStatus: true,
            addNote: 'URGENT: Conversation escalated due to critical negative sentiment ({{sentimentScore}}). Immediate attention required.',
            notifyTeam: true
          },
          priority: 'critical',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'keywords-complaint',
          name: 'Complaint Keywords',
          description: 'Escalate when complaint-related keywords are detected',
          isActive: false,
          triggerType: 'keywords',
          conditions: {
            keywords: ['complaint', 'angry', 'frustrated', 'terrible', 'awful', 'hate']
          },
          actions: {
            changeStatus: true,
            addNote: 'Conversation escalated due to complaint keywords detected.'
          },
          priority: 'medium',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      setConfigs(mockConfigs);
    } catch (error) {
      toast.error('Failed to load escalation configurations');
      console.error('Error loading configurations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      // In a real implementation, this would fetch from API
      const mockAnalytics: EscalationAnalytics = {
        totalEscalations: 42,
        escalationsByTrigger: {
          sentiment: 35,
          keywords: 5,
          duration: 2
        },
        escalationsByPriority: {
          low: 8,
          medium: 20,
          high: 12,
          critical: 2
        },
        averageResponseTime: 15.5,
        resolutionRate: 0.85
      };
      setAnalytics(mockAnalytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleToggleConfig = async (configId: string, isActive: boolean) => {
    try {
      // In a real implementation, this would call API
      setConfigs(prev => prev.map(config => 
        config.id === configId ? { ...config, isActive } : config
      ));
      toast.success(`Configuration ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      toast.error('Failed to update configuration');
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    try {
      // In a real implementation, this would call API
      setConfigs(prev => prev.filter(config => config.id !== configId));
      toast.success('Configuration deleted');
    } catch (error) {
      toast.error('Failed to delete configuration');
    }
  };

  const handleSaveConfig = async (config: EscalationTriggerConfig) => {
    try {
      if (editingConfig) {
        // Update existing
        setConfigs(prev => prev.map(c => c.id === config.id ? config : c));
        toast.success('Configuration updated');
      } else {
        // Create new
        const newConfig = {
          ...config,
          id: `config_${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setConfigs(prev => [...prev, newConfig]);
        toast.success('Configuration created');
      }
      setEditingConfig(null);
      setIsCreating(false);
    } catch (error) {
      toast.error('Failed to save configuration');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sentiment': return <TrendingDown className="h-4 w-4" />;
      case 'keywords': return <Settings className="h-4 w-4" />;
      case 'duration': return <AlertTriangle className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading escalation configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Escalation Configuration</h2>
          <p className="text-gray-600">Configure automatic escalation triggers for conversations</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Trigger
        </Button>
      </div>

      <Tabs defaultValue="configurations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configurations">Configurations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-4">
          {configs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No escalation triggers configured</h3>
                <p className="text-gray-600 text-center mb-4">
                  Create your first escalation trigger to automatically escalate conversations based on sentiment, keywords, or other conditions.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Trigger
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {configs.map((config) => (
                <Card key={config.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(config.triggerType)}
                        <div>
                          <CardTitle className="text-lg">{config.name}</CardTitle>
                          <CardDescription>{config.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(config.priority)}>
                          {config.priority}
                        </Badge>
                        <Switch
                          checked={config.isActive}
                          onCheckedChange={(checked) => handleToggleConfig(config.id, checked)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-4">
                          <span>Type: <strong>{config.triggerType}</strong></span>
                          {config.triggerType === 'sentiment' && config.conditions.sentimentThreshold && (
                            <span>Threshold: <strong>{config.conditions.sentimentThreshold}</strong></span>
                          )}
                          {config.triggerType === 'keywords' && config.conditions.keywords && (
                            <span>Keywords: <strong>{config.conditions.keywords.length}</strong></span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingConfig(config)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteConfig(config.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Escalations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalEscalations}</div>
                  <p className="text-xs text-gray-600">This week</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Avg Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.averageResponseTime}m</div>
                  <p className="text-xs text-gray-600">Minutes to first response</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Resolution Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Math.round(analytics.resolutionRate * 100)}%</div>
                  <p className="text-xs text-gray-600">Escalations resolved</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Top Trigger</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">Sentiment</div>
                  <p className="text-xs text-gray-600">{analytics.escalationsByTrigger.sentiment} escalations</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Configuration Editor Modal would go here */}
      {(editingConfig || isCreating) && (
        <ConfigurationEditor
          config={editingConfig}
          onSave={handleSaveConfig}
          onCancel={() => {
            setEditingConfig(null);
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}

// Configuration Editor Component
interface ConfigurationEditorProps {
  config: EscalationTriggerConfig | null;
  onSave: (config: EscalationTriggerConfig) => void;
  onCancel: () => void;
}

function ConfigurationEditor({ config, onSave, onCancel }: ConfigurationEditorProps) {
  const [formData, setFormData] = useState<Partial<EscalationTriggerConfig>>(
    config || {
      name: '',
      description: '',
      isActive: true,
      triggerType: 'sentiment',
      conditions: {},
      actions: {
        changeStatus: true
      },
      priority: 'medium'
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.triggerType) {
      onSave(formData as EscalationTriggerConfig);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{config ? 'Edit' : 'Create'} Escalation Trigger</CardTitle>
          <CardDescription>
            Configure when and how conversations should be escalated to human agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Negative Sentiment Detection"
                  required
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority || 'medium'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe when this trigger should activate"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="triggerType">Trigger Type</Label>
              <Select
                value={formData.triggerType || 'sentiment'}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  triggerType: value as any,
                  conditions: {} // Reset conditions when type changes
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sentiment">Sentiment Analysis</SelectItem>
                  <SelectItem value="keywords">Keywords</SelectItem>
                  <SelectItem value="duration">Duration</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional fields based on trigger type */}
            {formData.triggerType === 'sentiment' && (
              <div>
                <Label htmlFor="sentimentThreshold">Sentiment Threshold</Label>
                <Input
                  id="sentimentThreshold"
                  type="number"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={formData.conditions?.sentimentThreshold || -0.3}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    conditions: {
                      ...prev.conditions,
                      sentimentThreshold: parseFloat(e.target.value)
                    }
                  }))}
                  placeholder="-0.3"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Escalate when sentiment score is below this value (-1.0 to 1.0)
                </p>
              </div>
            )}

            {formData.triggerType === 'keywords' && (
              <div>
                <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                <Textarea
                  id="keywords"
                  value={formData.conditions?.keywords?.join(', ') || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    conditions: {
                      ...prev.conditions,
                      keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                    }
                  }))}
                  placeholder="complaint, angry, frustrated, terrible"
                  rows={2}
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive || false}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
  