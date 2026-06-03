import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendBulkWhatsApp } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';
import { BroadcastAudience } from '@/lib/types';

// This endpoint sends broadcasts that were scheduled for the current time
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  // Find scheduled broadcasts that are due
  const now = new Date().toISOString();
  const { data: broadcasts } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now);

  if (!broadcasts || broadcasts.length === 0) {
    return NextResponse.json({ message: 'No scheduled broadcasts to send' });
  }

  const results = [];

  for (const broadcast of broadcasts) {
    const recipients = await getRecipients(supabase, broadcast.audience as BroadcastAudience, broadcast.branch_id);

    try {
      const sendResults = await sendBulkWhatsApp({
        recipients,
        message: broadcast.message,
        imageUrl: broadcast.image_url || undefined,
      });

      const successCount = sendResults.filter((r) => r.success).length;

      await supabase
        .from('broadcasts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          recipients_count: successCount,
        })
        .eq('id', broadcast.id);

      results.push({ id: broadcast.id, sent: successCount });
    } catch (error) {
      await supabase
        .from('broadcasts')
        .update({ status: 'failed' })
        .eq('id', broadcast.id);

      results.push({
        id: broadcast.id,
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

  const seen = new Set<string>();
  return recipients.filter((r) => {
    const phone = r.phone_number.replace(/\D/g, '');
    if (seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });
}
