/**
 * Lazy Supabase client singleton.
 * Validates required env vars at first use (request time), not at module load time.
 * This allows the Next.js build to succeed without env vars while ensuring
 * production requests fail fast with a clear error if credentials are missing.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase credentials are not configured. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  _client = createClient(url, key);
  return _client;
}
