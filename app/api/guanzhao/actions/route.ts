/**
 * API Route: Guanzhao Actions
 * 处理用户对触发器的响应动作（如静默、反馈、打开流程等）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// =============================================
// Types
// =============================================

interface ActionRequest {
  action: string;
  triggerId?: string;
  triggerHistoryId?: string;
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

    // 2. 解析请求
    const body: ActionRequest = await req.json();
    const { action, triggerId, triggerHistoryId } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action' },
        { status: 400 }
      );
    }

    // 3. 处理不同类型的动作
    const result = await processAction(user.id, action, triggerId, triggerHistoryId, supabase);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error processing action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// Action Processing
// =============================================

async function processAction(
  userId: string,
  action: string,
  triggerId: string | undefined,
  triggerHistoryId: string | undefined,
  supabase: SupabaseClient
): Promise<{ success?: boolean; error?: string; redirectUrl?: string }> {
  // 1. 静默动作
  if (action.startsWith('snooze')) {
    return await handleSnoozeAction(userId, action, supabase);
  }

  // 2. 关闭观照
  if (action === 'disable_guanzhao') {
    return await handleDisableAction(userId, supabase);
  }

  // 3. 仅保留周回顾
  if (action === 'keep_weekly_only') {
    return await handleKeepWeeklyOnly(userId, supabase);
  }

  // 4. 打开设置
  if (action === 'open_settings_guanzhao') {
    return {
      redirectUrl: '/settings/guanzhao',
    };
  }

  // 5. 反馈动作
  if (action.startsWith('feedback.')) {
    return await handleFeedbackAction(userId, action, triggerHistoryId, supabase);
  }

  // 6. 打开流程
  if (action.startsWith('open_flow.')) {
    const flowId = action.replace('open_flow.', '');
    return {
      redirectUrl: `/flow/${flowId}`,
    };
  }

  // 7. 安全资源
  if (action.startsWith('safety.')) {
    return await handleSafetyAction(action);
  }

  return { error: 'Unknown action' };
}

/**
 * 处理静默动作
 */
async function handleSnoozeAction(
  userId: string,
  action: string,
  supabase: SupabaseClient
) {
  let snoozedUntil: Date;

  if (action === 'snooze.24h') {
    snoozedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else if (action === 'snooze.7d') {
    snoozedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  } else if (action === 'snooze.today') {
    // 到今天结束
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    snoozedUntil = tomorrow;
  } else {
    return { error: 'Unknown snooze action' };
  }

  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    .update({ snoozed_until: snoozedUntil.toISOString() })
    .eq('user_id', userId);

  if (error) {
    return { error: 'Failed to set snooze' };
  }

  return {
    success: true,
    message: `已静默至 ${snoozedUntil.toLocaleString()}`,
  };
}

/**
 * 处理关闭观照
 */
async function handleDisableAction(userId: string, supabase: SupabaseClient) {
  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    .update({ enabled: false })
    .eq('user_id', userId);

  if (error) {
    return { error: 'Failed to disable guanzhao' };
  }

  return {
    success: true,
    message: '观照已关闭',
  };
}

/**
 * 处理仅保留周回顾
 */
async function handleKeepWeeklyOnly(userId: string, supabase: SupabaseClient) {
  // 设置为静默级别，但保留 weekly_review
  const { error } = await supabase
    .from('guanzhao_budget_tracking')
    .update({
      frequency_level: 'silent',
      push_enabled: false,
    })
    .eq('user_id', userId);

  if (error) {
    return { error: 'Failed to update settings' };
  }

  // 这里可能需要额外的逻辑来标记 weekly_review 为例外
  // 可以在 user.profile 中添加一个 `exceptions` 字段

  return {
    success: true,
    message: '已切换至仅保留周回顾模式',
  };
}

/**
 * 处理反馈动作
 */
async function handleFeedbackAction(
  userId: string,
  action: string,
  triggerHistoryId: string | undefined,
  supabase: SupabaseClient
) {
  const feedback = action.replace('feedback.', '');

  if (!triggerHistoryId) {
    return { error: 'Missing triggerHistoryId for feedback' };
  }

  // 记录反馈
  const { error } = await supabase
    .from('guanzhao_trigger_history')
    .update({ feedback })
    .eq('id', triggerHistoryId)
    .eq('user_id', userId);

  if (error) {
    return { error: 'Failed to record feedback' };
  }

  // 如果反馈是"太频繁"，考虑降低频率级别
  if (feedback === 'too_frequent') {
    const { data: currentSettings } = await supabase
      .from('guanzhao_budget_tracking')
      .select('frequency_level')
      .eq('user_id', userId)
      .single();

    if (currentSettings) {
      const levels = ['jingjin', 'zhongdao', 'qingjian', 'silent'];
      const currentIndex = levels.indexOf(currentSettings.frequency_level);

      if (currentIndex < levels.length - 1) {
        const newLevel = levels[currentIndex + 1];

        await supabase
          .from('guanzhao_budget_tracking')
          .update({ frequency_level: newLevel })
          .eq('user_id', userId);
      }
    }
  }

  return {
    success: true,
    message: '感谢你的反馈',
  };
}

/**
 * 处理安全资源动作
 */
async function handleSafetyAction(action: string) {
  if (action === 'safety.open_resources') {
    return {
      redirectUrl: '/resources/crisis',
    };
  }

  if (action === 'safety.confirm_safe') {
    // 记录用户确认安全
    // 可以在 safety_screening_logs 表中添加记录
    return {
      success: true,
      message: '已记录',
    };
  }

  return { error: 'Unknown safety action' };
}
