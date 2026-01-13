/**
 * Guanzhao (Mindfulness) Feature Constants
 * Configuration values for the proactive engagement system
 */

/**
 * Time durations in milliseconds
 */
export const GUANZHAO_DURATIONS = {
  SNOOZE_24H: 24 * 60 * 60 * 1000,
  SNOOZE_7D: 7 * 24 * 60 * 60 * 1000,
  SESSION_OVERLOAD_MINUTES: 45,
  SESSION_COOLDOWN_MINUTES: 30,
} as const;

/**
 * Hour ranges for trigger conditions (24-hour format)
 */
export const GUANZHAO_HOUR_RANGES = {
  NIGHTLY_WRAPUP_START: 20,  // 8 PM
  NIGHTLY_WRAPUP_END: 23,    // 11 PM
  LATE_NIGHT_START: 0,       // Midnight
  LATE_NIGHT_END: 1,         // 1 AM
} as const;

/**
 * DND (Do Not Disturb) default times
 */
export const GUANZHAO_DND_DEFAULTS = {
  START: '23:30',
  END: '08:00',
} as const;

/**
 * Frequency levels for notification intensity
 * Ordered from most frequent to least frequent
 */
export const FREQUENCY_LEVELS = ['jingjin', 'zhongdao', 'qingjian', 'silent'] as const;
export type FrequencyLevel = typeof FREQUENCY_LEVELS[number];

/**
 * Trigger IDs for different engagement types
 */
export const TRIGGER_IDS = {
  DAILY_CHECKIN: 'daily_checkin',
  NIGHTLY_WRAPUP: 'nightly_wrapup',
  OVERLOAD_PROTECTION: 'overload_protection',
} as const;

/**
 * Channels for trigger delivery
 */
export const CHANNELS = {
  IN_APP: 'in_app',
  PUSH: 'push',
} as const;

/**
 * Session event types
 */
export const SESSION_EVENT_TYPES = {
  START: 'session_start',
  END: 'session_end',
  IN_SESSION: 'in_session',
} as const;
