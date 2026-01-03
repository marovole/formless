/**
 * 观照设置页面
 * 允许用户配置观照功能的频率、风格、DND 时段等
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Info } from 'lucide-react';

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
// Frequency Level Descriptions
// =============================================

const FREQUENCY_LEVELS = {
  silent: {
    label: '静默',
    description: '完全关闭主动触达',
    in_app: '0 次/天',
    push: '0 次/天',
  },
  qingjian: {
    label: '清简',
    description: '最小打扰，只保留最精华的观照',
    in_app: '1 次/天，最多 2 次/周',
    push: '0 次/天',
  },
  zhongdao: {
    label: '中道',
    description: '适中的陪伴，平衡关照与自由',
    in_app: '1 次/天，最多 5 次/周',
    push: '0-2 次/周',
  },
  jingjin: {
    label: '精进',
    description: '密集的修行支持',
    in_app: '2 次/天，最多 8 次/周',
    push: '1 次/天，最多 5 次/周',
  },
};

// =============================================
// Style Descriptions
// =============================================

const STYLES = {
  qingming: {
    label: '清明',
    description: '更提问、更留白，引导你自省',
    tone: '温和、探索、启发性',
  },
  cibei: {
    label: '慈悲',
    description: '更温和、更安抚，给你支持和力量',
    tone: '温暖、包容、鼓励性',
  },
  zhizhi: {
    label: '直指',
    description: '更具体、更聚焦行动',
    tone: '直接、务实、行动导向',
  },
};

// =============================================
// Main Component
// =============================================

export default function GuanzhaoSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [settings, setSettings] = useState<GuanzhaoSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 加载用户设置
  useEffect(() => {
    if (!user) return;

    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/guanzhao/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/guanzhao/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof GuanzhaoSettings>(
    key: K,
    value: GuanzhaoSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  };

  if (!user) {
    router.push('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-amber-50 to-stone-100">
      {/* Header */}
      <div className="border-b border-stone-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <h1 className="text-2xl font-serif text-stone-800">观照设置</h1>
          <div className="w-20" /> {/* 占位，保持标题居中 */}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
            <p className="mt-4 text-stone-600">加载中...</p>
          </div>
        ) : (
          <>
            {/* 主开关 */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-stone-800 mb-2">
                    启用观照
                  </h2>
                  <p className="text-sm text-stone-600">
                    开启后，我会根据你选择的频率主动给予关照和陪伴
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => updateSetting('enabled', checked)}
                  className="ml-4"
                />
              </div>
            </Card>

            {/* 频率级别 */}
            <Card className={`p-6 transition-opacity ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-xl font-semibold text-stone-800 mb-4">
                触达频率
              </h2>

              <RadioGroup
                value={settings.frequency_level}
                onValueChange={(value) =>
                  updateSetting('frequency_level', value as GuanzhaoSettings['frequency_level'])
                }
                className="space-y-3"
              >
                {(Object.entries(FREQUENCY_LEVELS) as [keyof typeof FREQUENCY_LEVELS, string][]).map(
                  ([key, level]) => (
                    <div
                      key={key}
                      className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors ${
                        settings.frequency_level === key
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <RadioGroupItem value={key} id={`freq-${key}`} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={`freq-${key}`} className="font-medium text-stone-800 cursor-pointer">
                          {level.label}
                        </Label>
                        <p className="text-sm text-stone-600 mt-1">{level.description}</p>
                        <div className="flex gap-4 mt-2 text-xs text-stone-500">
                          <span>应用内: {level.in_app}</span>
                          <span>推送: {level.push}</span>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </RadioGroup>
            </Card>

            {/* 风格选择 */}
            <Card className={`p-6 transition-opacity ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-xl font-semibold text-stone-800 mb-4">
                对话风格
              </h2>
              <p className="text-sm text-stone-600 mb-4">
                选择你喜欢的对话方式，我会根据你的偏好调整措辞
              </p>

              <Select
                value={settings.style}
                onValueChange={(value) =>
                  updateSetting('style', value as GuanzhaoSettings['style'])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STYLES) as [keyof typeof STYLES, string][]).map(([key, style]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-medium">{style.label}</span>
                        <span className="text-xs text-stone-500 ml-2">{style.tone}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {settings.style && (
                <div className="mt-4 p-3 bg-stone-50 rounded-lg">
                  <p className="text-sm text-stone-700">{STYLES[settings.style].description}</p>
                </div>
              )}
            </Card>

            {/* DND 时段 */}
            <Card className={`p-6 transition-opacity ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-xl font-semibold text-stone-800 mb-4">
                免打扰时段
              </h2>
              <p className="text-sm text-stone-600 mb-4">
                在此时段内不会收到任何通知
              </p>

              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="dnd-start" className="text-sm text-stone-600 mb-1 block">
                    开始时间
                  </Label>
                  <Input
                    id="dnd-start"
                    type="time"
                    value={settings.dnd_start}
                    onChange={(e) => updateSetting('dnd_start', e.target.value)}
                    className="w-full"
                  />
                </div>

                <span className="text-stone-400 mt-6">至</span>

                <div className="flex-1">
                  <Label htmlFor="dnd-end" className="text-sm text-stone-600 mb-1 block">
                    结束时间
                  </Label>
                  <Input
                    id="dnd-end"
                    type="time"
                    value={settings.dnd_end}
                    onChange={(e) => updateSetting('dnd_end', e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  免打扰时段不会影响应用内的触发，仅控制推送通知
                </p>
              </div>
            </Card>

            {/* 推送通知 */}
            <Card className={`p-6 transition-opacity ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-stone-800 mb-2">
                    推送通知
                  </h2>
                  <p className="text-sm text-stone-600">
                    允许通过推送通知收到观照（需要额外授权）
                  </p>
                </div>
                <Switch
                  checked={settings.push_enabled}
                  onCheckedChange={(checked) => updateSetting('push_enabled', checked)}
                  className="ml-4"
                />
              </div>

              {settings.push_enabled && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                  <p className="text-xs text-amber-700">
                    ⚠️ 推送通知会根据你选择的频率级别发送，建议选择「清简」或「中道」以避免打扰
                  </p>
                </div>
              )}
            </Card>

            {/* 快速操作 */}
            <Card className={`p-6 transition-opacity ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-xl font-semibold text-stone-800 mb-4">
                快速操作
              </h2>

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={async () => {
                    await fetch('/api/guanzhao/actions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'snooze.24h' }),
                    });
                    alert('已开启 24 小时静默');
                  }}
                >
                  静默 24 小时
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={async () => {
                    await fetch('/api/guanzhao/actions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'snooze.7d' }),
                    });
                    alert('已开启 7 天静默');
                  }}
                >
                  静默 7 天
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start text-stone-600 hover:text-stone-800"
                  onClick={() => router.push('/settings')}
                >
                  返回设置首页
                </Button>
              </div>
            </Card>

            {/* 保存按钮 */}
            <div className="flex items-center justify-between py-4">
              {saveSuccess && (
                <span className="text-sm text-green-600">✓ 设置已保存</span>
              )}
              {!saveSuccess && <div />}

              <Button
                onClick={saveSettings}
                disabled={saving}
                size="lg"
                className="ml-auto"
              >
                {saving ? '保存中...' : '保存设置'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
