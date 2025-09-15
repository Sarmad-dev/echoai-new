import { createClient } from "@supabase/supabase-js";

// Database types based on your schema
export interface User {
  id: string;
  email: string;
  apiKey: string;
  plan: "FREE" | "PRO";
  createdAt: string;
  updatedAt: string;
}

export interface Chatbot {
  id: string;
  name: string;
  welcomeMessage: string;
  primaryColor: string;
  isActive: boolean;
  apiKey: string;
  instructions?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  content: string;
  metadata: any;
  embedding?: number[];
  chatbotId: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  chatbotId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  role: "user" | "assistant";
  sentiment?: "positive" | "negative" | "neutral";
  sessionId?: string;
  imageUrl?: string;
  metadata?: any;
  createdAt: string;
}

export interface AutomationWorkflow {
  id: string;
  userId: string;
  chatbotId: string;
  name: string;
  description?: string;
  flowDefinition: any; // JSON type for React Flow definition
  stateMachine: any; // JSON type for XState definition
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Database interface
export interface Database {
  public: {
    Tables: {
      User: {
        Row: User;
        Insert: Omit<User, "id" | "createdAt" | "updatedAt"> & {
          id?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: Partial<Omit<User, "id" | "createdAt" | "updatedAt">>;
      };
      Chatbot: {
        Row: Chatbot;
        Insert: Omit<Chatbot, "id" | "createdAt" | "updatedAt"> & {
          id?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: Partial<Omit<Chatbot, "id" | "createdAt" | "updatedAt">>;
      };
      Document: {
        Row: Document;
        Insert: Omit<Document, "id" | "createdAt"> & {
          id?: string;
          createdAt?: string;
        };
        Update: Partial<Omit<Document, "id" | "createdAt">>;
      };
      Conversation: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "createdAt" | "updatedAt"> & {
          id?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: Partial<Omit<Conversation, "id" | "createdAt" | "updatedAt">>;
      };
      Message: {
        Row: Message;
        Insert: Omit<Message, "id" | "createdAt"> & {
          id?: string;
          createdAt?: string;
        };
        Update: Partial<Omit<Message, "id" | "createdAt">>;
      };
      AutomationWorkflow: {
        Row: AutomationWorkflow;
        Insert: Omit<AutomationWorkflow, "id" | "createdAt" | "updatedAt"> & {
          id?: string;
          createdAt?: string;
          updatedAt?: string;
        };
        Update: Partial<Omit<AutomationWorkflow, "id" | "createdAt" | "updatedAt">>;
      };
    };
  };
}

// Create typed Supabase client
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side client with service role key
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
