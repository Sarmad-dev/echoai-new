'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ChatbotList } from '@/components/dashboard/chatbot-list'
import { ChatbotForm } from '@/components/dashboard/chatbot-form'
import { ChatbotTraining } from '@/components/dashboard/chatbot-training'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, ArrowRight } from 'lucide-react'
import type { ChatbotData } from '@/types/api'

type DashboardView = 'list' | 'create' | 'edit' | 'train'

export default function DashboardPage() {
  const { } = useAuth()
  const [currentView, setCurrentView] = useState<DashboardView>('list')
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotData | null>(null)

  const handleSelectChatbot = (chatbot: ChatbotData) => {
    setSelectedChatbot(chatbot)
    setCurrentView('train')
  }

  const handleCreateChatbot = () => {
    setSelectedChatbot(null)
    setCurrentView('create')
  }

  const handleEditChatbot = (chatbot: ChatbotData) => {
    setSelectedChatbot(chatbot)
    setCurrentView('edit')
  }

  const handleFormSuccess = (chatbot: ChatbotData) => {
    setSelectedChatbot(chatbot)
    setCurrentView('list')
  }

  const handleBack = () => {
    setCurrentView('list')
    setSelectedChatbot(null)
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'create':
        return (
          <ChatbotForm 
            onBack={handleBack}
            onSuccess={handleFormSuccess}
          />
        )
      case 'edit':
        return (
          <ChatbotForm 
            chatbot={selectedChatbot}
            onBack={handleBack}
            onSuccess={handleFormSuccess}
          />
        )
      case 'train':
        return selectedChatbot ? (
          <ChatbotTraining 
            chatbot={selectedChatbot}
            onBack={handleBack}
          />
        ) : null
      default:
        return (
          <div className="space-y-6">
            {/* Quick Analytics Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Analytics Overview
                    </CardTitle>
                    <CardDescription>
                      Quick insights into your chatbot performance
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/analytics" className="flex items-center gap-2">
                      View Full Analytics
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="p-2 rounded-full bg-primary/10">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Total Conversations</p>
                      <p className="text-2xl font-bold">1,247</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <BarChart3 className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Resolution Rate</p>
                      <p className="text-2xl font-bold">94.2%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="p-2 rounded-full bg-blue-500/10">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Avg Sentiment</p>
                      <p className="text-2xl font-bold">0.72</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chatbot List */}
            <ChatbotList 
              onSelectChatbot={handleSelectChatbot}
              onCreateChatbot={handleCreateChatbot}
              onEditChatbot={handleEditChatbot}
            />
          </div>
        )
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {renderCurrentView()}
      </div>
    </DashboardLayout>
  )
}