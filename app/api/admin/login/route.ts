import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth/session';
import { LoginSchema } from '@/lib/validation/schemas';
import { getConvexClient } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const { email, password } = await request.json();

    const validationResult = LoginSchema.safeParse({ email, password });
    if (!validationResult.success) {
      const errors: Record<string, string[]> = {};
      validationResult.error.issues.forEach((err) => {
        const path = err.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(err.message);
      });
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }

    const convex = getConvexClient();
    const admin: any = await convex.query(api.admin.getAdminByEmail, { email });

    if (!admin || !admin.is_active) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    await convex.mutation(api.admin.updateAdminLogin, { id: admin._id });
    await createSession(admin._id, admin.email);

    return NextResponse.json({
      success: true,
      admin: {
        id: admin._id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
      },
    });
  } catch (error) {
    logger.error('Login error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
