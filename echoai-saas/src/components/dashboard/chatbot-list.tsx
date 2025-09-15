'use client'

import { useState, useEffect } from 'react'
import { Plus, Settings, Trash2, MessageSquare, FileText, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog'
import type { ChatbotData } from '@/types/api'

interface ChatbotListProps {
  onSelectChatbot: (chatbot: ChatbotData) => void
  onCreateChatbot: () => void
  onEditChatbot: (chatbot: ChatbotData) => void
}

interface ChatbotsResponse {
  chatbots: ChatbotData[]
  limits: {
    maxChatbots: number
    currentCount: number
  }
}

export function ChatbotList({ onSelectChatbot, onCreateChatbot, onEditChatbot }: ChatbotListProps) {
  const [chatbots, setChatbots] = useState<ChatbotData[]>([])
  const [limits, setLimits] = useState({ maxChatbots: 1, currentCount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [chatbotToDelete, setChatbotToDelete] = useState<ChatbotData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadChatbots = async () => {
    try {
      const response = await fetch('/api/chatbots')
      if (response.ok) {
        const data: ChatbotsResponse = await response.json()
        setChatbots(data.chatbots)
        setLimits(data.limits)
      }
    } catch (error) {
      console.error('Failed to load chatbots:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadChatbots()
  }, [])

  const handleDeleteChatbot = async () => {
    if (!chatbotToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/chatbots/${chatbotToDelete.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setChatbots(prev => prev.filter(c => c.id !== chatbotToDelete.id))
        setLimits(prev => ({ ...prev, currentCount: prev.currentCount - 1 }))
      }
    } catch (error) {
      console.error('Failed to delete chatbot:', error)
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setChatbotToDelete(null)
    }
  }

  const openDeleteDialog = (chatbot: ChatbotData) => {
    setChatbotToDelete(chatbot)
    setDeleteDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Your Chatbots</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Chatbots</h2>
            <p className="text-muted-foreground">
              {limits.currentCount} of {limits.maxChatbots} chatbots used
            </p>
          </div>
          <Button 
            onClick={onCreateChatbot}
            disabled={limits.currentCount >= limits.maxChatbots}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Chatbot
          </Button>
        </div>

        {chatbots.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No chatbots yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first chatbot to get started with AI-powered customer support.
              </p>
              <Button onClick={onCreateChatbot}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Chatbot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {chatbots.map((chatbot) => (
              <Card key={chatbot.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1" onClick={() => onSelectChatbot(chatbot)}>
                      <CardTitle className="text-lg">{chatbot.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {chatbot.welcomeMessage}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditChatbot(chatbot)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Edit Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => openDeleteDialog(chatbot)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent onClick={() => onSelectChatbot(chatbot)}>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>{chatbot._count?.documents || 0} docs</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        <span>{chatbot._count?.conversations || 0} chats</span>
                      </div>
                    </div>
                    <Badge 
                      variant={chatbot.isActive ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {chatbot.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: chatbot.primaryColor }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {limits.currentCount >= limits.maxChatbots && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <p className="text-sm">
                  You've reached your chatbot limit. 
                  {limits.maxChatbots === 1 && (
                    <span className="ml-1">Upgrade to Pro to create up to 3 chatbots.</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chatbot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{chatbotToDelete?.name}"? This will permanently 
              delete the chatbot and all its training data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteChatbot}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}