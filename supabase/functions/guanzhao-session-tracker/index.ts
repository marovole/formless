/**
 * Supabase Edge Function: Session Tracker
 * 处理用户会话的开始、结束和活动事件
 *
 * 功能：
 * - session_start: 创建新会话记录
 * - session_end: 结束会话，触发 nightly_wrapup 检查
 * - in_session: 更新活动时间，触发 overload_protection 检查
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

interface ErrorResponse {
  error: string;
  details?: string;
}

interface SuccessResponse {
  success: true;
  sessionId?: string;
  shouldTrigger?: {
    triggerId: string;
    reason: string;
  };
}

// =============================================
// Supabase Client
// =============================================

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =============================================
// Session Handlers
// =============================================

/**
 * 处理会话开始事件
 */
async function handleSessionStart(
  userId: string,
  timezone?: string
): Promise<SuccessResponse | ErrorResponse> {
  try {
    // 1. 创建新会话记录
    const { data: session, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        timezone: timezone || 'UTC',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return { error: 'Failed to create session', details: error.message };
    }

    // 2. 检查是否应该触发 daily_checkin
    // 条件：首次会话、延迟 5-15 分钟后
    const shouldTriggerDailyCheckin = await shouldTriggerDailyCheckinNow(userId);

    if (shouldTriggerDailyCheckin) {
      return {
        success: true,
        sessionId: session.id,
        shouldTrigger: {
          triggerId: 'daily_checkin',
          reason: 'First session of the day',
        },
      };
    }

    return {
      success: true,
      sessionId: session.id,
    };
  } catch (error) {
    console.error('Error in handleSessionStart:', error);
    return {
      error: 'Internal server error',
      details: error.message,
    };
  }
}

/**
 * 处理会话结束事件
 */
async function handleSessionEnd(
  userId: string,
  sessionId: string
): Promise<SuccessResponse | ErrorResponse> {
  try {
    // 1. 更新会话结束时间
    const { error } = await supabase
      .from('user_sessions')
      .update({
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error ending session:', error);
      return { error: 'Failed to end session', details: error.message };
    }

    // 2. 检查是否应该触发 nightly_wrapup
    const shouldTriggerNightlyWrapup = await shouldTriggerNightlyWrapupNow(userId);

    if (shouldTriggerNightlyWrapup) {
      return {
        success: true,
        shouldTrigger: {
          triggerId: 'nightly_wrapup',
          reason: 'Session ended in evening hours',
        },
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in handleSessionEnd:', error);
    return {
      error: 'Internal server error',
      details: error.message,
    };
  }
}

/**
 * 处理会话内活动事件
 */
async function handleInSession(
  userId: string,
  sessionId: string,
  messagesCount?: number
): Promise<SuccessResponse | ErrorResponse> {
  try {
    // 1. 更新会话活动时间和消息数
    const updateData: any = {
      last_activity_at: new Date().toISOString(),
    };

    if (messagesCount !== undefined) {
      updateData.messages_count = messagesCount;
    }

    const { data: session, error } = await supabase
      .from('user_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      return { error: 'Failed to update session', details: error.message };
    }

    // 2. 检查是否应该触发 overload_protection
    const shouldTriggerOverloadProtection = await shouldTriggerOverloadProtectionNow(
      userId,
      session
    );

    if (shouldTriggerOverloadProtection) {
      return {
        success: true,
        shouldTrigger: {
          triggerId: 'overload_protection',
          reason: 'Long session detected or late hour',
        },
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in handleInSession:', error);
    return {
      error: 'Internal server error',
      details: error.message,
    };
  }
}

// =============================================
// Trigger Logic
// =============================================

/**
 * 检查是否应该触发 daily_checkin
 */
async function shouldTriggerDailyCheckinNow(userId: string): Promise<boolean> {
  // 1. 检查今天是否已经触发过
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: existingTriggers } = await supabase
    .from('guanzhao_trigger_history')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_id', 'daily_checkin')
    .eq('channel', 'in_app')
    .gte('created_at', today.toISOString())
    .limit(1);

  if (existingTriggers && existingTriggers.length > 0) {
    return false; // 今天已经触发过了
  }

  // 2. 检查是否是今天的首次会话
  const { data: todaySessions } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('started_at', today.toISOString())
    .order('started_at', { ascending: true })
    .limit(1);

  // 如果这是今天的第一个会话，应该触发（延迟由调用方控制）
  return !todaySessions || todaySessions.length === 0;
}

/**
 * 检查是否应该触发 nightly_wrapup
 */
async function shouldTriggerNightlyWrapupNow(userId: string): Promise<boolean> {
  const now = new Date();
  const hour = now.getHours();

  // 1. 检查时间是否在晚上 8-11 点之间
  if (hour < 20 || hour >= 23) {
    return false;
  }

  // 2. 检查今天是否已经触发过
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: existingTriggers } = await supabase
    .from('guanzhao_trigger_history')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_id', 'nightly_wrapup')
    .eq('channel', 'in_app')
    .gte('created_at', today.toISOString())
    .limit(1);

  if (existingTriggers && existingTriggers.length > 0) {
    return false;
  }

  // 3. 检查用户今天是否有活动
  const { data: todayActivity } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('started_at', today.toISOString())
    .limit(1);

  return !!todayActivity && todayActivity.length > 0;
}

/**
 * 检查是否应该触发 overload_protection
 */
async function shouldTriggerOverloadProtectionNow(
  userId: string,
  session: any
): Promise<boolean> {
  const now = new Date();
  const hour = now.getHours();

  // 1. 检查是否在凌晨 0:30 之后
  if (hour >= 0 && hour < 1) {
    return await shouldTriggerOverloadThisSession(userId, session.id);
  }

  // 2. 检查会话时长是否超过 45 分钟
  if (session.started_at) {
    const startedAt = new Date(session.started_at);
    const duration = (now.getTime() - startedAt.getTime()) / (1000 * 60); // 分钟

    if (duration >= 45) {
      return await shouldTriggerOverloadThisSession(userId, session.id);
    }
  }

  return false;
}

/**
 * 检查当前会话是否应该触发 overload_protection
 */
async function shouldTriggerOverloadThisSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  // 1. 检查当前会话是否已经触发过
  const { data: existingTriggers } = await supabase
    .from('guanzhao_trigger_history')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_id', 'overload_protection')
    .eq('channel', 'in_app')
    .order('created_at', { ascending: false })
    .limit(1);

  // 如果最近 30 分钟内触发过，不再触发
  if (existingTriggers && existingTriggers.length > 0) {
    const lastTrigger = new Date(existingTriggers[0].created_at);
    const minutesAgo = (Date.now() - lastTrigger.getTime()) / (1000 * 60);

    if (minutesAgo < 30) {
      return false;
    }
  }

  return true;
}

// =============================================
// Main Handler
// =============================================

serve(async (req) => {
  // CORS 处理
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // 验证请求
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 解析请求体
    const body = await req.json();
    const { eventType } = body;

    if (!eventType) {
      return new Response(
        JSON.stringify({ error: 'Missing eventType in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let result: SuccessResponse | ErrorResponse;

    // 路由到不同的处理器
    switch (eventType) {
      case 'session_start':
        result = await handleSessionStart(body.userId, body.timezone);
        break;

      case 'session_end':
        result = await handleSessionEnd(body.userId, body.sessionId);
        break;

      case 'in_session':
        result = await handleInSession(body.userId, body.sessionId, body.messagesCount);
        break;

      default:
        result = { error: 'Invalid eventType', details: `Unknown eventType: ${eventType}` };
    }

    // 返回响应
    if ('error' in result) {
      return new Response(
        JSON.stringify(result),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error in session-tracker:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
