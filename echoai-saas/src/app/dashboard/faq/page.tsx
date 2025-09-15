"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, HelpCircle, AlertCircle } from "lucide-react";
import { ChatbotSelector } from "@/components/dashboard/chatbot-selector";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

interface Chatbot {
  id: string;
  name: string;
}

export default function FAQManagementPage() {
  const [selectedChatbot, setSelectedChatbot] = useState<Chatbot | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "",
    displayOrder: 0,
  });

  // Load FAQs when chatbot is selected
  useEffect(() => {
    if (selectedChatbot) {
      loadFAQs();
    }
  }, [selectedChatbot]);

  const loadFAQs = async () => {
    if (!selectedChatbot) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/faq?chatbotId=${selectedChatbot.id}`);
      if (response.ok) {
        const data = await response.json();
        setFaqs(data);
      } else {
        throw new Error('Failed to load FAQs');
      }
    } catch (error) {
      console.error('Error loading FAQs:', error);
      setError('Failed to load FAQs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFAQ = () => {
    setEditingFaq(null);
    setFormData({
      question: "",
      answer: "",
      category: "",
      displayOrder: faqs.length,
    });
    setIsDialogOpen(true);
  };

  const handleEditFAQ = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || "",
      displayOrder: faq.displayOrder,
    });
    setIsDialogOpen(true);
  };

  const handleSaveFAQ = async () => {
    if (!selectedChatbot || !formData.question.trim() || !formData.answer.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = editingFaq ? `/api/faq/${editingFaq.id}` : '/api/faq';
      const method = editingFaq ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatbotId: selectedChatbot.id,
          question: formData.question.trim(),
          answer: formData.answer.trim(),
          category: formData.category.trim() || null,
          displayOrder: formData.displayOrder,
        }),
      });

      if (response.ok) {
        await loadFAQs();
        setIsDialogOpen(false);
        setEditingFaq(null);
      } else {
        throw new Error('Failed to save FAQ');
      }
    } catch (error) {
      console.error('Error saving FAQ:', error);
      setError('Failed to save FAQ. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFAQ = async (faqId: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/faq/${faqId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadFAQs();
      } else {
        throw new Error('Failed to delete FAQ');
      }
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      setError('Failed to delete FAQ. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">FAQ Management</h1>
          <p className="text-muted-foreground">
            Manage frequently asked questions for your chatbots
          </p>
        </div>

        {/* Chatbot Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Chatbot</CardTitle>
            <CardDescription>
              Choose a chatbot to manage its FAQs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChatbotSelector
              selectedChatbotId={selectedChatbot?.id}
              onSelect={setSelectedChatbot}
            />
          </CardContent>
        </Card>

        {selectedChatbot && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  FAQs for {selectedChatbot.name}
                </CardTitle>
                <CardDescription>
                  Manage questions and answers that appear in the FAQ tab
                </CardDescription>
              </div>
              <Button onClick={handleCreateFAQ} disabled={isLoading}>
                <Plus className="w-4 h-4 mr-2" />
                Add FAQ
              </Button>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {isLoading && faqs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">Loading FAQs...</div>
                </div>
              ) : faqs.length === 0 ? (
                <div className="text-center py-8">
                  <HelpCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No FAQs yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first FAQ to help users find answers quickly
                  </p>
                  <Button onClick={handleCreateFAQ}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First FAQ
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {faqs.map((faq) => (
                    <div
                      key={faq.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{faq.question}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {faq.answer}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {faq.category && (
                              <Badge variant="secondary" className="text-xs">
                                {faq.category}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Order: {faq.displayOrder}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditFAQ(faq)}
                            disabled={isLoading}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFAQ(faq.id)}
                            disabled={isLoading}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* FAQ Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingFaq ? 'Edit FAQ' : 'Create New FAQ'}
              </DialogTitle>
              <DialogDescription>
                {editingFaq
                  ? 'Update the question and answer'
                  : 'Add a new frequently asked question'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="question">Question *</Label>
                <Input
                  id="question"
                  value={formData.question}
                  onChange={(e) =>
                    setFormData({ ...formData, question: e.target.value })
                  }
                  placeholder="What is your question?"
                />
              </div>
              <div>
                <Label htmlFor="answer">Answer *</Label>
                <Textarea
                  id="answer"
                  value={formData.answer}
                  onChange={(e) =>
                    setFormData({ ...formData, answer: e.target.value })
                  }
                  placeholder="Provide a helpful answer..."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g., General, Support"
                  />
                </div>
                <div>
                  <Label htmlFor="displayOrder">Display Order</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        displayOrder: parseInt(e.target.value) || 0,
                      })
                    }
                    min="0"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveFAQ} disabled={isLoading}>
                {isLoading ? 'Saving...' : editingFaq ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}