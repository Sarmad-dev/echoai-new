'use client'

import { useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#A855F7', // Violet
  '#22C55E', // Emerald
  '#F43F5E', // Rose
  '#0EA5E9', // Sky
  '#64748B', // Slate
  '#374151', // Gray
  '#1F2937', // Dark Gray
]

const GRADIENT_COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
]

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value)
  const [activeTab, setActiveTab] = useState('presets')

  const handlePresetClick = (color: string) => {
    onChange(color)
    setCustomColor(color.startsWith('linear-gradient') ? '#3B82F6' : color)
  }

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color)
    if (color.match(/^#[0-9A-F]{6}$/i)) {
      onChange(color)
    }
  }

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setCustomColor(color)
    onChange(color)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-full justify-start text-left font-normal ${className}`}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded border"
              style={{ 
                background: value,
                backgroundColor: value.startsWith('linear-gradient') ? undefined : value
              }}
            />
            <span className="truncate">
              {value.startsWith('linear-gradient') ? 'Gradient' : value}
            </span>
            <Palette className="ml-auto h-4 w-4" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="wheel">Wheel</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
          
          <TabsContent value="presets" className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Solid Colors</Label>
              <div className="grid grid-cols-6 gap-2 mt-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className="relative h-8 w-8 rounded border-2 border-white shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => handlePresetClick(color)}
                  >
                    {value === color && (
                      <Check className="absolute inset-0 h-4 w-4 text-white m-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Gradients</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {GRADIENT_COLORS.map((gradient, index) => (
                  <button
                    key={index}
                    className="h-8 w-full rounded border-2 border-white shadow-sm hover:scale-105 transition-transform"
                    style={{ background: gradient }}
                    onClick={() => handlePresetClick(gradient)}
                  >
                    {value === gradient && (
                      <Check className="h-4 w-4 text-white m-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="wheel" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="color-wheel">Color Wheel</Label>
              <input
                id="color-wheel"
                type="color"
                value={value.startsWith('#') ? value : '#3B82F6'}
                onChange={handleColorInputChange}
                className="w-full h-32 rounded border cursor-pointer"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="custom" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hex-input">Hex Color</Label>
              <Input
                id="hex-input"
                placeholder="#3B82F6"
                value={customColor}
                onChange={(e) => handleCustomColorChange(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Preview</Label>
              <div
                className="w-full h-16 rounded border"
                style={{ backgroundColor: customColor }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}