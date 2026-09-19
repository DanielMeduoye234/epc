'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      void applySession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        void applySession(session);
      }
    );

    return () => {
      cancelled = true;
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
