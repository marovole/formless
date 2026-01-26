import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const searchBooks = query({
  args: {
    query: v.string(),
    mood: v.optional(v.string()),
    topic: v.optional(v.string()),
    language: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 3, 10);
    const language = args.language ?? "zh";
    const q = args.query.trim().toLowerCase();

    const all = await ctx.db
      .query("healing_books")
      .withIndex("by_language", (idx) => idx.eq("language", language))
      .collect();

    const tokens = [q, args.mood, args.topic]
      .filter(Boolean)
      .flatMap((s) => String(s).toLowerCase().split(/\s+/))
      .filter(Boolean);

    const scored = all
      .map((b) => {
        const hay = `${b.title} ${b.author} ${(b.description || "")} ${b.tags.join(" ")}`.toLowerCase();
        const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
        return { b, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => ({
        title: x.b.title,
        author: x.b.author,
        reason: x.b.description || "",
        link: x.b.link,
      }));

    return { items: scored };
  },
});

export const pickMeditationAudio = query({
  args: {
    mood: v.string(),
    durationMinutes: v.optional(v.number()),
    style: v.optional(v.string()),
    language: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const language = args.language ?? "zh";
    const style = args.style ?? "breathing";
    const duration = Math.max(1, Math.min(30, Math.round(args.durationMinutes ?? 5))) * 60;
    const mood = args.mood.trim().toLowerCase();

    const all = await ctx.db
      .query("meditation_audios")
      .withIndex("by_style_language", (idx) => idx.eq("style", style).eq("language", language))
      .collect();

    const scored = all
      .map((a) => {
        const hay = `${a.title} ${a.tags.join(" ")} ${(a.instructions || "")}`.toLowerCase();
        const moodHit = mood ? (hay.includes(mood) ? 3 : 0) : 0;
        const durPenalty = Math.abs(a.duration - duration) / 60;
        const score = moodHit - durPenalty;
        return { a, score };
      })
      .sort((x, y) => y.score - x.score);

    const best = scored[0]?.a;
    if (!best) return null;

    return {
      title: best.title,
      duration: best.duration,
      url: best.url,
      instructions: best.instructions,
      style: best.style,
    };
  },
});

// Seed helpers (internal)

export const seedDefaultResources = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingBooks = await ctx.db.query("healing_books").first();
    const existingAudios = await ctx.db.query("meditation_audios").first();
    if (existingBooks || existingAudios) return { ok: true, skipped: true };

    await ctx.db.insert("healing_books", {
      title: "当下的力量",
      author: "埃克哈特·托利",
      tags: ["焦虑", "当下", "正念"],
      description: "帮助你从念头的洪流里退一步，回到此刻。",
      link: "https://book.douban.com/subject/1858513/",
      language: "zh",
    });

    await ctx.db.insert("healing_books", {
      title: "The Wisdom of Insecurity",
      author: "Alan Watts",
      tags: ["anxiety", "acceptance", "zen"],
      description: "A gentle exploration of fear and uncertainty through a Zen lens.",
      link: "https://www.goodreads.com/book/show/551520.The_Wisdom_of_Insecurity",
      language: "en",
    });

    await ctx.db.insert("meditation_audios", {
      title: "5分钟呼吸练习（放松）",
      duration: 5 * 60,
      style: "breathing",
      tags: ["焦虑", "失眠", "放松"],
      // Placeholder URL; replace with your own hosted audio.
      url: "https://example.com/audio/breathing-5min.mp3",
      instructions: "跟随节奏：吸气4拍，停2拍，呼气6拍。",
      language: "zh",
    });

    await ctx.db.insert("meditation_audios", {
      title: "5-min Breathing Practice (Calm)",
      duration: 5 * 60,
      style: "breathing",
      tags: ["anxiety", "sleep", "calm"],
      url: "https://example.com/audio/breathing-5min-en.mp3",
      instructions: "Breathe in for 4, hold 2, breathe out for 6.",
      language: "en",
    });

    return { ok: true, skipped: false };
  },
});
