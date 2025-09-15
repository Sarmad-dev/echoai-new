'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ColorPicker } from '@/components/ui/color-picker'
import type { ChatbotData } from '@/types/api'

const chatbotFormSchema = z.object({
  name: z.string().min(1, 'Chatbot name is required').max(50, 'Name must be less than 50 characters'),
  welcomeMessage: z.string().min(1, 'Welcome message is required').max(200, 'Message must be less than 200 characters'),
  primaryColor: z.string().min(1, 'Please select a color'),
})

type ChatbotFormData = z.infer<typeof chatbotFormSchema>

interface ChatbotFormProps {
  chatbot?: ChatbotData | null
  onBack: () => void
  onSuccess: (chatbot: ChatbotData) => void
}

export function ChatbotForm({ chatbot, onBack, onSuccess }: ChatbotFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ChatbotFormData>({
    resolver: zodResolver(chatbotFormSchema),
    defaultValues: {
      name: chatbot?.name || '',
      welcomeMessage: chatbot?.welcomeMessage || 'Hello! How can I help you today?',
      primaryColor: chatbot?.primaryColor || '#3B82F6',
    },
  })

  const onSubmit = async (data: ChatbotFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = chatbot ? `/api/chatbots/${chatbot.id}` : '/api/chatbots'
      const method = chatbot ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save chatbot')
      }

      const savedChatbot = await response.json()
      onSuccess(savedChatbot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const previewColor = form.watch('primaryColor')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold">
            {chatbot ? 'Edit Chatbot' : 'Create New Chatbot'}
          </h2>
          <p className="text-muted-foreground">
            {chatbot ? 'Update your chatbot settings' : 'Set up your new AI assistant'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Chatbot Settings</CardTitle>
            <CardDescription>
              Configure your chatbot's appearance and behavior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chatbot Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My AI Assistant" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="welcomeMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Welcome Message</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Hello! How can I help you today?"
                          className="resize-none"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded">
                    {error}
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={onBack}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {chatbot ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      chatbot ? 'Update Chatbot' : 'Create Chatbot'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              See how your chatbot will appear to users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ 
                    background: previewColor,
                    backgroundColor: previewColor.startsWith('linear-gradient') ? undefined : previewColor
                  }}
                >
                  AI
                </div>
                <div>
                  <div className="font-medium text-sm">
                    {form.watch('name') || 'Chatbot Name'}
                  </div>
                  <div className="text-xs text-muted-foreground">Online</div>
                </div>
              </div>
              <div className="bg-background rounded-lg p-3 shadow-sm">
                <p className="text-sm">
                  {form.watch('welcomeMessage') || 'Welcome message will appear here'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}