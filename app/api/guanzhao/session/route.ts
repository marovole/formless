import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import type { SessionEventResponse } from '@/lib/types/api-responses';

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { eventType, sessionId, timezone, messagesCount } = body;

    if (!eventType) {
      return NextResponse.json({ error: 'Missing eventType' }, { status: 400 });
    }

    const convex = getConvexClient();
    const result = await convex.mutation(api.guanzhao.handleSessionEvent, {
      eventType,
      clerkId,
      sessionId: sessionId ? (sessionId as Id<"user_sessions">) : undefined,
      timezone,
      messagesCount,
    }) as SessionEventResponse;

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in session API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
