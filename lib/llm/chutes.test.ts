import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamChatCompletion, ChatMessage } from './chutes'
import { createMockChutesStreamResponse, createMockChutesErrorResponse, createMockChutesEmptyResponse } from '@/__tests__/mocks/chutes-api'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('streamChatCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockFetch.mockReset()
  })

  it('should successfully stream chat completion with multiple chunks', async () => {
    // Arrange
    const apiKey = 'test-api-key'
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello!' }
    ]
    const chunks = ['Hello', ' there', '!']
    const mockResponse = createMockChutesStreamResponse(chunks)
    mockFetch.mockResolvedValue(mockResponse)

    const receivedChunks: string[] = []
    let completedText = ''

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onChunk: (chunk) => receivedChunks.push(chunk),
      onComplete: (text) => completedText = text
    })

    // Assert
    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.chutes.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: expect.stringContaining('"stream":true')
      })
    )
    expect(receivedChunks).toEqual(chunks)
    expect(completedText).toBe('Hello there!')
  })

  it('should handle API error response (401)', async () => {
    // Arrange
    const apiKey = 'invalid-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test' }
    ]
    const mockResponse = createMockChutesErrorResponse(401, 'Unauthorized')
    mockFetch.mockResolvedValue(mockResponse)

    const errorCallback = vi.fn()

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onError: errorCallback
    })

    // Assert
    expect(errorCallback).toHaveBeenCalled()
    expect(errorCallback.mock.calls[0][0].message).toContain('401')
  })

  it('should handle API error response (500)', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test' }
    ]
    const mockResponse = createMockChutesErrorResponse(500, 'Internal Server Error')
    mockFetch.mockResolvedValue(mockResponse)

    const errorCallback = vi.fn()

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onError: errorCallback
    })

    // Assert
    expect(errorCallback).toHaveBeenCalled()
    expect(errorCallback.mock.calls[0][0].message).toContain('500')
  })

  it('should handle empty response body', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test' }
    ]
    const mockResponse = createMockChutesEmptyResponse()
    mockFetch.mockResolvedValue(mockResponse)

    const errorCallback = vi.fn()

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onError: errorCallback
    })

    // Assert
    expect(errorCallback).toHaveBeenCalled()
    expect(errorCallback.mock.calls[0][0].message).toBe('No response body')
  })

  it('should call onChunk callback for each chunk', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Tell me a story' }
    ]
    const chunks = ['Once', ' upon', ' a', ' time']
    const mockResponse = createMockChutesStreamResponse(chunks)
    mockFetch.mockResolvedValue(mockResponse)

    const onChunk = vi.fn()

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onChunk
    })

    // Assert
    expect(onChunk).toHaveBeenCalledTimes(4)
    expect(onChunk).toHaveBeenNthCalledWith(1, 'Once')
    expect(onChunk).toHaveBeenNthCalledWith(2, ' upon')
    expect(onChunk).toHaveBeenNthCalledWith(3, ' a')
    expect(onChunk).toHaveBeenNthCalledWith(4, ' time')
  })

  it('should call onComplete callback with full text', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Say hello' }
    ]
    const chunks = ['Hi', ' there']
    const mockResponse = createMockChutesStreamResponse(chunks)
    mockFetch.mockResolvedValue(mockResponse)

    const onComplete = vi.fn()

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onComplete
    })

    // Assert
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('Hi there')
  })

  it('should call onError callback on network error', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test' }
    ]
    const networkError = new Error('Network error')
    mockFetch.mockRejectedValue(networkError)

    const onError = vi.fn()

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onError
    })

    // Assert
    expect(onError).toHaveBeenCalledWith(networkError)
  })

  it('should handle custom temperature and max_tokens', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test' }
    ]
    const mockResponse = createMockChutesStreamResponse(['test'])
    mockFetch.mockResolvedValue(mockResponse)

    const temperature = 0.5
    const maxTokens = 1000

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      temperature,
      max_tokens: maxTokens
    })

    // Assert
    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.chutes.ai/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining(`"temperature":${temperature}`)
      })
    )
    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm.chutes.ai/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining(`"max_tokens":${maxTokens}`)
      })
    )
  })

  it('should work without callbacks', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test' }
    ]
    const mockResponse = createMockChutesStreamResponse(['OK'])
    mockFetch.mockResolvedValue(mockResponse)

    // Act & Assert - should not throw
    await expect(streamChatCompletion(apiKey, { messages }))
      .resolves.toBeUndefined()
  })

  it('should handle single chunk response', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test' }
    ]
    const chunks = ['Single response']
    const mockResponse = createMockChutesStreamResponse(chunks)
    mockFetch.mockResolvedValue(mockResponse)

    const onComplete = vi.fn()

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onComplete
    })

    // Assert
    expect(onComplete).toHaveBeenCalledWith('Single response')
  })

  it('should handle empty chunks', async () => {
    // Arrange
    const apiKey = 'test-key'
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Test' }
    ]
    const chunks: string[] = []
    const mockResponse = createMockChutesStreamResponse(chunks)
    mockFetch.mockResolvedValue(mockResponse)

    const onComplete = vi.fn()

    // Act
    await streamChatCompletion(apiKey, {
      messages,
      onComplete
    })

    // Assert
    expect(onComplete).toHaveBeenCalledWith('')
  })
})
