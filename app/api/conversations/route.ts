import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'edge';

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

    for (const conv of conversations || []) {
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', (conv as any).id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      (conv as any).preview = lastMessage ? (lastMessage as any).content.slice(0, 100) : '';
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
