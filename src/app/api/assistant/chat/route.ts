import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { runAssistant, type ChatTurn } from '@/lib/assistant/engine';
import { suggestionsForRole } from '@/lib/assistant/suggestions';
import { DEMO_PROFILE, isDemoMode } from '@/lib/demo-data';
import type { Profile } from '@/lib/types';

function parseTurns(body: { history?: unknown }): ChatTurn[] {
  if (!Array.isArray(body.history)) return [];
  return body.history
    .filter(
      (turn: unknown) =>
        turn &&
        typeof turn === 'object' &&
        'role' in turn &&
        'content' in turn &&
        (turn.role === 'user' || turn.role === 'assistant') &&
        typeof turn.content === 'string'
    )
    .slice(-8)
    .map((turn: ChatTurn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'Type a question first.' }, { status: 400 });
    }
    if (message.length > 1200) {
      return NextResponse.json({ error: 'Keep questions under 1200 characters.' }, { status: 400 });
    }
    const history = parseTurns(body);

    if (isDemoMode()) {
      const result = await runAssistant(message, history, DEMO_PROFILE, null);
      return NextResponse.json({
        ...result,
        suggestions: suggestionsForRole(DEMO_PROFILE.role),
      });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Sign in to use Fold Assistant.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, branch:branches(*)')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: 'Your profile is not ready yet.' }, { status: 403 });
    }

    const result = await runAssistant(message, history, profile as Profile, supabase);
    return NextResponse.json({
      ...result,
      suggestions: suggestionsForRole(profile.role),
    });
  } catch (error) {
    console.error('[assistant/chat]', error);
    return NextResponse.json({ error: 'Fold Assistant could not answer just now.' }, { status: 500 });
  }
}
