'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUser } from '@/components/providers/user-provider';

/**
 * Soft client-side gate for instructor pages, mirroring AdminGuard. Reads the
 * shared user context. Checks is_instructor AND status='active' (matching
 * is_instructor() AND is_active_user() in RLS). Middleware is authoritative.
 *
 * Three-way: loading -> spinner; error (network) -> retry, NO redirect;
 * ready && not-an-active-instructor -> redirect; else children.
 */
export function InstructorGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading, error, retry } = useUser();

  useEffect(() => {
    if (loading || error) return; // never redirect while loading or on a network error
    if (!profile) {
      router.push('/login');
      return;
    }
    if (!profile.is_instructor || profile.status !== 'active') {
      router.push('/dashboard');
    }
  }, [loading, error, profile, router]);

  if (loading) {
    return <div className="text-center p-6">Loading...</div>;
  }
  if (error) {
    return (
      <div className="text-center p-6 space-y-3">
        <p className="text-destructive">Connection issue — couldn&apos;t reach the server.</p>
        <button
          type="button"
          onClick={retry}
          className="rounded border px-3 py-1 text-sm font-medium hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  const allowed = !!profile?.is_instructor && profile?.status === 'active';
  if (!allowed) {
    return <div className="text-center p-6">Loading...</div>; // redirect in flight
  }

  return <>{children}</>;
}
