'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ChatbotSelector } from '@/components/dashboard/chatbot-selector'
import { ChatbotForm } from '@/components/dashboard/chatbot-form'
import { ChatbotEmbedGenerator } from '@/components/dashboard/chatbot-embed-generator'
import { ChatWidgetPreview } from '@/components/dashboard/chat-widget-preview'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Palette, Code, Settings } from 'lucide-react'
import type { ChatbotData } from '@/types/api'

export default function CustomizePage() {
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotData | null>(null)
  const [activeTab, setActiveTab] = useState('settings')

  const handleChatbotUpdate = (updatedChatbot: ChatbotData) => {
    setSelectedChatbot(updatedChatbot)
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Customize Chatbot</h1>
          <p className="text-muted-foreground">
            Personalize your chatbot&apos;s appearance and generate embed code
          </p>
        </div>

        {!selectedChatbot ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Select Chatbot to Customize
              </CardTitle>
              <CardDescription>
                Choose which chatbot you want to customize
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ChatbotSelector
                onSelect={(chatbot) => {
                  setSelectedChatbot(chatbot)
                  setActiveTab('settings')
                }}
                placeholder="Select a chatbot to customize..."
              />
              
              {/* Customization options preview */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg text-center">
                  <Settings className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <h3 className="font-medium mb-1">Settings</h3>
                  <p className="text-sm text-muted-foreground">
                    Name, welcome message, and colors
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg text-center">
                  <Palette className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <h3 className="font-medium mb-1">Appearance</h3>
                  <p className="text-sm text-muted-foreground">
                    Theme, position, and branding
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg text-center">
                  <Code className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <h3 className="font-medium mb-1">Embed Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Ready-to-use website integration
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="embed" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Embed Code
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings" className="space-y-6">
              <ChatbotForm 
                chatbot={selectedChatbot}
                onBack={() => setSelectedChatbot(null)}
                onSuccess={handleChatbotUpdate}
              />
              
              {/* Chat Widget Preview */}
              <ChatWidgetPreview
                settings={{
                  chatbotName: selectedChatbot.name,
                  welcomeMessage: selectedChatbot.welcomeMessage,
                  primaryColor: selectedChatbot.primaryColor,
                }}
                apiKey={selectedChatbot.apiKey}
                chatbotId={selectedChatbot.id}
              />
            </TabsContent>
            
            <TabsContent value="embed" className="space-y-6">
              <ChatbotEmbedGenerator chatbot={selectedChatbot} />
              
              {/* Chat Widget Preview */}
              <ChatWidgetPreview
                settings={{
                  chatbotName: selectedChatbot.name,
                  welcomeMessage: selectedChatbot.welcomeMessage,
                  primaryColor: selectedChatbot.primaryColor,
                }}
                apiKey={selectedChatbot.apiKey}
                chatbotId={selectedChatbot.id}
              />
            </TabsContent>
          </Tabs>
        )}


      </div>
    </DashboardLayout>
  )
}