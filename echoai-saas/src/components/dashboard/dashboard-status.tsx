'use client'

import { Bot, Database, Palette, Code, AlertCircle, CheckCircle2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ChatbotConfig {
  hasData: boolean
  dataSourceCount: number
  chatbotName: string
  primaryColor: string
  welcomeMessage: string
  isEmbedReady: boolean
}

interface DashboardStatusProps {
  config: ChatbotConfig
}

export function DashboardStatus({ config }: DashboardStatusProps) {
  const {
    hasData,
    dataSourceCount,
    chatbotName,
    primaryColor,
    welcomeMessage,
    isEmbedReady
  } = config

  const getStatusBadge = () => {
    if (!hasData) {
      return <Badge variant="secondary">Setup Required</Badge>
    }
    if (hasData && !isEmbedReady) {
      return <Badge variant="outline">Partially Configured</Badge>
    }
    return <Badge variant="default" className="bg-green-600">Ready to Deploy</Badge>
  }

  const getStatusIcon = () => {
    if (!hasData) {
      return <AlertCircle className="h-5 w-5 text-orange-500" />
    }
    if (hasData && !isEmbedReady) {
      return <AlertCircle className="h-5 w-5 text-blue-500" />
    }
    return <CheckCircle2 className="h-5 w-5 text-green-500" />
  }

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Chatbot Status</CardTitle>
                <CardDescription>Current configuration overview</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              {getStatusBadge()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Data Sources */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Database className={`h-5 w-5 ${hasData ? 'text-green-600' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">Data Sources</p>
                <p className="text-xs text-muted-foreground">
                  {hasData ? `${dataSourceCount} connected` : 'None connected'}
                </p>
              </div>
            </div>

            {/* Customization */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Palette className={`h-5 w-5 ${chatbotName !== 'EchoAI Assistant' ? 'text-green-600' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">Customization</p>
                <p className="text-xs text-muted-foreground">
                  {chatbotName !== 'EchoAI Assistant' ? 'Customized' : 'Default settings'}
                </p>
              </div>
            </div>

            {/* Embed Code */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Code className={`h-5 w-5 ${isEmbedReady ? 'text-green-600' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">Embed Code</p>
                <p className="text-xs text-muted-foreground">
                  {isEmbedReady ? 'Ready' : 'Not generated'}
                </p>
              </div>
            </div>

            {/* Overall Status */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Bot className={`h-5 w-5 ${isEmbedReady && hasData ? 'text-green-600' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium text-sm">Chatbot</p>
                <p className="text-xs text-muted-foreground">
                  {isEmbedReady && hasData ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Configuration</CardTitle>
            <CardDescription>Your chatbot&apos;s current settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Chatbot Name</label>
              <p className="text-sm mt-1">{chatbotName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Welcome Message</label>
              <p className="text-sm mt-1 line-clamp-2">{welcomeMessage}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Primary Color</label>
              <div className="flex items-center gap-2 mt-1">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-sm">{primaryColor}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common tasks and next steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!hasData && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span>Connect data sources to train your chatbot</span>
              </div>
            )}
            {hasData && chatbotName === 'EchoAI Assistant' && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <span>Customize your chatbot&apos;s appearance</span>
              </div>
            )}
            {hasData && !isEmbedReady && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <span>Generate embed code for your website</span>
              </div>
            )}
            {isEmbedReady && hasData && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Your chatbot is ready to deploy!</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}