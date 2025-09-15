
'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Upload, X, FileText, Link as LinkIcon, Loader2, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

// Form validation schema
const dataConnectionSchema = z.object({
  urls: z.array(z.string().url('Please enter a valid URL')).optional(),
  files: z.array(z.instanceof(File)).optional(),
  instructions: z.string().optional(),
}).refine(
  (data) => (data.urls && data.urls.length > 0) || (data.files && data.files.length > 0) || (data.instructions && data.instructions.trim().length > 0),
  {
    message: 'Please provide at least one URL, upload at least one file, or add training instructions',
    path: ['root'],
  }
)

type DataConnectionFormData = z.infer<typeof dataConnectionSchema>

interface DataConnectionFormProps {
  onSubmit: (data: DataConnectionFormData) => Promise<void>
}

interface UploadedFile {
  file: File
  id: string
}

export function DataConnectionForm({ onSubmit }: DataConnectionFormProps) {
  const [urls, setUrls] = useState<string[]>([])
  const [currentUrl, setCurrentUrl] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [instructions, setInstructions] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState('')

  const form = useForm<DataConnectionFormData>({
    resolver: zodResolver(dataConnectionSchema),
    defaultValues: {
      urls: [],
      files: [],
      instructions: '',
    },
  })

  // URL handling
  const addUrl = () => {
    if (currentUrl && !urls.includes(currentUrl)) {
      try {
        new URL(currentUrl) // Validate URL
        setUrls([...urls, currentUrl])
        setCurrentUrl('')
        form.setValue('urls', [...urls, currentUrl])
      } catch {
        // Invalid URL - form validation will handle this
      }
    }
  }

  const removeUrl = (urlToRemove: string) => {
    const newUrls = urls.filter(url => url !== urlToRemove)
    setUrls(newUrls)
    form.setValue('urls', newUrls)
  }

  const handleUrlKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addUrl()
    }
  }

  // File handling
  const validateFile = useCallback((file: File): boolean => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!allowedTypes.includes(file.type)) {
      setSubmitStatus('error')
      setSubmitMessage('Only PDF and DOCX files are allowed')
      return false
    }

    if (file.size > maxSize) {
      setSubmitStatus('error')
      setSubmitMessage('File size must be less than 10MB')
      return false
    }

    return true
  }, [])

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: UploadedFile[] = []

    fileArray.forEach(file => {
      if (validateFile(file)) {
        // Check if file already exists
        const exists = uploadedFiles.some(uf => uf.file.name === file.name && uf.file.size === file.size)
        if (!exists) {
          validFiles.push({
            file,
            id: Math.random().toString(36).substr(2, 9)
          })
        }
      }
    })

    if (validFiles.length > 0) {
      const newUploadedFiles = [...uploadedFiles, ...validFiles]
      setUploadedFiles(newUploadedFiles)
      form.setValue('files', newUploadedFiles.map(uf => uf.file))
      setSubmitStatus('idle')
      setSubmitMessage('')
    }
  }, [uploadedFiles, form, validateFile])

  const removeFile = (fileId: string) => {
    const newUploadedFiles = uploadedFiles.filter(uf => uf.id !== fileId)
    setUploadedFiles(newUploadedFiles)
    form.setValue('files', newUploadedFiles.map(uf => uf.file))
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      addFiles(files)
    }
  }, [addFiles])

  // File input handler
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      addFiles(files)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }

  // Form submission
  const handleSubmit = async (_data: DataConnectionFormData) => {
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setSubmitMessage('')

    try {
      await onSubmit({
        urls: urls.length > 0 ? urls : undefined,
        files: uploadedFiles.length > 0 ? uploadedFiles.map(uf => uf.file) : undefined,
        instructions: instructions.trim() || undefined,
      })
      
      setSubmitStatus('success')
      setSubmitMessage('Chatbot training completed successfully!')
      
      // Reset form
      setUrls([])
      setUploadedFiles([])
      setCurrentUrl('')
      setInstructions('')
      form.reset()
    } catch (error) {
      setSubmitStatus('error')
      setSubmitMessage(error instanceof Error ? error.message : 'Failed to train chatbot. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-4 w-4 text-red-500" />
    }
    return <FileText className="h-4 w-4 text-blue-500" />
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* URL Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Website URLs
            </CardTitle>
            <CardDescription>
              Add website URLs to extract content for your chatbot training
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyPress={handleUrlKeyPress}
                className="flex-1"
              />
              <Button 
                type="button" 
                onClick={addUrl}
                disabled={!currentUrl}
                variant="outline"
              >
                Add URL
              </Button>
            </div>
            
            {urls.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Added URLs:</p>
                <div className="flex flex-wrap gap-2">
                  {urls.map((url, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" />
                      <span className="max-w-[200px] truncate">{url}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1"
                        onClick={() => removeUrl(url)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              File Upload
            </CardTitle>
            <CardDescription>
              Upload PDF and DOCX files to train your chatbot (Max 10MB per file)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  Drag and drop files here, or{' '}
                  <label className="text-primary cursor-pointer hover:underline">
                    browse files
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports PDF and DOCX files up to 10MB each
                </p>
              </div>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploaded Files:</p>
                <div className="space-y-2">
                  {uploadedFiles.map((uploadedFile) => (
                    <div
                      key={uploadedFile.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(uploadedFile.file)}
                        <div>
                          <p className="text-sm font-medium">{uploadedFile.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(uploadedFile.file.size)}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadedFile.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training Instructions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Training Instructions
            </CardTitle>
            <CardDescription>
              Define how your chatbot should behave, respond, and interact with users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Example: You are a helpful customer support assistant for [Company Name]. Always be polite, professional, and empathetic. When answering questions:

1. Use the knowledge from uploaded documents to provide accurate information
2. If you don't know something, politely say so and suggest contacting support
3. Always maintain a friendly and helpful tone
4. Provide step-by-step guidance when possible
5. Ask clarifying questions if the user's request is unclear

Contact information: support@company.com | Phone: (555) 123-4567"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-[160px] resize-y"
            />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                💡 Tips for effective instructions:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                <li>• Define your chatbot's role and personality</li>
                <li>• Specify how to handle unknown questions</li>
                <li>• Include contact information for escalation</li>
                <li>• Set tone and communication style guidelines</li>
                <li>• Provide examples of good responses</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Form Errors */}
        {form.formState.errors.root && (
          <div className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          </div>
        )}

        {/* Submit Status Messages */}
        {submitStatus !== 'idle' && (
          <div className={`flex items-center gap-2 p-3 border rounded-lg ${
            submitStatus === 'success' 
              ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-destructive/50 bg-destructive/10 text-destructive'
          }`}>
            {submitStatus === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <p className="text-sm">{submitMessage}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button 
          type="submit" 
          className="w-full" 
          size="lg"
          disabled={isSubmitting || (urls.length === 0 && uploadedFiles.length === 0 && !instructions.trim())}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Training Chatbot...
            </>
          ) : (
            'Train Chatbot'
          )}
        </Button>
      </form>
    </Form>
  )
}