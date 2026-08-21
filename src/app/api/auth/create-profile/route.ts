import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestUser, parseSignupRole } from '@/lib/request-user';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Sign in before creating a profile.' }, { status: 401 });
    }

    const { full_name, email, role, branch_id, branchCode } = await request.json();
    const resolvedRole =
      parseSignupRole(user.user_metadata?.role) || parseSignupRole(role) || 'recorder';

    const name = (typeof full_name === 'string' && full_name.trim()) || user.user_metadata?.full_name || '';
    if (!name) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    let resolvedBranchId = typeof branch_id === 'string' ? branch_id : undefined;

    if (!resolvedBranchId && (resolvedRole === 'shepherd' || resolvedRole === 'recorder')) {
      if (!branchCode || typeof branchCode !== 'string') {
        return NextResponse.json({ error: 'Branch code is required for this role' }, { status: 400 });
      }

      const { data: branch } = await admin
        .from('branches')
        .select('id')
        .ilike('branch_code', branchCode.trim())
        .maybeSingle();

      if (!branch) {
        return NextResponse.json({ error: 'Invalid branch code. Please confirm with your admin.' }, { status: 404 });
      }

      resolvedBranchId = branch.id;
    }

    const profileData: Record<string, string> = {
      id: user.id,
      full_name: name,
      email: (typeof email === 'string' && email) || user.email || '',
      role: resolvedRole,
    };
    if (resolvedBranchId) profileData.branch_id = resolvedBranchId;

    const { error } = await admin.from('profiles').upsert(profileData);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[create-profile] Unexpected error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
