import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Verify the caller is an authenticated super_admin or bishop
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!callerProfile || !['super_admin', 'bishop'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { email, password, full_name, role, branch_id, bacenta_id } = await request.json();
  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const resolvedBranchId = branch_id || callerProfile.branch_id;
  if (bacenta_id) {
    const { data: bacenta } = await supabase
      .from('bacentas')
      .select('id')
      .eq('id', bacenta_id)
      .eq('branch_id', resolvedBranchId)
      .maybeSingle();

    if (!bacenta) {
      return NextResponse.json({ error: 'Selected bacenta does not belong to this branch' }, { status: 400 });
    }
  }

  const admin = createAdminClient();

  // Create auth user without sending email confirmation
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip confirmation email — admin sets password directly
    user_metadata: { full_name, role },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // Create profile with branch assignment
  const { error: profileError } = await admin.from('profiles').insert({
    id: newUser.user.id,
    full_name,
    email,
    role,
    branch_id: resolvedBranchId,
    bacenta_id: role === 'shepherd' ? bacenta_id : null,
  });

  if (profileError) {
    // Clean up the created auth user if profile insert fails
    await admin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (role === 'shepherd' && bacenta_id) {
    await admin.from('shepherd_bacentas').insert({
      shepherd_id: newUser.user.id,
      bacenta_id,
      branch_id: resolvedBranchId,
    });
  }

  return NextResponse.json({ success: true, userId: newUser.user.id });
}
