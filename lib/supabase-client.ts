/**
 * Supabase client singleton with lazy initialization.
 * Use `getSupabaseClient()` instead of calling `createClient` directly in routes.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Returns a lazily-initialized Supabase service-role client.
 * Throws if the required environment variables are missing.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
      );
    }
    client = createClient(url, key);
  }
  return client;
}
