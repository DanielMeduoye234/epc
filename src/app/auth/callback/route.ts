import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Safety net: ensure profile exists after email confirmation
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createAdminClient();
        const { data: existing } = await admin
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (!existing) {
          const meta = user.user_metadata ?? {};
          await admin.from('profiles').insert({
            id: user.id,
            full_name: meta.full_name || '',
            email: user.email || '',
            role: meta.role || 'recorder',
          });
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
