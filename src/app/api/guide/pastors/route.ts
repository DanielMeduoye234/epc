import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

interface SupabaseLikeError {
  code?: string;
  message: string;
}

function errorResponse(error: SupabaseLikeError, fallbackStatus = 500) {
  if (error.code === '42P01') {
    return NextResponse.json(
      { error: 'Counselling tables are not set up yet. Run the EPC Guide counselling schema in Supabase.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ error: error.message }, { status: fallbackStatus });
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('counselling_pastors')
    .select('id, full_name, email, phone_number, bio, specialties, photo_url, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(error);
  }

  return NextResponse.json({ pastors: data || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fullName = String(body.full_name || '').trim();
    const email = normalizeEmail(String(body.email || ''));
    const photoUrl = body.photo_url ? String(body.photo_url) : null;
    const specialties = Array.isArray(body.specialties)
      ? body.specialties.map((item: unknown) => String(item).trim()).filter(Boolean).slice(0, 8)
      : [];

    if (!fullName || !email) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    if (photoUrl && photoUrl.length > 1_500_000) {
      return NextResponse.json({ error: 'Photo is too large. Use an image below 1MB.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('counselling_pastors')
      .upsert({
        full_name: fullName,
        email,
        phone_number: body.phone_number ? String(body.phone_number).trim() : null,
        bio: body.bio ? String(body.bio).trim() : null,
        specialties,
        photo_url: photoUrl,
        is_active: true,
      }, { onConflict: 'email' })
      .select('id, full_name, email, phone_number, bio, specialties, photo_url, created_at')
      .single();

    if (error) {
      return errorResponse(error);
    }

    return NextResponse.json({ pastor: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}