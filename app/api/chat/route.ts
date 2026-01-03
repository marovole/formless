// @ts-nocheck - Supabase type system limitation with dynamic queries
import { NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getAvailableApiKey } from '@/lib/api-keys/manager';
import { getActivePrompt } from '@/lib/prompts/manager';
import { streamChatCompletion } from '@/lib/llm/chutes';
import { streamToSSE } from '@/lib/llm/streaming';
import { ChatSchema } from '@/lib/validation/schemas';
import type { ChatMessage } from '@/lib/llm/chutes';


export async function POST(request: NextRequest) {
  try {
    // 1. Verify user authentication
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate request body
    const body = await request.json()
    const validationResult = ChatSchema.safeParse(body)

    if (!validationResult.success) {
      const errors: Record<string, string[]> = {}
      validationResult.error.issues.forEach((err) => {
        const path = err.path.join('.')
        if (!errors[path]) errors[path] = []
        errors[path].push(err.message)
      })
      return new Response(JSON.stringify({ error: 'Validation failed', errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { message, conversationId, language = 'zh' } = validationResult.data

    let activeConversationId = conversationId;
    let conversationHistory: ChatMessage[] = [];

    if (activeConversationId) {
      // Verify the conversation belongs to this user
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('id, user_id')
        .eq('id', activeConversationId)
        .single();

      if (convError || !conversation) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if ((conversation as any).user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: true });

      if (messages) {
        conversationHistory = messages.map((msg) => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        }));
      }
    } else {
      // Create new conversation with user_id
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert([{
          user_id: user.id,
          language,
          title: message.slice(0, 50),
        }])
        .select('id')
        .single();

      if (convError || !newConversation) {
        console.error('Conversation creation error:', convError);
        throw new Error(`Failed to create conversation: ${convError?.message || 'unknown error'}`);
      }

      activeConversationId = newConversation.id;
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

      await streamChatCompletion(apiKey.key, {
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
            .insert([
              {
                conversation_id: activeConversationId,
                role: 'assistant',
                content: fullResponse,
              },
            ]);

          await supabase.from('api_usage')
            .insert([
              {
                api_key_id: apiKey.id,
                user_id: user.id,
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
