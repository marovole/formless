import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // 用户（Clerk ID 作为外键引用）
  users: defineTable({
    clerkId: v.string(), // Clerk user ID
    email: v.string(),
    fullName: v.optional(v.string()),
    profile: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // 对话
  conversations: defineTable({
    userId: v.string(), // Clerk ID
    title: v.string(),
    messageCount: v.number(),
    language: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // 消息
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    tokens: v.optional(v.number()),
  }).index("by_conversation", ["conversationId"]),

  // 记忆
  keyQuotes: defineTable({
    userId: v.string(),
    quote: v.string(),
    context: v.optional(v.string()),
    emotion: v.optional(v.string()),
    topic: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // API Keys（后台用）
  apiKeys: defineTable({
    provider: v.string(),
    apiKey: v.string(),
    dailyLimit: v.number(),
    dailyUsed: v.number(),
    priority: v.number(),
    isActive: v.boolean(),
  }),

  // API 用量
  apiUsage: defineTable({
    apiKeyId: v.id("apiKeys"),
    tokensUsed: v.number(),
    success: v.boolean(),
    createdAt: v.number(),
  }),

  // Prompts
  prompts: defineTable({
    name: v.string(),
    role: v.string(),
    language: v.string(),
    content: v.string(),
    isActive: v.boolean(),
  }),

  // 观照系统
  guanzhaoSettings: defineTable({
    userId: v.string(),
    enabled: v.boolean(),
    frequency: v.string(),
    style: v.string(),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  guanzhaoBudget: defineTable({
    userId: v.string(),
    dailyBudget: v.number(),
    dailyUsed: v.number(),
    weeklyBudget: v.number(),
    weeklyUsed: v.number(),
    lastResetDate: v.string(),
  }).index("by_user", ["userId"]),

  guanzhaoTriggerHistory: defineTable({
    userId: v.string(),
    triggerType: v.string(),
    status: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  guanzhaoSessionEvents: defineTable({
    userId: v.string(),
    eventType: v.string(),
    duration: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  guanzhaoActionHistory: defineTable({
    userId: v.string(),
    actionType: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  guanzhaoPushTokens: defineTable({
    userId: v.string(),
    token: v.string(),
    deviceType: v.string(),
  }).index("by_user", ["userId"]),

  // 管理员
  adminUsers: defineTable({
    email: v.string(),
    role: v.string(),
  }),
});
