import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET: Webhook verification handshake required by Meta
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// POST: Receive incoming WhatsApp messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate it's from WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        const value = change.value;

        // Handle status updates (delivered, read)
        for (const status of value.statuses || []) {
          await supabase
            .from('chat_messages')
            .update({ status: status.status })
            .eq('wa_message_id', status.id);
        }

        // Handle incoming messages
        for (const message of value.messages || []) {
          if (message.type !== 'text') continue;

          const fromPhone = message.from; // e.g. "2348012345678"
          const msgText = message.text?.body || '';
          const waMessageId = message.id;

          // Find the person by phone number across all tables
          const phone_variants = [
            fromPhone,
            `+${fromPhone}`,
            fromPhone.startsWith('234') ? `0${fromPhone.slice(3)}` : fromPhone,
          ];

          let personRow: { id: string; type: string; branch_id: string } | null = null;

          for (const table of ['new_believers', 'first_timers', 'members']) {
            const personType = table === 'new_believers' ? 'new_believer' : table === 'first_timers' ? 'first_timer' : 'member';
            for (const phone of phone_variants) {
              const { data } = await supabase
                .from(table)
                .select('id, branch_id')
                .ilike('phone_number', `%${fromPhone.slice(-9)}%`)
                .limit(1)
                .single();

              if (data) {
                personRow = { id: data.id, type: personType, branch_id: data.branch_id };
                break;
              }
            }
            if (personRow) break;
          }

          if (!personRow) continue;

          // Store the inbound message
          await supabase.from('chat_messages').insert({
            person_id: personRow.id,
            person_type: personRow.type,
            phone_number: fromPhone,
            direction: 'inbound',
            message: msgText,
            wa_message_id: waMessageId,
            status: 'read',
            branch_id: personRow.branch_id,
            sent_by: null,
          });
        }
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
