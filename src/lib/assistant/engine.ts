import type { Profile } from '@/lib/types';
import { articlesForRole, type AssistantLink } from './knowledge';
import { executeTool, TOOL_DEFINITIONS } from './tools';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isDemoMode } from '@/lib/demo-data';

export type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantReply = {
  reply: string;
  links: AssistantLink[];
  source: 'llm' | 'local';
};

function scoreArticle(question: string, title: string, keywords: string[], id: string) {
  const q = question.toLowerCase();
  const hay = `${title} ${keywords.join(' ')} ${id}`.toLowerCase();
  let score = 0;
  for (const word of q.split(/\s+/).filter((w) => w.length > 2)) {
    if (hay.includes(word)) score += 2;
    if (keywords.some((k) => k.includes(word) || word.includes(k))) score += 2;
  }
  return score;
}

function detectTool(question: string): { name: string; args: Record<string, unknown> } | null {
  const q = question.toLowerCase();
  if (/\b(how many|stats?|snapshot|numbers|count|overview of (my|the) (branch|flock))\b/.test(q)) {
    return { name: 'get_stats', args: {} };
  }
  if (/\b(flagged|at risk|at-risk|absent|alerts?|unread)\b/.test(q)) {
    return { name: 'get_alerts', args: {} };
  }
  if (/\bbirthdays?\b/.test(q)) {
    return { name: 'get_birthdays', args: {} };
  }
  const search = q.match(/\b(?:find|search|look up|who is|where's|where is)\s+(.+)/i);
  if (search?.[1] && search[1].trim().length >= 2) {
    return { name: 'search_people', args: { query: search[1].replace(/[?!.]/g, '').trim() } };
  }
  return null;
}

export async function localAssistant(
  question: string,
  profile: Profile,
  supabase: SupabaseClient | null
): Promise<AssistantReply> {
  const tool = isDemoMode() ? null : detectTool(question);
  if (tool && supabase) {
    const result = await executeTool(tool.name, tool.args, supabase, profile);
    return { reply: result.text, links: result.links, source: 'local' };
  }

  const articles = articlesForRole(profile.role);
  const ranked = articles
    .map((article) => ({
      article,
      score: scoreArticle(question, article.title, article.keywords, article.id),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (best && best.score >= 2) {
    return {
      reply: `**${best.article.title}**\n\n${best.article.body}`,
      links: best.article.links,
      source: 'local',
    };
  }

  const overview = articles.find((article) => article.id === 'overview') ?? articles[0];
  return {
    reply: `${overview ? `**${overview.title}**\n\n${overview.body}` : 'Ask how to use any page on Everything by Prayer.'}\n\nYou can also ask for live numbers ("how many members?"), flagged people, birthdays, or "find Ama".`,
    links: overview?.links ?? [],
    source: 'local',
  };
}

function llmConfig() {
  const groq = process.env.GROQ_API_KEY;
  if (groq) {
    return {
      apiKey: groq,
      url: 'https://api.groq.com/openai/v1/chat/completions',
      model: process.env.ASSISTANT_MODEL || 'llama-3.1-8b-instant',
    };
  }
  const openai = process.env.OPENAI_API_KEY;
  if (openai) {
    return {
      apiKey: openai,
      url: 'https://api.openai.com/v1/chat/completions',
      model: process.env.ASSISTANT_MODEL || 'gpt-4o-mini',
    };
  }
  const gemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (gemini) {
    return {
      apiKey: gemini,
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: process.env.ASSISTANT_MODEL || 'gemini-2.0-flash',
    };
  }
  return null;
}

function systemPrompt(profile: Profile) {
  const roleLabel =
    profile.role === 'recorder'
      ? 'New Believer Officer'
      : profile.role.replace('_', ' ');
  return `You are the Everything by Prayer Assistant, the in-app guide for the Everything by Prayer church dashboard.
You help ${profile.full_name}, a ${roleLabel} at ${profile.branch?.name || 'their branch'}.

Rules:
- Be concise, pastoral, and practical. No marketing language.
- Prefer numbered steps for how-to questions.
- Use tools for live data. Do not invent counts or names.
- If a feature is broken or unfinished, say so plainly (you have this in get_help articles).
- Never reveal API keys, SQL, or how to bypass roles.
- After answering, offer one next action.
- Speak in the user's language if they write in another language.`;
}

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

export async function llmAssistant(
  question: string,
  history: ChatTurn[],
  profile: Profile,
  supabase: SupabaseClient | null
): Promise<AssistantReply | null> {
  const config = llmConfig();
  if (!config || !supabase) return null;

  const messages: OpenAiMessage[] = [
    { role: 'system', content: systemPrompt(profile) },
    ...history.slice(-8).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: 'user', content: question },
  ];

  const collectedLinks: AssistantLink[] = [];

  for (let step = 0; step < 4; step += 1) {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Assistant model error (${response.status}): ${errText.slice(0, 240)}`);
    }

    const payload = await response.json();
    const choice = payload.choices?.[0]?.message as OpenAiMessage | undefined;
    if (!choice) break;

    if (choice.tool_calls && choice.tool_calls.length > 0) {
      messages.push(choice);
      for (const call of choice.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          args = {};
        }
        const result = await executeTool(call.function.name, args, supabase, profile);
        collectedLinks.push(...result.links);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result.text,
        });
      }
      continue;
    }

    const text = (choice.content || '').trim();
    if (!text) break;
    const unique = collectedLinks.filter(
      (link, index, arr) => arr.findIndex((item) => item.href === link.href) === index
    );
    return { reply: text, links: unique.slice(0, 6), source: 'llm' };
  }

  return null;
}

export async function runAssistant(
  question: string,
  history: ChatTurn[],
  profile: Profile,
  supabase: SupabaseClient | null
): Promise<AssistantReply> {
  try {
    const llm = await llmAssistant(question, history, profile, supabase);
    if (llm) return llm;
  } catch (error) {
    console.error('[assistant] LLM fallback:', error);
  }
  return localAssistant(question, profile, supabase);
}

export { suggestionsForRole } from './suggestions';
