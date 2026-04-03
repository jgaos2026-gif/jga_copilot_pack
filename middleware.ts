import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/health',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith('/api/auth/'));
}

/**
 * Validates the JWT stored in the sb-access-token cookie by calling
 * Supabase auth.getUser(). This ensures the token is authentic, unexpired,
 * and issued by our Supabase project — not just present.
 *
 * Note: Edge middleware cannot import Node-only modules.  We create a minimal
 * Supabase client here using only the anon key so that auth.getUser() can hit
 * the Supabase Auth REST API to validate the token.
 */
async function validateToken(token: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return false;
  }

  try {
    // Use the anon key so this is safe in Edge middleware.
    // auth.getUser(token) validates the JWT signature and expiry against
    // the Supabase project — no service-role key required.
    const supabase = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.auth.getUser(token);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Middleware — protect all dashboard and API routes.
 * Unauthenticated or invalid-token requests are redirected to /login.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const isDashboard = pathname.startsWith('/dashboard');
  const isProtectedApi =
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    !pathname.startsWith('/api/health');

  if (!isDashboard && !isProtectedApi) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get('sb-access-token')?.value ||
    request.cookies.get('supabase-auth-token')?.value;

  if (!token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate the JWT — not just its presence.
  const valid = await validateToken(token);
  if (!valid) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear the stale/invalid token cookie.
    response.cookies.set('sb-access-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
