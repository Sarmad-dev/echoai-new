"use client"

import { EnhancedChatWidget } from "@/components/enhanced-chat-widget"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"

interface ChatWidgetPreviewProps {
  settings: {
    chatbotName: string
    welcomeMessage: string
    primaryColor: string
  }
  apiKey: string
  chatbotId?: string
}

export function ChatWidgetPreview({ settings, apiKey, chatbotId }: ChatWidgetPreviewProps) {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Chat Widget Preview
            <Badge variant="secondary">Live Preview</Badge>
          </CardTitle>
          <CardDescription>
            This is how your chat widget will appear on your website. The widget starts minimized and expands when clicked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Current Settings</h4>
              <div className="text-sm space-y-1">
                <div>
                  <span className="font-medium">Name:</span> {settings.chatbotName ?? 'Bot'}
                </div>
                <div>
                  <span className="font-medium">Welcome:</span> {settings.welcomeMessage}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Color:</span>
                  <div 
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: settings.primaryColor }}
                  />
                  {settings.primaryColor}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Features</h4>
              <ul className="text-sm space-y-1">
                <li>✅ Custom branding</li>
                <li>✅ Dark mode support</li>
                <li>✅ Real-time messaging</li>
                <li>✅ Sentiment analysis</li>
                <li>✅ FAQ tab functionality</li>
                <li>✅ Conversation history</li>
                <li>✅ Image upload support</li>
                <li>✅ Mobile responsive</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">
                <strong>Preview Error:</strong> {error}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This error will not affect the actual widget on your website.
              </p>
            </div>
          )}

          <div className="p-4 bg-muted/50 rounded-lg border-2 border-dashed">
            <p className="text-sm text-muted-foreground text-center">
              Your chat widget will appear in the bottom-right corner of this preview area.
              Click the bot icon to test the interface.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chat Widget - positioned relative to this container for preview */}
      <div className="relative h-96 bg-gradient-to-br from-background to-muted/20 rounded-lg border overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-4 left-4 text-sm text-muted-foreground">
          Website Preview
        </div>
        
        <EnhancedChatWidget
          apiKey={apiKey}
          settings={settings}
          chatbotId={chatbotId}
          userEmail="preview@example.com"
          onError={setError}
          className="!fixed !bottom-4 !right-4"
          enableImageUpload={true}
          enableFAQ={true}
          enableHistory={true}
        />
      </div>
    </div>
  )
}