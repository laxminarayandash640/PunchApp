import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Root page — Server Component.
 *
 * Acts solely as an authentication gate and smart redirector:
 *   - Authenticated admin     → /admin/dashboard
 *   - Authenticated employee  → /dashboard
 *   - Unauthenticated         → /login
 */
export default async function RootPage() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect('/login');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      redirect('/login');
    }

    if (profile.role === 'admin') {
      redirect('/admin/dashboard');
    }

    redirect('/dashboard');
  } catch {
    redirect('/login');
  }
}
