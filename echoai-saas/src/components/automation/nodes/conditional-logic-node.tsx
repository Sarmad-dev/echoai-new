'use client'

import React, { useState } from 'react'
import { Handle, Position, NodeProps } from 'reactflow'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  GitBranch, 
  Settings, 
  Plus, 
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

export interface ConditionalLogicData {
  label: string
  conditions: Array<{
    id: string
    field: string
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'exists' | 'not_exists'
    value: string | number | boolean
    logicalOperator?: 'AND' | 'OR'
  }>
  branches: Array<{
    id: string
    name: string
    condition: string // Expression that evaluates to true/false
    color: string
  }>
  defaultBranch?: string
  config?: Record<string, any>
}

interface ConditionalLogicNodeProps extends NodeProps {
  data: ConditionalLogicData
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'exists', label: 'Exists' },
  { value: 'not_exists', label: 'Does Not Exist' }
]

const BRANCH_COLORS = [
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f97316', // orange
]

export function ConditionalLogicNode({ data, selected }: ConditionalLogicNodeProps) {
  const [showConfig, setShowConfig] = useState(false)
  const [conditions, setConditions] = useState(data.conditions || [])
  const [branches, setBranches] = useState(data.branches || [
    { id: 'true', name: 'True', condition: 'true', color: '#10b981' },
    { id: 'false', name: 'False', condition: 'false', color: '#ef4444' }
  ])
  const [expanded, setExpanded] = useState(false)

  const addCondition = () => {
    const newCondition = {
      id: `condition-${Date.now()}`,
      field: '',
      operator: 'equals' as const,
      value: '',
      logicalOperator: conditions.length > 0 ? 'AND' as const : undefined
    }
    setConditions([...conditions, newCondition])
  }

  const updateCondition = (id: string, updates: Partial<typeof conditions[0]>) => {
    setConditions(conditions.map(condition => 
      condition.id === id ? { ...condition, ...updates } : condition
    ))
  }

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(condition => condition.id !== id))
  }

  const addBranch = () => {
    const newBranch = {
      id: `branch-${Date.now()}`,
      name: `Branch ${branches.length + 1}`,
      condition: 'true',
      color: BRANCH_COLORS[branches.length % BRANCH_COLORS.length]
    }
    setBranches([...branches, newBranch])
  }

  const updateBranch = (id: string, updates: Partial<typeof branches[0]>) => {
    setBranches(branches.map(branch => 
      branch.id === id ? { ...branch, ...updates } : branch
    ))
  }

  const removeBranch = (id: string) => {
    if (branches.length > 2) { // Keep at least 2 branches
      setBranches(branches.filter(branch => branch.id !== id))
    }
  }

  const saveConfiguration = () => {
    // Update the node data
    data.conditions = conditions
    data.branches = branches
    setShowConfig(false)
  }

  return (
    <>
      <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm">{data.label}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </Button>
              <Dialog open={showConfig} onOpenChange={setShowConfig}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-3 h-3" />
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {conditions.length} condition{conditions.length !== 1 ? 's' : ''}
            </div>
            
            {expanded && (
              <div className="space-y-1">
                {conditions.slice(0, 3).map((condition, index) => (
                  <div key={condition.id} className="text-xs p-1 bg-muted rounded">
                    {index > 0 && (
                      <span className="text-blue-600 font-medium mr-1">
                        {condition.logicalOperator}
                      </span>
                    )}
                    <span className="font-medium">{condition.field || 'field'}</span>
                    <span className="mx-1">{condition.operator}</span>
                    <span className="text-muted-foreground">{condition.value || 'value'}</span>
                  </div>
                ))}
                {conditions.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{conditions.length - 3} more...
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {branches.map((branch) => (
                <Badge 
                  key={branch.id} 
                  variant="outline" 
                  className="text-xs"
                  style={{ borderColor: branch.color, color: branch.color }}
                >
                  {branch.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>

        {/* Input Handle */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-blue-600"
        />

        {/* Output Handles for each branch */}
        {branches.map((branch, index) => (
          <Handle
            key={branch.id}
            type="source"
            position={Position.Right}
            id={branch.id}
            className="w-3 h-3"
            style={{
              backgroundColor: branch.color,
              top: `${30 + (index * 20)}%`
            }}
          />
        ))}
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Conditional Logic</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Conditions Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Conditions</h3>
                <Button onClick={addCondition} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Condition
                </Button>
              </div>

              <div className="space-y-3">
                {conditions.map((condition, index) => (
                  <div key={condition.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {index > 0 && (
                      <Select
                        value={condition.logicalOperator}
                        onValueChange={(value) => updateCondition(condition.id, { logicalOperator: value as 'AND' | 'OR' })}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Field</Label>
                        <Input
                          placeholder="e.g., sentiment.score"
                          value={condition.field}
                          onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Operator</Label>
                        <Select
                          value={condition.operator}
                          onValueChange={(value) => updateCondition(condition.id, { operator: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">Value</Label>
                        <Input
                          placeholder="Value to compare"
                          value={condition.value as string}
                          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                        />
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCondition(condition.id)}
                      disabled={conditions.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {conditions.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    No conditions defined. Add a condition to get started.
                  </div>
                )}
              </div>
            </div>

            {/* Branches Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Output Branches</h3>
                <Button onClick={addBranch} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Branch
                </Button>
              </div>

              <div className="space-y-3">
                {branches.map((branch, _index) => (
                  <div key={branch.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: branch.color }}
                    />

                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Branch Name</Label>
                        <Input
                          value={branch.name}
                          onChange={(e) => updateBranch(branch.id, { name: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Condition Expression</Label>
                        <Input
                          placeholder="e.g., result === true"
                          value={branch.condition}
                          onChange={(e) => updateBranch(branch.id, { condition: e.target.value })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Color</Label>
                      <div className="flex gap-1">
                        {BRANCH_COLORS.map((color, colorIndex) => (
                          <button
                            key={`${color}-${colorIndex}`}
                            className={`w-6 h-6 rounded border-2 ${
                              branch.color === color ? 'border-gray-900' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => updateBranch(branch.id, { color })}
                          />
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBranch(branch.id)}
                      disabled={branches.length <= 2}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancel
              </Button>
              <Button onClick={saveConfiguration}>
                Save Configuration
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}