import { type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

export async function middleware(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname;

  // Protected routes
  const protectedRoutes = [
    '/dashboard',
    '/dashboard/*',
    '/certificates',
    '/certificates/*',
    '/courses/*',
    '/learning-paths/*',
    '/admin',
    '/admin/*',
    '/instructor',
    '/instructor/*',
  ];

  // Redirect to login if not authenticated on a protected route
  if (
    protectedRoutes.some(route => pathname.startsWith(route.replace('*', ''))) &&
    (!user || userError)
  ) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // /admin additionally requires is_admin. The check above should already have
  // redirected unauthenticated requests; this guard keeps that independent of
  // the protectedRoutes list staying correct.
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

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
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

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