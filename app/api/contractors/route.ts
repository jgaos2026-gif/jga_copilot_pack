import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase.server';

const contractorSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  stateTag: z.string().min(1),
  identityCode: z.string().min(1),
  password: z.string().min(8),
});

/**
 * Reads the caller's role from the `profiles` table using the JWT stored in
 * the sb-access-token cookie.  Returns null if the token is missing/invalid.
 */
async function getCallerRole(request: NextRequest): Promise<string | null> {
  const token =
    request.cookies.get('sb-access-token')?.value ||
    request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return null;

  const supabase = createServerClient();

  // Validate the JWT and get the user identity.
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return null;

  // Look up the authoritative role from our profiles table (not user_metadata).
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) return null;
  return (profile as { role: string }).role;
}

/**
 * GET /api/contractors
 * List contractors joined with their profile data.
 * Accessible to owner, admin, and staff roles.
 */
export async function GET(request: NextRequest) {
  try {
    const role = await getCallerRole(request);
    if (!role || !['owner', 'admin', 'staff'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('contractors')
      .select(`
        id,
        state_tag,
        identity_code,
        verification_status,
        payout_method_status,
        w9_status,
        created_at,
        profiles (
          id,
          full_name,
          email
        )
      `);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const contractors = (data ?? []).map((c) => {
      const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
      return {
        id: c.id,
        full_name: (profile as { full_name?: string | null } | null)?.full_name ?? '',
        email: (profile as { email?: string | null } | null)?.email ?? '',
        state_tag: c.state_tag,
        identity_code: c.identity_code,
        verification_status: c.verification_status,
        w9_status: c.w9_status,
        created_at: c.created_at,
      };
    });

    return NextResponse.json({ contractors }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch contractors' }, { status: 500 });
  }
}

/**
 * POST /api/contractors
 * Create a new contractor: auth user → profile → contractor record.
 *
 * Authorization: owner and admin only.
 *
 * Transactional safety: if the profile or contractor insert fails after the
 * auth user has been created, the orphaned auth user is deleted.
 */
export async function POST(request: NextRequest) {
  try {
    // Authorization check — must be owner or admin.
    const role = await getCallerRole(request);
    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = contractorSchema.parse(body);

    const supabase = createServerClient();

    // Step 1: Create auth user.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: 'contractor' },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Step 2: Upsert profile row.
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: data.fullName,
      email: data.email,
      role: 'contractor',
      state_tag: data.stateTag,
    });

    if (profileError) {
      // Compensating cleanup: remove orphaned auth user.
      const { error: deleteError } = await supabase.auth.admin.deleteUser(authData.user.id);
      if (deleteError) {
        console.error(
          `[contractors] Cleanup failed — orphaned auth user ${authData.user.id}: ${deleteError.message}`,
        );
      }
      return NextResponse.json(
        { error: 'Failed to create contractor profile. Please try again.' },
        { status: 500 },
      );
    }

    // Step 3: Insert contractor record.
    const { data: contractorData, error: contractorError } = await supabase
      .from('contractors')
      .insert({
        profile_id: authData.user.id,
        state_tag: data.stateTag,
        identity_code: data.identityCode,
        verification_status: 'pending',
        payout_method_status: 'pending',
        w9_status: 'pending',
      })
      .select()
      .single();

    if (contractorError) {
      // Compensating cleanup: remove orphaned auth user (profile cascades via FK).
      const { error: deleteError } = await supabase.auth.admin.deleteUser(authData.user.id);
      if (deleteError) {
        console.error(
          `[contractors] Cleanup failed — orphaned auth user ${authData.user.id}: ${deleteError.message}`,
        );
      }
      return NextResponse.json(
        { error: 'Failed to create contractor record. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, contractor: contractorData }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid contractor data', issues: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Failed to create contractor' }, { status: 500 });
  }
}

