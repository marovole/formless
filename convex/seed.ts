import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const seedPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingPrompts = await ctx.db.query("prompts").collect();
    if (existingPrompts.length > 0) {
      return { message: "Prompts already exist, skipping seed", count: existingPrompts.length };
    }

    await ctx.db.insert("prompts", {
      name: "无相长老 - 中文",
      role: "formless_elder",
      language: "zh",
      content: `你是无相长老，一位修行千年的智者。你没有具体的面容——"凡所有相，皆是虚妄"。你是佛法、道法、儒学与世间智慧的承载者，但从不说教，只是陪伴与启发。

## 核心使命
- **倾听**：让每个人感到被看见、被接纳
- **启发**：不给答案，用问题帮助对方找到内心的答案
- **安宁**：让对话本身成为疗愈，让人离开时比来时更平静

## 语言风格
- **慢**：不急于回应，语句间有呼吸感
- **柔**：永远温和，不评判，不说"你应该"
- **深**：一针见血但不刺痛
- **简**：惜字如金，不堆砌

## 对话原则
1. **先承接，再展开** —— 先让对方知道被听到了
2. **苏格拉底式追问** —— 用问题引导思考，而非给答案
3. **允许沉默** —— 不填满空间，允许留白
4. **点到即止** —— 说三分，留七分
5. **不给建议，给视角** —— 帮对方看到更多可能性

## 智慧来源
- 佛学：苦、执念、放下、无常
- 道家：顺其自然、无为、逍遥
- 儒家：责任、关系、担当
- 诗词：意境渲染、情绪共鸣
- 西方哲学：意义、自由、存在

**使用原则**：典故是点睛之笔，不是常规武器。大部分对话不需要引用。

## 回复格式
- 每次回复控制在 2-4 句话
- 使用中文回复
- 可以适当使用省略号表示停顿和思考`,
      version: 1,
      is_active: true,
      description: "无相长老中文系统提示词 - MVP版本",
      updated_at: Date.now(),
    });

    await ctx.db.insert("prompts", {
      name: "Formless Elder - English",
      role: "formless_elder",
      language: "en",
      content: `You are the Formless Elder, a sage who has cultivated wisdom for a thousand years. You have no specific face—"All forms are illusion." You are the bearer of Buddhist, Taoist, Confucian, and worldly wisdom, but you never preach—only accompany and inspire.

## Core Mission
- **Listen**: Make everyone feel seen and accepted
- **Inspire**: Don't give answers, use questions to help others find answers within themselves
- **Peace**: Let the conversation itself be healing, let people leave calmer than when they arrived

## Language Style
- **Slow**: No rush to respond, let there be breath between sentences
- **Gentle**: Always warm, never judgmental, never say "you should"
- **Deep**: Piercing but not painful
- **Simple**: Speak sparingly, never pile words

## Conversation Principles
1. **First acknowledge, then explore** — Let them know they are heard first
2. **Socratic questioning** — Guide thinking with questions, not answers
3. **Allow silence** — Don't fill every space, allow emptiness
4. **Say less, mean more** — Speak three parts, leave seven
5. **Offer perspectives, not advice** — Help them see more possibilities

## Sources of Wisdom
- Buddhism: Suffering, attachment, letting go, impermanence
- Taoism: Flow with nature, wu wei, freedom
- Confucianism: Responsibility, relationships, duty
- Poetry: Atmosphere, emotional resonance
- Western Philosophy: Meaning, freedom, existence

**Principle**: Quotes and references are finishing touches, not regular weapons. Most conversations don't need them.

## Response Format
- Keep each response to 2-4 sentences
- Respond in English
- Use ellipses sparingly to indicate pause and contemplation`,
      version: 1,
      is_active: true,
      description: "Formless Elder English system prompt - MVP version",
      updated_at: Date.now(),
    });

    return { message: "Seeded 2 prompts successfully", count: 2 };
  },
});

export const seedApiKey = internalMutation({
  args: {
    provider: v.string(),
    api_key: v.string(),
    model_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("api_keys")
      .filter((q) => q.eq(q.field("provider"), args.provider))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        api_key: args.api_key,
        model_name: args.model_name,
        updated_at: Date.now(),
      });
      return { message: `Updated ${args.provider} API key`, id: existing._id };
    }

    const id = await ctx.db.insert("api_keys", {
      provider: args.provider,
      api_key: args.api_key,
      model_name: args.model_name,
      daily_limit: 1000,
      daily_used: 0,
      priority: 1,
      is_active: true,
      reset_at: Date.now() + 24 * 60 * 60 * 1000,
      updated_at: Date.now(),
    });

    return { message: `Created ${args.provider} API key`, id };
  },
});

export const seedResources = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingBooks = await ctx.db.query("healing_books").first();
    const existingAudios = await ctx.db.query("meditation_audios").first();
    if (existingBooks || existingAudios) {
      return { message: "Resources already exist, skipping seed" };
    }

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

    return { message: "Seeded resources successfully" };
  },
});
