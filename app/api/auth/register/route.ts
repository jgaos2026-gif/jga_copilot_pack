import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['contractor', 'client', 'staff']).default('client'),
  stateCode: z.string().max(10).optional(),
});

/**
 * POST /api/auth/register
 * Creates a new Supabase auth user and a matching profile row.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const supabase = createServerClient();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: data.role },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Upsert profile row
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: data.fullName,
      email: data.email,
      role: data.role,
      state_tag: data.stateCode ?? 'IL-01',
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: true, userId: authData.user.id },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid registration data', issues: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
