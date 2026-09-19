import type { UserRole } from '@/lib/types';

export type AssistantLink = {
  href: string;
  label: string;
};

export type KnowledgeArticle = {
  id: string;
  title: string;
  keywords: string[];
  roles: UserRole[] | 'all';
  body: string;
  links: AssistantLink[];
};

export const KNOWLEDGE: KnowledgeArticle[] = [
  {
    id: 'overview',
    title: 'How Everything by Prayer works',
    keywords: ['help', 'start', 'how', 'use', 'platform', 'what', 'fold', 'dashboard', 'guide', 'ebp', 'prayer'],
    roles: 'all',
    body: `Everything by Prayer is EPC's church-growth workspace. Your job on most screens is one of four things: record a person, mark Sunday attendance, notice who is at risk, then follow up.

I can explain any page, look up live numbers for your branch, search people, and send you to the right screen. Ask in everyday language: "How do I mark attendance?" or "Who is flagged?"`,
    links: [{ href: '/dashboard', label: 'Open dashboard' }],
  },
  {
    id: 'new-believers',
    title: 'Record a New Believer',
    keywords: ['new believer', 'nb', 'altar', 'saved', 'salvation', 'gave their life', 'officer', 'recorder'],
    roles: ['bishop', 'super_admin', 'recorder'],
    body: `Use New Believers when someone gives their life to Christ.

1. Open New Believers.
2. Tap Add New Believer.
3. Enter name, phone (WhatsApp), address, bacenta, and who brought them. Date saved defaults to today.
4. Save. You can open the row later to add a photo or chat on WhatsApp.

Search and pagination sit above the table. On a phone the table still scrolls sideways; tap a name to open the full profile.`,
    links: [{ href: '/dashboard/new-believers', label: 'Go to New Believers' }],
  },
  {
    id: 'first-timers',
    title: 'Track First Timers',
    keywords: ['first timer', 'first-timer', 'visitor', 'guest', 'newcomer', 'promote'],
    roles: ['bishop', 'super_admin', 'recorder', 'shepherd'],
    body: `First Timers are first-time visitors, not yet members.

Add them the same way as New Believers. The list shows how many times they have been marked present. The intended rule is promotion after two attendances in a calendar month (the UI says "twice in a month").

Promotion currently runs when attendance is saved, not from a weekly cron. If someone is ready, an admin can also use Church Attendance. The Alerts page has a Promote Now button that is not wired yet; use attendance marking instead.`,
    links: [
      { href: '/dashboard/first-timers', label: 'Go to First Timers' },
      { href: '/dashboard/church-attendance', label: 'Church Attendance' },
    ],
  },
  {
    id: 'members',
    title: 'Members and My Sheep',
    keywords: ['member', 'sheep', 'flock', 'regular', 'directory', 'deactivate'],
    roles: ['bishop', 'super_admin', 'shepherd'],
    body: `Members (labelled My Sheep for shepherds) is the living directory.

- Search by name or phone.
- Filter by bacenta and status (active, inactive, flagged).
- Add a member, assign a bacenta, or deactivate someone who has left.
- Shepherds only see people assigned to them or in their bacentas.
- Recorders cannot manage members.

Click a name to open the profile: photo, WhatsApp chat, and attendance history.`,
    links: [{ href: '/dashboard/regular-members', label: 'Open Members / My Sheep' }],
  },
  {
    id: 'attendance-shepherd',
    title: 'Mark Sunday attendance',
    keywords: ['attendance', 'mark', 'present', 'sunday', "shepherd's data", 'weekly'],
    roles: ['shepherd', 'bishop'],
    body: `Shepherds mark attendance on Shepherd's Data.

1. Open Shepherd's Data.
2. Pick the Sunday date.
3. Search or filter by bacenta.
4. Tick who was present, then save.

Saving also runs first-timer promotion checks. Super Admins are redirected away from this page; they mark attendance on Church Attendance instead.

Bishops see shepherd analytics here (who is marking, who is behind), not the tick-grid.`,
    links: [{ href: '/dashboard/attendance', label: "Open Shepherd's Data" }],
  },
  {
    id: 'church-attendance',
    title: 'Church Attendance (admin)',
    keywords: ['church attendance', 'sunday tracker', 'qr', 'overview', 'monthly records'],
    roles: ['bishop', 'super_admin'],
    body: `Church Attendance is the admin hub: overview charts, a Sunday tracker grid, monthly records, add-member, bacenta tools, and the branch QR code for public registration.

Use this to see the whole house on a Sunday, not only one shepherd's fold. It overlaps Bacentas and Members, so prefer this page for Sunday ops and the dedicated pages for slow, careful CRUD.

The QR code sends guests to /register/[branchId], which currently writes them straight into Members.`,
    links: [{ href: '/dashboard/church-attendance', label: 'Open Church Attendance' }],
  },
  {
    id: 'bacentas',
    title: 'Bacentas',
    keywords: ['bacenta', 'cell', 'fellowship', 'zone', 'leader'],
    roles: ['bishop', 'super_admin'],
    body: `A bacenta is a geographical fellowship unit. Create bacentas, assign shepherds, and expand a row to see its members.

Member counts are loaded per bacenta (this can feel slow in a large branch). After you add bacentas, people forms can pick them from a dropdown instead of free text.`,
    links: [{ href: '/dashboard/bacentas', label: 'Open Bacentas' }],
  },
  {
    id: 'shepherds',
    title: 'Shepherds',
    keywords: ['shepherd', 'leaderboard', 'performance', 'reassign', 'delete shepherd'],
    roles: ['bishop', 'super_admin'],
    body: `Shepherds shows each shepherd's flock size and attendance. Expand a row to see their sheep. You can open a deep link with ?shepherdId= from Shepherd's Data.

Deleting a shepherd asks you to reassign their people first. There is no search box yet; scroll or use the dashboard filters.`,
    links: [{ href: '/dashboard/shepherds', label: 'Open Shepherds' }],
  },
  {
    id: 'alerts',
    title: 'Alerts',
    keywords: ['alert', 'flagged', 'absence', 'notification', 'unread'],
    roles: ['bishop', 'super_admin', 'shepherd'],
    body: `Alerts lists absence, birthday, and promotion-ready notices. Mark one read with the close control.

Shepherds currently see the whole branch feed, not only their flock. Promote Now on an alert does not run yet; open the person and mark attendance, or use Church Attendance.

Ask me "who is flagged?" and I will look up live at-risk members.`,
    links: [{ href: '/dashboard/alerts', label: 'Open Alerts' }],
  },
  {
    id: 'follow-ups',
    title: 'Follow-ups',
    keywords: ['follow up', 'follow-up', 'call', 'whatsapp', 'log'],
    roles: ['bishop', 'super_admin', 'shepherd'],
    body: `Log every call, visit, WhatsApp, or prayer for a member.

1. Open Follow-ups.
2. Tap to add a log: pick the person, type, status (completed, no answer, scheduled), and notes.
3. Edit or delete from the timeline.

Shepherds currently see every branch log. Prefer writing notes that another shepherd could act on.`,
    links: [{ href: '/dashboard/follow-ups', label: 'Open Follow-ups' }],
  },
  {
    id: 'visitations',
    title: 'Visitations',
    keywords: ['visit', 'visitation', 'home visit', 'schedule', 'house'],
    roles: ['bishop', 'super_admin', 'shepherd'],
    body: `Schedule a home visit, then mark it complete when you have been.

There is no calendar grid yet; the page is a list split into upcoming and completed. Past-due visits are not highlighted automatically. Marking complete cannot be undone from the UI.`,
    links: [{ href: '/dashboard/visitations', label: 'Open Visitations' }],
  },
  {
    id: 'birthdays',
    title: 'Birthdays',
    keywords: ['birthday', 'wish', 'celebrate'],
    roles: ['bishop', 'super_admin'],
    body: `Birthdays lists members with a birthday on file. You can preview a WhatsApp wish and send it.

Sending needs WhatsApp credentials. Each branch can set its own Meta Phone Number ID in Settings. Staff accounts share that branch line. The access token stays on the server.

If Send is disabled, the member has no phone number. Add it on their profile.`,
    links: [{ href: '/dashboard/birthdays', label: 'Open Birthdays' }],
  },
  {
    id: 'reports',
    title: 'Reports',
    keywords: ['report', 'export', 'csv', 'download', 'excel'],
    roles: ['bishop', 'super_admin'],
    body: `Reports exports CSV for summary, members, attendance, and follow-ups. Set a date range first.

Watch the default dates: they may still be stuck on May 2026. Set "this month" yourself before downloading. The members export filters by date joined in range, so it is not a full directory dump. Preview shows only a few rows.`,
    links: [{ href: '/dashboard/reports', label: 'Open Reports' }],
  },
  {
    id: 'news',
    title: 'EPC News broadcasts',
    keywords: ['news', 'broadcast', 'whatsapp blast', 'announcement', 'message'],
    roles: ['bishop', 'super_admin'],
    body: `EPC News composes a WhatsApp broadcast to all, new believers, first timers, or members. You can send now or schedule.

Quick Actions currently open a blank composer; they do not fill the templates. The send API only allows Super Admin, so bishops can open the page and still get a 403 on send.

WhatsApp must be configured in environment variables. Branch Settings stores a WhatsApp number that is not used for sending yet.`,
    links: [{ href: '/dashboard/epc-news', label: 'Open EPC News' }],
  },
  {
    id: 'prayers',
    title: 'Prayer schedules',
    keywords: ['prayer', 'schedule', 'weekly message'],
    roles: ['bishop', 'super_admin'],
    body: `Create a weekly prayer message: pick day, time, audience, then toggle it active. Delete with the browser confirm dialog (other pages use a modal).

There is no edit screen; delete and recreate to change copy. Delivery depends on the send-prayers cron (every 5 minutes on Vercel) plus WhatsApp credentials.`,
    links: [{ href: '/dashboard/prayers', label: 'Open Prayers' }],
  },
  {
    id: 'settings',
    title: 'Settings and inviting the team',
    keywords: ['settings', 'invite', 'user', 'role', 'password', 'team', 'whatsapp config'],
    roles: ['bishop', 'super_admin'],
    body: `Settings shows branch info, WhatsApp sender fields, and the team list.

To add someone: Invite user, choose role, and share the temporary password. Prefer telling shepherds and officers to use Signup with your branch code instead of handing out Super Admin.

Do not promote someone to bishop without a conversation. There is no deactivate-user control yet.`,
    links: [{ href: '/dashboard/settings', label: 'Open Settings' }],
  },
  {
    id: 'branches',
    title: 'Branches (bishop)',
    keywords: ['branch', 'multi-branch', 'locations'],
    roles: ['bishop'],
    body: `Branches is bishop-only. You see each location's member and conversion counts. The attendance percentage on that page is currently hardcoded at 75% and should not be trusted until it is wired to real attendance.

Create additional branches from Settings or the admin create-branch API, not from this cards view.`,
    links: [{ href: '/dashboard/branches', label: 'Open Branches' }],
  },
  {
    id: 'profile',
    title: 'Person profile',
    keywords: ['profile', 'photo', 'chat', 'history'],
    roles: 'all',
    body: `Click any person to open their profile. You can upload a photo, start a WhatsApp chat (if credentials are set), and review attendance.

Use the sidebar or a list page to go back; the back control uses browser history and can leave the app if you arrived from a link.`,
    links: [{ href: '/dashboard/regular-members', label: 'Browse people' }],
  },
  {
    id: 'register',
    title: 'Public QR registration',
    keywords: ['qr', 'register', 'self register', 'guest form'],
    roles: ['bishop', 'super_admin'],
    body: `Share the branch QR from Church Attendance. Guests open /register/[branchId] and submit their details with an optional photo.

That form writes into Members (and optionally First Timers). It is unauthenticated, so treat the QR as a Sunday-table tool, not a public website embed without watching the list.`,
    links: [{ href: '/dashboard/church-attendance', label: 'Find the branch QR' }],
  },
  {
    id: 'roles',
    title: 'Roles and who can do what',
    keywords: ['role', 'permission', 'bishop', 'admin', 'recorder', 'access'],
    roles: 'all',
    body: `Bishop: all branches, shepherds, reports, settings.
Super Admin: full control inside one branch.
Shepherd: My Sheep, attendance, alerts, follow-ups, visitations.
Recorder (NB Officer): New Believers and First Timers only.

The permissions file in code is not wired into the sidebar yet. The sidebar hides links by role, but typing a URL can still open some pages. If a screen looks empty or locked, you are on a role that is not meant to use it.`,
    links: [{ href: '/dashboard', label: 'Back to dashboard' }],
  },
];

export function articlesForRole(role: UserRole): KnowledgeArticle[] {
  return KNOWLEDGE.filter((article) => article.roles === 'all' || article.roles.includes(role));
}
