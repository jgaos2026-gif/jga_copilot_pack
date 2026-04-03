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
 * TODO: In production, verify the TOTP token against the user's secret
 *       stored in a secure vault (e.g., AWS Secrets Manager).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, totpToken } = mfaVerifySchema.parse(body);

    // Validate token format (6-digit numeric)
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
