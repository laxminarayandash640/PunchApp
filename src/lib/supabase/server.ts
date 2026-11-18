import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers (Next.js 14 App Router).
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  let cookieStore: any;
  try {
    const c = cookies();
    cookieStore = typeof (c as any)?.then === 'function' ? await c : c;
  } catch {
    cookieStore = { get: () => undefined, set: () => {}, remove: () => {} };
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore?.get?.(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore?.set?.({ name, value, ...options });
        } catch {
          // Can happen in Server Components where cookies are read-only
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore?.set?.({ name, value: '', ...options });
        } catch {
          // Can happen in Server Components
        }
      },
    },
  });
}
