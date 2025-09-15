'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'

import { 
  FlaskConical, 
  Play, 
  Pause, 
  Target, 
  CheckCircle, 
  XCircle,
  Settings,
  Plus,
  BarChart3,
  Trophy
} from 'lucide-react'
import type { AutomationWorkflow } from '@/types/database'

interface ABTest {
  id: string
  name: string
  description: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
  variants: ABTestVariant[]
  trafficSplit: Record<string, number> // variant id -> percentage
  metrics: ABTestMetric[]
  startDate?: Date
  endDate?: Date
  duration?: number // days
  minSampleSize: number
  confidenceLevel: number
  hypothesis: string
  successCriteria: string
  createdAt: Date
  updatedAt: Date
}

interface ABTestVariant {
  id: string
  name: string
  description: string
  workflow: AutomationWorkflow
  isControl: boolean
  trafficPercentage: number
  color: string
}

interface ABTestMetric {
  id: string
  name: string
  type: 'conversion_rate' | 'execution_time' | 'success_rate' | 'cost_per_execution' | 'custom'
  description: string
  isPrimary: boolean
  targetValue?: number
  targetDirection: 'increase' | 'decrease'
  customExpression?: string // For custom metrics
}

interface ABTestResults {
  testId: string
  variant: string
  metrics: {
    [metricId: string]: {
      value: number
      sampleSize: number
      confidenceInterval: [number, number]
      pValue: number
      isSignificant: boolean
    }
  }
  overallWinner?: string
  recommendation: string
  statisticalPower: number
}

interface ABTestingFrameworkProps {
  workflowId?: string
  onCreateTest?: (test: Partial<ABTest>) => void
  onUpdateTest?: (testId: string, updates: Partial<ABTest>) => void
}

const VARIANT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#f97316', // orange
]

const METRIC_TYPES = [
  { value: 'conversion_rate', label: 'Conversion Rate', description: 'Percentage of successful outcomes' },
  { value: 'execution_time', label: 'Execution Time', description: 'Average time to complete workflow' },
  { value: 'success_rate', label: 'Success Rate', description: 'Percentage of successful executions' },
  { value: 'cost_per_execution', label: 'Cost per Execution', description: 'Average cost per workflow execution' },
  { value: 'custom', label: 'Custom Metric', description: 'Define your own metric calculation' }
]

export function ABTestingFramework({ 
  workflowId, 
  onCreateTest, 
  onUpdateTest 
}: ABTestingFrameworkProps) {
  const [tests, setTests] = useState<ABTest[]>([])
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null)
  const [testResults, setTestResults] = useState<Record<string, ABTestResults>>({})
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loading, setLoading] = useState(true)

  // New test form state
  const [newTest, setNewTest] = useState<Partial<ABTest>>({
    name: '',
    description: '',
    hypothesis: '',
    successCriteria: '',
    duration: 14,
    minSampleSize: 1000,
    confidenceLevel: 95,
    variants: [],
    metrics: [],
    trafficSplit: {}
  })

  useEffect(() => {
    loadABTests()
  }, [workflowId])

  const loadABTests = async () => {
    setLoading(true)
    try {
      // Mock data - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockTests: ABTest[] = [
        {
          id: 'test-1',
          name: 'Return Approval Optimization',
          description: 'Testing different confidence thresholds for auto-approval',
          status: 'running',
          variants: [
            {
              id: 'control',
              name: 'Control (80% confidence)',
              description: 'Current workflow with 80% confidence threshold',
              workflow: {} as AutomationWorkflow,
              isControl: true,
              trafficPercentage: 50,
              color: VARIANT_COLORS[0]
            },
            {
              id: 'variant-a',
              name: 'Higher Confidence (90%)',
              description: 'Increased confidence threshold to 90%',
              workflow: {} as AutomationWorkflow,
              isControl: false,
              trafficPercentage: 50,
              color: VARIANT_COLORS[1]
            }
          ],
          trafficSplit: { 'control': 50, 'variant-a': 50 },
          metrics: [
            {
              id: 'approval-rate',
              name: 'Auto-Approval Rate',
              type: 'conversion_rate',
              description: 'Percentage of returns automatically approved',
              isPrimary: true,
              targetDirection: 'increase'
            },
            {
              id: 'accuracy',
              name: 'Approval Accuracy',
              type: 'success_rate',
              description: 'Percentage of correct approval decisions',
              isPrimary: false,
              targetDirection: 'increase'
            }
          ],
          startDate: new Date('2024-01-15'),
          duration: 14,
          minSampleSize: 1000,
          confidenceLevel: 95,
          hypothesis: 'Increasing confidence threshold will improve approval accuracy without significantly reducing approval rate',
          successCriteria: 'Variant shows >5% improvement in accuracy with <10% decrease in approval rate',
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-15')
        }
      ]

      setTests(mockTests)
      
      // Mock results
      setTestResults({
        'test-1': {
          testId: 'test-1',
          variant: 'variant-a',
          metrics: {
            'approval-rate': {
              value: 0.72,
              sampleSize: 856,
              confidenceInterval: [0.69, 0.75],
              pValue: 0.023,
              isSignificant: true
            },
            'accuracy': {
              value: 0.94,
              sampleSize: 856,
              confidenceInterval: [0.92, 0.96],
              pValue: 0.001,
              isSignificant: true
            }
          },
          overallWinner: 'variant-a',
          recommendation: 'Deploy variant A - shows significant improvement in accuracy with acceptable decrease in approval rate',
          statisticalPower: 0.87
        }
      })
    } catch (error) {
      console.error('Failed to load A/B tests:', error)
    } finally {
      setLoading(false)
    }
  }

  const createTest = async () => {
    try {
      const test: ABTest = {
        ...newTest,
        id: `test-${Date.now()}`,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      } as ABTest

      setTests([...tests, test])
      onCreateTest?.(test)
      setShowCreateDialog(false)
      resetNewTestForm()
    } catch (error) {
      console.error('Failed to create A/B test:', error)
    }
  }

  const resetNewTestForm = () => {
    setNewTest({
      name: '',
      description: '',
      hypothesis: '',
      successCriteria: '',
      duration: 14,
      minSampleSize: 1000,
      confidenceLevel: 95,
      variants: [],
      metrics: [],
      trafficSplit: {}
    })
  }

  const addVariant = () => {
    const newVariant: ABTestVariant = {
      id: `variant-${Date.now()}`,
      name: `Variant ${(newTest.variants?.length || 0) + 1}`,
      description: '',
      workflow: {} as AutomationWorkflow,
      isControl: (newTest.variants?.length || 0) === 0,
      trafficPercentage: 0,
      color: VARIANT_COLORS[(newTest.variants?.length || 0) % VARIANT_COLORS.length]
    }

    setNewTest({
      ...newTest,
      variants: [...(newTest.variants || []), newVariant]
    })
  }

  const addMetric = () => {
    const newMetric: ABTestMetric = {
      id: `metric-${Date.now()}`,
      name: '',
      type: 'conversion_rate',
      description: '',
      isPrimary: (newTest.metrics?.length || 0) === 0,
      targetDirection: 'increase'
    }

    setNewTest({
      ...newTest,
      metrics: [...(newTest.metrics || []), newMetric]
    })
  }

  const updateTestStatus = async (testId: string, status: ABTest['status']) => {
    const updatedTests = tests.map(test => 
      test.id === testId 
        ? { ...test, status, updatedAt: new Date() }
        : test
    )
    setTests(updatedTests)
    onUpdateTest?.(testId, { status })
  }

  const getStatusColor = (status: ABTest['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: ABTest['status']) => {
    switch (status) {
      case 'running': return <Play className="w-3 h-3" />
      case 'paused': return <Pause className="w-3 h-3" />
      case 'completed': return <CheckCircle className="w-3 h-3" />
      case 'cancelled': return <XCircle className="w-3 h-3" />
      default: return <Settings className="w-3 h-3" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 animate-pulse" />
          <span>Loading A/B tests...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6" />
            A/B Testing Framework
          </h2>
          <p className="text-muted-foreground">
            Optimize your workflows through controlled experimentation
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Test
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>

      {/* Tests List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tests.map((test) => {
          const results = testResults[test.id]
          const isRunning = test.status === 'running'
          
          return (
            <Card key={test.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{test.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {test.description}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(test.status)}>
                    {getStatusIcon(test.status)}
                    <span className="ml-1 capitalize">{test.status}</span>
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Variants */}
                  <div>
                    <div className="text-sm font-medium mb-2">Variants</div>
                    <div className="flex gap-2">
                      {test.variants.map((variant) => (
                        <Badge 
                          key={variant.id}
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: variant.color, color: variant.color }}
                        >
                          {variant.name} ({variant.trafficPercentage}%)
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Progress */}
                  {isRunning && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>
                          {results ? Math.min(100, Math.round((Object.values(results.metrics)[0]?.sampleSize || 0) / test.minSampleSize * 100)) : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={results ? Math.min(100, (Object.values(results.metrics)[0]?.sampleSize || 0) / test.minSampleSize * 100) : 0}
                        className="h-2"
                      />
                      <div className="text-xs text-muted-foreground mt-1">
                        {results ? Object.values(results.metrics)[0]?.sampleSize || 0 : 0} / {test.minSampleSize} samples
                      </div>
                    </div>
                  )}

                  {/* Results Preview */}
                  {results && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Key Results</div>
                      {Object.entries(results.metrics).slice(0, 2).map(([metricId, metric]) => {
                        const metricInfo = test.metrics.find(m => m.id === metricId)
                        return (
                          <div key={metricId} className="flex justify-between text-sm">
                            <span>{metricInfo?.name}</span>
                            <div className="flex items-center gap-2">
                              <span>{(metric.value * 100).toFixed(1)}%</span>
                              {metric.isSignificant && (
                                <Badge variant="outline" className="text-xs">
                                  <Trophy className="w-3 h-3 mr-1" />
                                  Significant
                                </Badge>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedTest(test)}
                    >
                      <BarChart3 className="w-3 h-3 mr-1" />
                      View Details
                    </Button>
                    
                    {test.status === 'draft' && (
                      <Button 
                        size="sm"
                        onClick={() => updateTestStatus(test.id, 'running')}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Start
                      </Button>
                    )}
                    
                    {test.status === 'running' && (
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => updateTestStatus(test.id, 'paused')}
                      >
                        <Pause className="w-3 h-3 mr-1" />
                        Pause
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {tests.length === 0 && (
          <div className="col-span-2 text-center py-12">
            <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No A/B Tests Yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first A/B test to start optimizing your workflows
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Test
            </Button>
          </div>
        )}
      </div>

      {/* Create Test Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create A/B Test</DialogTitle>
            <DialogDescription>
              Set up a controlled experiment to optimize your workflow performance
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="variants">Variants</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="test-name">Test Name</Label>
                  <Input
                    id="test-name"
                    placeholder="e.g., Return Approval Optimization"
                    value={newTest.name}
                    onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="test-description">Description</Label>
                  <Textarea
                    id="test-description"
                    placeholder="Describe what you're testing and why"
                    value={newTest.description}
                    onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="hypothesis">Hypothesis</Label>
                  <Textarea
                    id="hypothesis"
                    placeholder="What do you expect to happen and why?"
                    value={newTest.hypothesis}
                    onChange={(e) => setNewTest({ ...newTest, hypothesis: e.target.value })}
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="success-criteria">Success Criteria</Label>
                  <Textarea
                    id="success-criteria"
                    placeholder="How will you determine if the test is successful?"
                    value={newTest.successCriteria}
                    onChange={(e) => setNewTest({ ...newTest, successCriteria: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="variants" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Test Variants</h3>
                <Button onClick={addVariant} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Variant
                </Button>
              </div>

              <div className="space-y-3">
                {newTest.variants?.map((variant, index) => (
                  <div key={variant.id} className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: variant.color }}
                      />
                      <Input
                        placeholder="Variant name"
                        value={variant.name}
                        onChange={(e) => {
                          const updatedVariants = [...(newTest.variants || [])]
                          updatedVariants[index] = { ...variant, name: e.target.value }
                          setNewTest({ ...newTest, variants: updatedVariants })
                        }}
                      />
                      {variant.isControl && (
                        <Badge variant="outline">Control</Badge>
                      )}
                    </div>
                    
                    <Textarea
                      placeholder="Describe the changes in this variant"
                      value={variant.description}
                      onChange={(e) => {
                        const updatedVariants = [...(newTest.variants || [])]
                        updatedVariants[index] = { ...variant, description: e.target.value }
                        setNewTest({ ...newTest, variants: updatedVariants })
                      }}
                      rows={2}
                    />
                  </div>
                ))}

                {(newTest.variants?.length || 0) === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-8 h-8 mx-auto mb-2" />
                    <p>Add variants to compare different workflow configurations</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Success Metrics</h3>
                <Button onClick={addMetric} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Metric
                </Button>
              </div>

              <div className="space-y-3">
                {newTest.metrics?.map((metric, index) => (
                  <div key={metric.id} className="p-4 border rounded-lg">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="text-xs">Metric Name</Label>
                        <Input
                          placeholder="e.g., Conversion Rate"
                          value={metric.name}
                          onChange={(e) => {
                            const updatedMetrics = [...(newTest.metrics || [])]
                            updatedMetrics[index] = { ...metric, name: e.target.value }
                            setNewTest({ ...newTest, metrics: updatedMetrics })
                          }}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Metric Type</Label>
                        <Select
                          value={metric.type}
                          onValueChange={(value) => {
                            const updatedMetrics = [...(newTest.metrics || [])]
                            updatedMetrics[index] = { ...metric, type: value as any }
                            setNewTest({ ...newTest, metrics: updatedMetrics })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {METRIC_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mb-3">
                      <Label className="text-xs">Description</Label>
                      <Input
                        placeholder="What does this metric measure?"
                        value={metric.description}
                        onChange={(e) => {
                          const updatedMetrics = [...(newTest.metrics || [])]
                          updatedMetrics[index] = { ...metric, description: e.target.value }
                          setNewTest({ ...newTest, metrics: updatedMetrics })
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`primary-${metric.id}`}
                          checked={metric.isPrimary}
                          onChange={(e) => {
                            const updatedMetrics = [...(newTest.metrics || [])]
                            updatedMetrics[index] = { ...metric, isPrimary: e.target.checked }
                            setNewTest({ ...newTest, metrics: updatedMetrics })
                          }}
                        />
                        <Label htmlFor={`primary-${metric.id}`} className="text-xs">
                          Primary Metric
                        </Label>
                      </div>

                      <Select
                        value={metric.targetDirection}
                        onValueChange={(value) => {
                          const updatedMetrics = [...(newTest.metrics || [])]
                          updatedMetrics[index] = { ...metric, targetDirection: value as any }
                          setNewTest({ ...newTest, metrics: updatedMetrics })
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="increase">Increase</SelectItem>
                          <SelectItem value="decrease">Decrease</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}

                {(newTest.metrics?.length || 0) === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                    <p>Define metrics to measure the success of your test</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration">Test Duration (days)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={newTest.duration}
                    onChange={(e) => setNewTest({ ...newTest, duration: parseInt(e.target.value) || 14 })}
                  />
                </div>

                <div>
                  <Label htmlFor="sample-size">Minimum Sample Size</Label>
                  <Input
                    id="sample-size"
                    type="number"
                    min="100"
                    value={newTest.minSampleSize}
                    onChange={(e) => setNewTest({ ...newTest, minSampleSize: parseInt(e.target.value) || 1000 })}
                  />
                </div>

                <div>
                  <Label htmlFor="confidence">Confidence Level (%)</Label>
                  <Select
                    value={newTest.confidenceLevel?.toString()}
                    onValueChange={(value) => setNewTest({ ...newTest, confidenceLevel: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90%</SelectItem>
                      <SelectItem value="95">95%</SelectItem>
                      <SelectItem value="99">99%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createTest} disabled={!newTest.name || (newTest.variants?.length || 0) < 2}>
              Create Test
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Details Modal */}
      {selectedTest && (
        <Dialog open={!!selectedTest} onOpenChange={() => setSelectedTest(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTest.name}</DialogTitle>
              <DialogDescription>{selectedTest.description}</DialogDescription>
            </DialogHeader>

            {/* Test details content would go here */}
            <div className="space-y-4">
              <p>Detailed test results and analysis would be displayed here...</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}