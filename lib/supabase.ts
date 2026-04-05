import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service-role key.
 * Use only in API routes / server components — never expose to the browser.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(url, key);
}

/**
 * Browser-safe Supabase client using the public anon key.
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase public environment variables');
  }

  return createClient(url, anonKey);
}
