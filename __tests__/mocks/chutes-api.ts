export function createMockChutesStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        const data = JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'deepseek-ai/DeepSeek-V3.2-TEE',
          choices: [{
            index: 0,
            delta: { content: chunk },
            finish_reason: null
          }]
        })
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      const finalData = JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'deepseek-ai/DeepSeek-V3.2-TEE',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      })
      controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })

  return {
    ok: true,
    status: 200,
    body: stream
  } as Response
}

export function createMockChutesErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    text: async () => message
  } as Response
}

export function createMockChutesEmptyResponse() {
  return {
    ok: true,
    status: 200,
    body: null
  } as Response
}
