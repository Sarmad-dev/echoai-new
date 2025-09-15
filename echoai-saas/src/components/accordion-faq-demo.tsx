"use client";

import * as React from "react";
import { AccordionFAQ, FAQ } from "@/components/accordion-faq";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Sample FAQ data for demonstration
const sampleFAQs: FAQ[] = [
  {
    id: "1",
    question: "How do I get started with EchoAI?",
    answer: "Getting started with EchoAI is simple! First, create an account, then upload your documents or provide training instructions. Our AI will learn from your content and be ready to assist your customers within minutes.",
    category: "Getting Started",
    tags: ["setup", "onboarding", "basics"],
    popularity: 45,
    lastUpdated: new Date("2024-01-15"),
  },
  {
    id: "2",
    question: "What types of documents can I upload?",
    answer: "EchoAI supports various document formats including PDF, Word documents, text files, and web pages. You can also provide custom training instructions to teach the AI about your specific business processes and tone.",
    category: "Documents",
    tags: ["upload", "formats", "training"],
    popularity: 32,
    lastUpdated: new Date("2024-01-10"),
  },
  {
    id: "3",
    question: "How does the chatbot learn from my content?",
    answer: "Our AI uses advanced natural language processing to understand your documents and instructions. It creates embeddings that capture the meaning and context, allowing it to provide accurate, relevant responses to customer questions.",
    category: "AI Technology",
    tags: ["learning", "AI", "embeddings"],
    popularity: 28,
    lastUpdated: new Date("2024-01-12"),
  },
  {
    id: "4",
    question: "Can I customize the chatbot's appearance?",
    answer: "Yes! You can customize the chatbot's colors, welcome message, and branding to match your website. The widget is fully responsive and integrates seamlessly with your existing design.",
    category: "Customization",
    tags: ["design", "branding", "colors"],
    popularity: 21,
    lastUpdated: new Date("2024-01-08"),
  },
  {
    id: "5",
    question: "Is my data secure with EchoAI?",
    answer: "Absolutely. We use enterprise-grade security measures including encryption at rest and in transit, secure data centers, and strict access controls. Your data is never shared with third parties.",
    category: "Security",
    tags: ["security", "privacy", "encryption"],
    popularity: 38,
    lastUpdated: new Date("2024-01-14"),
  },
  {
    id: "6",
    question: "How much does EchoAI cost?",
    answer: "EchoAI offers flexible pricing plans to suit businesses of all sizes. We have a free tier for getting started, and paid plans that scale with your usage. Contact us for enterprise pricing.",
    category: "Pricing",
    tags: ["cost", "pricing", "plans"],
    popularity: 42,
    lastUpdated: new Date("2024-01-13"),
  },
  {
    id: "7",
    question: "Can the chatbot handle multiple languages?",
    answer: "Yes, EchoAI supports multiple languages. You can train it with content in different languages, and it will respond appropriately based on the customer's language preference.",
    category: "Features",
    tags: ["languages", "multilingual", "international"],
    popularity: 15,
    lastUpdated: new Date("2024-01-09"),
  },
  {
    id: "8",
    question: "What happens if the chatbot doesn't know an answer?",
    answer: "When the chatbot encounters a question it can't answer confidently, it will gracefully escalate to human support or provide related information that might be helpful. It never gives incorrect information.",
    category: "Features",
    tags: ["escalation", "fallback", "support"],
    popularity: 25,
    lastUpdated: new Date("2024-01-11"),
  },
];

export function AccordionFAQDemo() {
  const handleFAQSelect = (faq: FAQ) => {
    console.log("FAQ selected:", faq);
    alert(`You selected: ${faq.question}`);
  };

  const handleStartChat = () => {
    console.log("Start chat clicked");
    alert("Starting chat conversation...");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Accordion FAQ Component Demo</h1>
        <p className="text-muted-foreground">
          Interactive FAQ component with search, filtering, and analytics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Default Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Default Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <AccordionFAQ
              faqs={sampleFAQs}
              chatbotId="demo-chatbot"
              onFAQSelect={handleFAQSelect}
              onStartChat={handleStartChat}
              primaryColor="#3b82f6"
            />
          </CardContent>
        </Card>

        {/* Customized Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Customized Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <AccordionFAQ
              faqs={sampleFAQs}
              chatbotId="demo-chatbot-2"
              searchable={true}
              categorized={false}
              allowMultipleOpen={false}
              onFAQSelect={handleFAQSelect}
              onStartChat={handleStartChat}
              primaryColor="#10b981"
              maxHeight="300px"
              showPopularity={false}
              enableChatIntegration={false}
            />
          </CardContent>
        </Card>
      </div>

      {/* Minimal Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Minimal Configuration (No Search, No Categories)</CardTitle>
        </CardHeader>
        <CardContent>
          <AccordionFAQ
            faqs={sampleFAQs.slice(0, 4)}
            chatbotId="demo-chatbot-3"
            searchable={false}
            categorized={false}
            onFAQSelect={handleFAQSelect}
            primaryColor="#f59e0b"
            showPopularity={false}
          />
        </CardContent>
      </Card>

      {/* Empty State */}
      <Card>
        <CardHeader>
          <CardTitle>Empty State</CardTitle>
        </CardHeader>
        <CardContent>
          <AccordionFAQ
            faqs={[]}
            chatbotId="demo-chatbot-4"
            onStartChat={handleStartChat}
            primaryColor="#ef4444"
          />
        </CardContent>
      </Card>
    </div>
  );
}