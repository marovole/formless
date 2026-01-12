import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/session';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const convex = getConvexClient();
    const { usage, keys } = await convex.query(api.admin.getUsageStats, { limit: 1000 });

    const today = new Date().toISOString().split('T')[0];
    const todayUsage = usage.filter((u: any) =>
      new Date(u._creationTime).toISOString().startsWith(today)
    );

    const stats = {
      total_calls_today: todayUsage.length,
      successful_calls_today: todayUsage.filter((u: any) => u.success).length,
      total_tokens_today: todayUsage.reduce((sum: number, u: any) => sum + (u.tokens_used || 0), 0),
      keys_status: keys.map((k: any) => ({
        id: k._id,
        provider: k.provider,
        model_name: k.model_name,
        daily_limit: k.daily_limit,
        daily_used: k.daily_used
      })),
      recent_usage: usage.slice(0, 50).map((u: any) => ({
        ...u,
        id: u._id,
        created_at: new Date(u._creationTime).toISOString()
      })),
    };

    return NextResponse.json({ data: stats });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
