import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/lib/types';
import { articlesForRole, type AssistantLink } from './knowledge';

export type AssistantToolName =
  | 'get_help'
  | 'get_stats'
  | 'search_people'
  | 'get_alerts'
  | 'get_birthdays';

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_help',
      description: 'Explain how to use a page or workflow on The Fold.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Page or task, e.g. attendance, new believers, follow-ups, roles.',
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_stats',
      description: 'Live counts for this user: members, first timers, new believers, flagged people.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_people',
      description: 'Search members, first timers, and new believers by name or phone.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name or phone fragment.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_alerts',
      description: 'Unread or recent alerts, plus flagged members.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_birthdays',
      description: 'Members with birthdays coming up in the next 14 days, plus today.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

type ToolResult = {
  text: string;
  links: AssistantLink[];
};

function canSeeMembers(role: UserRole) {
  return role === 'bishop' || role === 'super_admin' || role === 'shepherd';
}

async function shepherdScope(
  supabase: SupabaseClient,
  profile: Profile
): Promise<{ bacentaNames: string[] }> {
  const { data } = await supabase
    .from('shepherd_bacentas')
    .select('bacenta:bacentas(name)')
    .eq('shepherd_id', profile.id)
    .eq('branch_id', profile.branch_id);

  const bacentaNames = (data || [])
    .map((row) => {
      const bacenta = row.bacenta as { name?: string } | { name?: string }[] | null;
      if (Array.isArray(bacenta)) return bacenta[0]?.name;
      return bacenta?.name;
    })
    .filter((name): name is string => Boolean(name));

  if (bacentaNames.length === 0 && profile.bacenta?.name) {
    bacentaNames.push(profile.bacenta.name);
  }

  return { bacentaNames };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  profile: Profile
): Promise<ToolResult> {
  switch (name) {
    case 'get_help':
      return runHelp(String(args.topic || ''), profile.role);
    case 'get_stats':
      return runStats(supabase, profile);
    case 'search_people':
      return runSearch(supabase, profile, String(args.query || ''));
    case 'get_alerts':
      return runAlerts(supabase, profile);
    case 'get_birthdays':
      return runBirthdays(supabase, profile);
    default:
      return { text: `Unknown tool: ${name}`, links: [] };
  }
}

function runHelp(topic: string, role: UserRole): ToolResult {
  const articles = articlesForRole(role);
  const needle = topic.toLowerCase();
  const ranked = articles
    .map((article) => {
      const hay = `${article.title} ${article.keywords.join(' ')} ${article.id}`.toLowerCase();
      const score = needle
        .split(/\s+/)
        .filter(Boolean)
        .reduce((sum, word) => sum + (hay.includes(word) ? 2 : 0) + (article.keywords.some((k) => k.includes(word)) ? 1 : 0), 0);
      return { article, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.score ? ranked[0].article : articles.find((a) => a.id === 'overview');
  if (!best) return { text: 'I do not have a guide for that yet.', links: [] };
  return { text: `**${best.title}**\n\n${best.body}`, links: best.links };
}

async function runStats(supabase: SupabaseClient, profile: Profile): Promise<ToolResult> {
  const branchId = profile.branch_id;
  const links: AssistantLink[] = [{ href: '/dashboard', label: 'Open dashboard' }];

  if (profile.role === 'recorder') {
    const [{ count: nb }, { count: ft }] = await Promise.all([
      supabase.from('new_believers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
      supabase.from('first_timers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'first_timer'),
    ]);
    return {
      text: `${profile.branch?.name || 'Your branch'} right now:\n- New Believers: ${nb ?? 0}\n- Active First Timers: ${ft ?? 0}\n\nRecord today's altar-call names on New Believers.`,
      links: [
        { href: '/dashboard/new-believers', label: 'Record New Believer' },
        { href: '/dashboard/first-timers', label: 'First Timers' },
      ],
    };
  }

  if (!canSeeMembers(profile.role)) {
    return { text: 'Your role does not include membership stats.', links };
  }

  let memberQuery = supabase.from('members').select('id, status', { count: 'exact' }).eq('branch_id', branchId);
  if (profile.role === 'shepherd') {
    const { bacentaNames } = await shepherdScope(supabase, profile);
    const orFilter = [`assigned_shepherd.eq.${profile.id}`, ...bacentaNames.map((name) => `bacenta.eq.${name}`)].join(',');
    memberQuery = memberQuery.or(orFilter);
  }

  const [{ data: members }, { count: nb }, { count: ft }] = await Promise.all([
    memberQuery,
    supabase.from('new_believers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
    supabase.from('first_timers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'first_timer'),
  ]);

  const list = members || [];
  const flagged = list.filter((m) => m.status === 'flagged').length;
  const inactive = list.filter((m) => m.status === 'inactive').length;

  return {
    text: `${profile.branch?.name || 'Your branch'} snapshot:\n- Members in your view: ${list.length}\n- Flagged (need follow-up): ${flagged}\n- Inactive: ${inactive}\n- New Believers: ${nb ?? 0}\n- Active First Timers: ${ft ?? 0}`,
    links: [
      { href: '/dashboard/regular-members', label: 'Open members' },
      { href: '/dashboard/alerts', label: 'Open alerts' },
    ],
  };
}

async function runSearch(
  supabase: SupabaseClient,
  profile: Profile,
  query: string
): Promise<ToolResult> {
  const q = query.trim().replace(/[,()%]/g, ' ').slice(0, 80);
  if (q.length < 2) {
    return { text: 'Type at least two letters of a name or phone number.', links: [] };
  }

  const branchId = profile.branch_id;
  const like = `%${q}%`;
  const results: { name: string; kind: string; extra: string; href: string }[] = [];

  const canNb = profile.role !== 'shepherd';
  const canMembers = canSeeMembers(profile.role);

  if (canNb) {
    const [{ data: nbs }, { data: fts }] = await Promise.all([
      supabase.from('new_believers').select('id, full_name, phone_number, bacenta').eq('branch_id', branchId).or(`full_name.ilike.${like},phone_number.ilike.${like}`).limit(5),
      supabase.from('first_timers').select('id, full_name, phone_number, bacenta, status').eq('branch_id', branchId).or(`full_name.ilike.${like},phone_number.ilike.${like}`).limit(5),
    ]);
    for (const row of nbs || []) {
      results.push({
        name: row.full_name,
        kind: 'New Believer',
        extra: row.bacenta || row.phone_number || '',
        href: `/dashboard/profile/new_believer/${row.id}`,
      });
    }
    for (const row of fts || []) {
      results.push({
        name: row.full_name,
        kind: row.status === 'member' ? 'First Timer (promoted)' : 'First Timer',
        extra: row.bacenta || row.phone_number || '',
        href: `/dashboard/profile/first_timer/${row.id}`,
      });
    }
  }

  if (canMembers) {
    let memberQuery = supabase
      .from('members')
      .select('id, full_name, phone_number, bacenta, status')
      .eq('branch_id', branchId)
      .or(`full_name.ilike.${like},phone_number.ilike.${like}`)
      .limit(8);
    if (profile.role === 'shepherd') {
      const { bacentaNames } = await shepherdScope(supabase, profile);
      const orFilter = [`assigned_shepherd.eq.${profile.id}`, ...bacentaNames.map((name) => `bacenta.eq.${name}`)].join(',');
      memberQuery = memberQuery.or(orFilter);
    }
    const { data: members } = await memberQuery;
    for (const row of members || []) {
      results.push({
        name: row.full_name,
        kind: `Member (${row.status})`,
        extra: row.bacenta || row.phone_number || '',
        href: `/dashboard/profile/member/${row.id}`,
      });
    }
  }

  if (results.length === 0) {
    return { text: `No one matching "${q}" in your branch view.`, links: [] };
  }

  const lines = results.slice(0, 8).map((row) => `- ${row.name} · ${row.kind}${row.extra ? ` · ${row.extra}` : ''}`);
  return {
    text: `Matches for "${q}":\n${lines.join('\n')}`,
    links: results.slice(0, 5).map((row) => ({ href: row.href, label: row.name })),
  };
}

async function runAlerts(supabase: SupabaseClient, profile: Profile): Promise<ToolResult> {
  const { data: alerts } = await supabase
    .from('alerts')
    .select('id, type, priority, title, message, is_read, member_id')
    .eq('branch_id', profile.branch_id)
    .order('created_at', { ascending: false })
    .limit(8);

  let flaggedNote = '';
  if (canSeeMembers(profile.role)) {
    let flaggedQuery = supabase
      .from('members')
      .select('id, full_name, status')
      .eq('branch_id', profile.branch_id)
      .eq('status', 'flagged')
      .limit(8);
    if (profile.role === 'shepherd') {
      const { bacentaNames } = await shepherdScope(supabase, profile);
      flaggedQuery = flaggedQuery.or(
        [`assigned_shepherd.eq.${profile.id}`, ...bacentaNames.map((name) => `bacenta.eq.${name}`)].join(',')
      );
    }
    const { data: flagged } = await flaggedQuery;
    if (flagged && flagged.length > 0) {
      flaggedNote = `\n\nFlagged members:\n${flagged.map((m) => `- ${m.full_name}`).join('\n')}`;
    } else {
      flaggedNote = '\n\nNo flagged members in your view.';
    }
  }

  const unread = (alerts || []).filter((a) => !a.is_read);
  const alertLines =
    (alerts || []).length === 0
      ? 'No alerts stored yet.'
      : (alerts || [])
          .slice(0, 6)
          .map((a) => `- ${a.is_read ? '' : '(unread) '}${a.title}`)
          .join('\n');

  return {
    text: `${unread.length} unread alert${unread.length === 1 ? '' : 's'}.\n${alertLines}${flaggedNote}`,
    links: [{ href: '/dashboard/alerts', label: 'Open Alerts' }],
  };
}

async function runBirthdays(supabase: SupabaseClient, profile: Profile): Promise<ToolResult> {
  if (profile.role === 'recorder') {
    return { text: 'Birthday sending is for pastors and admins.', links: [] };
  }

  const { data: members } = await supabase
    .from('members')
    .select('id, full_name, birthday, phone_number')
    .eq('branch_id', profile.branch_id)
    .not('birthday', 'is', null)
    .eq('status', 'active')
    .limit(200);

  const now = new Date();
  const upcoming = (members || [])
    .map((member) => {
      if (!member.birthday) return null;
      const date = new Date(`${member.birthday}T00:00:00`);
      const next = new Date(now.getFullYear(), date.getMonth(), date.getDate());
      if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        next.setFullYear(now.getFullYear() + 1);
      }
      const days = Math.round((next.getTime() - now.getTime()) / 86400000);
      return { ...member, days };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null && row.days <= 14)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);

  if (upcoming.length === 0) {
    return { text: 'No member birthdays in the next 14 days.', links: [{ href: '/dashboard/birthdays', label: 'Open Birthdays' }] };
  }

  const lines = upcoming.map((row) => {
    const when = row.days === 0 ? 'today' : row.days === 1 ? 'tomorrow' : `in ${row.days} days`;
    return `- ${row.full_name} (${when})`;
  });

  return {
    text: `Upcoming birthdays:\n${lines.join('\n')}`,
    links: upcoming.slice(0, 4).map((row) => ({
      href: `/dashboard/profile/member/${row.id}`,
      label: row.full_name,
    })),
  };
}
