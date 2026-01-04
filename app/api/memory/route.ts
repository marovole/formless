import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/middleware';
import { handleApiError } from '@/lib/api/responses';
import { logger } from '@/lib/logger';
import type { KeyQuote, User } from '@/lib/supabase/types';

interface UserProfile {
  personality?: string;
  interests?: string[];
  concerns?: string[];
  [key: string]: unknown;
}

interface MemoryResponse {
  quotes: KeyQuote[];
  insights: {
    personality?: string;
    interests: string[];
    concerns: string[];
  };
}

export async function GET(request: NextRequest) {
  try {
    // 1. 认证用户
    const { user, supabase } = await requireAuth(request);

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100); // 限制最大100
    const topic = searchParams.get('topic') || undefined;

    // 3. 构建查询
    let query = supabase
      .from('key_quotes')
      .select('id, quote, context, emotion, topic, created_at, conversation_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }

    if (topic) {
      query = query.ilike('topic', `%${topic}%`);
    }

    const { data: memories, error } = await query;

    if (error) {
      logger.error('获取记忆失败', { error, userId: user.id });
      throw new Error('获取记忆失败');
    }

    // 4. 获取用户档案洞察
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('profile')
      .eq('id', user.id)
      .single();

    if (userError) {
      logger.warn('获取用户档案失败', { error: userError, userId: user.id });
    }

    const profile = (userData?.profile as UserProfile) || {};

    const response: MemoryResponse = {
      quotes: (memories as KeyQuote[]) || [],
      insights: {
        personality: profile.personality,
        interests: profile.interests || [],
        concerns: profile.concerns || [],
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, '获取记忆API错误');
  }
}
