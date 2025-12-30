export function createSSEStream(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
) {
  return {
    sendEvent(data: string, event?: string) {
      if (event) {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
      }
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    },

    sendError(error: string) {
      controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`));
    },

    close() {
      controller.close();
    },
  };
}

export function streamToSSE(
  onStreamReady: (stream: ReturnType<typeof createSSEStream>) => Promise<void>
): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const stream = createSSEStream(controller, encoder);
      
      try {
        await onStreamReady(stream);
        stream.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        stream.sendError(errorMessage);
        stream.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
