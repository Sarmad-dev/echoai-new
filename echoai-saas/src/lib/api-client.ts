// API client utilities for communicating with Next.js API routes

import type {
  APIError,
  TrainRequest,
  TrainResponse,
  ChatRequest,
  ChatResponse,
  StreamingChatData,
} from "@/types/api";

export class APIClientError extends Error {
  public code?: string;
  public details?: unknown;
  public status: number;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.name = "APIClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class APIClient {
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData: APIError;

      try {
        errorData = await response.json();
      } catch {
        errorData = {
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      throw new APIClientError(
        errorData.message,
        response.status,
        errorData.code,
        errorData.details
      );
    }

    return response.json();
  }

  /**
   * Train the chatbot with new documents (URLs and/or files)
   */
  async train(data: TrainRequest): Promise<TrainResponse> {
    const formData = new FormData();

    // Add URLs if provided
    if (data.urls && data.urls.length > 0) {
      formData.append("urls", JSON.stringify(data.urls));
    }

    // Add files if provided
    if (data.files && data.files.length > 0) {
      data.files.forEach((file) => {
        formData.append("files", file);
      });
    }

    const response = await fetch("/api/train", {
      method: "POST",
      body: formData,
    });

    return this.handleResponse<TrainResponse>(response);
  }

  /**
   * Send a chat message and get a response
   */
  async chat(data: ChatRequest): Promise<ChatResponse> {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return this.handleResponse<ChatResponse>(response);
  }

  /**
   * Send a chat message and get a streaming response
   */
  async chatStream(
    data: ChatRequest,
    onToken: (token: string) => void,
    onMetadata?: (metadata: {
      conversationId: string;
      sentiment: string;
    }) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
        }));

        throw new APIClientError(
          errorData.message,
          response.status,
          errorData.code,
          errorData.details
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body available for streaming");
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onComplete?.();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: StreamingChatData = JSON.parse(line.slice(6));

              if (data.type === "token" && data.content) {
                onToken(data.content);
              } else if (
                data.type === "metadata" &&
                data.conversation_id &&
                data.sentiment
              ) {
                onMetadata?.({
                  conversationId: data.conversation_id,
                  sentiment: data.sentiment,
                });
              } else if (data.type === "done") {
                onComplete?.();
                return;
              }
            } catch (parseError) {
              console.error("Error parsing streaming data:", parseError);
            }
          }
        }
      }
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export utility functions for common operations
export async function trainChatbot(data: TrainRequest): Promise<TrainResponse> {
  return apiClient.train(data);
}

export async function sendChatMessage(
  data: ChatRequest
): Promise<ChatResponse> {
  return apiClient.chat(data);
}

export async function sendStreamingChatMessage(
  data: ChatRequest,
  onToken: (token: string) => void,
  onMetadata?: (metadata: {
    conversationId: string;
    sentiment: string;
  }) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  return apiClient.chatStream(data, onToken, onMetadata, onComplete, onError);
}

// Re-export types for convenience
export type {
  APIError,
  TrainRequest,
  TrainResponse,
  ChatRequest,
  ChatResponse,
  StreamingChatData,
  StreamingCallbacks,
} from "@/types/api";
