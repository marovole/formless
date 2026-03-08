// ============================================================================
// Constants for Guanzhao (Mindfulness) System
// ============================================================================

export const GUANZHAO_DURATIONS = {
  SNOOZE_24H: 24 * 60 * 60 * 1000,
  SNOOZE_7D: 7 * 24 * 60 * 60 * 1000,
  SESSION_OVERLOAD_MINUTES: 45,
  SESSION_COOLDOWN_MINUTES: 30,
  COOLDOWN_DAY_MS: 24 * 60 * 60 * 1000,
} as const;

export const GUANZHAO_HOUR_RANGES = {
  NIGHTLY_WRAPUP_START: 20,
  NIGHTLY_WRAPUP_END: 23,
  LATE_NIGHT_START: 0,
  LATE_NIGHT_END: 1,
} as const;

export const GUANZHAO_DND_DEFAULTS = {
  START: '23:30',
  END: '08:00',
} as const;

export const FREQUENCY_LEVELS = ['jingjin', 'zhongdao', 'qingjian', 'silent'] as const;

export const TRIGGER_IDS = {
  DAILY_CHECKIN: 'daily_checkin',
  NIGHTLY_WRAPUP: 'nightly_wrapup',
  OVERLOAD_PROTECTION: 'overload_protection',
} as const;

export const CHANNELS = {
  IN_APP: 'in_app',
  PUSH: 'push',
} as const;