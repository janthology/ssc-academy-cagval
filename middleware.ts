import { type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

function needsAuthCheck(pathname: string): boolean {
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/certificates') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/instructor')
  ) {
    return true
  }
  // Course detail / module pages are protected; the catalog (/courses) is public.
  if (pathname.startsWith('/courses/')) return true
  // Learning-path detail pages are protected; the public list is not.
  if (pathname.startsWith('/learning-paths/')) return true
  return false
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public pages and APIs skip the Auth round-trip entirely. getUser() talks to
  // the Supabase Auth server on every request and was the dominant cost on
  // /courses, /events, /api/courses, and other anon-safe routes.
  if (!needsAuthCheck(pathname)) {
    return NextResponse.next();
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() revalidates the token against the Supabase Auth server.
  // getSession() only decodes the cookie and must not be trusted for authorization.
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // Redirect to login if not authenticated on a protected route
  if (!user || userError) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // /admin additionally requires is_admin.
  if (pathname.startsWith('/admin')) {
    const { data, error: profileError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !data?.is_admin) {
      console.error('Middleware profile error:', profileError?.message || 'Not an admin');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // /instructor requires is_instructor AND an active account — the same pair the
  // instructor RLS policies check (is_instructor() AND is_active_user()), so the
  // UI never shows a surface the database will refuse to write to.
  if (pathname.startsWith('/instructor')) {
    const { data, error: profileError } = await supabase
      .from('users')
      .select('is_instructor, status')
      .eq('id', user.id)
      .single();

    if (profileError || !data?.is_instructor || data.status !== 'active') {
      console.error(
        'Middleware profile error:',
        profileError?.message || 'Not an active instructor'
      );
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
