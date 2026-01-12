import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/session';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';

export async function GET(request: NextRequest) {
  try {
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const convex = getConvexClient();
    const users = await convex.query(api.admin.listUsers, { limit: 100 });

    const sanitizedUsers = users.map(u => ({
      id: u._id,
      email: u.email,
      created_at: new Date(u._creationTime).toISOString(),
      profile: u.profile
    }));

    return NextResponse.json({ users: sanitizedUsers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
