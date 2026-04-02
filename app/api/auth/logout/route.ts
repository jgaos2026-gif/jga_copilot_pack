import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * GET /api/auth/logout
 * Signs out the current user and clears the session cookie.
 */
export async function GET() {
  try {
    const supabase = createServerClient();
    await supabase.auth.signOut();

    const response = NextResponse.json(
      { success: true, message: 'Logged out' },
      { status: 200 },
    );

    // Clear the session cookie
    response.cookies.set('sb-access-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
