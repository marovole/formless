import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { handleApiError, unauthorizedResponse } from '@/lib/api/responses';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);

    const convex = getConvexClient();
    const conversations = await convex.query(api.conversations.listInternal, {
        clerkId,
        limit
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    return handleApiError(error, '获取对话列表API错误');
  }
}
