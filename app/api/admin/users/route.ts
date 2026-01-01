import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { verifyAdminSession } from '@/lib/auth/session';


export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, created_at, profile')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
