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

      const { data, error } = await supabase
        .from('profiles')
        .select('*, branch:branches(*)')
        .eq('id', user.id)
        .maybeSingle();

      let profileRow = data;

      if (!profileRow && !error) {
        const meta = user.user_metadata ?? {};
        const res = await fetch('/api/auth/create-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            full_name: meta.full_name || '',
            email: user.email || '',
            role: meta.role || 'recorder',
          }),
        });
        if (res.ok) {
          const refetch = await supabase
            .from('profiles')
            .select('*, branch:branches(*)')
            .eq('id', user.id)
            .maybeSingle();
          profileRow = refetch.data;
        }
      }

      if (profileRow?.role === 'shepherd') {
        const { data: assignedBacentas, error: assignedBacentasError } = await supabase
          .from('shepherd_bacentas')
          .select('bacenta:bacentas(*)')
          .eq('shepherd_id', profileRow.id)
          .eq('branch_id', profileRow.branch_id);

        profileRow = {
          ...profileRow,
          bacentas: assignedBacentasError
            ? profileRow.bacenta ? [profileRow.bacenta] : []
            : (assignedBacentas || [])
              .map((row: { bacenta: Profile['bacenta'] }) => row.bacenta)
              .filter(Boolean),
        };
      }

      setProfile(profileRow);
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
