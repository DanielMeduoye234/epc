import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendBulkWhatsApp } from '@/lib/whatsapp';
import { NextRequest, NextResponse } from 'next/server';
import { BroadcastAudience } from '@/lib/types';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is super_admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { title, message, image_url, audience, message_type, branch_id, created_by, send_now, scheduled_at } = body;

  if (!title || !message || !audience || !branch_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get recipients based on audience
  const recipients = await getRecipients(supabase, audience as BroadcastAudience, branch_id);

  if (!send_now) {
    // Save as scheduled
    const { error } = await supabase.from('broadcasts').insert({
      title,
      message,
      image_url,
      audience,
      message_type,
      status: 'scheduled',
      recipients_count: recipients.length,
      branch_id,
      created_by,
      scheduled_at,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, scheduled: true, recipients: recipients.length });
  }

  // Send now
  let results;
  try {
    results = await sendBulkWhatsApp({
      recipients,
      message,
      imageUrl: image_url || undefined,
    });
  } catch (error) {
    // Save as failed
    await supabase.from('broadcasts').insert({
      title,
      message,
      image_url,
      audience,
      message_type,
      status: 'failed',
      recipients_count: recipients.length,
      branch_id,
      created_by,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send messages' },
      { status: 500 }
    );
  }

  const successCount = results.filter((r) => r.success).length;

  // Save broadcast record
  await supabase.from('broadcasts').insert({
    title,
    message,
    image_url,
    audience,
    message_type,
    status: 'sent',
    recipients_count: successCount,
    branch_id,
    created_by,
    sent_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    sent: successCount,
    failed: results.length - successCount,
    total: results.length,
  });
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
