import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');

    if (!userId && !conversationId) {
      return NextResponse.json({ error: 'userId or conversationId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('key_quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data: quotes, error } = await query;

    if (error) {
      throw error;
    }

    let profile = null;
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('profile')
        .eq('id', userId)
        .single();

      profile = (userData as any)?.profile;
    }

    return NextResponse.json({
      quotes: quotes || [],
      profile: profile || {},
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
