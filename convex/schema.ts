import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    tokenIdentifier: v.string(),
    clerkId: v.string(),
    full_name: v.optional(v.string()),
    avatar_url: v.optional(v.string()),
    preferred_language: v.optional(v.string()), // 'zh' or 'en'
    profile: v.optional(v.any()), // JSONB
    updated_at: v.optional(v.number()),
    // created_at handled by _creationTime
  })
  .index("by_email", ["email"])
  .index("by_token", ["tokenIdentifier"])
  .index("by_clerk_id", ["clerkId"]),

  conversations: defineTable({
    user_id: v.id("users"),
    title: v.optional(v.string()),
    language: v.optional(v.string()),
    message_count: v.optional(v.number()),
    last_message_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
  .index("by_user_id", ["user_id"])
  .index("by_user_last_message", ["user_id", "last_message_at"]),

  messages: defineTable({
    conversation_id: v.id("conversations"),
    role: v.string(), // 'user', 'assistant', 'system'
    content: v.string(),
    tokens: v.optional(v.number()),
  })
  .index("by_conversation_id", ["conversation_id"]),

  letter_threads: defineTable({
    user_a_id: v.id("users"),
    user_b_id: v.id("users"),
    pair_key: v.string(),
    subject: v.optional(v.string()),
    last_letter_at: v.number(),
    last_sender_id: v.id("users"),
    next_sender_id: v.id("users"),
    last_letter_preview: v.optional(v.string()),
    updated_at: v.number(),
  })
  .index("by_user_a_last_letter", ["user_a_id", "last_letter_at"])
  .index("by_user_b_last_letter", ["user_b_id", "last_letter_at"])
  .index("by_pair_key", ["pair_key"]),

  letters: defineTable({
    thread_id: v.id("letter_threads"),
    sender_id: v.id("users"),
    recipient_id: v.id("users"),
    body: v.string(),
    day_key: v.string(),
    created_at: v.number(),
  })
  .index("by_thread_id", ["thread_id"])
  .index("by_sender_day", ["sender_id", "day_key"]),

  key_quotes: defineTable({
    user_id: v.id("users"),
    conversation_id: v.optional(v.id("conversations")),
    quote: v.string(),
    context: v.optional(v.string()),
    emotion: v.optional(v.string()),
    topic: v.optional(v.string()),
  })
  .index("by_user_id", ["user_id"])
  .index("by_conversation_id", ["conversation_id"]),

  api_keys: defineTable({
    provider: v.string(), // 'chutes', 'openrouter'
    api_key: v.string(),
    model_name: v.optional(v.string()),
    daily_limit: v.optional(v.number()),
    daily_used: v.optional(v.number()),
    priority: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
    last_used_at: v.optional(v.number()),
    reset_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
  .index("by_provider_priority", ["provider", "priority"]),

  api_usage: defineTable({
    api_key_id: v.optional(v.id("api_keys")),
    provider: v.string(),
    model_name: v.optional(v.string()),
    user_id: v.optional(v.id("users")),
    conversation_id: v.optional(v.id("conversations")),
    tokens_used: v.optional(v.number()),
    success: v.optional(v.boolean()),
    error_message: v.optional(v.string()),
    response_time_ms: v.optional(v.number()),
    created_at: v.optional(v.number()), // Explicit timestamp for time-range queries
  })
  .index("by_user_id", ["user_id"])
  .index("by_api_key_id", ["api_key_id"])
  .index("by_conversation_id", ["conversation_id"])
  .index("by_created_at", ["created_at"]),

  prompts: defineTable({
    name: v.string(),
    role: v.string(),
    language: v.string(),
    content: v.string(),
    version: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
    variables: v.optional(v.any()),
    description: v.optional(v.string()),
    created_by: v.optional(v.id("users")),
    updated_at: v.optional(v.number()),
  })
  .index("by_name", ["name"])
  .index("by_role_language", ["role", "language"]),

  user_sessions: defineTable({
    user_id: v.id("users"),
    timezone: v.optional(v.string()),
    day_key: v.optional(v.string()),
    week_key: v.optional(v.string()),
    // started_at handled by _creationTime
    ended_at: v.optional(v.number()),
    last_activity_at: v.optional(v.number()),
    messages_count: v.optional(v.number())
  })
  .index("by_user_id", ["user_id"])
  .index("by_user_day", ["user_id", "day_key"]),

  guanzhao_budget_tracking: defineTable({
    user_id: v.id("users"),
    timezone: v.optional(v.string()),
    day_key: v.optional(v.string()),
    week_key: v.optional(v.string()),
    snoozed_until: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    frequency_level: v.optional(v.string()),
    push_enabled: v.optional(v.boolean()),
    budget_in_app_day: v.optional(v.number()),
    used_in_app_day: v.optional(v.number()),
    budget_in_app_week: v.optional(v.number()),
    used_in_app_week: v.optional(v.number()),
    budget_push_day: v.optional(v.number()),
    used_push_day: v.optional(v.number()),
    budget_push_week: v.optional(v.number()),
    used_push_week: v.optional(v.number()),
    dnd_start: v.optional(v.string()),
    dnd_end: v.optional(v.string()),
    style: v.optional(v.string()),
    updated_at: v.optional(v.number()),
  })
  .index("by_user_id", ["user_id"]),

  guanzhao_trigger_history: defineTable({
    user_id: v.id("users"),
    trigger_id: v.string(),
    template_id: v.optional(v.string()),
    channel: v.optional(v.string()),
    status: v.optional(v.string()),
    reason: v.optional(v.string()),
    feedback: v.optional(v.string()),
    day_key: v.optional(v.string()),
    week_key: v.optional(v.string()),
    conversation_id: v.optional(v.id("conversations"))
  })
  .index("by_user_id", ["user_id"])
  .index("by_user_trigger", ["user_id", "trigger_id"])
  .index("by_user_trigger_day", ["user_id", "trigger_id", "day_key"])
  .index("by_conversation_id", ["conversation_id"]),

  guanzhao_cooldowns: defineTable({
    user_id: v.id("users"),
    trigger_id: v.string(),
    channel: v.string(),
    cooldown_until: v.string(),
  })
  .index("by_user_id", ["user_id"])
  .index("by_user_trigger_channel", ["user_id", "trigger_id", "channel"]),

  push_tokens: defineTable({
    user_id: v.id("users"),
    token: v.string(),
    platform: v.string(),
    device_id: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
    last_used_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
  .index("by_user_id", ["user_id"])
  .index("by_token", ["token"]),
});
