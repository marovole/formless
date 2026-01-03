/**
 * API Route: Guanzhao Settings
 * 管理用户的观照设置
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

// =============================================
// Types
// =============================================

interface GuanzhaoSettings {
  enabled: boolean;
  frequency_level: 'silent' | 'qingjian' | 'zhongdao' | 'jingjin';
  style: 'qingming' | 'cibei' | 'zhizhi';
  push_enabled: boolean;
  dnd_start: string;
  dnd_end: string;
}

// =============================================
// GET Handler - 读取设置
// =============================================

export async function GET(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 从数据库读取设置
    // @ts-ignore - Supabase type inference issue with guanzhao_budget_tracking table
    const { data: settings, error } = await supabase
      .from('guanzhao_budget_tracking')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // 如果用户没有设置记录，返回默认设置
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          enabled: true,
          frequency_level: 'qingjian',
          style: 'qingming',
          push_enabled: false,
          dnd_start: '23:30',
          dnd_end: '08:00',
        });
      }

      throw error;
    }

    interface SettingsResponse {
      enabled: boolean;
      frequency_level: string;
      style: string;
      push_enabled: boolean;
      dnd_start: string;
      dnd_end: string;
    }

    const typedSettings = settings as unknown as SettingsResponse;

    return NextResponse.json({
      enabled: typedSettings.enabled,
      frequency_level: typedSettings.frequency_level,
      style: typedSettings.style,
      push_enabled: typedSettings.push_enabled,
      dnd_start: typedSettings.dnd_start,
      dnd_end: typedSettings.dnd_end,
    });
  } catch (error) {
    console.error('Error reading settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// POST Handler - 更新设置
// =============================================

export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const newSettings: Partial<GuanzhaoSettings> = await req.json();

    // 3. 验证数据
    const validFrequencyLevels = ['silent', 'qingjian', 'zhongdao', 'jingjin'] as const;
    const validStyles = ['qingming', 'cibei', 'zhizhi'] as const;

    if (newSettings.frequency_level && !validFrequencyLevels.includes(newSettings.frequency_level)) {
      return NextResponse.json(
        { error: 'Invalid frequency_level' },
        { status: 400 }
      );
    }

    if (newSettings.style && !validStyles.includes(newSettings.style)) {
      return NextResponse.json(
        { error: 'Invalid style' },
        { status: 400 }
      );
    }

    // 验证时间格式
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (newSettings.dnd_start && !timeRegex.test(newSettings.dnd_start)) {
      return NextResponse.json(
        { error: 'Invalid dnd_start format (use HH:MM)' },
        { status: 400 }
      );
    }

    if (newSettings.dnd_end && !timeRegex.test(newSettings.dnd_end)) {
      return NextResponse.json(
        { error: 'Invalid dnd_end format (use HH:MM)' },
        { status: 400 }
      );
    }

    // 4. 更新设置
    const updates: any = {};
    if (newSettings.enabled !== undefined) updates.enabled = newSettings.enabled;
    if (newSettings.frequency_level !== undefined) updates.frequency_level = newSettings.frequency_level;
    if (newSettings.style !== undefined) updates.style = newSettings.style;
    if (newSettings.push_enabled !== undefined) updates.push_enabled = newSettings.push_enabled;
    if (newSettings.dnd_start !== undefined) updates.dnd_start = newSettings.dnd_start;
    if (newSettings.dnd_end !== undefined) updates.dnd_end = newSettings.dnd_end;

    // 如果频率级别改变，需要更新预算配置
    if (newSettings.frequency_level) {
      const budgetConfig = getBudgetConfig(newSettings.frequency_level);
      updates.budget_in_app_day = budgetConfig.in_app_day;
      updates.budget_in_app_week = budgetConfig.in_app_week;
      updates.budget_push_day = budgetConfig.push_day;
      updates.budget_push_week = budgetConfig.push_week;
    }

    // @ts-ignore - Supabase type inference issue
    const { data, error } = await supabase
      .from('guanzhao_budget_tracking')
      .upsert({
        user_id: user.id,
        ...updates,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // @ts-ignore - Supabase type inference issue
    return NextResponse.json({
      success: true,
      settings: {
        // @ts-ignore - Supabase type inference issue
        enabled: data.enabled,
        // @ts-ignore - Supabase type inference issue
        frequency_level: data.frequency_level,
        // @ts-ignore - Supabase type inference issue
        style: data.style,
        // @ts-ignore - Supabase type inference issue
        push_enabled: data.push_enabled,
        // @ts-ignore - Supabase type inference issue
        dnd_start: data.dnd_start,
        // @ts-ignore - Supabase type inference issue
        dnd_end: data.dnd_end,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================
// Helper Functions
// =============================================

/**
 * 根据频率级别获取预算配置
 */
function getBudgetConfig(level: 'silent' | 'qingjian' | 'zhongdao' | 'jingjin') {
  const configs = {
    silent: {
      in_app_day: 0,
      in_app_week: 0,
      push_day: 0,
      push_week: 0,
    },
    qingjian: {
      in_app_day: 1,
      in_app_week: 2,
      push_day: 0,
      push_week: 0,
    },
    zhongdao: {
      in_app_day: 1,
      in_app_week: 5,
      push_day: 0,
      push_week: 2,
    },
    jingjin: {
      in_app_day: 2,
      in_app_week: 8,
      push_day: 1,
      push_week: 5,
    },
  };

  return configs[level];
}
