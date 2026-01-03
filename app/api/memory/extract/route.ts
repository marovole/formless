// @ts-nocheck - Supabase type system limitation with dynamic updates
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getAvailableApiKey } from '@/lib/api-keys/manager';
import { streamChatCompletion } from '@/lib/llm/chutes';


interface ExtractRequest {
  conversationId: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conversationId }: ExtractRequest = await request.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    // 2. Verify conversation belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if ((conversation as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Get messages
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

    const apiKey = await getAvailableApiKey('chutes');
    if (!apiKey) {
      return NextResponse.json({ error: 'No available API key' }, { status: 500 });
    }

    let extractedData = '';

    await streamChatCompletion(apiKey.key, {
      messages: [
        { role: 'system', content: 'You are a memory extraction assistant. Extract key information from conversations and respond in JSON format.' },
        { role: 'user', content: extractionPrompt },
      ],
      onChunk: (chunk) => {
        extractedData += chunk;
      },
      onComplete: async (fullText) => {
        try {
          // Extract JSON from response (may have markdown code blocks)
          const jsonMatch = fullText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) return;

          const parsed = JSON.parse(jsonMatch[0]);

          // Store key quotes
          if (parsed.key_quotes && Array.isArray(parsed.key_quotes)) {
            for (const quote of parsed.key_quotes) {
              await supabase.from('key_quotes').upsert({
                user_id: user.id,
                conversation_id: conversationId,
                quote: quote,
                context: conversationText.slice(0, 500),
                emotion: parsed.insights?.emotion || null,
                topic: parsed.insights?.topic || null,
              }, { onConflict: 'user_id,conversation_id,quote' });
            }
          }

          // Update user profile with insights
          if (parsed.insights) {
            const { data: existingUser } = await supabase
              .from('users')
              .select('profile')
              .eq('id', user.id)
              .single();

            const currentProfile = (existingUser?.profile as Record<string, unknown>) || {};
            const updatedProfile = {
              ...currentProfile,
              personality: parsed.insights.personality || currentProfile.personality,
              interests: parsed.insights.interests || currentProfile.interests || [],
              concerns: parsed.insights.concerns || currentProfile.concerns || [],
              last_memory_update: new Date().toISOString(),
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

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
