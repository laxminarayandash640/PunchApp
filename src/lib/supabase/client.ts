import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for use in browser (Client Components).
 * Uses @supabase/ssr createBrowserClient which automatically handles
 * cookie-based session management in Next.js 14 App Router.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
