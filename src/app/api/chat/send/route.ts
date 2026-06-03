import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify the user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, branch_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 401 });
    }

    const body = await req.json();
    const { person_id, person_type, phone_number, message, branch_id } = body;

    if (!person_id || !person_type || !phone_number || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Send via WhatsApp Cloud API
    let waMessageId: string | null = null;
    let status = 'sent';

    try {
      const result = await sendWhatsAppMessage({ to: phone_number, message });
      waMessageId = result?.messages?.[0]?.id || null;
    } catch {
      status = 'failed';
    }

    // Store message in database
    const { data: chatMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        person_id,
        person_type,
        phone_number,
        direction: 'outbound',
        message,
        wa_message_id: waMessageId,
        status,
        branch_id: branch_id || profile.branch_id,
        sent_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chatMessage, waStatus: status });
  } catch (error) {
    console.error('Chat send error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
