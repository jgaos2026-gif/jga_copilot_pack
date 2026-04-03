import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase.server';

/**
 * Public registration schema.
 * The `role` field is intentionally omitted from the public schema so that
 * self-registration is always locked to the `client` role.
 * Staff, contractor, and admin accounts must be created via the admin-only
 * POST /api/contractors or a future POST /api/admin/users endpoint.
 */
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  stateCode: z.string().max(10).optional(),
});

/**
 * POST /api/auth/register
 * Creates a new Supabase auth user and a matching profile row.
 *
 * Security: this is a PUBLIC endpoint.  The role is always forced to
 * `client` — callers cannot elevate to staff/contractor/owner/admin.
 *
 * Transactional safety: if the profile upsert fails after the auth user has
 * been created, the orphaned auth user is deleted to keep the two stores in
 * sync.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const supabase = createServerClient();

    // Create auth user — role is always 'client' for public registration.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: 'client' },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Upsert profile row.
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: data.fullName,
      email: data.email,
      role: 'client',
      state_tag: data.stateCode ?? 'IL-01',
    });

    if (profileError) {
      // Compensating cleanup: remove the orphaned auth user so the two
      // stores don't get out of sync.
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: 'Registration failed. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, userId: authData.user.id }, { status: 201 });
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
