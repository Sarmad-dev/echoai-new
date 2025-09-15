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
import { Textarea } from '@/components/ui/textarea'
import { 
  Clock, 
  Settings, 
  Calendar,
  Timer,
  Pause
} from 'lucide-react'

export interface DelayNodeData {
  label: string
  delayType: 'fixed' | 'dynamic' | 'scheduled' | 'conditional'
  delayConfig: {
    // Fixed delay
    duration?: number
    unit?: 'seconds' | 'minutes' | 'hours' | 'days'
    
    // Dynamic delay
    expression?: string // JavaScript expression that returns delay in milliseconds
    
    // Scheduled delay
    scheduleType?: 'cron' | 'date' | 'recurring'
    cronExpression?: string
    scheduledDate?: string
    recurringPattern?: {
      frequency: 'daily' | 'weekly' | 'monthly'
      interval: number
      daysOfWeek?: number[] // 0-6, Sunday = 0
      dayOfMonth?: number
      time?: string // HH:MM format
    }
    
    // Conditional delay
    condition?: string // Expression that determines if delay should happen
    conditionalDuration?: number
    conditionalUnit?: 'seconds' | 'minutes' | 'hours' | 'days'
  }
  timeZone?: string
  maxDelay?: number // Maximum delay in milliseconds for safety
  config?: Record<string, any>
}

interface DelayNodeProps extends NodeProps {
  data: DelayNodeData
}

const TIME_UNITS = [
  { value: 'seconds', label: 'Seconds' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' }
]

const DELAY_TYPES = [
  { value: 'fixed', label: 'Fixed Delay', icon: Timer },
  { value: 'dynamic', label: 'Dynamic Delay', icon: Settings },
  { value: 'scheduled', label: 'Scheduled', icon: Calendar },
  { value: 'conditional', label: 'Conditional', icon: Pause }
]

const SCHEDULE_TYPES = [
  { value: 'cron', label: 'Cron Expression' },
  { value: 'date', label: 'Specific Date' },
  { value: 'recurring', label: 'Recurring Pattern' }
]

const RECURRING_FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

export function DelayNode({ data, selected }: DelayNodeProps) {
  const [showConfig, setShowConfig] = useState(false)
  const [delayType, setDelayType] = useState<'fixed' | 'dynamic' | 'scheduled' | 'conditional'>(data.delayType || 'fixed')
  const [delayConfig, setDelayConfig] = useState(data.delayConfig || {
    duration: 5,
    unit: 'minutes'
  })

  const updateDelayConfig = (updates: Partial<typeof delayConfig>) => {
    setDelayConfig({ ...delayConfig, ...updates })
  }

  const saveConfiguration = () => {
    data.delayType = delayType
    data.delayConfig = delayConfig
    setShowConfig(false)
  }

  const getDelayDescription = () => {
    switch (delayType) {
      case 'fixed':
        return `${delayConfig.duration || 0} ${delayConfig.unit || 'minutes'}`
      case 'dynamic':
        return 'Dynamic delay'
      case 'scheduled':
        if (delayConfig.scheduleType === 'cron') {
          return `Cron: ${delayConfig.cronExpression || '* * * * *'}`
        } else if (delayConfig.scheduleType === 'date') {
          return `Until: ${delayConfig.scheduledDate || 'Not set'}`
        } else {
          return `${delayConfig.recurringPattern?.frequency || 'daily'}`
        }
      case 'conditional':
        return `If condition met: ${delayConfig.conditionalDuration || 0} ${delayConfig.conditionalUnit || 'minutes'}`
      default:
        return 'Not configured'
    }
  }

  const getDelayIcon = () => {
    const DelayIcon = DELAY_TYPES.find(type => type.value === delayType)?.icon || Clock
    return <DelayIcon className="w-4 h-4 text-orange-600" />
  }

  return (
    <>
      <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getDelayIcon()}
              <CardTitle className="text-sm">{data.label}</CardTitle>
            </div>
            <Dialog open={showConfig} onOpenChange={setShowConfig}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="w-3 h-3" />
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="space-y-2">
            <Badge variant="outline" className="text-xs">
              {DELAY_TYPES.find(type => type.value === delayType)?.label}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {getDelayDescription()}
            </div>
            {data.maxDelay && (
              <div className="text-xs text-orange-600">
                Max: {Math.floor(data.maxDelay / 1000 / 60)} min
              </div>
            )}
          </div>
        </CardContent>

        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-orange-600"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-orange-600"
        />
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Delay/Schedule</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Delay Type Selection */}
            <div>
              <Label className="text-sm font-medium">Delay Type</Label>
              <Select value={delayType} onValueChange={(value: string) => setDelayType(value as 'fixed' | 'dynamic' | 'scheduled' | 'conditional')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELAY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="w-4 h-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fixed Delay Configuration */}
            {delayType === 'fixed' && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Fixed Delay</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Duration</Label>
                    <Input
                      type="number"
                      min="1"
                      value={delayConfig.duration || ''}
                      onChange={(e) => updateDelayConfig({ duration: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Select
                      value={delayConfig.unit}
                      onValueChange={(value) => updateDelayConfig({ unit: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_UNITS.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Delay Configuration */}
            {delayType === 'dynamic' && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Dynamic Delay</h3>
                <div>
                  <Label className="text-xs">Expression (returns milliseconds)</Label>
                  <Textarea
                    placeholder="e.g., Math.random() * 60000 // Random delay up to 1 minute"
                    value={delayConfig.expression || ''}
                    onChange={(e) => updateDelayConfig({ expression: e.target.value })}
                    rows={3}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Available variables: context, triggerData, previousResults
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled Delay Configuration */}
            {delayType === 'scheduled' && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Scheduled Execution</h3>
                
                <div>
                  <Label className="text-xs">Schedule Type</Label>
                  <Select
                    value={delayConfig.scheduleType}
                    onValueChange={(value) => updateDelayConfig({ scheduleType: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {delayConfig.scheduleType === 'cron' && (
                  <div>
                    <Label className="text-xs">Cron Expression</Label>
                    <Input
                      placeholder="0 9 * * 1-5 (9 AM on weekdays)"
                      value={delayConfig.cronExpression || ''}
                      onChange={(e) => updateDelayConfig({ cronExpression: e.target.value })}
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Format: minute hour day month day-of-week
                    </div>
                  </div>
                )}

                {delayConfig.scheduleType === 'date' && (
                  <div>
                    <Label className="text-xs">Scheduled Date & Time</Label>
                    <Input
                      type="datetime-local"
                      value={delayConfig.scheduledDate || ''}
                      onChange={(e) => updateDelayConfig({ scheduledDate: e.target.value })}
                    />
                  </div>
                )}

                {delayConfig.scheduleType === 'recurring' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Frequency</Label>
                        <Select
                          value={delayConfig.recurringPattern?.frequency}
                          onValueChange={(value) => updateDelayConfig({
                            recurringPattern: {
                              frequency: value as 'daily' | 'weekly' | 'monthly',
                              interval: delayConfig.recurringPattern?.interval || 1,
                              ...delayConfig.recurringPattern
                            }
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECURRING_FREQUENCIES.map((freq) => (
                              <SelectItem key={freq.value} value={freq.value}>
                                {freq.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Interval</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={delayConfig.recurringPattern?.interval || ''}
                          onChange={(e) => updateDelayConfig({
                            recurringPattern: {
                              frequency: delayConfig.recurringPattern?.frequency || 'daily',
                              interval: parseInt(e.target.value) || 1,
                              ...delayConfig.recurringPattern
                            }
                          })}
                        />
                      </div>
                    </div>

                    {delayConfig.recurringPattern?.frequency === 'weekly' && (
                      <div>
                        <Label className="text-xs">Days of Week</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {DAYS_OF_WEEK.map((day) => (
                            <Button
                              key={day.value}
                              variant={
                                delayConfig.recurringPattern?.daysOfWeek?.includes(day.value)
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              onClick={() => {
                                const currentDays = delayConfig.recurringPattern?.daysOfWeek || []
                                const newDays = currentDays.includes(day.value)
                                  ? currentDays.filter(d => d !== day.value)
                                  : [...currentDays, day.value]
                                
                                updateDelayConfig({
                                  recurringPattern: {
                                    frequency: delayConfig.recurringPattern?.frequency || 'weekly',
                                    interval: delayConfig.recurringPattern?.interval || 1,
                                    daysOfWeek: newDays,
                                    ...delayConfig.recurringPattern
                                  }
                                })
                              }}
                            >
                              {day.label.slice(0, 3)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {delayConfig.recurringPattern?.frequency === 'monthly' && (
                      <div>
                        <Label className="text-xs">Day of Month</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="1"
                          value={delayConfig.recurringPattern?.dayOfMonth || ''}
                          onChange={(e) => updateDelayConfig({
                            recurringPattern: {
                              frequency: delayConfig.recurringPattern?.frequency || 'monthly',
                              interval: delayConfig.recurringPattern?.interval || 1,
                              dayOfMonth: parseInt(e.target.value) || 1,
                              ...delayConfig.recurringPattern
                            }
                          })}
                        />
                      </div>
                    )}

                    <div>
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        value={delayConfig.recurringPattern?.time || ''}
                        onChange={(e) => updateDelayConfig({
                          recurringPattern: {
                            frequency: delayConfig.recurringPattern?.frequency || 'daily',
                            interval: delayConfig.recurringPattern?.interval || 1,
                            time: e.target.value,
                            ...delayConfig.recurringPattern
                          }
                        })}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Conditional Delay Configuration */}
            {delayType === 'conditional' && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Conditional Delay</h3>
                
                <div>
                  <Label className="text-xs">Condition</Label>
                  <Textarea
                    placeholder="e.g., context.priority === 'high'"
                    value={delayConfig.condition || ''}
                    onChange={(e) => updateDelayConfig({ condition: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Delay Duration (if condition is true)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={delayConfig.conditionalDuration || ''}
                      onChange={(e) => updateDelayConfig({ conditionalDuration: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Select
                      value={delayConfig.conditionalUnit}
                      onValueChange={(value) => updateDelayConfig({ conditionalUnit: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_UNITS.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Common Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Advanced Settings</h3>
              
              <div>
                <Label className="text-xs">Time Zone</Label>
                <Input
                  placeholder="UTC, America/New_York, Europe/London"
                  value={data.timeZone || ''}
                  onChange={(e) => { data.timeZone = e.target.value }}
                />
              </div>

              <div>
                <Label className="text-xs">Maximum Delay (minutes)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="No limit"
                  value={data.maxDelay ? Math.floor(data.maxDelay / 1000 / 60) : ''}
                  onChange={(e) => { 
                    data.maxDelay = e.target.value ? parseInt(e.target.value) * 60 * 1000 : undefined 
                  }}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Safety limit to prevent excessive delays
                </div>
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