import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const member = body.member || {};
    const memberName = String(member.full_name || '').trim();
    const memberEmail = normalizeEmail(String(member.email || ''));
    const pastorId = String(body.pastor_id || '').trim();
    const scheduledDate = String(body.scheduled_date || '').trim();
    const scheduledTime = String(body.scheduled_time || '').trim();
    const topic = String(body.topic || '').trim();

    if (!memberName || !memberEmail || !pastorId || !scheduledDate || !scheduledTime || !topic) {
      return NextResponse.json({ error: 'Member details, pastor, date, time, and topic are required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: pastor, error: pastorError } = await admin
      .from('counselling_pastors')
      .select('id, full_name, google_meet_link, is_active')
      .eq('id', pastorId)
      .maybeSingle();

    if (pastorError) {
      return NextResponse.json({ error: pastorError.message }, { status: 500 });
    }

    if (!pastor || !pastor.is_active) {
      return NextResponse.json({ error: 'Selected pastor is not available.' }, { status: 404 });
    }

    const { data: existingBooking } = await admin
      .from('counselling_bookings')
      .select('id')
      .eq('pastor_id', pastorId)
      .eq('scheduled_date', scheduledDate)
      .eq('scheduled_time', scheduledTime)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json({ error: 'That time is already booked for this pastor. Choose another time.' }, { status: 409 });
    }

    const { data: counsellingMember, error: memberError } = await admin
      .from('counselling_members')
      .upsert({
        full_name: memberName,
        email: memberEmail,
        phone_number: member.phone_number ? String(member.phone_number).trim() : null,
      }, { onConflict: 'email' })
      .select('id, full_name, email, phone_number')
      .single();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    const { data: booking, error: bookingError } = await admin
      .from('counselling_bookings')
      .insert({
        pastor_id: pastorId,
        member_id: counsellingMember.id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        topic,
        notes: body.notes ? String(body.notes).trim() : null,
        meeting_link: pastor.google_meet_link,
        status: 'requested',
      })
      .select('id, scheduled_date, scheduled_time, topic, meeting_link, status, pastor:counselling_pastors(full_name), member:counselling_members(full_name, email)')
      .single();

    if (bookingError) {
      return NextResponse.json({ error: bookingError.message }, { status: 500 });
    }

    return NextResponse.json({ booking });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}