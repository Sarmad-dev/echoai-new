import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { useStreamingChat } from '../use-streaming-chat';

// Mock fetch
global.fetch = vi.fn();

// Mock ReadableStream
class MockReadableStream {
  private reader: any;
  
  constructor(private chunks: string[]) {
    this.reader = {
      read: vi.fn().mockImplementation(() => {
        const chunk = this.chunks.shift();
        if (chunk) {
          return Promise.resolve({
            done: false,
            value: new TextEncoder().encode(chunk)
          });
        }
        return Promise.resolve({ done: true });
      }),
      releaseLock: vi.fn()
    };
  }

  getReader() {
    return this.reader;
  }
}

describe('useStreamingChat', () => {
  const mockOptions = {
    apiKey: 'test-api-key',
    chatbotId: 'test-chatbot-id',
    sessionId: 'test-session-id',
    onError: vi.fn(),
    onMessageComplete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fetch as any).mockClear();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useStreamingChat(mockOptions));

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentStreamingMessage).toBe('');
    expect(result.current.streamingMessageId).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('sends streaming message successfully', async () => {
    const mockChunks = [
      'data: {"type":"token","content":"Hello"}\n\n',
      'data: {"type":"token","content":" World"}\n\n',
      'data: {"type":"metadata","conversation_id":"conv-123","sentiment":"positive"}\n\n',
      'data: {"type":"done"}\n\n'
    ];

    const mockResponse = {
      ok: true,
      body: new MockReadableStream(mockChunks)
    };

    (fetch as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat(mockOptions));

    act(() => {
      result.current.sendStreamingMessage('Test message');
    });

    // Should start streaming
    expect(result.current.isStreaming).toBe(true);

    // Wait for streaming to complete
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.currentStreamingMessage).toBe('');
    expect(mockOptions.onMessageComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Hello World',
        role: 'assistant',
        sentiment: 'positive'
      })
    );
  });

  it('handles streaming errors', async () => {
    (fetch as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useStreamingChat(mockOptions));

    await act(async () => {
      await result.current.sendStreamingMessage('Test message');
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(mockOptions.onError).toHaveBeenCalledWith('Network error');
  });

  it('handles HTTP errors', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Server error' })
    };

    (fetch as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat(mockOptions));

    await act(async () => {
      await result.current.sendStreamingMessage('Test message');
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('Server error');
  });

  it('cancels streaming', async () => {
    const mockChunks = [
      'data: {"type":"token","content":"Hello"}\n\n',
      // Streaming will be cancelled before this
      'data: {"type":"token","content":" World"}\n\n',
    ];

    const mockResponse = {
      ok: true,
      body: new MockReadableStream(mockChunks)
    };

    (fetch as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat(mockOptions));

    act(() => {
      result.current.sendStreamingMessage('Test message');
    });

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.cancelStreaming();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentStreamingMessage).toBe('');
  });

  it('prevents multiple concurrent streams', async () => {
    const { result } = renderHook(() => useStreamingChat(mockOptions));

    // Start first stream
    act(() => {
      result.current.sendStreamingMessage('First message');
    });

    expect(result.current.isStreaming).toBe(true);

    // Try to start second stream
    const secondResult = await act(async () => {
      return await result.current.sendStreamingMessage('Second message');
    });

    // Second stream should be rejected
    expect(secondResult).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('clears error state', () => {
    const { result } = renderHook(() => useStreamingChat(mockOptions));

    // Set error state
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBe(null);
  });

  it('includes image URL in request', async () => {
    const mockResponse = {
      ok: true,
      body: new MockReadableStream(['data: {"type":"done"}\n\n'])
    };

    (fetch as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat(mockOptions));

    await act(async () => {
      await result.current.sendStreamingMessage('Test message', 'https://example.com/image.jpg');
    });

    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      body: expect.stringContaining('https://example.com/image.jpg')
    }));
  });

  it('updates streaming message content progressively', async () => {
    const mockChunks = [
      'data: {"type":"token","content":"H"}\n\n',
      'data: {"type":"token","content":"e"}\n\n',
      'data: {"type":"token","content":"l"}\n\n',
      'data: {"type":"token","content":"l"}\n\n',
      'data: {"type":"token","content":"o"}\n\n',
      'data: {"type":"done"}\n\n'
    ];

    const mockResponse = {
      ok: true,
      body: new MockReadableStream(mockChunks)
    };

    (fetch as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useStreamingChat(mockOptions));

    act(() => {
      result.current.sendStreamingMessage('Test message');
    });

    // Wait for streaming to complete
    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(mockOptions.onMessageComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Hello'
      })
    );
  });
});