import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    tokenIdentifier: v.optional(v.string()), // Full token identifier
    clerkId: v.optional(v.string()), // Just the Clerk User ID (subject)
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

  admin_users: defineTable({
    email: v.string(),
    password_hash: v.string(),
    full_name: v.optional(v.string()),
    role: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
    last_login_at: v.optional(v.number()),
    updated_at: v.optional(v.number()),
  })
  .index("by_email", ["email"]),

  prompts: defineTable({
    name: v.string(),
    role: v.string(),
    language: v.string(),
    content: v.string(),
    version: v.optional(v.number()),
    is_active: v.optional(v.boolean()),
    variables: v.optional(v.any()),
    description: v.optional(v.string()),
    created_by: v.optional(v.id("admin_users")),
    updated_at: v.optional(v.number()),
  })
  .index("by_name", ["name"])
  .index("by_role_language", ["role", "language"]),

  user_sessions: defineTable({
    user_id: v.id("users"),
    timezone: v.optional(v.string()),
    // started_at handled by _creationTime
    ended_at: v.optional(v.number()),
    last_activity_at: v.optional(v.number()),
    messages_count: v.optional(v.number())
  })
  .index("by_user_id", ["user_id"]),

  guanzhao_budget_tracking: defineTable({
    user_id: v.id("users"),
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
    conversation_id: v.optional(v.id("conversations"))
  })
  .index("by_user_id", ["user_id"])
  .index("by_user_trigger", ["user_id", "trigger_id"])
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
