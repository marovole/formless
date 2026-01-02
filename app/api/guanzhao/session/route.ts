/**
 * API Route: Guanzhao Session Events
 * 处理用户会话事件（开始、活动、结束）
 * 转发请求到 Supabase Edge Function
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

// =============================================
// Types
// =============================================

interface SessionStartRequest {
  eventType: 'session_start';
  userId: string;
  timezone?: string;
}

interface SessionEndRequest {
  eventType: 'session_end';
  userId: string;
  sessionId: string;
}

interface InSessionRequest {
  eventType: 'in_session';
  userId: string;
  sessionId: string;
  messagesCount?: number;
}

type SessionRequest = SessionStartRequest | SessionEndRequest | InSessionRequest;

// =============================================
// Supabase Edge Function URL
// =============================================

function getEdgeFunctionUrl(functionName: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }

  // 提取项目引用
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error('Invalid SUPABASE_URL format');
  }

  const projectRef = match[1];
  return `https://${projectRef}.supabase.co/functions/v1/${functionName}`;
}

// =============================================
// POST Handler
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

    // 2. 解析请求体
    const body: SessionRequest = await req.json();
    const { eventType } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: 'Missing eventType' },
        { status: 400 }
      );
    }

    // 3. 验证用户 ID 匹配
    if (body.userId !== user.id) {
      return NextResponse.json(
        { error: 'User ID mismatch' },
        { status: 403 }
      );
    }

    // 4. 转发请求到 Edge Function
    const edgeFunctionUrl = getEdgeFunctionUrl('guanzhao/session-tracker');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
    }

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Edge function error', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 5. 如果有触发器响应，返回触发器信息
    if (data.shouldTrigger) {
      // 这里可以添加额外的处理逻辑，比如调用触发引擎获取模板
      return NextResponse.json({
        success: true,
        sessionId: data.sessionId,
        shouldTrigger: data.shouldTrigger,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in session API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
