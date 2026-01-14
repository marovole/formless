import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getConvexAdminClient, getConvexClientWithAuth } from '@/lib/convex';
import { api, internal } from '@/convex/_generated/api';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId, getToken } = await auth();
    const user = await currentUser();

    if (!clerkId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const convexToken = await getToken({ template: 'convex' });
    if (!convexToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const convex = getConvexClientWithAuth(convexToken);
    const results: string[] = [];

    const chutesApiKey = process.env.CHUTES_API_KEY;
    if (chutesApiKey) {
      try {
        await convex.mutation(api.api_keys.create, {
          provider: 'chutes',
          api_key: chutesApiKey,
          model_name: 'deepseek-ai/DeepSeek-R1',
          daily_limit: 2000,
          priority: 1,
          is_active: true,
        });
        results.push('Created Chutes API key');
      } catch {
        results.push('Chutes API key may already exist');
      }
    } else {
      results.push('CHUTES_API_KEY not found in environment');
    }

    const openrouterKeys = process.env.OPENROUTER_API_KEYS;
    if (openrouterKeys) {
      const keys = openrouterKeys.split(',').map(k => k.trim()).filter(Boolean);
      for (let i = 0; i < keys.length; i++) {
        try {
          await convex.mutation(api.api_keys.create, {
            provider: 'openrouter',
            api_key: keys[i],
            model_name: 'glm-4.5-air',
            daily_limit: 1000,
            priority: i + 1,
            is_active: true,
          });
          results.push(`Created OpenRouter API key ${i + 1}`);
        } catch {
          results.push(`OpenRouter API key ${i + 1} may already exist`);
        }
      }
    } else {
      results.push('OPENROUTER_API_KEYS not found in environment');
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Initialization complete',
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: 'Initialization failed', details: String(error) },
      { status: 500 }
    );
  }
}
