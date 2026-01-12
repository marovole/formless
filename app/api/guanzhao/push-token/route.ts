/**
 * API Route: Push Token Registration
 * 注册和管理用户的推送通知令牌（Expo）
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

// =============================================
// Types
// =============================================

interface PushTokenRequest {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceId?: string;
}

interface PushTokenDeleteRequest {
  token: string;
}

// =============================================
// POST Handler - 注册令牌
// =============================================

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PushTokenRequest = await req.json();
    const { token, platform, deviceId } = body;

    if (!token || !platform) {
      return NextResponse.json({ error: 'Missing token or platform' }, { status: 400 });
    }

    const validPlatforms = ['ios', 'android', 'web'];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 });
    }

    const convex = getConvexClient();
    await convex.mutation(api.guanzhao.registerPushToken, {
      clerkId,
      token,
      platform,
      deviceId,
    });

    return NextResponse.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================
// DELETE Handler - 删除令牌
// =============================================

export async function DELETE(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PushTokenDeleteRequest = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const convex = getConvexClient();
    await convex.mutation(api.guanzhao.deactivatePushToken, {
      clerkId,
      token,
    });

    return NextResponse.json({
      success: true,
      message: 'Push token removed successfully',
    });
  } catch (error) {
    console.error('Error removing push token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================
// GET Handler - 获取用户的所有令牌
// =============================================

export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const convex = getConvexClient();
    const tokens: any[] = await convex.query(api.guanzhao.getPushTokens, { clerkId });

    const sanitizedTokens = tokens.map((token) => ({
      id: token._id,
      platform: token.platform,
      created_at: new Date(token._creationTime).toISOString(),
      last_used_at: token.last_used_at ? new Date(token.last_used_at).toISOString() : null,
      token_preview: token.token.substring(0, 20) + '...',
    }));

    return NextResponse.json({
      tokens: sanitizedTokens,
      count: sanitizedTokens.length,
    });
  } catch (error) {
    console.error('Error fetching push tokens:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
