import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { handleApiError, unauthorizedResponse } from '@/lib/api/responses';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return unauthorizedResponse();
    }

    const convex = getConvexClient();
    await convex.mutation(api.conversations.deleteConversation, {
        id: id as Id<"conversations">,
        clerkId
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, '删除对话API错误');
  }
}
