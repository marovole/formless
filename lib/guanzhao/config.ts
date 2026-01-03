/**
 * 观照（Guanzhao）系统配置加载器
 * 从 guanzhao-bundle.json 加载配置并提供类型安全的访问接口
 */

import guanzhaoBundle from '@/docs/guanzhao/guanzhao-bundle.json';
import type {
  GuanzhaoConfig,
  Trigger,
  Template,
  Action,
  FrequencyLevel,
  SuppressionRule,
  Persona,
  Defaults,
} from './types';

// =============================================
// Configuration Access
// =============================================

/**
 * 获取完整的观照配置
 */
export function getGuanzhaoConfig(): GuanzhaoConfig {
  return guanzhaoBundle as GuanzhaoConfig;
}

/**
 * 获取触发器配置
 */
export function getTriggerConfig(triggerId: string): Trigger | undefined {
  const config = getGuanzhaoConfig();
  return config.triggers.find(t => t.id === triggerId);
}

/**
 * 获取所有触发器
 */
export function getAllTriggers(): Trigger[] {
  const config = getGuanzhaoConfig();
  return config.triggers;
}

/**
 * 按类别获取触发器
 */
export function getTriggersByCategory(category: 'rhythm' | 'behavior' | 'protective'): Trigger[] {
  const config = getGuanzhaoConfig();
  return config.triggers.filter(t => t.category === category);
}

/**
 * 获取启用的触发器（按默认设置）
 */
export function getEnabledByDefaultTriggers(): Trigger[] {
  const config = getGuanzhaoConfig();
  return config.triggers.filter(t => t.enabled_by_default);
}

/**
 * 获取触发器的模板 ID 列表
 */
export function getTemplateIdsForTrigger(triggerId: string, style: string): string[] {
  const trigger = getTriggerConfig(triggerId);
  if (!trigger) return [];

  const templateIds = trigger.template_sets.by_style[style] ||
                     trigger.template_sets.by_style[trigger.template_sets.fallback_style];

  return templateIds || [];
}

/**
 * 获取触发器的所有模板
 */
export function getTemplatesForTrigger(triggerId: string, style: string): Template[] {
  const config = getGuanzhaoConfig();
  const templateIds = getTemplateIdsForTrigger(triggerId, style);

  return config.templates.filter(t => templateIds.includes(t.id));
}

/**
 * 获取单个模板
 */
export function getTemplate(templateId: string): Template | undefined {
  const config = getGuanzhaoConfig();
  return config.templates.find(t => t.id === templateId);
}

/**
 * 随机选择一个模板
 */
export function getRandomTemplate(triggerId: string, style: string, excludeIds: string[] = []): Template | undefined {
  const templates = getTemplatesForTrigger(triggerId, style);
  const available = templates.filter(t => !excludeIds.includes(t.id));

  if (available.length === 0) return undefined;

  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

/**
 * 轮转选择模板（避免重复）
 */
export function getRotatingTemplate(
  triggerId: string,
  style: string,
  recentlyUsed: string[]
): Template | undefined {
  const templates = getTemplatesForTrigger(triggerId, style);

  // 找到第一个未使用的模板
  for (const template of templates) {
    if (!recentlyUsed.includes(template.id)) {
      return template;
    }
  }

  // 如果所有模板都用过了，重置并返回第一个
  return templates[0];
}

// =============================================
// Actions
// =============================================

/**
 * 获取动作配置
 */
export function getAction(actionId: string): Action | undefined {
  const config = getGuanzhaoConfig();
  return config.actions[actionId];
}

/**
 * 获取所有动作
 */
export function getAllActions(): Record<string, Action> {
  const config = getGuanzhaoConfig();
  return config.actions;
}

// =============================================
// Frequency Levels
// =============================================

/**
 * 获取频率级别配置
 */
export function getFrequencyLevel(level: string): FrequencyLevel | undefined {
  const config = getGuanzhaoConfig();
  return config.frequency_levels[level];
}

/**
 * 获取所有频率级别
 */
export function getAllFrequencyLevels(): Record<string, FrequencyLevel> {
  const config = getGuanzhaoConfig();
  return config.frequency_levels;
}

/**
 * 计算频率级别的预算
 */
export function getBudgetForFrequencyLevel(
  level: string,
  channel: 'in_app' | 'push',
  period: 'day' | 'week'
): number {
  const frequencyLevel = getFrequencyLevel(level);
  if (!frequencyLevel) return 0;

  const key = `${channel}_${period}` as 'in_app_day' | 'in_app_week' | 'push_day' | 'push_week';

  // 处理嵌套的 budgets 对象
  if (period === 'day') {
    return frequencyLevel.budgets[channel]?.per_day || 0;
  } else {
    return frequencyLevel.budgets[channel]?.per_week || 0;
  }
}

// =============================================
// Suppression Rules
// =============================================

/**
 * 获取所有抑制规则
 */
export function getSuppressionRules(): SuppressionRule[] {
  const config = getGuanzhaoConfig();
  return config.global_rules.suppression;
}

// =============================================
// Persona
// =============================================

/**
 * 获取人格配置
 */
export function getPersona(): Persona {
  const config = getGuanzhaoConfig();
  return config.persona;
}

/**
 * 获取可用的语气风格
 */
export function getAvailableStyles(): string[] {
  const persona = getPersona();
  return Object.keys(persona.tone_styles);
}

// =============================================
// Defaults
// =============================================

/**
 * 获取默认配置
 */
export function getDefaults(): Defaults {
  const config = getGuanzhaoConfig();
  return config.defaults;
}

/**
 * 获取默认频率级别
 */
export function getDefaultFrequencyLevel(): string {
  return getDefaults().frequency_level;
}

/**
 * 获取默认风格
 */
export function getDefaultStyle(): string {
  return getDefaults().style;
}

// =============================================
// Utility Functions
// =============================================

/**
 * 检查触发器是否支持指定渠道
 */
export function isTriggerAvailableForChannel(triggerId: string, channel: 'in_app' | 'push'): boolean {
  const trigger = getTriggerConfig(triggerId);
  if (!trigger) return false;

  if (channel === 'push') {
    return trigger.push !== undefined &&
           trigger.push.constraints?.disabled !== true;
  }

  return trigger.in_app.constraints?.disabled !== true;
}

/**
 * 获取触发器的预算消耗
 */
export function getTriggerBudgetCost(triggerId: string, channel: 'in_app' | 'push'): number {
  const trigger = getTriggerConfig(triggerId);
  if (!trigger) return 0;

  return trigger.budget_cost[channel] || 0;
}

/**
 * 解析占位符变量
 * 支持格式: {{user.xxx|DEFAULT}}
 */
export function resolvePlaceholder(
  value: string,
  userConfig: Record<string, any>
): string {
  const placeholderRegex = /\{\{user\.(\w+)\|([^}]*)\}\}/g;

  return value.replace(placeholderRegex, (match, key, defaultValue) => {
    return userConfig[key] !== undefined ? String(userConfig[key]) : defaultValue;
  });
}

/**
 * 解析时间窗占位符
 */
export function resolveTimeWindow(
  timeWindow: { start: string; end: string; day_of_week?: string },
  userConfig: Record<string, any>
): { start: string; end: string; day_of_week?: string } {
  return {
    start: resolvePlaceholder(timeWindow.start, userConfig),
    end: resolvePlaceholder(timeWindow.end, userConfig),
    day_of_week: timeWindow.day_of_week
      ? resolvePlaceholder(timeWindow.day_of_week, userConfig)
      : undefined,
  };
}

// =============================================
// Exports
// =============================================

export default guanzhaoBundle;
