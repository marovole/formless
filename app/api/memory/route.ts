import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');
    const conversationId = searchParams.get('conversationId');

    if (!userIdParam && !conversationId) {
      return NextResponse.json({ error: 'userId or conversationId required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (userIdParam && userIdParam !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (conversationId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    let query = supabase
      .from('key_quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (userIdParam) {
      query = query.eq('user_id', user.id);
    }

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    const { data: quotes, error } = await query;

    if (error) {
      throw error;
    }

    let profile = null;
    if (userIdParam) {
      const { data: userData } = await supabase
        .from('users')
        .select('profile')
        .eq('id', user.id)
        .single();

      profile = userData?.profile as Record<string, unknown> | null;
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
