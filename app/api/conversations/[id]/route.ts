import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', id);

    if (messagesError) {
      throw messagesError;
    }

    const { error: quotesError } = await supabase
      .from('key_quotes')
      .delete()
      .eq('conversation_id', id);

    if (quotesError) {
      throw quotesError;
    }

    const { error: convError } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (convError) {
      throw convError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
