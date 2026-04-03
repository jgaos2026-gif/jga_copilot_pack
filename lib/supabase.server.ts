/**
 * Server-only Supabase client using the service-role key.
 *
 * This module MUST only be imported in server-side code (API routes, server
 * components, middleware). Importing it in a browser/client bundle will expose
 * the service-role key and bypass Row-Level Security.
 *
 * If the `server-only` npm package is available it will enforce this at build
 * time. Without it the guard below throws at runtime if the module is loaded
 * in a browser environment.
 */

// Runtime guard: abort if this module is ever evaluated in a browser context.
if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase.server.ts must not be imported in client components. ' +
      'Use lib/supabase.browser.ts for browser-safe access.',
  );
}

import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service-role key.
 * Each call returns a new instance — callers may cache as needed.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
