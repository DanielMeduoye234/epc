import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendBulkWhatsApp } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';
import { BroadcastAudience } from '@/lib/types';

// This endpoint is called by a cron job (e.g., Supabase Edge Function or Vercel Cron)
// It checks for prayer schedules that should be sent at the current day/time
export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sunday
  const currentTime = now.toTimeString().slice(0, 5); // HH:mm

  // Find active prayer schedules for current day and time (within 5 min window)
  const { data: schedules } = await supabase
    .from('prayer_schedules')
    .select('*')
    .eq('is_active', true)
    .eq('day_of_week', dayOfWeek)
    .eq('time', currentTime);

  if (!schedules || schedules.length === 0) {
    return NextResponse.json({ message: 'No prayers to send at this time' });
  }

  const results = [];

  for (const schedule of schedules) {
    const recipients = await getRecipients(supabase, schedule.audience as BroadcastAudience, schedule.branch_id);

    if (recipients.length === 0) continue;

    try {
      const sendResults = await sendBulkWhatsApp({
        recipients,
        message: schedule.message,
      });

      const successCount = sendResults.filter((r) => r.success).length;

      // Log the broadcast
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

async function getRecipients(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
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

  // Deduplicate by phone number
  const seen = new Set<string>();
  return recipients.filter((r) => {
    const phone = r.phone_number.replace(/\D/g, '');
    if (seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });
}
