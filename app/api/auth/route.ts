import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/supabase-client';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  role: z.enum(['contractor', 'customer', 'admin']).default('contractor'),
  stateCode: z.string().length(2).optional(),
});

/**
 * POST /api/auth/login or /api/auth/register
 * Dispatches based on action field in the body.
 * Login: { action: 'login', email, password }
 * Register: { action: 'register', email, password, fullName, role, stateCode }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { action } = body;

    if (action === 'register') {
      const { email, password, fullName, role, stateCode } =
        registerSchema.parse(body);

      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Insert user profile
      if (data.user) {
        await supabase.from('users').insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role,
          state_code: stateCode ?? null,
          created_at: new Date().toISOString(),
        });
      }

      return NextResponse.json(
        { success: true, user: data.user },
        { status: 201 }
      );
    }

    // Default: login
    const { email, password } = loginSchema.parse(body);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        success: true,
        user: data.user,
        session: data.session,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

/**
 * GET /api/auth/logout
 * User logout endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    const token = request.headers.get('authorization')?.split(' ')[1];

    if (token) {
      await supabase.auth.signOut();
    }

    return NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 400 }
    );
  }
}
