import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { userId, full_name, email, role, branch_id } = await request.json();

    if (!userId || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();
    const profileData: Record<string, string> = {
      id: userId,
      full_name,
      email: email || '',
      role,
    };
    if (branch_id) profileData.branch_id = branch_id;

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
