import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient, type User } from '@supabase/supabase-js';

export async function getRequestUser(request: Request): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const tokenClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data } = await tokenClient.auth.getUser(authorization.slice(7));
  return data.user ?? null;
}

export const SELF_SIGNUP_ROLES = ['super_admin', 'shepherd', 'recorder'] as const;
export type SelfSignupRole = (typeof SELF_SIGNUP_ROLES)[number];

export function parseSignupRole(value: unknown): SelfSignupRole | null {
  if (typeof value !== 'string') return null;
  return SELF_SIGNUP_ROLES.includes(value as SelfSignupRole) ? (value as SelfSignupRole) : null;
}
