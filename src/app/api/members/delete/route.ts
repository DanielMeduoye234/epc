import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isInShepherdFlock, shepherdBacentaNames } from '@/lib/flock';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('id, role, branch_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!callerProfile || !['super_admin', 'bishop', 'shepherd'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to delete members' }, { status: 403 });
    }

    const body = await request.json();
    const memberId = body.member_id || body.id;

    if (!memberId) {
      return NextResponse.json({ error: 'Missing member_id' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch the member to verify existence and check permissions
    const { data: member, error: memberFetchError } = await admin
      .from('members')
      .select('id, full_name, branch_id, assigned_shepherd, bacenta')
      .eq('id', memberId)
      .maybeSingle();

    if (memberFetchError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Role-based authorization check
    if (callerProfile.role === 'super_admin' && member.branch_id !== callerProfile.branch_id) {
      return NextResponse.json({ error: 'Forbidden: Member belongs to another branch' }, { status: 403 });
    }

    if (callerProfile.role === 'shepherd') {
      if (member.branch_id !== callerProfile.branch_id) {
        return NextResponse.json({ error: 'Forbidden: Member belongs to another branch' }, { status: 403 });
      }

      const { data: shepherdProfile } = await admin
        .from('profiles')
        .select('id, bacenta:bacentas!profiles_bacenta_id_fkey(name)')
        .eq('id', callerProfile.id)
        .maybeSingle();

      const { data: shepherdBacentas } = await admin
        .from('shepherd_bacentas')
        .select('bacenta:bacentas(name)')
        .eq('shepherd_id', callerProfile.id)
        .eq('branch_id', callerProfile.branch_id);

      type ShepherdBacentaJoin = { bacenta: { name: string } | { name: string }[] | null };
      const assignedBacentaNames = ((shepherdBacentas || []) as unknown as ShepherdBacentaJoin[])
        .map((row) => {
          const b = row?.bacenta;
          if (Array.isArray(b)) return b[0]?.name;
          return b?.name;
        })
        .filter((name): name is string => Boolean(name));

      const bacentaNames = shepherdBacentaNames({
        bacentas: assignedBacentaNames.map((name) => ({ name })),
        bacenta: (shepherdProfile as { bacenta?: { name: string } | null } | null)?.bacenta || null,
      });

      if (!isInShepherdFlock(member, callerProfile.id, bacentaNames)) {
        return NextResponse.json(
          { error: 'Forbidden: You can only delete members under your direct care or bacenta' },
          { status: 403 }
        );
      }
    }

    // Perform complete purge of all records associated with this member
    // 1. Attendance records (polymorphic person_id without direct foreign key constraint)
    await admin.from('attendance').delete().eq('person_id', memberId);

    // 2. Chat messages (polymorphic person_id without direct foreign key constraint)
    await admin.from('chat_messages').delete().eq('person_id', memberId);

    // 3. Follow-up records
    await admin.from('follow_ups').delete().eq('member_id', memberId);

    // 4. Visitations
    await admin.from('visitations').delete().eq('member_id', memberId);

    // 5. Alerts
    await admin.from('alerts').delete().eq('member_id', memberId);

    // 6. Birthday messages
    await admin.from('birthday_messages').delete().eq('member_id', memberId);

    // 7. Delete the member record itself
    const { error: deleteError } = await admin
      .from('members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete member record: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Member ${member.full_name} and all associated records deleted completely.`,
      deleted_id: memberId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 });
  }
}
