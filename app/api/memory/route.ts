// @ts-nocheck - Supabase type system limitation with dynamic queries
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';


export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '10');
    const topic = searchParams.get('topic') || undefined;

    // 2. Build query for user's memories
    let query = supabase
      .from('key_quotes')
      .select('id, quote, context, emotion, topic, created_at, conversation_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    if (topic) {
      query = query.ilike('topic', `%${topic}%`);
    }

    const { data: memories, error } = await query;

    if (error) {
      throw error;
    }

    // 3. Get user profile insights
    const { data: userData } = await supabase
      .from('users')
      .select('profile')
      .eq('id', user.id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = ((userData as any)?.profile as Record<string, unknown>) || {};

    return NextResponse.json({
      quotes: memories || [],
      insights: {
        personality: profile.personality,
        interests: profile.interests || [],
        concerns: profile.concerns || [],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
