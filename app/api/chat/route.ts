import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { getAvailableApiKey } from '@/lib/api-keys/manager';
import { getActivePrompt } from '@/lib/prompts/manager';
import { streamChatCompletion } from '@/lib/llm/chutes';
import { streamToSSE } from '@/lib/llm/streaming';
import type { ChatMessage } from '@/lib/llm/chutes';

export const runtime = 'edge';

interface ChatRequest {
  message: string;
  conversationId?: string;
  language?: 'zh' | 'en';
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationId, language = 'zh' }: ChatRequest = await request.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdminClient();

    let activeConversationId = conversationId;
    let conversationHistory: ChatMessage[] = [];

    if (activeConversationId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });

      if (messages) {
        conversationHistory = messages.map((msg: any) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        }));
      }
    } else {
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        // @ts-ignore - Supabase generated types issue with Insert
        .insert([{ language }])
        .select('id')
        .single();

      if (convError || !newConversation) {
        throw new Error('Failed to create conversation');
      }

      activeConversationId = (newConversation as any).id;
    }

    const apiKey = await getAvailableApiKey('chutes');
    if (!apiKey) {
      throw new Error('No available Chutes API key');
    }

    const systemPrompt = await getActivePrompt('formless_elder', language);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt?.content || '' },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    await supabase.from('messages')
      // @ts-ignore - Supabase generated types issue with Insert
      .insert([
        {
          conversation_id: activeConversationId,
          role: 'user',
          content: message,
        },
      ]);

    return streamToSSE(async (stream) => {
      let fullResponse = '';
      let tokenCount = 0;

      stream.sendEvent(JSON.stringify({ conversationId: activeConversationId }), 'metadata');

      await streamChatCompletion((apiKey as any).key, {
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        onChunk: (chunk) => {
          fullResponse += chunk;
          tokenCount++;
          stream.sendEvent(JSON.stringify({ content: chunk }), 'chunk');
        },
        onComplete: async () => {
          await supabase.from('messages')
            // @ts-ignore - Supabase generated types issue with Insert
            .insert([
              {
                conversation_id: activeConversationId,
                role: 'assistant',
                content: fullResponse,
              },
            ]);

          await supabase.from('api_usage')
            // @ts-ignore - Supabase generated types issue with Insert
            .insert([
              {
                api_key_id: (apiKey as any).id,
                tokens_used: tokenCount,
                request_type: 'chat_completion',
              },
            ]);

          stream.sendEvent(JSON.stringify({ done: true }), 'complete');
        },
        onError: (error) => {
          stream.sendError(error.message);
        },
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
