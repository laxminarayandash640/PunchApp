import { type NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';

// ----------------------------------------------------------------
// Route classification helpers
// ----------------------------------------------------------------

/** Routes that require no authentication. */
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/update-password'];

/** Route prefixes that bypass middleware entirely (static assets, API). */
const BYPASS_PREFIXES = ['/api/', '/_next/', '/favicon.ico'];

/** Admin-only route prefix. */
const ADMIN_PREFIX = '/admin';

/** Default dashboard for regular employees. */
const EMPLOYEE_DASHBOARD = '/dashboard';

/** Default dashboard for administrators. */
const ADMIN_DASHBOARD = '/admin/dashboard';

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

function isBypassRoute(pathname: string): boolean {
  return BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAdminRoute(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(ADMIN_PREFIX + '/');
}

// ----------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware for static files and API routes.
  if (isBypassRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Create middleware-safe Supabase client.
  try {
    const { supabase, response } = createMiddlewareClient(request);

    // 3. Refresh the session.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // 4a. Unauthenticated user
    if (!user || error) {
      if (isPublicRoute(pathname)) {
        return response;
      }
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // 4b. Authenticated user — fetch role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role ?? 'employee';
    const isAdmin = role === 'admin';

    // 4c. Authenticated user visiting /login
    if (isPublicRoute(pathname)) {
      const destination = isAdmin ? ADMIN_DASHBOARD : EMPLOYEE_DASHBOARD;
      return NextResponse.redirect(new URL(destination, request.url));
    }

    // 4d. Non-admin user trying to access /admin/*
    if (isAdminRoute(pathname) && !isAdmin) {
      return NextResponse.redirect(new URL(EMPLOYEE_DASHBOARD, request.url));
    }

    return response;
  } catch (err) {
    console.error('Middleware auth check error:', err);
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
