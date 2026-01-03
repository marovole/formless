/**
 * API Route: Guanzhao Settings
 * 管理用户的观照设置
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getAllFrequencyLevels, getAvailableStyles, getDefaults, getFrequencyLevel } from '@/lib/guanzhao/config';

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

type GuanzhaoBudgetUpdate = Partial<{
  enabled: boolean;
  frequency_level: GuanzhaoSettings['frequency_level'];
  style: GuanzhaoSettings['style'];
  push_enabled: boolean;
  dnd_start: string;
  dnd_end: string;
  budget_in_app_day: number;
  budget_in_app_week: number;
  budget_push_day: number;
  budget_push_week: number;
}>;

// =============================================
// GET Handler - 读取设置
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

    // 2. 从数据库读取设置
    const { data: settings, error } = await supabase
      .from('guanzhao_budget_tracking')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      // 如果用户没有设置记录，返回默认设置
      if (error.code === 'PGRST116') {
        const defaults = getDefaults();
        return NextResponse.json({
          enabled: defaults.enabled,
          frequency_level: defaults.frequency_level,
          style: defaults.style,
          push_enabled: defaults.channels.push,
          dnd_start: defaults.dnd_local_time.start,
          dnd_end: defaults.dnd_local_time.end,
        });
      }

      throw error;
    }

    return NextResponse.json({
      enabled: settings.enabled,
      frequency_level: settings.frequency_level,
      style: settings.style,
      push_enabled: settings.push_enabled,
      dnd_start: settings.dnd_start,
      dnd_end: settings.dnd_end,
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
    const newSettings: Partial<GuanzhaoSettings> = await req.json();

    // 3. 验证数据
    const validFrequencyLevels = Object.keys(getAllFrequencyLevels());
    const validStyles = getAvailableStyles();

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
    const updates: GuanzhaoBudgetUpdate = {};
    if (newSettings.enabled !== undefined) updates.enabled = newSettings.enabled;
    if (newSettings.frequency_level !== undefined) updates.frequency_level = newSettings.frequency_level;
    if (newSettings.style !== undefined) updates.style = newSettings.style;
    if (newSettings.push_enabled !== undefined) updates.push_enabled = newSettings.push_enabled;
    if (newSettings.dnd_start !== undefined) updates.dnd_start = newSettings.dnd_start;
    if (newSettings.dnd_end !== undefined) updates.dnd_end = newSettings.dnd_end;

    // 如果频率级别改变，需要更新预算配置
    if (newSettings.frequency_level) {
      const frequencyLevel = getFrequencyLevel(newSettings.frequency_level);
      if (!frequencyLevel) {
        return NextResponse.json(
          { error: 'Invalid frequency_level' },
          { status: 400 }
        );
      }
      updates.budget_in_app_day = frequencyLevel.budgets.in_app.per_day;
      updates.budget_in_app_week = frequencyLevel.budgets.in_app.per_week;
      updates.budget_push_day = frequencyLevel.budgets.push.per_day;
      updates.budget_push_week = frequencyLevel.budgets.push.per_week;
    }

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

    return NextResponse.json({
      success: true,
      settings: {
        enabled: data.enabled,
        frequency_level: data.frequency_level,
        style: data.style,
        push_enabled: data.push_enabled,
        dnd_start: data.dnd_start,
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
