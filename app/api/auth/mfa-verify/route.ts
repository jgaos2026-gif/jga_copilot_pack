import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseClient } from '@/lib/supabase-client';

const mfaVerifySchema = z.object({
  userId: z.string().uuid(),
  totpToken: z.string().length(6).regex(/^\d{6}$/),
});

/**
 * POST /api/auth/mfa-verify
 * Verify a TOTP token for MFA (Law #5: Owners Room Requires MFA)
 *
 * ⚠️  SECURITY TODO (requires attorney/CPA review before go-live):
 *   This endpoint currently only validates the 6-digit format and then records
 *   the verification timestamp. It does NOT validate the TOTP token against a
 *   stored secret — providing no cryptographic MFA guarantee.
 *
 *   Before production activation:
 *   1. Store a per-user TOTP secret in AWS Secrets Manager (or equivalent vault).
 *   2. Use a TOTP library (e.g., `otplib`) to verify `totpToken` against the secret.
 *   3. Only record `mfa_verified_at` when the cryptographic check passes.
 *   4. Rate-limit failed attempts to prevent brute-force.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, totpToken } = mfaVerifySchema.parse(body);

    // CRITICAL: This only checks format. Real TOTP validation against a stored
    // secret is required before enabling this in production (see TODO above).
    const isValidFormat = /^\d{6}$/.test(totpToken);

    if (!isValidFormat) {
      return NextResponse.json(
        { error: 'Invalid MFA token format' },
        { status: 400 }
      );
    }

    // Update mfa_verified_at timestamp on successful verification
    const { error: updateError } = await getSupabaseClient()
      .from('user_roles')
      .update({ mfa_verified_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      return NextResponse.json(
        { error: 'MFA verification failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { status: 'verified', verifiedAt: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
