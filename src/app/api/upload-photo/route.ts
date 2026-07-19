import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { uploadMemberPhoto, MAX_PHOTO_BYTES } from '@/lib/photo-storage';

// Authenticated endpoint: uploads a member photo for the caller's branch and
// returns its public URL. Used by the dashboard's Add Member modal.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('branch_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.branch_id) {
    return NextResponse.json({ error: 'No branch on profile' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: 'Photo is too large (max 5MB)' }, { status: 400 });
  }

  const url = await uploadMemberPhoto(createAdminClient(), profile.branch_id, photo);
  if (!url) {
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
  }
  return NextResponse.json({ url });
}
