import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!callerProfile || !['super_admin', 'bishop'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, location, branch_code } = await request.json();
  if (!name || !branch_code) {
    return NextResponse.json({ error: 'Branch name and code are required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: branch, error: branchError } = await admin
    .from('branches')
    .insert({ name, location: location || null, branch_code: (branch_code as string).toUpperCase() })
    .select()
    .single();

  if (branchError) {
    return NextResponse.json({ error: branchError.message }, { status: 500 });
  }

  // Assign this user to the new branch
  const { error: updateError } = await admin
    .from('profiles')
    .update({ branch_id: branch.id })
    .eq('id', user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, branch });
}
