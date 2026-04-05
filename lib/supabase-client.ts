/**
 * Lazy-initialized Supabase client
 *
 * Supabase requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to
 * be present at initialisation time. Calling `createClient` at module level
 * causes Next.js build failures when those env vars are absent (e.g. CI or
 * local dev without a .env file). Use `getSupabaseClient()` inside request
 * handlers instead so the client is only created on first use at runtime.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'Missing Supabase credentials: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}
