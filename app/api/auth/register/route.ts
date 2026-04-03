import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/supabase-client';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['owner', 'admin', 'staff', 'contractor', 'client']).default('client'),
});

/**
 * POST /api/auth/register
 * Register a new user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, fullName, role } = registerSchema.parse(body);

    // Create auth user
    const { data: authData, error: authError } = await getSupabaseClient().auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName, role },
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? 'Registration failed' },
        { status: 400 }
      );
    }

    // Create profile record
    await getSupabaseClient().from('profiles').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      role,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: true, userId: authData.user.id },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
