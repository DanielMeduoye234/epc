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

  const { shepherd_id, reassign_to } = await request.json();
  if (!shepherd_id) {
    return NextResponse.json({ error: 'Missing shepherd_id' }, { status: 400 });
  }
  if (shepherd_id === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Target must be a shepherd in the caller's branch
  const { data: target } = await admin
    .from('profiles')
    .select('id, role, branch_id')
    .eq('id', shepherd_id)
    .maybeSingle();

  if (!target || target.role !== 'shepherd' || target.branch_id !== callerProfile.branch_id) {
    return NextResponse.json({ error: 'Shepherd not found in your branch' }, { status: 404 });
  }

  // Optional replacement shepherd must also be a shepherd in the same branch
  if (reassign_to) {
    const { data: replacement } = await admin
      .from('profiles')
      .select('id, role, branch_id')
      .eq('id', reassign_to)
      .maybeSingle();
    if (!replacement || replacement.role !== 'shepherd' || replacement.branch_id !== callerProfile.branch_id) {
      return NextResponse.json({ error: 'Replacement shepherd not found in your branch' }, { status: 400 });
    }
  }

  const newShepherd = reassign_to || null;

  // Reassign every record that points at the shepherd being removed
  const reassignments = await Promise.all([
    admin.from('members').update({ assigned_shepherd: newShepherd }).eq('assigned_shepherd', shepherd_id),
    admin.from('first_timers').update({ assigned_shepherd: newShepherd }).eq('assigned_shepherd', shepherd_id),
  ]);
  const reassignError = reassignments.find((r) => r.error)?.error;
  if (reassignError) {
    return NextResponse.json({ error: reassignError.message }, { status: 500 });
  }

  // Move bacenta links over to the replacement (skipping bacentas they already lead)
  const { data: links } = await admin
    .from('shepherd_bacentas')
    .select('bacenta_id, branch_id')
    .eq('shepherd_id', shepherd_id);

  const { error: unlinkError } = await admin
    .from('shepherd_bacentas')
    .delete()
    .eq('shepherd_id', shepherd_id);
  if (unlinkError) {
    return NextResponse.json({ error: unlinkError.message }, { status: 500 });
  }

  if (newShepherd && links && links.length > 0) {
    const { data: existingLinks } = await admin
      .from('shepherd_bacentas')
      .select('bacenta_id')
      .eq('shepherd_id', newShepherd);
    const alreadyLinked = new Set((existingLinks || []).map((l: { bacenta_id: string }) => l.bacenta_id));
    const newLinks = links
      .filter((l: { bacenta_id: string }) => !alreadyLinked.has(l.bacenta_id))
      .map((l: { bacenta_id: string; branch_id: string }) => ({
        shepherd_id: newShepherd,
        bacenta_id: l.bacenta_id,
        branch_id: l.branch_id,
      }));
    if (newLinks.length > 0) {
      const { error: linkError } = await admin.from('shepherd_bacentas').insert(newLinks);
      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }
  }

  // Remove the profile, then the auth user
  const { error: profileError } = await admin.from('profiles').delete().eq('id', shepherd_id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: authError } = await admin.auth.admin.deleteUser(shepherd_id);
  if (authError) {
    // Profile is already gone; report but treat as partial success
    return NextResponse.json({ success: true, warning: `Profile removed but auth user deletion failed: ${authError.message}` });
  }

  return NextResponse.json({ success: true });
}
