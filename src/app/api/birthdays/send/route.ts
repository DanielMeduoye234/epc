import { createBirthdayMessage, birthdayDateForYear } from '@/lib/birthdays';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, branch_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['super_admin', 'bishop'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { member_id } = await request.json();
  if (!member_id) return NextResponse.json({ error: 'member_id is required' }, { status: 400 });

  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin
    .from('members')
    .select('id, full_name, phone_number, birthday, branch_id')
    .eq('id', member_id)
    .eq('branch_id', profile.branch_id)
    .maybeSingle();

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  if (!member.birthday) return NextResponse.json({ error: 'Member has no birthday recorded' }, { status: 400 });
  if (!member.phone_number) return NextResponse.json({ error: 'Member has no WhatsApp phone number recorded' }, { status: 400 });

  const message = createBirthdayMessage(member.full_name);
  const birthdayDate = birthdayDateForYear(member.birthday);

  try {
    await sendWhatsAppMessage({ to: member.phone_number, message });
    await admin.from('birthday_messages').upsert({
      member_id: member.id,
      branch_id: member.branch_id,
      birthday_date: birthdayDate,
      message,
      sent_by: profile.id,
      whatsapp_status: 'sent',
      error: null,
    }, { onConflict: 'member_id,birthday_date' });
    return NextResponse.json({ success: true, message });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await admin.from('birthday_messages').upsert({
      member_id: member.id,
      branch_id: member.branch_id,
      birthday_date: birthdayDate,
      message,
      sent_by: profile.id,
      whatsapp_status: 'failed',
      error: errorMessage,
    }, { onConflict: 'member_id,birthday_date' });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}