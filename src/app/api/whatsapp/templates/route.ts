import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createWhatsAppTemplate, listWhatsAppTemplates } from '@/lib/whatsapp';
import { RECOMMENDED_TEMPLATES } from '@/lib/whatsapp-templates';

async function requireNewsEditor() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single();

  if (!profile || !['super_admin', 'bishop'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { profile };
}

export async function GET() {
  const auth = await requireNewsEditor();
  if (auth.error) return auth.error;

  try {
    const templates = await listWhatsAppTemplates();
    return NextResponse.json({ templates, recommended: RECOMMENDED_TEMPLATES });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireNewsEditor();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const names: string[] =
    Array.isArray(body.names) && body.names.length
      ? body.names
      : RECOMMENDED_TEMPLATES.map((t) => t.name);

  const existing = await listWhatsAppTemplates().catch(() => []);
  const existingNames = new Set(existing.map((t) => t.name));
  const created: { name: string; status: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const template of RECOMMENDED_TEMPLATES.filter((t) => names.includes(t.name))) {
    if (existingNames.has(template.name)) {
      skipped.push({ name: template.name, reason: 'Already submitted to Meta' });
      continue;
    }

    try {
      const result = await createWhatsAppTemplate(template);
      created.push({ name: template.name, status: result.status || 'PENDING' });
    } catch (error) {
      failed.push({
        name: template.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const templates = await listWhatsAppTemplates().catch(() => existing);
  return NextResponse.json({ created, skipped, failed, templates, recommended: RECOMMENDED_TEMPLATES });
}
