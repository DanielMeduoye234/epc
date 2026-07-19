import type { createAdminClient } from '@/lib/supabase/admin';

export const PHOTO_BUCKET = 'member-photos';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Uploads a member photo to storage and returns its public URL. Creates the
// bucket on first use. Returns null on failure — a photo problem should never
// block the registration itself.
export async function uploadMemberPhoto(
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
