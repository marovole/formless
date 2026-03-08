import guanzhaoBundle from "../../docs/guanzhao/guanzhao-bundle.json";
import type { GuanzhaoTrigger, GuanzhaoTemplate, GuanzhaoConfig } from "./types";

// ============================================================================
// Utility Functions for Guanzhao (Mindfulness) System
// ============================================================================

export function getTriggerConfig(triggerId: string): GuanzhaoTrigger | undefined {
  return (guanzhaoBundle as GuanzhaoConfig).triggers.find((t) => t.id === triggerId);
}

export function getTemplateConfig(templateId: string): GuanzhaoTemplate | undefined {
  return (guanzhaoBundle as GuanzhaoConfig).templates.find((t) => t.id === templateId);
}

export function getBudgetsForFrequencyLevel(level: string) {
  const config = guanzhaoBundle as GuanzhaoConfig;
  const frequency =
    config.frequency_levels[level as keyof typeof config.frequency_levels];
  if (!frequency) {
    return { in_app_day: 0, in_app_week: 0, push_day: 0, push_week: 0 };
  }

  return {
    in_app_day: frequency.budgets.in_app.per_day,
    in_app_week: frequency.budgets.in_app.per_week,
    push_day: frequency.budgets.push.per_day,
    push_week: frequency.budgets.push.per_week,
  };
}

export function getZonedDate(now: Date, timezone: string): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: timezone }));
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalWeekKey(date: Date): string {
  const dayOfWeek = date.getDay();
  const offset = (dayOfWeek + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - offset);
  return getLocalDateKey(start);
}

export function getCurrentTimeInTimezone(timezone: string): string {
  const zoned = getZonedDate(new Date(), timezone);
  const hours = String(zoned.getHours()).padStart(2, "0");
  const minutes = String(zoned.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function getCurrentLocalKeys(timezone: string): { dayKey: string; weekKey: string } {
  const zonedNow = getZonedDate(new Date(), timezone);
  return {
    dayKey: getLocalDateKey(zonedNow),
    weekKey: getLocalWeekKey(zonedNow),
  };
}

export function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  const current = parseTime(currentTime);
  const start = parseTime(startTime);
  const end = parseTime(endTime);

  // Handle overnight ranges (e.g., 23:30 to 08:00)
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}