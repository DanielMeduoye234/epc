import { birthdayDateForYear, createBirthdayMessage, isBirthdayToday } from '@/lib/birthdays';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = new URL(request.url).searchParams.get('secret') || request.headers.get('x-cron-secret');
  if (configuredSecret && providedSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: members, error } = await admin
    .from('members')
    .select('id, full_name, phone_number, birthday, branch_id')
    .not('birthday', 'is', null)
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todayMembers = (members || []).filter((member) => isBirthdayToday(member.birthday));
  const results: Array<{ member_id: string; success: boolean; error?: string }> = [];

  for (const member of todayMembers) {
    const birthdayDate = birthdayDateForYear(member.birthday);
    const { data: existing } = await admin
      .from('birthday_messages')
      .select('id, whatsapp_status')
      .eq('member_id', member.id)
      .eq('birthday_date', birthdayDate)
      .eq('whatsapp_status', 'sent')
      .maybeSingle();

    if (existing) {
      results.push({ member_id: member.id, success: true });
      continue;
    }

    const message = createBirthdayMessage(member.full_name);
    try {
      await sendWhatsAppMessage({ to: member.phone_number, message });
      await admin.from('birthday_messages').upsert({
        member_id: member.id,
        branch_id: member.branch_id,
        birthday_date: birthdayDate,
        message,
        whatsapp_status: 'sent',
        error: null,
      }, { onConflict: 'member_id,birthday_date' });
      results.push({ member_id: member.id, success: true });
    } catch (sendError) {
      const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
      await admin.from('birthday_messages').upsert({
        member_id: member.id,
        branch_id: member.branch_id,
        birthday_date: birthdayDate,
        message,
        whatsapp_status: 'failed',
        error: errorMessage,
      }, { onConflict: 'member_id,birthday_date' });
      results.push({ member_id: member.id, success: false, error: errorMessage });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}