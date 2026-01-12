/**
 * API Route: Guanzhao Settings
 * 管理用户的观照设置
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

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

const DEFAULT_SETTINGS: GuanzhaoSettings = {
  enabled: true,
  frequency_level: 'qingjian',
  style: 'qingming',
  push_enabled: false,
  dnd_start: '23:30',
  dnd_end: '08:00',
};

// =============================================
// GET Handler - 读取设置
// =============================================

export async function GET() {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const convex = getConvexClient();
    const settings: any = await convex.query(api.guanzhao.getGuanzhaoSettings, { clerkId });

    if (!settings) {
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json({
      enabled: settings.enabled ?? DEFAULT_SETTINGS.enabled,
      frequency_level: settings.frequency_level ?? DEFAULT_SETTINGS.frequency_level,
      style: settings.style ?? DEFAULT_SETTINGS.style,
      push_enabled: settings.push_enabled ?? DEFAULT_SETTINGS.push_enabled,
      dnd_start: settings.dnd_start ?? DEFAULT_SETTINGS.dnd_start,
      dnd_end: settings.dnd_end ?? DEFAULT_SETTINGS.dnd_end,
    });
  } catch (error) {
    console.error('Error reading settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================
// POST Handler - 更新设置
// =============================================

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newSettings: Partial<GuanzhaoSettings> = await req.json();

    // 验证数据
    const validFrequencyLevels = ['silent', 'qingjian', 'zhongdao', 'jingjin'] as const;
    const validStyles = ['qingming', 'cibei', 'zhizhi'] as const;

    if (newSettings.frequency_level && !validFrequencyLevels.includes(newSettings.frequency_level)) {
      return NextResponse.json({ error: 'Invalid frequency_level' }, { status: 400 });
    }

    if (newSettings.style && !validStyles.includes(newSettings.style)) {
      return NextResponse.json({ error: 'Invalid style' }, { status: 400 });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (newSettings.dnd_start && !timeRegex.test(newSettings.dnd_start)) {
      return NextResponse.json({ error: 'Invalid dnd_start format' }, { status: 400 });
    }

    if (newSettings.dnd_end && !timeRegex.test(newSettings.dnd_end)) {
      return NextResponse.json({ error: 'Invalid dnd_end format' }, { status: 400 });
    }

    const updates: any = { ...newSettings };

    // 如果频率级别改变，需要更新预算配置
    if (newSettings.frequency_level) {
      const budgetConfig = getBudgetConfig(newSettings.frequency_level);
      Object.assign(updates, {
        budget_in_app_day: budgetConfig.in_app_day,
        budget_in_app_week: budgetConfig.in_app_week,
        budget_push_day: budgetConfig.push_day,
        budget_push_week: budgetConfig.push_week,
      });
    }

    const convex = getConvexClient();
    const result: any = await convex.mutation(api.guanzhao.updateGuanzhaoSettings, {
      clerkId,
      updates,
    });

    return NextResponse.json({
      success: true,
      settings: {
        enabled: result.settings.enabled,
        frequency_level: result.settings.frequency_level,
        style: result.settings.style,
        push_enabled: result.settings.push_enabled,
        dnd_start: result.settings.dnd_start,
        dnd_end: result.settings.dnd_end,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getBudgetConfig(level: 'silent' | 'qingjian' | 'zhongdao' | 'jingjin') {
  const configs = {
    silent: { in_app_day: 0, in_app_week: 0, push_day: 0, push_week: 0 },
    qingjian: { in_app_day: 1, in_app_week: 2, push_day: 0, push_week: 0 },
    zhongdao: { in_app_day: 1, in_app_week: 5, push_day: 0, push_week: 2 },
    jingjin: { in_app_day: 2, in_app_week: 8, push_day: 1, push_week: 5 },
  };
  return configs[level];
}
