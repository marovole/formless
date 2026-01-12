import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { handleApiError } from '@/lib/api/responses';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);

    const convex = getConvexClient();
    const data = await convex.query(api.memories.listInternal, {
        clerkId,
        conversationId: conversationId as Id<"conversations">,
        limit
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, '获取记忆API错误');
  }
}
