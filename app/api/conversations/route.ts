// @ts-nocheck - Supabase type system limitation with dynamic queries
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';


interface ConversationPreview {
  id: string;
  created_at: string;
  language: string;
  updated_at: string;
  preview?: string;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Verify user authentication
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Only return conversations for the authenticated user
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, created_at, language, updated_at, title')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const conversationsWithPreview: ConversationPreview[] = [];

    for (const conv of conversations || []) {
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      conversationsWithPreview.push({
        id: conv.id,
        created_at: conv.created_at,
        language: conv.language,
        updated_at: conv.updated_at,
        preview: lastMessage?.content?.slice(0, 100) || conv.title || '',
      });
    }

    return NextResponse.json({ conversations: conversationsWithPreview });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
