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

async function loadShepherdBacentas(
  supabase: ReturnType<typeof createClient>,
  profileRow: Profile
): Promise<Profile> {
  if (profileRow.role !== 'shepherd' || !profileRow.branch_id) {
    return profileRow;
  }

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

  return {
    ...profileRow,
    bacentas: assigned.length > 0
      ? assigned
      : profileRow.bacenta ? [profileRow.bacenta] : [],
  };
}

async function fetchProfileForSession(
  supabase: ReturnType<typeof createClient>,
  session: Session
): Promise<Profile | null> {
  const user = session.user;
  const authHeaders: HeadersInit = {
    Authorization: `Bearer ${session.access_token}`,
  };

  // Always try service-role path first — existing branch accounts must load.
  try {
    const meRes = await fetch('/api/auth/me', { headers: authHeaders, cache: 'no-store' });
    if (meRes.ok) {
      const meData = await meRes.json();
      if (meData.profile) {
        return await loadShepherdBacentas(supabase, meData.profile as Profile);
      }
    }
  } catch {
    // Fall through to client read.
  }

  const { data: clientProfile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*), bacenta:bacentas(*)')
    .eq('id', user.id)
    .maybeSingle();

  if (clientProfile) {
    return await loadShepherdBacentas(supabase, clientProfile as Profile);
  }

  // Only create when the server confirms there is truly no profile.
  const meta = user.user_metadata ?? {};
  const createRes = await fetch('/api/auth/create-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      full_name: meta.full_name || '',
      email: user.email || '',
      role: meta.role || 'recorder',
    }),
  });

  if (createRes.ok) {
    const meRes = await fetch('/api/auth/me', { headers: authHeaders, cache: 'no-store' });
    if (meRes.ok) {
      const meData = await meRes.json();
      if (meData.profile) {
        return await loadShepherdBacentas(supabase, meData.profile as Profile);
      }
    }
    const { data: refetch } = await supabase
      .from('profiles')
      .select('*, branch:branches(*), bacenta:bacentas(*)')
      .eq('id', user.id)
      .maybeSingle();
    if (refetch) {
      return await loadShepherdBacentas(supabase, refetch as Profile);
    }
  }

  return null;
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
        const nextProfile = await fetchProfileForSession(supabase, session);
        if (!cancelled) setProfile(nextProfile);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Initial session (may be empty briefly on first paint).
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      void applySession(data.session);
    });

    // Re-run whenever auth settles — this is what stops the false setup screen.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      void applySession(session);
    });

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
