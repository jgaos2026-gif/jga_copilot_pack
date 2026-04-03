/**
 * Browser-safe Supabase client using the public anon key.
 * Safe to import in client components.
 */

import { createClient } from '@supabase/supabase-js';

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase public environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return createClient(url, anonKey);
}
