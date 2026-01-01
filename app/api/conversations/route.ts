// @ts-nocheck - Supabase type system limitation with dynamic queries
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';


interface ConversationPreview {
  id: string;
  created_at: string;
  language: string;
  updated_at: string;
  preview?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('conversations')
      .select('id, created_at, language, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: conversations, error } = await query;

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
        ...conv,
        preview: lastMessage?.content?.slice(0, 100) || '',
      });
    }

    return NextResponse.json({ conversations: conversationsWithPreview });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
