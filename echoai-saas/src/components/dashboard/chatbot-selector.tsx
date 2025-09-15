'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem 
} from '@/components/ui/command'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ChatbotData } from '@/types/api'

interface ChatbotSelectorProps {
  selectedChatbotId?: string
  onSelect: (chatbot: ChatbotData) => void
  placeholder?: string
  className?: string
}

export function ChatbotSelector({ 
  selectedChatbotId, 
  onSelect, 
  placeholder = "Select a chatbot...",
  className 
}: ChatbotSelectorProps) {
  const [open, setOpen] = useState(false)
  const [chatbots, setChatbots] = useState<ChatbotData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const selectedChatbot = chatbots.find(c => c.id === selectedChatbotId)

  useEffect(() => {
    const loadChatbots = async () => {
      try {
        const response = await fetch('/api/chatbots')
        if (response.ok) {
          const data = await response.json()
          setChatbots(data.chatbots)
        }
      } catch (error) {
        console.error('Failed to load chatbots:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadChatbots()
  }, [])

  const handleSelect = (chatbot: ChatbotData) => {
    onSelect(chatbot)
    setOpen(false)
  }

  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between"
          disabled
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-muted rounded animate-pulse" />
            <span>Loading chatbots...</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </div>
    )
  }

  if (chatbots.length === 0) {
    return (
      <div className={cn("w-full", className)}>
        <Button
          variant="outline"
          className="w-full justify-between"
          disabled
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span>No chatbots available</span>
          </div>
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedChatbot ? (
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedChatbot.primaryColor }}
                />
                <span>{selectedChatbot.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {selectedChatbot._count?.documents || 0} docs
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span>{placeholder}</span>
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search chatbots..." />
            <CommandEmpty>No chatbots found.</CommandEmpty>
            <CommandGroup>
              {chatbots.map((chatbot) => (
                <CommandItem
                  key={chatbot.id}
                  value={chatbot.name}
                  onSelect={() => handleSelect(chatbot)}
                  className="flex items-center gap-2"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedChatbotId === chatbot.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: chatbot.primaryColor }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{chatbot.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {chatbot._count?.documents || 0} documents • {chatbot._count?.conversations || 0} conversations
                    </div>
                  </div>
                  {!chatbot.isActive && (
                    <Badge variant="secondary" className="text-xs">
                      Inactive
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}