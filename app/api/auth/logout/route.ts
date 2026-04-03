import { NextResponse } from 'next/server';

/**
 * GET /api/auth/logout
 * Clears the session cookie to log the user out.
 *
 * Security note: we do NOT call supabase.auth.signOut() with the service-role
 * client because that client is not associated with the user's session and
 * would not revoke anything.  Clearing the httpOnly cookie is sufficient for
 * cookie-based auth — the access_token will expire on its own (24 h).
 * If immediate server-side revocation is required in the future, use the
 * Supabase SSR helpers with the user's own session token.
 */
export async function GET() {
  const response = NextResponse.json({ success: true, message: 'Logged out' }, { status: 200 });

  // Expire the session cookie immediately.
  response.cookies.set('sb-access-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
