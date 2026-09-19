import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestUser } from '@/lib/request-user';
import { NextResponse } from 'next/server';

/**
 * Returns the signed-in user's profile + branch using the service role.
 * Bypasses client RLS so existing branch accounts always reach their dashboard
 * even if a SELECT policy was too strict.
 */
export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from('profiles')
      .select('*, branch:branches(*), bacenta:bacentas(*)')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    let bacentas: unknown[] = [];
    if (profile.role === 'shepherd' && profile.branch_id) {
      const { data: assigned } = await admin
        .from('shepherd_bacentas')
        .select('bacenta:bacentas(*)')
        .eq('shepherd_id', profile.id)
        .eq('branch_id', profile.branch_id);

      bacentas = (assigned || [])
        .map((row: { bacenta: unknown }) => row.bacenta)
        .filter(Boolean);

      if (bacentas.length === 0 && profile.bacenta) {
        bacentas = [profile.bacenta];
      }
    }

    return NextResponse.json({
      profile: {
        ...profile,
        bacentas,
      },
    });
  } catch (err: unknown) {
    console.error('[auth/me] Unexpected error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
