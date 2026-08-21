import { createAdminClient } from '@/lib/supabase/admin';
import { authorizeCron } from '@/lib/cron-auth';
import { getBranchWhatsAppCredentials, sendBulkWhatsApp } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';
import { BroadcastAudience } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

function timeToMinutes(hhmm: string) {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

async function run(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const now = new Date();
  const dayOfWeek = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const { data: schedules } = await supabase
    .from('prayer_schedules')
    .select('*')
    .eq('is_active', true)
    .eq('day_of_week', dayOfWeek);

  const due = (schedules || []).filter((schedule) => {
    const delta = nowMinutes - timeToMinutes(schedule.time);
    return delta >= 0 && delta < 5;
  });

  if (due.length === 0) {
    return NextResponse.json({ message: 'No prayers to send at this time' });
  }

  const results = [];

  for (const schedule of due) {
    const recipients = await getRecipients(supabase, schedule.audience as BroadcastAudience, schedule.branch_id);
    if (recipients.length === 0) continue;

    try {
      const credentials = await getBranchWhatsAppCredentials(supabase, schedule.branch_id);
      const sendResults = await sendBulkWhatsApp({
        recipients,
        message: schedule.message,
        phoneNumberId: credentials.phoneNumberId,
        accessToken: credentials.accessToken,
      });
      const successCount = sendResults.filter((r) => r.success).length;

      await supabase.from('broadcasts').insert({
        title: schedule.title,
        message: schedule.message,
        image_url: null,
        audience: schedule.audience,
        message_type: 'prayer',
        status: 'sent',
        recipients_count: successCount,
        branch_id: schedule.branch_id,
        created_by: schedule.created_by,
        sent_at: new Date().toISOString(),
      });

      results.push({
        schedule_id: schedule.id,
        title: schedule.title,
        sent: successCount,
        total: recipients.length,
      });
    } catch (error) {
      results.push({
        schedule_id: schedule.id,
        title: schedule.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({ success: true, results });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

async function getRecipients(
  supabase: SupabaseClient,
  audience: BroadcastAudience,
  branchId: string
): Promise<{ phone_number: string; full_name: string }[]> {
  const recipients: { phone_number: string; full_name: string }[] = [];

  if (audience === 'all' || audience === 'new_believers') {
    const { data } = await supabase
      .from('new_believers')
      .select('phone_number, full_name')
      .eq('branch_id', branchId);
    if (data) recipients.push(...data);
  }

  if (audience === 'all' || audience === 'first_timers') {
    const { data } = await supabase
      .from('first_timers')
      .select('phone_number, full_name')
      .eq('branch_id', branchId)
      .eq('status', 'first_timer');
    if (data) recipients.push(...data);
  }

  if (audience === 'all' || audience === 'members') {
    const { data } = await supabase
      .from('members')
      .select('phone_number, full_name')
      .eq('branch_id', branchId);
    if (data) recipients.push(...data);
  }

  const seen = new Set<string>();
  return recipients.filter((r) => {
    const phone = r.phone_number.replace(/\D/g, '');
    if (seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });
}
