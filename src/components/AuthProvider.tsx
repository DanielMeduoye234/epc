'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
    async function getProfile() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      // 1) Prefer a direct client read (own-row RLS).
      let { data: profileRow } = await supabase
        .from('profiles')
        .select('*, branch:branches(*), bacenta:bacentas(*)')
        .eq('id', user.id)
        .maybeSingle();

      // 2) If RLS/client miss, load via service-role API so existing branch
      //    accounts still reach their dashboard.
      if (!profileRow) {
        const headers: HeadersInit = {};
        if (session.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
        const meRes = await fetch('/api/auth/me', { headers });
        if (meRes.ok) {
          const meData = await meRes.json();
          profileRow = meData.profile ?? null;
        }
      }

      // 3) Only create a brand-new profile when none exists at all.
      //    Never invent a second setup flow for accounts that already have a branch.
      if (!profileRow) {
        const meta = user.user_metadata ?? {};
        const res = await fetch('/api/auth/create-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            userId: user.id,
            full_name: meta.full_name || '',
            email: user.email || '',
            role: meta.role || 'recorder',
          }),
        });
        if (res.ok) {
          const meRes = await fetch('/api/auth/me', {
            headers: session.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {},
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            profileRow = meData.profile ?? null;
          }
          if (!profileRow) {
            const refetch = await supabase
              .from('profiles')
              .select('*, branch:branches(*), bacenta:bacentas(*)')
              .eq('id', user.id)
              .maybeSingle();
            profileRow = refetch.data;
          }
        }
      }

      if (profileRow) {
        profileRow = await loadShepherdBacentas(supabase, profileRow as Profile);
      }

      setProfile(profileRow as Profile | null);
      setLoading(false);
    }
    getProfile();
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
