import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PHOTO_BUCKET = 'member-photos';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Uploads the registrant's photo to storage and returns its public URL.
// Creates the bucket on first use. Returns null on failure — a photo problem
// should never block the registration itself.
async function uploadPhoto(
  admin: ReturnType<typeof createAdminClient>,
  branchId: string,
  photo: File
): Promise<string | null> {
  if (!photo.type.startsWith('image/') || photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
    return null;
  }
  const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${branchId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const bytes = await photo.arrayBuffer();

  let { error } = await admin.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: photo.type });
  if (error) {
    await admin.storage.createBucket(PHOTO_BUCKET, { public: true, fileSizeLimit: MAX_PHOTO_BYTES }).catch(() => {});
    ({ error } = await admin.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: photo.type }));
  }
  if (error) return null;
  return admin.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Public endpoint: returns the branch name and its bacentas so the QR
// registration form can render without authentication.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  if (!UUID_RE.test(branchId)) {
    return NextResponse.json({ error: 'Invalid branch link' }, { status: 400 });
  }

  const admin = createAdminClient();
  const [branchRes, bacentaRes] = await Promise.all([
    admin.from('branches').select('id, name, location').eq('id', branchId).maybeSingle(),
    admin.from('bacentas').select('id, name, leader_name').eq('branch_id', branchId).order('name'),
  ]);

  if (!branchRes.data) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
  }

  return NextResponse.json({
    branch: branchRes.data,
    bacentas: bacentaRes.data || [],
  });
}

// Public endpoint: registers a member under the branch encoded in the QR link.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  if (!UUID_RE.test(branchId)) {
    return NextResponse.json({ error: 'Invalid branch link' }, { status: 400 });
  }

  // Accept multipart/form-data (photo uploads) as well as plain JSON.
  let body: {
    full_name?: string;
    phone_number?: string;
    bacenta?: string;
    address?: string;
    who_brought?: string;
    is_first_timer?: boolean;
  };
  let photo: File | null = null;
  try {
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await request.formData();
      const field = (name: string) => {
        const v = form.get(name);
        return typeof v === 'string' ? v : '';
      };
      body = {
        full_name: field('full_name'),
        phone_number: field('phone_number'),
        bacenta: field('bacenta'),
        address: field('address'),
        who_brought: field('who_brought'),
        is_first_timer: field('is_first_timer') === 'true',
      };
      const photoEntry = form.get('photo');
      if (photoEntry instanceof File && photoEntry.size > 0) {
        if (photoEntry.size > MAX_PHOTO_BYTES) {
          return NextResponse.json({ error: 'Photo is too large (max 5MB)' }, { status: 400 });
        }
        photo = photoEntry;
      }
    } else {
      body = await request.json();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const fullName = (body.full_name || '').trim();
  const phoneNumber = (body.phone_number || '').trim();
  const bacenta = (body.bacenta || '').trim();

  if (!fullName || !phoneNumber) {
    return NextResponse.json({ error: 'Full name and phone number are required' }, { status: 400 });
  }
  if (fullName.length > 120 || phoneNumber.length > 30) {
    return NextResponse.json({ error: 'Name or phone number is too long' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: branch } = await admin
    .from('branches')
    .select('id')
    .eq('id', branchId)
    .maybeSingle();
  if (!branch) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
  }

  // Duplicate guard: no member with the same name (case-insensitive) or phone
  // number may be registered twice under the same branch.
  const { data: existing } = await admin
    .from('members')
    .select('full_name, phone_number')
    .eq('branch_id', branchId);

  const nameKey = fullName.toLowerCase();
  const phoneKey = phoneNumber.replace(/\s+/g, '');
  const duplicate = (existing || []).find(
    (m: { full_name: string; phone_number: string }) =>
      m.full_name.trim().toLowerCase() === nameKey ||
      (m.phone_number && m.phone_number.replace(/\s+/g, '') === phoneKey)
  );
  if (duplicate) {
    const reason = duplicate.full_name.trim().toLowerCase() === nameKey
      ? 'This name is already registered in this branch'
      : 'This phone number is already registered in this branch';
    return NextResponse.json({ error: reason }, { status: 409 });
  }

  const photoUrl = photo ? await uploadPhoto(admin, branchId, photo) : null;

  const today = new Date().toISOString().split('T')[0];
  const { error: insertError } = await admin.from('members').insert({
    full_name: fullName,
    phone_number: phoneNumber,
    address: (body.address || '').trim(),
    bacenta: bacenta || 'Unassigned',
    who_brought: (body.who_brought || '').trim(),
    date_joined: today,
    membership_date: today,
    branch_id: branchId,
    status: 'active',
    photo_url: photoUrl,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (body.is_first_timer) {
    await admin.from('first_timers').insert({
      full_name: fullName,
      phone_number: phoneNumber,
      address: (body.address || '').trim(),
      bacenta: bacenta || 'Unassigned',
      who_brought: (body.who_brought || '').trim(),
      date_joined: today,
      branch_id: branchId,
      status: 'first_timer',
      photo_url: photoUrl,
    });
  }

  return NextResponse.json({ success: true });
}
