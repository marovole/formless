import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const prompts = await ctx.db.query("prompts").collect();
    return prompts
      .sort((a, b) => {
        if (a.role !== b.role) return a.role.localeCompare(b.role);
        return a.language.localeCompare(b.language);
      })
      .map((p) => ({
        id: p._id,
        name: p.name,
        role: p.role,
        language: p.language,
        content: p.content,
        version: p.version ?? 1,
        is_active: p.is_active ?? true,
        description: p.description ?? null,
        updated_at: p.updated_at ?? null,
        created_at: p._creationTime,
      }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    language: v.string(),
    content: v.string(),
    description: v.optional(v.string()),
    is_active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return await ctx.db.insert("prompts", {
      name: args.name,
      role: args.role,
      language: args.language,
      content: args.content,
      version: 1,
      is_active: args.is_active ?? true,
      description: args.description,
      created_by: admin._id,
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
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) return;

    await ctx.db.patch(id, {
      ...updates,
      version: (existing.version ?? 1) + (updates.content ? 1 : 0),
      updated_at: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("prompts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.id);
  },
});

export const getActiveInternal = internalQuery({
  args: {
    role: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const prompt = await ctx.db
      .query("prompts")
      .withIndex("by_role_language", (q) =>
        q.eq("role", args.role).eq("language", args.language),
      )
      .filter((q) => q.eq(q.field("is_active"), true))
      .first();

    if (prompt) return prompt;

    return await ctx.db
      .query("prompts")
      .withIndex("by_role_language", (q) =>
        q.eq("role", args.role).eq("language", "en"),
      )
      .filter((q) => q.eq(q.field("is_active"), true))
      .first();
  },
});

export const seedPromptInternal = internalMutation({
  args: {
    name: v.string(),
    role: v.string(),
    language: v.string(),
    content: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("prompts")
      .withIndex("by_role_language", (q) =>
        q.eq("role", args.role).eq("language", args.language),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        content: args.content,
        description: args.description,
        version: (existing.version ?? 1) + 1,
        is_active: true,
        updated_at: Date.now(),
      });
      return { id: existing._id, action: "updated" };
    }

    const id = await ctx.db.insert("prompts", {
      name: args.name,
      role: args.role,
      language: args.language,
      content: args.content,
      version: 1,
      is_active: true,
      description: args.description,
      updated_at: Date.now(),
    });

    return { id, action: "created" };
  },
});
