import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============ Admin Queries ============

export const list = query({
  args: {},
  handler: async (ctx) => {
    const prompts = await ctx.db.query("prompts").collect();
    return prompts.sort((a, b) => {
      // Sort by role, then by language
      if (a.role !== b.role) return a.role.localeCompare(b.role);
      return a.language.localeCompare(b.language);
    });
  },
});

export const getById = query({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getActive = query({
  args: {
    role: v.string(),
    language: v.string()
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_role_language", (q) => q.eq("role", args.role).eq("language", args.language))
      .filter((q) => q.eq(q.field("is_active"), true))
      .first();
  }
});

// ============ Admin Mutations ============

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    language: v.string(),
    content: v.string(),
    is_active: v.optional(v.boolean()),
    variables: v.optional(v.any()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("prompts", {
      name: args.name,
      role: args.role,
      language: args.language,
      content: args.content,
      version: 1,
      is_active: args.is_active ?? true,
      variables: args.variables || undefined,
      description: args.description || undefined,
      updated_at: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("prompts"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    language: v.optional(v.string()),
    content: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
    variables: v.optional(v.any()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (existing) {
      await ctx.db.patch(id, {
        ...updates,
        version: (existing.version || 1) + 1,
        updated_at: Date.now(),
      });
    }
  },
});

export const deletePrompt = mutation({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ============ Role-based Queries ============

export const getByRole = query({
  args: { role: v.string() },
  handler: async (ctx, args) => {
    const prompts = await ctx.db.query("prompts").collect();
    return prompts.filter((p) => p.role === args.role);
  },
});
