/**
 * API Route: Push Token Registration
 * 注册和管理用户的推送通知令牌（Expo）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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
    // 1. 验证用户身份
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 解析请求
    const body: PushTokenRequest = await req.json();
    const { token, platform, deviceId } = body;

    if (!token || !platform) {
      return NextResponse.json(
        { error: 'Missing token or platform' },
        { status: 400 }
      );
    }

    // 3. 验证平台
    const validPlatforms = ['ios', 'android', 'web'];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // 4. 检查令牌是否已存在
    const { data: existing } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('token', token)
      .maybeSingle();

    if (existing) {
      // 更新使用时间
      await supabase
        .from('push_tokens')
        .update({
          last_used_at: new Date().toISOString(),
          is_active: true,
        })
        .eq('id', existing.id);
    } else {
      // 插入新令牌
      const { error: insertError } = await supabase
        .from('push_tokens')
        .insert({
          user_id: user.id,
          token,
          platform,
          device_id: deviceId,
        });

      if (insertError) {
        throw insertError;
      }
    }

    // 5. 启用推送通知
    await supabase
      .from('guanzhao_budget_tracking')
      .update({ push_enabled: true })
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// DELETE Handler - 删除令牌
// =============================================

export async function DELETE(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 解析请求
    const body: PushTokenDeleteRequest = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      );
    }

    // 3. 删除或禁用令牌
    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('token', token);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Push token removed successfully',
    });
  } catch (error) {
    console.error('Error removing push token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// GET Handler - 获取用户的所有令牌
// =============================================

export async function GET() {
  try {
    // 1. 验证用户身份
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 获取所有活跃令牌
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 3. 返回脱敏的令牌信息
    const tokenRows = (tokens || []) as Array<{
      id: string;
      platform: string;
      created_at: string;
      last_used_at: string | null;
      token: string;
    }>;

    const sanitizedTokens = tokenRows.map((token) => ({
      id: token.id,
      platform: token.platform,
      created_at: token.created_at,
      last_used_at: token.last_used_at,
      token_preview: token.token.substring(0, 20) + '...',
    }));

    return NextResponse.json({
      tokens: sanitizedTokens,
      count: sanitizedTokens.length,
    });
  } catch (error) {
    console.error('Error fetching push tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
