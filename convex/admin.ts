import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ============ API Keys 管理 ============

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    // 管理员权限检查应该在应用层实现
    return await ctx.db.query("apiKeys").collect();
  },
});

export const getApiKey = query({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createApiKey = mutation({
  args: {
    provider: v.string(),
    apiKey: v.string(),
    dailyLimit: v.number(),
    priority: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      provider: args.provider,
      apiKey: args.apiKey,
      dailyLimit: args.dailyLimit,
      dailyUsed: 0,
      priority: args.priority,
      isActive: true,
    });
  },
});

export const updateApiKey = mutation({
  args: {
    id: v.id("apiKeys"),
    apiKey: v.optional(v.string()),
    dailyLimit: v.optional(v.number()),
    priority: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {};
    if (args.apiKey !== undefined) updates.apiKey = args.apiKey;
    if (args.dailyLimit !== undefined) updates.dailyLimit = args.dailyLimit;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.id, updates);
  },
});

export const deleteApiKey = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// 获取当前活跃的 API Key（用于服务端）
export const getActiveApiKey = query({
  args: {},
  handler: async (ctx) => {
    const keys = await ctx.db
      .query("apiKeys")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // 按优先级排序，返回最高优先级的可用 key
    return keys.sort((a, b) => a.priority - b.priority)[0] ?? null;
  },
});

// ============ API Usage 管理 ============

export const getApiUsage = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db.query("apiUsage").order("desc").take(limit);
  },
});

export const recordApiUsage = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    tokensUsed: v.number(),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiUsage", {
      apiKeyId: args.apiKeyId,
      tokensUsed: args.tokensUsed,
      success: args.success,
      createdAt: Date.now(),
    });

    // 更新 API Key 的使用量
    const key = await ctx.db.get(args.apiKeyId);
    if (key) {
      await ctx.db.patch(args.apiKeyId, {
        dailyUsed: key.dailyUsed + args.tokensUsed,
      });
    }
  },
});

// ============ Prompts 管理 ============

export const listPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("prompts").collect();
  },
});

export const getPrompt = query({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createPrompt = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    language: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("prompts", {
      name: args.name,
      role: args.role,
      language: args.language,
      content: args.content,
      isActive: true,
    });
  },
});

export const updatePrompt = mutation({
  args: {
    id: v.id("prompts"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    language: v.optional(v.string()),
    content: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.role !== undefined) updates.role = args.role;
    if (args.language !== undefined) updates.language = args.language;
    if (args.content !== undefined) updates.content = args.content;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.id, updates);
  },
});

export const deletePrompt = mutation({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// 获取活跃的 prompts
export const getActivePrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("prompts")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

// ============ Admin Users 管理 ============

export const listAdminUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("adminUsers").collect();
  },
});

export const addAdminUser = mutation({
  args: {
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("adminUsers", {
      email: args.email,
      role: args.role,
    });
  },
});

export const removeAdminUser = mutation({
  args: { id: v.id("adminUsers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// 检查用户是否为管理员
export const isAdmin = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminUsers")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();
    return admin !== null;
  },
});
