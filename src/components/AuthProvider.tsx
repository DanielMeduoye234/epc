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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let { data } = await supabase
          .from('profiles')
          .select('*, branch:branches(*)')
          .eq('id', user.id)
          .maybeSingle();

        // Auto-repair: if the auth user exists but has no profile row, create it now
        if (!data) {
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
            data = refetch.data;
          }
        }

        setProfile(data);
      }
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
