import { createAdminClient } from '@/lib/supabase/admin';
import { authorizeCron } from '@/lib/cron-auth';
import { getBranchWhatsAppCredentials, sendBulkWhatsApp } from '@/lib/whatsapp';
import { templateNameForMessageType } from '@/lib/whatsapp-templates';
import { NextRequest, NextResponse } from 'next/server';
import { BroadcastAudience } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

async function run(request: NextRequest) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const supabase = createAdminClient();
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
      const credentials = await getBranchWhatsAppCredentials(supabase, broadcast.branch_id);
      const sendResults = await sendBulkWhatsApp({
        recipients,
        message: broadcast.message,
        imageUrl: broadcast.image_url || undefined,
        phoneNumberId: credentials.phoneNumberId,
        accessToken: credentials.accessToken,
        templateName: templateNameForMessageType(broadcast.message_type),
        templateLanguage: 'en_US',
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
