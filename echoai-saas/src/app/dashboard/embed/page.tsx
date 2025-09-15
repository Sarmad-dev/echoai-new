'use client'

import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { ChatbotEmbedGenerator } from '@/components/dashboard/chatbot-embed-generator'
import { Code } from 'lucide-react'

export default function EmbedCodePage() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Code className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Embed Code</h1>
            <p className="text-muted-foreground">
              Get the embed code to add your chatbot to your website
            </p>
          </div>
        </div>

        <ChatbotEmbedGenerator />
      </div>
    </DashboardLayout>
  )
}