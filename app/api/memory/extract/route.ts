// @ts-nocheck - Supabase type system limitation with dynamic updates
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getAvailableApiKey } from '@/lib/api-keys/manager';
import { streamChatCompletion } from '@/lib/llm/openrouter';
import { ExtractRequestSchema } from '@/lib/validation/schemas';


interface ExtractRequest {
  conversationId: string;
  userId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = ExtractRequestSchema.safeParse(body);

    if (!validationResult.success) {
      const errors: Record<string, string[]> = {};
      validationResult.error.issues.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) {
          errors[path] = [];
        }
        errors[path].push(err.message);
      });
      return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
    }

    const { conversationId, userId }: ExtractRequest = validationResult.data;

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (userId && userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages found' }, { status: 404 });
    }

    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const extractionPrompt = `分析以下对话，提取用户的关键信息、重要原话和性格特点。以JSON格式返回：
{
  "key_quotes": ["重要原话1", "重要原话2"],
  "insights": {
    "personality": "性格特点",
    "interests": ["兴趣1", "兴趣2"],
    "concerns": ["关注点1", "关注点2"]
  }
}

对话内容：
${conversationText}`;

    const apiKey = await getAvailableApiKey('openrouter');
    if (!apiKey) {
      return NextResponse.json({ error: 'No available API key' }, { status: 500 });
    }

    let extractedData = '';

    await streamChatCompletion(apiKey.key, {
      messages: [
        { role: 'system', content: 'You are a memory extraction assistant.' },
        { role: 'user', content: extractionPrompt },
      ],
      onChunk: (chunk) => {
        extractedData += chunk;
      },
      onComplete: async (fullText) => {
        try {
          const parsed = JSON.parse(fullText);

          if (parsed.key_quotes && Array.isArray(parsed.key_quotes)) {
            for (const quote of parsed.key_quotes) {
              await supabase.from('key_quotes')
                .insert([{
                  conversation_id: conversationId,
                  user_id: user.id,
                  quote_text: quote,
                }]);
            }
          }

          if (parsed.insights) {
            const { data: existingUser } = await supabase
              .from('users')
              .select('profile')
              .eq('id', user.id)
              .single();

            const currentProfile = existingUser?.profile || {};
            const updatedProfile = {
              ...currentProfile,
              ...parsed.insights,
            };

            await supabase
              .from('users')
              .update({ profile: updatedProfile })
              .eq('id', user.id);
          }
        } catch (parseError) {
          console.error('Failed to parse extraction result:', parseError);
        }
      },
      onError: (error) => {
        console.error('Extraction error:', error);
      },
    });

    return NextResponse.json({ success: true, extracted: extractedData });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
