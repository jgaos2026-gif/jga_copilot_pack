import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase.server';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * POST /api/auth/login
 * Authenticates a user via Supabase.
 *
 * Security: returns only minimal user info (id, email, role).
 * The session access_token is stored in an httpOnly cookie only — it is
 * intentionally NOT returned in the response body to prevent JS access.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const supabase = createServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Return only minimal user info — never expose the access_token in the
    // response body, as that would defeat httpOnly cookie protection.
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: (data.user.user_metadata as Record<string, unknown>)?.role ?? 'client',
        },
      },
      { status: 200 },
    );

    // Set the session token as an httpOnly cookie so it cannot be read by
    // browser JavaScript.
    if (data.session?.access_token) {
      response.cookies.set('sb-access-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid credentials format' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
