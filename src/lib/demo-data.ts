import { Profile, UserRole, NewBeliever, FirstTimer, Member, Broadcast, PrayerSchedule, FollowUp, Visitation, Alert, Branch } from './types';

// Check if we're in demo mode
export function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !url || url === 'your-supabase-url-here' || !url.startsWith('http');
}

// Shepherd/Recorder name lookup for super admin views
export const DEMO_USERS: Record<string, { name: string; role: UserRole; bacenta_id?: string | null }> = {
  'demo-user-001': { name: 'Shepherd Samuel', role: 'shepherd', bacenta_id: 'bac-1' },
  'demo-user-002': { name: 'Shepherd Grace', role: 'shepherd', bacenta_id: 'bac-2' },
  'demo-recorder-001': { name: 'Recorder Blessing', role: 'recorder' },
  'demo-admin-001': { name: 'Pastor Admin', role: 'super_admin' },
  'demo-bishop-001': { name: 'Bishop Dominion', role: 'bishop' },
};

export const DEMO_PROFILE: Profile = {
  id: 'demo-bishop-001',
  full_name: 'Bishop Dominion',
  email: 'bishop@epc.church',
  role: 'bishop',
  branch_id: 'demo-branch-001',
  bacenta_id: null,
  created_at: '2025-01-01T00:00:00Z',
  branch: {
    id: 'demo-branch-001',
    name: 'EPC Apache',
    location: 'Apache, Lagos',
    branch_code: 'epc-apache',
    created_at: '2025-01-01T00:00:00Z',
  },
};

export const DEMO_BACENTAS = [
  { id: 'bac-1', name: 'Bacenta Alpha', leader_name: 'Brother Samuel', location: 'Zone A, Lagos', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z' },
  { id: 'bac-2', name: 'Bacenta Beta', leader_name: 'Sister Joy', location: 'Zone B, Ikeja', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z' },
  { id: 'bac-3', name: 'Bacenta Omega', leader_name: 'Brother Daniel', location: 'Zone C, Lekki', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z' },
];

export const DEMO_NEW_BELIEVERS: NewBeliever[] = [
  { id: 'nb-1', full_name: 'Grace Adeyemi', first_name: 'Grace', last_name: 'Adeyemi', nickname: null, birthday: null, address: '12 Harmony Street, Lagos', bacenta: 'Bacenta Alpha', phone_number: '+2348012345678', who_brought: 'Sister Joy', date_saved: '2026-05-10', branch_id: 'demo-branch-001', recorded_by: 'demo-recorder-001', photo_url: null, created_at: '2026-05-10T10:00:00Z' },
  { id: 'nb-2', full_name: 'David Okonkwo', first_name: 'David', last_name: 'Okonkwo', nickname: null, birthday: null, address: '5 Unity Lane, Ikeja', bacenta: 'Bacenta Omega', phone_number: '+2348087654321', who_brought: 'Brother Samuel', date_saved: '2026-05-08', branch_id: 'demo-branch-001', recorded_by: 'demo-recorder-001', photo_url: null, created_at: '2026-05-08T10:00:00Z' },
  { id: 'nb-3', full_name: 'Blessing Eze', first_name: 'Blessing', last_name: 'Eze', nickname: null, birthday: null, address: '20 Grace Avenue, Lekki', bacenta: 'Bacenta Alpha', phone_number: '+2348098765432', who_brought: 'Pastor Admin', date_saved: '2026-05-05', branch_id: 'demo-branch-001', recorded_by: 'demo-recorder-001', photo_url: null, created_at: '2026-05-05T10:00:00Z' },
  { id: 'nb-4', full_name: 'Emmanuel Nwachukwu', first_name: 'Emmanuel', last_name: 'Nwachukwu', nickname: 'Emeka', birthday: null, address: '8 Faith Road, Surulere', bacenta: 'Bacenta Beta', phone_number: '+2348076543210', who_brought: 'Sister Ruth', date_saved: '2026-04-28', branch_id: 'demo-branch-001', recorded_by: 'demo-recorder-001', photo_url: null, created_at: '2026-04-28T10:00:00Z' },
  { id: 'nb-5', full_name: 'Favour Olumide', first_name: 'Favour', last_name: 'Olumide', nickname: null, birthday: null, address: '15 Victory Close, VI', bacenta: 'Bacenta Omega', phone_number: '+2348065432109', who_brought: 'Brother Daniel', date_saved: '2026-04-20', branch_id: 'demo-branch-001', recorded_by: 'demo-recorder-001', photo_url: null, created_at: '2026-04-20T10:00:00Z' },
  { id: 'nb-6', full_name: 'Mercy Johnson', first_name: 'Mercy', last_name: 'Johnson', nickname: null, birthday: null, address: '3 Praise Street, Yaba', bacenta: 'Bacenta Alpha', phone_number: '+2348054321098', who_brought: 'Sister Grace', date_saved: '2026-04-15', branch_id: 'demo-branch-001', recorded_by: 'demo-recorder-001', photo_url: null, created_at: '2026-04-15T10:00:00Z' },
];

export const DEMO_FIRST_TIMERS: FirstTimer[] = [
  { id: 'ft-1', full_name: 'Chioma Adeola', first_name: 'Chioma', last_name: 'Adeola', nickname: null, birthday: '2000-03-15', address: '7 New Life Street, Ajah', bacenta: 'Bacenta Alpha', phone_number: '+2348043210987', who_brought: 'Brother Paul', date_joined: '2026-05-12', branch_id: 'demo-branch-001', assigned_shepherd: 'demo-user-001', status: 'first_timer', photo_url: null, promoted_at: null, created_at: '2026-05-12T10:00:00Z', attendance_count: 2 },
  { id: 'ft-2', full_name: 'Tunde Bakare', first_name: 'Tunde', last_name: 'Bakare', nickname: 'TD', birthday: '1998-07-22', address: '22 Hope Crescent, Ikeja', bacenta: 'Bacenta Beta', phone_number: '+2348032109876', who_brought: 'Sister Mercy', date_joined: '2026-05-05', branch_id: 'demo-branch-001', assigned_shepherd: 'demo-user-001', status: 'first_timer', photo_url: null, promoted_at: null, created_at: '2026-05-05T10:00:00Z', attendance_count: 3 },
  { id: 'ft-3', full_name: 'Amaka Obi', first_name: 'Amaka', last_name: 'Obi', nickname: null, birthday: null, address: '10 Covenant Drive, Lekki', bacenta: 'Bacenta Omega', phone_number: '+2348021098765', who_brought: 'Brother James', date_joined: '2026-05-14', branch_id: 'demo-branch-001', assigned_shepherd: 'demo-user-001', status: 'first_timer', photo_url: null, promoted_at: null, created_at: '2026-05-14T10:00:00Z', attendance_count: 1 },
  { id: 'ft-4', full_name: 'Kemi Afolabi', first_name: 'Kemi', last_name: 'Afolabi', nickname: null, birthday: '2001-11-04', address: '4 Worship Lane, Maryland', bacenta: 'Bacenta Alpha', phone_number: '+2348010987654', who_brought: 'Sister Victoria', date_joined: '2026-04-28', branch_id: 'demo-branch-001', assigned_shepherd: 'demo-user-001', status: 'first_timer', photo_url: null, promoted_at: null, created_at: '2026-04-28T10:00:00Z', attendance_count: 2 },
];

export const DEMO_MEMBERS: Member[] = [
  { id: 'm-1', first_timer_id: null, full_name: 'John Akpan', first_name: 'John', last_name: 'Akpan', nickname: null, address: '14 Glory Street, Lagos', bacenta: 'Bacenta Alpha', phone_number: '+2349012345678', who_brought: 'Pastor Admin', date_joined: '2025-11-01', membership_date: '2025-11-22', assigned_shepherd: 'demo-user-001', branch_id: 'demo-branch-001', status: 'active', photo_url: null, birthday: '1995-05-25', created_at: '2025-11-01T10:00:00Z' },
  { id: 'm-2', first_timer_id: null, full_name: 'Sarah Ogundimu', first_name: 'Sarah', last_name: 'Ogundimu', nickname: null, address: '9 Covenant Crescent, Ikeja', bacenta: 'Bacenta Beta', phone_number: '+2349087654321', who_brought: 'Sister Joy', date_joined: '2025-10-15', membership_date: '2025-11-05', assigned_shepherd: 'demo-user-001', branch_id: 'demo-branch-001', status: 'active', photo_url: null, birthday: '1998-06-12', created_at: '2025-10-15T10:00:00Z' },
  { id: 'm-3', first_timer_id: null, full_name: 'Michael Etim', first_name: 'Michael', last_name: 'Etim', nickname: 'Mike', address: '6 Peace Avenue, Surulere', bacenta: 'Bacenta Omega', phone_number: '+2349076543210', who_brought: 'Brother Samuel', date_joined: '2025-09-20', membership_date: '2025-10-11', assigned_shepherd: 'demo-user-001', branch_id: 'demo-branch-001', status: 'flagged', photo_url: null, birthday: '1992-03-08', created_at: '2025-09-20T10:00:00Z' },
  { id: 'm-4', first_timer_id: null, full_name: 'Ruth Onyeka', first_name: 'Ruth', last_name: 'Onyeka', nickname: null, address: '18 Praise Road, Yaba', bacenta: 'Bacenta Alpha', phone_number: '+2349065432109', who_brought: 'Pastor Admin', date_joined: '2025-12-01', membership_date: '2025-12-22', assigned_shepherd: 'demo-user-002', branch_id: 'demo-branch-001', status: 'active', photo_url: null, birthday: '1997-05-23', created_at: '2025-12-01T10:00:00Z' },
  { id: 'm-5', first_timer_id: null, full_name: 'Peter Adeleke', first_name: 'Peter', last_name: 'Adeleke', nickname: null, address: '2 Hallelujah Close, VI', bacenta: 'Bacenta Beta', phone_number: '+2349054321098', who_brought: 'Brother Daniel', date_joined: '2026-01-10', membership_date: '2026-01-31', assigned_shepherd: 'demo-user-002', branch_id: 'demo-branch-001', status: 'active', photo_url: null, birthday: '2000-12-01', created_at: '2026-01-10T10:00:00Z' },
  { id: 'm-6', first_timer_id: null, full_name: 'Deborah Umeh', first_name: 'Deborah', last_name: 'Umeh', nickname: 'Debs', address: '11 Zion Way, Lekki', bacenta: 'Bacenta Omega', phone_number: '+2349043210987', who_brought: 'Sister Mercy', date_joined: '2026-02-05', membership_date: '2026-02-26', assigned_shepherd: 'demo-user-001', branch_id: 'demo-branch-001', status: 'inactive', photo_url: null, birthday: '1994-08-19', created_at: '2026-02-05T10:00:00Z' },
  { id: 'm-7', first_timer_id: null, full_name: 'Joshua Ibe', first_name: 'Joshua', last_name: 'Ibe', nickname: null, address: '25 Shalom Street, Ajah', bacenta: 'Bacenta Alpha', phone_number: '+2349032109876', who_brought: 'Sister Ruth', date_joined: '2026-03-01', membership_date: '2026-03-22', assigned_shepherd: 'demo-user-002', branch_id: 'demo-branch-001', status: 'active', photo_url: null, birthday: '1999-11-30', created_at: '2026-03-01T10:00:00Z' },
];

export const DEMO_BROADCASTS: Broadcast[] = [
  { id: 'bc-1', title: 'Sunday Service Reminder', message: 'Hello! Don\'t forget our Sunday service tomorrow at 9AM. Come expecting!', image_url: null, audience: 'all', message_type: 'reminder', scheduled_at: null, sent_at: '2026-05-18T08:00:00Z', status: 'sent', recipients_count: 15, branch_id: 'demo-branch-001', created_by: 'demo-user-001', created_at: '2026-05-18T08:00:00Z' },
  { id: 'bc-2', title: 'Welcome New Believers', message: 'Welcome to the family of God! We are so glad you made the decision to follow Christ.', image_url: null, audience: 'new_believers', message_type: 'news', scheduled_at: null, sent_at: '2026-05-15T10:00:00Z', status: 'sent', recipients_count: 6, branch_id: 'demo-branch-001', created_by: 'demo-user-001', created_at: '2026-05-15T10:00:00Z' },
  { id: 'bc-3', title: 'Youth Conference 2026', message: 'Register for our upcoming Youth Conference! It\'s going to be powerful.', image_url: 'https://example.com/flyer.jpg', audience: 'all', message_type: 'event', scheduled_at: '2026-05-25T09:00:00Z', sent_at: null, status: 'scheduled', recipients_count: 17, branch_id: 'demo-branch-001', created_by: 'demo-user-001', created_at: '2026-05-14T10:00:00Z' },
];

// Attendance records
export const DEMO_ATTENDANCE: { member_id: string; date: string; status: 'present' | 'absent' }[] = [
  { member_id: 'm-1', date: '2026-05-18', status: 'present' },
  { member_id: 'm-2', date: '2026-05-18', status: 'present' },
  { member_id: 'm-3', date: '2026-05-18', status: 'absent' },
  { member_id: 'm-4', date: '2026-05-18', status: 'present' },
  { member_id: 'm-5', date: '2026-05-18', status: 'absent' },
  { member_id: 'm-6', date: '2026-05-18', status: 'absent' },
  { member_id: 'm-7', date: '2026-05-18', status: 'present' },
  { member_id: 'm-1', date: '2026-05-11', status: 'present' },
  { member_id: 'm-2', date: '2026-05-11', status: 'present' },
  { member_id: 'm-3', date: '2026-05-11', status: 'absent' },
  { member_id: 'm-4', date: '2026-05-11', status: 'present' },
  { member_id: 'm-5', date: '2026-05-11', status: 'present' },
  { member_id: 'm-6', date: '2026-05-11', status: 'absent' },
  { member_id: 'm-7', date: '2026-05-11', status: 'present' },
];

export const DEMO_PRAYER_SCHEDULES: PrayerSchedule[] = [
  { id: 'ps-1', title: 'Monday Morning Prayer', message: 'Good morning {name}! May God\'s grace be upon you this week. Psalm 23:1', day_of_week: 1, time: '07:00', audience: 'members', is_active: true, branch_id: 'demo-branch-001', created_by: 'demo-user-001', created_at: '2026-05-01T10:00:00Z' },
  { id: 'ps-2', title: 'Wednesday Encouragement', message: 'Hi {name}! Midweek check-in: You can do all things through Christ! Phil 4:13', day_of_week: 3, time: '12:00', audience: 'all', is_active: true, branch_id: 'demo-branch-001', created_by: 'demo-user-001', created_at: '2026-05-01T10:00:00Z' },
  { id: 'ps-3', title: 'Saturday Night Prayer', message: 'Good night {name}. May God grant you peaceful rest. Psalm 91:1', day_of_week: 6, time: '21:00', audience: 'members', is_active: false, branch_id: 'demo-branch-001', created_by: 'demo-user-001', created_at: '2026-05-01T10:00:00Z' },
];

// Multi-branch data for Bishop view
export const DEMO_BRANCHES: Branch[] = [
  { id: 'demo-branch-001', name: 'EPC Apache', location: 'Apache, Lagos', branch_code: 'epc-apache', created_at: '2025-01-01T00:00:00Z' },
  { id: 'demo-branch-002', name: 'EPC Victory', location: 'Ikeja, Lagos', branch_code: 'epc-victory', created_at: '2025-02-01T00:00:00Z' },
  { id: 'demo-branch-003', name: 'EPC Grace', location: 'Lekki, Lagos', branch_code: 'epc-grace', created_at: '2025-03-01T00:00:00Z' },
];

export const DEMO_BRANCH_STATS: Record<string, { pastor: string; members: number; newBelievers: number; firstTimers: number; attendance: number; shepherds: number }> = {
  'demo-branch-001': { pastor: 'Pastor Admin', members: 7, newBelievers: 6, firstTimers: 4, attendance: 72, shepherds: 2 },
  'demo-branch-002': { pastor: 'Pastor Victory', members: 12, newBelievers: 8, firstTimers: 5, attendance: 68, shepherds: 3 },
  'demo-branch-003': { pastor: 'Pastor Grace', members: 9, newBelievers: 4, firstTimers: 3, attendance: 81, shepherds: 2 },
};

// Follow-up tracking
export const DEMO_FOLLOWUPS: FollowUp[] = [
  { id: 'fu-1', member_id: 'm-3', member_name: 'Michael Etim', shepherd_id: 'demo-user-001', shepherd_name: 'Shepherd Samuel', type: 'call', status: 'completed', notes: 'Spoke with him, promised to come this Sunday', date: '2026-05-20', branch_id: 'demo-branch-001', created_at: '2026-05-20T10:00:00Z' },
  { id: 'fu-2', member_id: 'm-6', member_name: 'Deborah Umeh', shepherd_id: 'demo-user-001', shepherd_name: 'Shepherd Samuel', type: 'visit', status: 'completed', notes: 'Visited her home, she was sick. Prayed for her.', date: '2026-05-18', branch_id: 'demo-branch-001', created_at: '2026-05-18T10:00:00Z' },
  { id: 'fu-3', member_id: 'm-3', member_name: 'Michael Etim', shepherd_id: 'demo-user-001', shepherd_name: 'Shepherd Samuel', type: 'whatsapp', status: 'completed', notes: 'Sent encouragement message', date: '2026-05-15', branch_id: 'demo-branch-001', created_at: '2026-05-15T10:00:00Z' },
  { id: 'fu-4', member_id: 'm-6', member_name: 'Deborah Umeh', shepherd_id: 'demo-user-001', shepherd_name: 'Shepherd Samuel', type: 'call', status: 'no_answer', notes: 'Phone was off', date: '2026-05-12', branch_id: 'demo-branch-001', created_at: '2026-05-12T10:00:00Z' },
];

// Visitation schedule
export const DEMO_VISITATIONS: Visitation[] = [
  { id: 'vs-1', member_id: 'm-6', member_name: 'Deborah Umeh', shepherd_id: 'demo-user-001', shepherd_name: 'Shepherd Samuel', scheduled_date: '2026-05-25', completed: false, notes: 'Follow up on health status', address: '11 Zion Way, Lekki', branch_id: 'demo-branch-001', created_at: '2026-05-20T10:00:00Z' },
  { id: 'vs-2', member_id: 'm-3', member_name: 'Michael Etim', shepherd_id: 'demo-user-001', shepherd_name: 'Shepherd Samuel', scheduled_date: '2026-05-26', completed: false, notes: 'Accountability check', address: '6 Peace Avenue, Surulere', branch_id: 'demo-branch-001', created_at: '2026-05-20T10:00:00Z' },
  { id: 'vs-3', member_id: 'm-7', member_name: 'Joshua Ibe', shepherd_id: 'demo-user-002', shepherd_name: 'Shepherd Grace', scheduled_date: '2026-05-24', completed: true, notes: 'New member welcome visit', address: '25 Shalom Street, Ajah', branch_id: 'demo-branch-001', created_at: '2026-05-18T10:00:00Z' },
];

// Alerts
export const DEMO_ALERTS: Alert[] = [
  { id: 'al-1', type: 'absence', priority: 'high', title: 'Michael Etim missed 3 weeks', message: 'Michael Etim has not attended service for 3 consecutive weeks. Immediate follow-up recommended.', member_id: 'm-3', member_name: 'Michael Etim', shepherd_id: 'demo-user-001', is_read: false, branch_id: 'demo-branch-001', created_at: '2026-05-22T08:00:00Z' },
  { id: 'al-2', type: 'absence', priority: 'high', title: 'Deborah Umeh inactive for 4 weeks', message: 'Deborah Umeh has been absent for 4 weeks and is now marked inactive.', member_id: 'm-6', member_name: 'Deborah Umeh', shepherd_id: 'demo-user-001', is_read: false, branch_id: 'demo-branch-001', created_at: '2026-05-21T08:00:00Z' },
  { id: 'al-3', type: 'birthday', priority: 'medium', title: "Ruth Onyeka's birthday today! \ud83c\udf82", message: 'Ruth Onyeka turns a year older today. Send her a birthday greeting!', member_id: 'm-4', member_name: 'Ruth Onyeka', shepherd_id: 'demo-user-002', is_read: false, branch_id: 'demo-branch-001', created_at: '2026-05-23T00:00:00Z' },
  { id: 'al-4', type: 'birthday', priority: 'medium', title: "John Akpan's birthday in 2 days \ud83c\udf82", message: "John Akpan's birthday is on May 25. Prepare a birthday message!", member_id: 'm-1', member_name: 'John Akpan', shepherd_id: 'demo-user-001', is_read: true, branch_id: 'demo-branch-001', created_at: '2026-05-23T00:00:00Z' },
  { id: 'al-5', type: 'promotion_ready', priority: 'low', title: 'Chioma Adeola ready for promotion', message: 'First timer Chioma Adeola has attended 3 consecutive services and is ready to be promoted to Member.', member_id: 'ft-1', member_name: 'Chioma Adeola', is_read: false, branch_id: 'demo-branch-001', created_at: '2026-05-22T10:00:00Z' },
  { id: 'al-6', type: 'absence', priority: 'medium', title: 'Peter Adeleke missed 2 weeks', message: 'Peter Adeleke has missed 2 consecutive services.', member_id: 'm-5', member_name: 'Peter Adeleke', shepherd_id: 'demo-user-002', is_read: true, branch_id: 'demo-branch-001', created_at: '2026-05-19T08:00:00Z' },
];
