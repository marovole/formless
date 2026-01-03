import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Verify user authentication
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify the conversation belongs to this user
    const { data: conversation, error: convCheckError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (convCheckError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((conversation as any).user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Delete related records in transaction-like manner
    // Messages
    await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', id);

    // Key quotes (memories) - can be optionally preserved
    // Uncomment below to preserve memories even when conversation is deleted
    // await supabase
    //   .from('key_quotes')
    //   .update({ conversation_id: null })
    //   .eq('conversation_id', id);
    await supabase
      .from('key_quotes')
      .delete()
      .eq('conversation_id', id);

    // Guanzhao trigger history
    await supabase
      .from('guanzhao_trigger_history')
      .delete()
      .eq('conversation_id', id);

    // API usage records
    await supabase
      .from('api_usage')
      .delete()
      .eq('conversation_id', id);

    // 4. Delete the conversation
    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (convError) {
      throw convError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
