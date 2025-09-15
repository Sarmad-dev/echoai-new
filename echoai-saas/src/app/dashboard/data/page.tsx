'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ChatbotSelector } from '@/components/dashboard/chatbot-selector'
import { ChatbotTraining } from '@/components/dashboard/chatbot-training'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Database, FileText, AlertCircle } from 'lucide-react'
import type { ChatbotData } from '@/types/api'

export default function DataPage() {
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotData | null>(null)

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Training Data</h1>
          <p className="text-muted-foreground">
            Manage your chatbot's knowledge base by adding documents and URLs
          </p>
        </div>

        {!selectedChatbot ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Select Chatbot to Train
              </CardTitle>
              <CardDescription>
                Choose which chatbot you want to add training data to
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ChatbotSelector
                onSelect={setSelectedChatbot}
                placeholder="Select a chatbot to train..."
              />
              
              {/* Info about training */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <h3 className="font-medium">Supported Formats</h3>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• PDF documents</li>
                    <li>• DOCX files</li>
                    <li>• Website URLs</li>
                    <li>• Plain text content</li>
                  </ul>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <h3 className="font-medium">Training Tips</h3>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use high-quality, relevant content</li>
                    <li>• Keep documents focused and organized</li>
                    <li>• Update regularly for best results</li>
                    <li>• Test your chatbot after training</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ChatbotTraining 
            chatbot={selectedChatbot}
            onBack={() => setSelectedChatbot(null)}
          />
        )}
      </div>
    </DashboardLayout>
  )
}