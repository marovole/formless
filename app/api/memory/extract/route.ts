/**
 * API Route: Memory Extraction
 * 从对话中提取关键引用和洞察
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { handleApiError, validationErrorResponse } from '@/lib/api/responses';
import { getAvailableApiKey } from '@/lib/api-keys/manager';
import { streamChatCompletion } from '@/lib/llm/chutes';
import { logger } from '@/lib/logger';

interface ExtractRequest {
  conversationId: string;
}

interface ExtractedMemory {
  key_quotes?: string[];
  insights?: {
    personality?: string;
    interests?: string[];
    concerns?: string[];
    emotion?: string;
    topic?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ExtractRequest = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return validationErrorResponse('缺少对话ID');
    }

    const convex = getConvexClient();

    // 1. 准备提取（验证所有权并获取消息）
    const preparation: any = await convex.mutation(api.memories.prepareExtraction, {
      clerkId,
      conversationId: conversationId as Id<"conversations">,
    });

    const { userId, conversationText } = preparation;

    // 2. 构建提取Prompt
    const extractionPrompt = `分析以下对话，提取用户的关键信息、重要原话和性格特点。以JSON格式返回：
{
  "key_quotes": ["重要原话1", "重要原话2"],
  "insights": {
    "personality": "性格特点",
    "interests": ["兴趣1", "兴趣2"],
    "concerns": ["关注点1", "关注点2"],
    "emotion": "当前情绪",
    "topic": "核心话题"
  }
}

对话内容：
${conversationText}`;

    // 3. 获取API密钥
    const apiKey = await getAvailableApiKey('chutes');
    if (!apiKey) {
      logger.error('没有可用的API密钥', { clerkId });
      throw new Error('服务暂时不可用');
    }

    // 4. 执行记忆提取
    let fullResponse = '';

    await streamChatCompletion(apiKey.api_key, {
      messages: [
        {
          role: 'system',
          content: 'You are a memory extraction assistant. Extract key information from conversations and respond in JSON format.',
        },
        { role: 'user', content: extractionPrompt },
      ],
      onChunk: (chunk) => {
        fullResponse += chunk;
      },
      onComplete: async (fullText) => {
        const parsed = parseExtractionResult(fullText);
        if (!parsed) return;

        // 存储记忆 (Convex Mutation)
        await convex.mutation(api.memories.saveExtractedMemories, {
          userId,
          conversationId: conversationId as Id<"conversations">,
          quotes: parsed.key_quotes || [],
          insights: parsed.insights,
          context: conversationText,
        });
      },
      onError: (error) => {
        logger.error('记忆提取错误', { error, clerkId, conversationId });
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, '记忆提取API错误');
  }
}

function parseExtractionResult(rawText: string): ExtractedMemory | null {
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[jsonMatch.length - 1]) as ExtractedMemory;
  } catch (error) {
    logger.error('解析提取结果失败', { error, rawText: rawText.slice(0, 200) });
    return null;
  }
}
