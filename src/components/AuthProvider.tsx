'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import { isDemoMode, DEMO_PROFILE } from '@/lib/demo-data';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType>({ profile: null, loading: true, isDemo: false });

async function resolveProfile(
  supabase: ReturnType<typeof createClient>,
  session: Session
): Promise<Profile | null> {
  const user = session.user;

  // Direct profile read with explicit foreign key to prevent PostgREST PGRST201 ambiguity.
  let { data: profileRow } = await supabase
    .from('profiles')
    .select('*, branch:branches(*), bacenta:bacentas!profiles_bacenta_id_fkey(*)')
    .eq('id', user.id)
    .maybeSingle();

  // If joined query returned nothing or failed, try plain select + separate branch fetch
  if (!profileRow) {
    const { data: plainRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (plainRow) {
      let branch = null;
      if (plainRow.branch_id) {
        const { data: bData } = await supabase
          .from('branches')
          .select('*')
          .eq('id', plainRow.branch_id)
          .maybeSingle();
        branch = bData;
      }
      profileRow = { ...plainRow, branch, bacenta: null };
    }
  }

  // Fallback via service-role /api/auth/me if client RLS hid the row
  if (!profileRow) {
    try {
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        profileRow = meData.profile ?? null;
      }
    } catch {
      // ignore
    }
  }

  if (!profileRow) {
    return null;
  }

  if (profileRow?.role === 'shepherd') {
    const { data: assignedBacentas, error: assignedBacentasError } = await supabase
      .from('shepherd_bacentas')
      .select('bacenta:bacentas(*)')
      .eq('shepherd_id', profileRow.id)
      .eq('branch_id', profileRow.branch_id);

    const assigned = assignedBacentasError
      ? []
      : (assignedBacentas || [])
          .map((row: { bacenta: Profile['bacenta'] }) => row.bacenta)
          .filter(Boolean);

    profileRow = {
      ...profileRow,
      bacentas: assigned.length > 0
        ? assigned
        : profileRow.bacenta ? [profileRow.bacenta] : [],
    };
  }

  return (profileRow as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const demo = isDemoMode();

  useEffect(() => {
    if (demo) {
      setProfile(DEMO_PROFILE);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    async function handleAuthFailure() {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name] = cookie.trim().split('=');
          if (name && (name.includes('-auth-token') || name.startsWith('sb-'))) {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
          }
        }
      }
      if (!cancelled) {
        setProfile(null);
        setLoading(false);
      }
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
        window.location.href = '/login';
      }
    }

    async function applySession(session: Session | null) {
      if (cancelled) return;
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const next = await resolveProfile(supabase, session);
        if (!cancelled) setProfile(next);
      } catch (err) {
        console.error('Error resolving profile:', err);
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Intercept background unhandled rejections from supabase auto-refresh so Next.js doesn't show an error overlay
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = (reason?.message || String(reason || '')).toLowerCase();
      if (msg.includes('invalid refresh token') || (msg.includes('refresh token') && msg.includes('not found'))) {
        event.preventDefault();
        void handleAuthFailure();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
    }

    supabase.auth
      .getSession()
      .then(async ({ data, error }: { data: { session: Session | null }; error: AuthError | null }) => {
        if (cancelled) return;
        if (error) {
          const msg = error.message?.toLowerCase() || '';
          if (msg.includes('refresh token') || msg.includes('not found') || error.status === 400) {
            await handleAuthFailure();
            return;
          }
        }
        await applySession(data?.session ?? null);
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
        if (msg.includes('refresh token') || msg.includes('not found')) {
          await handleAuthFailure();
          return;
        }
        await applySession(null);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        if (cancelled) return;
        if (event === 'SIGNED_OUT') {
          void applySession(null);
          return;
        }
        if (event === 'TOKEN_REFRESHED' && !session) {
          await handleAuthFailure();
          return;
        }
        void applySession(session);
      }
    );

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      }
      subscription.unsubscribe();
    };
  }, [demo]);

  return (
    <AuthContext.Provider value={{ profile, loading, isDemo: demo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
