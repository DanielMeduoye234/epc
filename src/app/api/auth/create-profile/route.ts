import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, full_name, email, role, branch_id, branchCode } = await request.json();

    if (!userId || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();
    let resolvedBranchId = branch_id;

    if (!resolvedBranchId && (role === 'shepherd' || role === 'recorder')) {
      if (!branchCode) {
        return NextResponse.json({ error: 'Branch code is required for this role' }, { status: 400 });
      }

      const { data: branch } = await admin
        .from('branches')
        .select('id')
        .ilike('branch_code', (branchCode as string).trim())
        .maybeSingle();

      if (!branch) {
        return NextResponse.json({ error: 'Invalid branch code. Please confirm with your admin.' }, { status: 404 });
      }

      resolvedBranchId = branch.id;
    }

    const profileData: Record<string, string> = {
      id: userId,
      full_name,
      email: email || '',
      role,
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
