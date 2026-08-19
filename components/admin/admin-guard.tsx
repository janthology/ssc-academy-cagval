'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUser } from '@/components/providers/user-provider';

/**
 * Soft client-side gate for admin pages. Reads the shared user context instead of
 * running its own getUser()+users select. Middleware remains the authoritative
 * server-side gate; this only controls what the client renders.
 *
 * Three-way: loading -> spinner; error (network) -> retry, NO redirect (a hang is
 * not a deauth); ready && !admin -> redirect; ready && admin -> children.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading, error, retry } = useUser();

  useEffect(() => {
    if (loading || error) return; // never redirect while loading or on a network error
    if (!profile?.is_admin) router.push('/dashboard');
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
  if (!profile?.is_admin) {
    return <div className="text-center p-6">Loading...</div>; // redirect in flight
  }

  return <>{children}</>;
}
