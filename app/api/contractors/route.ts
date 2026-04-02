import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase';

const contractorSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  stateTag: z.string().min(1),
  identityCode: z.string().min(1),
  password: z.string().min(8),
});

/**
 * GET /api/contractors
 * List contractors joined with their profile data.
 */
export async function GET() {
  try {
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
      // profiles is a single row (FK join), not an array
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
 * Owner/admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = contractorSchema.parse(body);

    const supabase = createServerClient();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: 'contractor' },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const profileId = authData.user.id;

    // Upsert profile
    await supabase.from('profiles').upsert({
      id: profileId,
      full_name: data.fullName,
      email: data.email,
      role: 'contractor',
      state_tag: data.stateTag,
    });

    // Create contractor record
    const { data: contractor, error: cError } = await supabase
      .from('contractors')
      .insert({
        profile_id: profileId,
        state_tag: data.stateTag,
        identity_code: data.identityCode,
      })
      .select()
      .single();

    if (cError) {
      return NextResponse.json({ error: cError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, contractor }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid contractor data', issues: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create contractor' }, { status: 500 });
  }
}
