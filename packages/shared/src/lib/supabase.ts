import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Supabase client — initialized at app startup.
 *
 * Web:    initSupabase(import.meta.env.VITE_SUPABASE_URL, ...)
 * Mobile: initSupabase(SUPABASE_URL, ..., { auth: { storage: AsyncStorage } })
 */
export let supabase: SupabaseClient = null!;

export function initSupabase(
  url: string,
  anonKey: string,
  options?: Record<string, any>,
): SupabaseClient {
  supabase = createClient(url, anonKey, options);
  return supabase;
}
