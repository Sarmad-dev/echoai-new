'use client'

import Link from 'next/link'
import { ArrowRight, Database, Palette, Code, CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface WelcomeStateProps {
  hasData?: boolean
  hasCustomization?: boolean
  hasEmbedCode?: boolean
}

export function WelcomeState({ 
  hasData = false, 
  hasCustomization = false, 
  hasEmbedCode = false 
}: WelcomeStateProps) {
  const steps = [
    {
      title: 'Connect Your Data',
      description: 'Upload documents or connect website URLs to train your chatbot',
      href: '/dashboard/data',
      icon: Database,
      completed: hasData,
      primary: !hasData,
    },
    {
      title: 'Customize Your Chatbot',
      description: 'Set your chatbot name, welcome message, and brand colors',
      href: '/dashboard/customize',
      icon: Palette,
      completed: hasCustomization,
      primary: hasData && !hasCustomization,
    },
    {
      title: 'Get Embed Code',
      description: 'Copy the embed code to add your chatbot to your website',
      href: '/dashboard/embed',
      icon: Code,
      completed: hasEmbedCode,
      primary: hasData && hasCustomization && !hasEmbedCode,
    },
  ]

  const completedSteps = steps.filter(step => step.completed).length
  const totalSteps = steps.length

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Welcome to EchoAI! 🎉</h1>
        <p className="text-muted-foreground text-lg">
          Let&apos;s get your AI chatbot set up in just a few steps
        </p>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Setup Progress
            <span className="text-sm font-normal text-muted-foreground">
              ({completedSteps}/{totalSteps} completed)
            </span>
          </CardTitle>
          <CardDescription>
            Follow these steps to get your chatbot up and running
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full bg-secondary rounded-full h-2 mb-4">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {completedSteps === totalSteps 
              ? "🎉 All set! Your chatbot is ready to use."
              : `${totalSteps - completedSteps} step${totalSteps - completedSteps !== 1 ? 's' : ''} remaining`
            }
          </p>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        {steps.map((step, index) => (
          <Card 
            key={step.href} 
            className={`transition-all duration-200 ${
              step.primary 
                ? 'ring-2 ring-primary shadow-lg' 
                : step.completed 
                ? 'bg-muted/50' 
                : 'hover:shadow-md'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    step.completed 
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      : step.primary
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.completed ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <step.icon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      Step {index + 1}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="mb-4">
                {step.description}
              </CardDescription>
              <Button 
                asChild 
                variant={step.primary ? 'default' : step.completed ? 'secondary' : 'outline'}
                className="w-full"
              >
                <Link href={step.href} className="flex items-center gap-2">
                  {step.completed ? 'Review' : step.primary ? 'Get Started' : 'Set Up'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Tips */}
      <Card>
        <CardHeader>
          <CardTitle>💡 Quick Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <p className="text-sm">
              <strong>Data Sources:</strong> You can upload PDFs, DOCX files, or connect website URLs. The more relevant content you provide, the better your chatbot will perform.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <p className="text-sm">
              <strong>Customization:</strong> Make your chatbot match your brand by setting custom colors, names, and welcome messages.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
            <p className="text-sm">
              <strong>Embedding:</strong> Once set up, you can embed your chatbot on any website with just a simple JavaScript snippet.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}