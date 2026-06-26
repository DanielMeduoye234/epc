'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Heart, UserPlus, Users, AlertTriangle, CheckCircle, XCircle, TrendingUp, Building2, Bell, MapPin, Phone } from 'lucide-react';
import { isDemoMode, DEMO_NEW_BELIEVERS, DEMO_FIRST_TIMERS, DEMO_MEMBERS, DEMO_USERS, DEMO_BRANCHES, DEMO_BRANCH_STATS, DEMO_ALERTS } from '@/lib/demo-data';
import type { Profile } from '@/lib/types';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Stats {
  newBelievers: number;
  firstTimers: number;
  members: number;
  flaggedMembers: number;
}

interface ShepherdStats {
  totalSheep: number;
  activeSheep: number;
  flaggedSheep: number;
  inactiveSheep: number;
}

interface SheepAttendance {
  id: string;
  full_name: string;
  photo_url: string | null;
  status: string;
  lastSeen: string;
  attendanceRate: number;
  streak: number;
}

// ── Time-series bucketing (shared by all dashboard trend charts) ──
type Granularity = 'day' | 'week' | 'month';

interface PeriodBucket {
  key: string;
  label: string;
}

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Parse a 'YYYY-MM-DD' (or ISO) string as a local date so buckets align to local days.
function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr.slice(0, 10)}T00:00:00`);
}

function bucketKeyFor(date: Date, g: Granularity): string {
  if (g === 'month') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
  if (g === 'week') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    return toLocalDateKey(weekStart);
  }
  return toLocalDateKey(date);
}

function bucketLabelFor(key: string, g: Granularity): string {
  if (g === 'month') {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleString('en', { month: 'short', year: '2-digit' });
  }
  return parseLocalDate(key).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// Ordered list of the most recent buckets for the chosen granularity.
function buildBuckets(g: Granularity): PeriodBucket[] {
  const count = g === 'day' ? 14 : g === 'week' ? 8 : 6;
  const today = new Date();
  const buckets: PeriodBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    if (g === 'day') d.setDate(today.getDate() - i);
    else if (g === 'week') d.setDate(today.getDate() - today.getDay() - i * 7);
    else d.setMonth(today.getMonth() - i, 1);
    const key = bucketKeyFor(d, g);
    buckets.push({ key, label: bucketLabelFor(key, g) });
  }
  return buckets;
}

function countByBucket(dates: string[], buckets: PeriodBucket[], g: Granularity): Record<string, number> {
  const counts: Record<string, number> = {};
  buckets.forEach((b) => { counts[b.key] = 0; });
  dates.forEach((ds) => {
    if (!ds) return;
    const key = bucketKeyFor(parseLocalDate(ds), g);
    if (key in counts) counts[key] += 1;
  });
  return counts;
}

const COLORS = ['#f97316', '#000000', '#fb923c', '#fdba74', '#fed7aa'];

export default function DashboardPage() {
  const { profile, isDemo, loading: authLoading } = useAuth();
  const supabase = createClient();

  // Super admin state
  const [stats, setStats] = useState<Stats>({
    newBelievers: 0,
    firstTimers: 0,
    members: 0,
    flaggedMembers: 0,
  });
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [rawNewBelieverDates, setRawNewBelieverDates] = useState<string[]>([]);
  const [rawFirstTimerDates, setRawFirstTimerDates] = useState<string[]>([]);
  const [rawAttendance, setRawAttendance] = useState<{ date: string; is_present: boolean }[]>([]);
  const [bacentaData, setBacentaData] = useState<{ name: string; value: number }[]>([]);

  // Shepherd state
  const [shepherdStats, setShepherdStats] = useState<ShepherdStats>({
    totalSheep: 0,
    activeSheep: 0,
    flaggedSheep: 0,
    inactiveSheep: 0,
  });
  const [sheepList, setSheepList] = useState<SheepAttendance[]>([]);

  // Recorder state
  const [recentNewBelievers, setRecentNewBelievers] = useState<{ id: string; full_name: string; date_saved: string; bacenta: string }[]>([]);
  const [thisMonthCount, setThisMonthCount] = useState(0);

  // Bishop state (real data)
  const [bishopBranches, setBishopBranches] = useState<{ id: string; name: string; location: string | null; branch_code: string }[]>([]);
  const [bishopStats, setBishopStats] = useState<Record<string, { members: number; newBelievers: number; firstTimers: number; attendance: number; shepherds: number }>>({});
  const [bishopAlerts, setBishopAlerts] = useState<{ id: string; type: string; priority: string; title: string; message: string; is_read: boolean }[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!profile) {
      setLoading(false);
      return;
    }
    if (profile.role === 'shepherd') {
      if (isDemo) loadShepherdDemoData();
      else fetchShepherdData();
    } else if (profile.role === 'bishop') {
      if (isDemo) { setLoading(false); }
      else fetchBishopData();
    } else {
      if (isDemo) loadDemoData();
      else fetchDashboardData();
    }
  }, [profile, isDemo, authLoading]);

  useEffect(() => {
    if (authLoading || !profile || isDemo) return;

    const refresh = () => {
      if (profile.role === 'shepherd') {
        fetchShepherdData();
      } else if (profile.role === 'bishop') {
        fetchBishopData();
      } else {
        fetchDashboardData();
      }
    };

    const branchFilter = profile.role === 'bishop' ? undefined : `branch_id=eq.${profile.branch_id}`;
    const channel = supabase.channel(`dashboard-live-${profile.id}-${profile.role}`);

    const watchTable = (table: string) => {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: branchFilter,
        },
        refresh
      );
    };

    watchTable('members');
    watchTable('new_believers');
    watchTable('first_timers');
    watchTable('attendance');
    watchTable('bacentas');
    watchTable('profiles');
    watchTable('alerts');
    watchTable('branches');

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isDemo, authLoading]);

  // ── Derived trend data, re-bucketed whenever the granularity changes ──
  const periodBuckets = useMemo(() => buildBuckets(granularity), [granularity]);

  const attendanceGrowthData = useMemo(() => {
    const present: Record<string, number> = {};
    const absent: Record<string, number> = {};
    periodBuckets.forEach((b) => { present[b.key] = 0; absent[b.key] = 0; });
    rawAttendance.forEach((a) => {
      const key = bucketKeyFor(parseLocalDate(a.date), granularity);
      if (!(key in present)) return;
      if (a.is_present) present[key] += 1;
      else absent[key] += 1;
    });
    return periodBuckets.map((b) => {
      const p = present[b.key];
      const ab = absent[b.key];
      const total = p + ab;
      return { period: b.label, present: p, absent: ab, attendanceRate: total > 0 ? Math.round((p / total) * 100) : 0 };
    });
  }, [periodBuckets, granularity, rawAttendance]);

  const additionsData = useMemo(() => {
    const nb = countByBucket(rawNewBelieverDates, periodBuckets, granularity);
    const ft = countByBucket(rawFirstTimerDates, periodBuckets, granularity);
    return periodBuckets.map((b) => ({ period: b.label, newBelievers: nb[b.key], firstTimers: ft[b.key] }));
  }, [periodBuckets, granularity, rawNewBelieverDates, rawFirstTimerDates]);

  const firstTimerTrendData = useMemo(() => {
    const ft = countByBucket(rawFirstTimerDates, periodBuckets, granularity);
    return periodBuckets.map((b) => ({ period: b.label, count: ft[b.key] }));
  }, [periodBuckets, granularity, rawFirstTimerDates]);

  const periodWord = granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : 'Monthly';
  const periodNoun = granularity === 'day' ? 'day' : granularity === 'week' ? 'week' : 'month';

  async function fetchBishopData() {
    const [branchesRes, alertsRes] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('alerts').select('id, type, priority, title, message, is_read').eq('is_read', false).order('created_at', { ascending: false }).limit(10),
    ]);
    const branches = branchesRes.data || [];
    setBishopBranches(branches);
    setBishopAlerts(alertsRes.data || []);

    const statsMap: Record<string, { members: number; newBelievers: number; firstTimers: number; attendance: number; shepherds: number }> = {};
    await Promise.all(
      branches.map(async (branch: { id: string }) => {
        const [mRes, nbRes, ftRes, shRes, attRes] = await Promise.all([
          supabase.from('members').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
          supabase.from('new_believers').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id),
          supabase.from('first_timers').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id).eq('status', 'first_timer'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('branch_id', branch.id).eq('role', 'shepherd'),
          supabase.from('attendance').select('is_present').eq('branch_id', branch.id).gte('date', new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0]),
        ]);
        const total = attRes.data?.length || 0;
        const present = attRes.data?.filter((a: { is_present: boolean }) => a.is_present).length || 0;
        statsMap[branch.id] = {
          members: mRes.count || 0,
          newBelievers: nbRes.count || 0,
          firstTimers: ftRes.count || 0,
          shepherds: shRes.count || 0,
          attendance: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      })
    );
    setBishopStats(statsMap);
    setLoading(false);
  }

  function loadShepherdDemoData() {
    const sheep = DEMO_MEMBERS;
    const active = sheep.filter(m => m.status === 'active').length;
    const flagged = sheep.filter(m => m.status === 'flagged').length;
    const inactive = sheep.filter(m => m.status === 'inactive').length;

    setShepherdStats({
      totalSheep: sheep.length,
      activeSheep: active,
      flaggedSheep: flagged,
      inactiveSheep: inactive,
    });

    // Generate mock attendance data for each sheep
    const sheepWithAttendance: SheepAttendance[] = sheep.map(m => {
      const rate = m.status === 'active' ? Math.floor(Math.random() * 30) + 70 :
                   m.status === 'flagged' ? Math.floor(Math.random() * 25) + 20 :
                   Math.floor(Math.random() * 15) + 5;
      const streak = m.status === 'active' ? Math.floor(Math.random() * 6) + 2 :
                     m.status === 'flagged' ? 0 : 0;
      const daysAgo = m.status === 'active' ? Math.floor(Math.random() * 5) :
                      m.status === 'flagged' ? Math.floor(Math.random() * 20) + 14 :
                      Math.floor(Math.random() * 30) + 30;
      const lastSeen = new Date();
      lastSeen.setDate(lastSeen.getDate() - daysAgo);

      return {
        id: m.id,
        full_name: m.full_name,
        photo_url: m.photo_url,
        status: m.status,
        lastSeen: lastSeen.toISOString(),
        attendanceRate: rate,
        streak,
      };
    });

    setSheepList(sheepWithAttendance.sort((a, b) => a.attendanceRate - b.attendanceRate));
    setLoading(false);
  }

  async function fetchShepherdData() {
    // Resolve the bacentas this shepherd covers. Every member in those bacentas
    // (plus anyone assigned directly) counts as part of the shepherd's flock.
    const { data: shepherdBacentas, error: shepherdBacentasError } = await supabase
      .from('shepherd_bacentas')
      .select('bacenta:bacentas(name)')
      .eq('branch_id', profile!.branch_id)
      .eq('shepherd_id', profile!.id);

    let bacentaNames: string[] = [];
    if (shepherdBacentasError) {
      // Legacy schema: a shepherd was linked to a single bacenta via profiles.bacenta_id
      const { data: legacyProfile } = await supabase
        .from('profiles')
        .select('bacenta:bacentas(name)')
        .eq('id', profile!.id)
        .single();
      const legacyName = (legacyProfile as { bacenta: { name: string } | null } | null)?.bacenta?.name;
      if (legacyName) bacentaNames = [legacyName];
    } else {
      bacentaNames = (shepherdBacentas || [])
        .map((row: { bacenta: { name: string } | null }) => row.bacenta?.name)
        .filter(Boolean) as string[];
    }

    const { data: allMembers } = await supabase
      .from('members')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .order('full_name');

    const sheep = (allMembers || []).filter((m: { assigned_shepherd: string | null; bacenta: string }) =>
      m.assigned_shepherd === profile!.id || bacentaNames.includes(m.bacenta)
    );

    const members: Array<{ id: string; full_name: string; photo_url: string | null; status: string; created_at: string }> = sheep;
    const active = members.filter(m => m.status === 'active').length;
    const flagged = members.filter(m => m.status === 'flagged').length;
    const inactive = members.filter(m => m.status === 'inactive').length;

    setShepherdStats({
      totalSheep: members.length,
      activeSheep: active,
      flaggedSheep: flagged,
      inactiveSheep: inactive,
    });

    // Fetch attendance data for last 8 weeks
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const memberIds: string[] = members.map(m => m.id);

    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('person_id, is_present, date')
      .in('person_id', memberIds)
      .gte('date', eightWeeksAgo.toISOString().split('T')[0]);

    const attendanceMap: Record<string, { present: number; total: number; lastPresent: string }> = {};
    memberIds.forEach((id: string) => { attendanceMap[id] = { present: 0, total: 0, lastPresent: '' }; });

    attendanceData?.forEach((a: { person_id: string; is_present: boolean; date: string }) => {
      if (attendanceMap[a.person_id]) {
        attendanceMap[a.person_id].total++;
        if (a.is_present) {
          attendanceMap[a.person_id].present++;
          if (a.date > attendanceMap[a.person_id].lastPresent) {
            attendanceMap[a.person_id].lastPresent = a.date;
          }
        }
      }
    });

    const sheepWithAttendance: SheepAttendance[] = members.map((m: { id: string; full_name: string; photo_url: string | null; status: string; created_at: string }) => {
      const record = attendanceMap[m.id];
      const rate = record.total > 0 ? Math.round((record.present / record.total) * 100) : 0;
      return {
        id: m.id,
        full_name: m.full_name,
        photo_url: m.photo_url,
        status: m.status,
        lastSeen: record.lastPresent || m.created_at,
        attendanceRate: rate,
        streak: 0,
      };
    });

    setSheepList(sheepWithAttendance.sort((a, b) => a.attendanceRate - b.attendanceRate));
    setLoading(false);
  }

  function loadDemoData() {
    setStats({
      newBelievers: DEMO_NEW_BELIEVERS.length,
      firstTimers: DEMO_FIRST_TIMERS.length,
      members: DEMO_MEMBERS.length,
      flaggedMembers: DEMO_MEMBERS.filter(m => m.status === 'flagged').length,
    });

    // Spread demo additions across the last ~6 months so day/week/month views all populate.
    const today = new Date();
    const newBelieverDates: string[] = [];
    const firstTimerDates: string[] = [];
    const attendance: { date: string; is_present: boolean }[] = [];

    for (let i = 0; i < 45; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - Math.floor(Math.random() * 180));
      newBelieverDates.push(toLocalDateKey(d));
    }
    for (let i = 0; i < 32; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - Math.floor(Math.random() * 180));
      firstTimerDates.push(toLocalDateKey(d));
    }
    // One attendance record set per Sunday for the last 26 weeks.
    for (let w = 0; w < 26; w++) {
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - today.getDay() - w * 7);
      const key = toLocalDateKey(sunday);
      const present = Math.floor(Math.random() * 30) + 25;
      const absent = Math.floor(Math.random() * 12) + 4;
      for (let p = 0; p < present; p++) attendance.push({ date: key, is_present: true });
      for (let a = 0; a < absent; a++) attendance.push({ date: key, is_present: false });
    }

    setRawNewBelieverDates(newBelieverDates);
    setRawFirstTimerDates(firstTimerDates);
    setRawAttendance(attendance);

    const bacentaCounts: Record<string, number> = {};
    DEMO_MEMBERS.forEach(m => {
      bacentaCounts[m.bacenta] = (bacentaCounts[m.bacenta] || 0) + 1;
    });
    setBacentaData(Object.entries(bacentaCounts).map(([name, value]) => ({ name, value })));
    setLoading(false);
  }

  async function fetchDashboardData() {
    const branchId = profile!.branch_id;

    const [nbRes, ftRes, mRes, fmRes] = await Promise.all([
      supabase.from('new_believers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
      supabase.from('first_timers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'first_timer'),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('branch_id', branchId),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).eq('status', 'flagged'),
    ]);

    setStats({
      newBelievers: nbRes.count || 0,
      firstTimers: ftRes.count || 0,
      members: mRes.count || 0,
      flaggedMembers: fmRes.count || 0,
    });

    // Pull raw dated rows over the last 6 months. The charts bucket this
    // client-side into days / weeks / months based on the selected granularity.
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = toLocalDateKey(sixMonthsAgo);

    const [nbDatesRes, ftDatesRes, attendanceRes] = await Promise.all([
      supabase.from('new_believers').select('date_saved').eq('branch_id', branchId).gte('date_saved', startDate),
      supabase.from('first_timers').select('date_joined').eq('branch_id', branchId).gte('date_joined', startDate),
      supabase.from('attendance').select('date, is_present').eq('branch_id', branchId).gte('date', startDate),
    ]);

    setRawNewBelieverDates((nbDatesRes.data || []).map((r: { date_saved: string }) => r.date_saved).filter(Boolean));
    setRawFirstTimerDates((ftDatesRes.data || []).map((r: { date_joined: string }) => r.date_joined).filter(Boolean));
    setRawAttendance((attendanceRes.data || []).map((r: { date: string; is_present: boolean }) => ({ date: r.date, is_present: r.is_present })));

    const { data: membersData } = await supabase
      .from('members')
      .select('bacenta')
      .eq('branch_id', branchId);

    const bacentaCounts: { [key: string]: number } = {};
    membersData?.forEach((m: { bacenta: string }) => {
      bacentaCounts[m.bacenta] = (bacentaCounts[m.bacenta] || 0) + 1;
    });
    setBacentaData(
      Object.entries(bacentaCounts).map(([name, value]) => ({ name, value }))
    );

    // Fetch recent new believers and this month count (for recorder view)
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const [recentNBRes, thisMonthRes] = await Promise.all([
      supabase.from('new_believers').select('id, full_name, date_saved, bacenta').eq('branch_id', branchId).order('date_saved', { ascending: false }).limit(4),
      supabase.from('new_believers').select('id', { count: 'exact', head: true }).eq('branch_id', branchId).gte('date_saved', firstOfMonth),
    ]);
    setRecentNewBelievers(recentNBRes.data || []);
    setThisMonthCount(thisMonthRes.count || 0);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <ProfileRepair />;
  }

  // ═══════════════════════════════════════════
  // NO BRANCH SETUP (new super_admin)
  // ═══════════════════════════════════════════
  if (!profile.branch_id && (profile.role === 'super_admin' || profile.role === 'bishop') && !isDemo) {
    return <BranchSetup profile={profile} />;
  }

  // ═══════════════════════════════════════════
  // SHEPHERD DASHBOARD
  // ═══════════════════════════════════════════
  if (profile?.role === 'shepherd') {
    const faithfulSheep = sheepList.filter(s => s.attendanceRate >= 70);
    const atRiskSheep = sheepList.filter(s => s.attendanceRate >= 30 && s.attendanceRate < 70);
    const lostSheep = sheepList.filter(s => s.attendanceRate < 30);

    return (
      <div className="space-y-6">
        {/* Shepherd Header */}
        <div className="bg-linear-to-r from-orange-400 to-orange-600 rounded-2xl p-6 text-white">
          <h1 className="text-2xl font-bold">My Sheep Fold 🐑</h1>
          <p className="text-orange-100 mt-1">
            {shepherdStats.totalSheep > 0
              ? `Shepherd ${profile.full_name?.split(' ')[0]}, you have ${shepherdStats.totalSheep} sheep under your care`
              : `Welcome, Shepherd ${profile.full_name?.split(' ')[0]}! Your flock will appear here once members are assigned to you.`
            }
          </p>
        </div>

        {/* Shepherd Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">Total Sheep</p>
                <p className="text-2xl sm:text-3xl font-bold text-black mt-1">{shepherdStats.totalSheep}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">Faithful</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1">{shepherdStats.activeSheep}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center">
                <CheckCircle size={20} className="text-white" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">At Risk</p>
                <p className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1">{shepherdStats.flaggedSheep}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-amber-100 to-amber-200 flex items-center justify-center">
                <span className="text-lg sm:text-xl" role="img" aria-label="wolf chasing sheep">🐺🐑</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">Lost</p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-1">{shepherdStats.inactiveSheep}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-red-100 to-red-200 flex items-center justify-center">
                <span className="text-lg sm:text-xl" role="img" aria-label="wolf eating sheep">🐺🍖</span>
              </div>
            </div>
          </div>
        </div>

        {/* Eagle Eye Overview */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-orange-500" />
            <h3 className="text-lg font-semibold text-black">Eagle Eye Overview</h3>
          </div>
          <p className="text-sm text-gray-500 mb-5">Attendance faithfulness at a glance — see who needs follow-up</p>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-5 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">Faithful (70%+)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-gray-600">At Risk (30-69%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-600">Lost (&lt;30%)</span>
            </div>
          </div>

          {/* Sheep Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
            {sheepList.map((sheep) => {
              const color = sheep.attendanceRate >= 70 ? 'border-green-400 bg-green-50' :
                            sheep.attendanceRate >= 30 ? 'border-amber-400 bg-amber-50' :
                            'border-red-400 bg-red-50';
              const ringColor = sheep.attendanceRate >= 70 ? 'ring-green-400' :
                               sheep.attendanceRate >= 30 ? 'ring-amber-400' : 'ring-red-400';
              return (
                <Link
                  key={sheep.id}
                  href={`/dashboard/profile/member/${sheep.id}`}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 ${color} hover:shadow-md transition`}
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ring-2 ${ringColor} flex items-center justify-center overflow-hidden bg-linear-to-br from-orange-400 to-orange-600`}>
                    {sheep.photo_url ? (
                      <img src={sheep.photo_url} alt={sheep.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-xs font-bold">
                        {sheep.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs font-medium text-gray-800 mt-1.5 text-center truncate w-full">
                    {sheep.full_name.split(' ')[0]}
                  </p>
                  <p className={`text-[10px] font-bold mt-0.5 ${
                    sheep.attendanceRate >= 70 ? 'text-green-600' :
                    sheep.attendanceRate >= 30 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {sheep.attendanceRate}%
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sheep Needing Attention */}
        {(atRiskSheep.length > 0 || lostSheep.length > 0) && (
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-red-100">
            <h3 className="text-lg font-semibold text-black mb-1">⚠️ Sheep Needing Attention</h3>
            <p className="text-sm text-gray-500 mb-4">These members haven&apos;t been faithful in attendance</p>
            <div className="space-y-3">
              {[...lostSheep, ...atRiskSheep].map((sheep) => {
                const daysSince = Math.floor((Date.now() - new Date(sheep.lastSeen).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <Link
                    key={sheep.id}
                    href={`/dashboard/profile/member/${sheep.id}`}
                    className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-gray-50 hover:bg-orange-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ring-2 ${
                        sheep.attendanceRate < 30 ? 'ring-red-400' : 'ring-amber-400'
                      } bg-linear-to-br from-orange-400 to-orange-600`}>
                        {sheep.photo_url ? (
                          <img src={sheep.photo_url} alt={sheep.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white text-xs font-bold">
                            {sheep.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-black text-sm">{sheep.full_name}</p>
                        <p className="text-xs text-gray-500">
                          Last seen {daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        sheep.attendanceRate < 30 ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {sheep.attendanceRate}%
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase">attendance</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/members"
            className="flex items-center justify-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition text-sm font-medium text-gray-700"
          >
            <Users size={18} className="text-orange-500" />
            View All Sheep
          </Link>
          <Link
            href="/dashboard/attendance"
            className="flex items-center justify-center gap-2 p-4 bg-linear-to-r from-orange-400 to-orange-600 rounded-2xl shadow-sm hover:shadow-md transition text-sm font-medium text-white"
          >
            <CheckCircle size={18} />
            Mark Attendance
          </Link>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // RECORDER DASHBOARD
  // ═══════════════════════════════════════════
  if (profile?.role === 'recorder') {
    const totalNewBelievers = isDemo ? DEMO_NEW_BELIEVERS.length : stats.newBelievers;
    const totalFirstTimers = isDemo ? DEMO_FIRST_TIMERS.length : stats.firstTimers;
    const recentNB = isDemo ? DEMO_NEW_BELIEVERS.slice(0, 4) : recentNewBelievers;
    const recentFT = isDemo ? DEMO_FIRST_TIMERS.slice(0, 3) : [];

    // Conversion rate: first timers / new believers
    const conversionRate = totalNewBelievers > 0 ? Math.round((totalFirstTimers / totalNewBelievers) * 100) : 0;

    // Monthly recording pace
    const thisMonth = isDemo ? DEMO_NEW_BELIEVERS.filter(nb => {
      const d = new Date(nb.date_saved);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length : thisMonthCount;

    return (
      <div className="space-y-6">
        {/* Recorder Header */}
        <div className="bg-linear-to-r from-orange-400 to-orange-600 rounded-2xl p-6 text-white">
          <h1 className="text-2xl font-bold">Recorder Dashboard 📋</h1>
          <p className="text-orange-100 mt-1">
            {profile.full_name}, you&apos;re helping build the Kingdom — one soul at a time
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">New Believers</p>
                <p className="text-2xl sm:text-3xl font-bold text-black mt-1">{totalNewBelievers}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <Heart size={20} className="text-white" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">First Timers</p>
                <p className="text-2xl sm:text-3xl font-bold text-black mt-1">{totalFirstTimers}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-gray-700 to-black flex items-center justify-center">
                <UserPlus size={20} className="text-white" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">Conversion</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-1">{conversionRate}%</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center">
                <TrendingUp size={20} className="text-white" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-500 font-medium">This Month</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-500 mt-1">{thisMonth}</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-linear-to-br from-orange-300 to-orange-500 flex items-center justify-center">
                <span className="text-white text-lg">🔥</span>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Pipeline */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black mb-1">🔄 Conversion Pipeline</h3>
          <p className="text-sm text-gray-500 mb-4">Journey from salvation to membership</p>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* New Believer stage */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <span className="text-white text-lg sm:text-2xl font-bold">{totalNewBelievers}</span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mt-2">New Believers</p>
              <p className="text-[10px] text-gray-400">Saved</p>
            </div>
            {/* Arrow */}
            <div className="flex flex-col items-center">
              <div className="text-orange-400 text-lg">→</div>
              <p className="text-[9px] text-gray-400">{conversionRate}%</p>
            </div>
            {/* First Timer stage */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-linear-to-br from-gray-700 to-black flex items-center justify-center">
                <span className="text-white text-lg sm:text-2xl font-bold">{totalFirstTimers}</span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mt-2">First Timers</p>
              <p className="text-[10px] text-gray-400">Attending</p>
            </div>
            {/* Arrow */}
            <div className="flex flex-col items-center">
              <div className="text-orange-400 text-lg">→</div>
              <p className="text-[9px] text-gray-400">growing</p>
            </div>
            {/* Member stage */}
            <div className="flex-1 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center">
                <span className="text-white text-lg sm:text-2xl font-bold">{isDemo ? DEMO_MEMBERS.length : stats.members}</span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-700 mt-2">Members</p>
              <p className="text-[10px] text-gray-400">Established</p>
            </div>
          </div>
        </div>

        {/* Recent Recordings */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black mb-1">📝 Recent Recordings</h3>
          <p className="text-sm text-gray-500 mb-4">Latest souls you&apos;ve helped document</p>
          <div className="space-y-3">
            {recentNB.map(nb => (
              <div key={nb.id} className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">
                      {nb.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">{nb.full_name}</p>
                    <p className="text-[10px] text-gray-500">Saved {new Date(nb.date_saved).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-[10px] bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-medium">New Believer</span>
              </div>
            ))}
            {recentFT.map(ft => (
              <div key={ft.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-linear-to-br from-gray-600 to-black flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">
                      {ft.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">{ft.full_name}</p>
                    <p className="text-[10px] text-gray-500">Joined {new Date(ft.date_joined).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-[10px] bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full font-medium">First Timer</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard/new-believers"
            className="flex items-center justify-center gap-2 p-4 bg-linear-to-r from-orange-400 to-orange-600 rounded-2xl shadow-sm hover:shadow-md transition text-sm font-medium text-white"
          >
            <Heart size={18} />
            Record New Believer
          </Link>
          <Link
            href="/dashboard/first-timers"
            className="flex items-center justify-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-orange-200 transition text-sm font-medium text-gray-700"
          >
            <UserPlus size={18} className="text-orange-500" />
            View First Timers
          </Link>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // BISHOP DASHBOARD (Multi-Branch Oversight)
  // ═══════════════════════════════════════════
  if (profile?.role === 'bishop') {
    const branches = isDemo ? DEMO_BRANCHES : bishopBranches;
    const branchStats = isDemo ? DEMO_BRANCH_STATS : bishopStats;
    const alerts = isDemo ? DEMO_ALERTS : bishopAlerts;
    const unreadAlerts = alerts.filter(a => !a.is_read);

    const totalMembers = Object.values(branchStats).reduce((s, b) => s + b.members, 0);
    const totalNewBelievers = Object.values(branchStats).reduce((s, b) => s + b.newBelievers, 0);
    const avgAttendance = branches.length > 0 ? Math.round(Object.values(branchStats).reduce((s, b) => s + b.attendance, 0) / branches.length) : 0;
    const totalShepherds = Object.values(branchStats).reduce((s, b) => s + b.shepherds, 0);

    return (
      <div className="space-y-6">
        {/* Bishop Header */}
        <div className="bg-linear-to-r from-purple-600 to-purple-800 rounded-2xl p-6 text-white">
          <h1 className="text-2xl font-bold">Bishop&apos;s Command Center 🏛️</h1>
          <p className="text-purple-200 mt-1">Overseeing {branches.length} branches across the diocese</p>
        </div>

        {/* Aggregate Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={18} className="text-blue-500" />
              <span className="text-xs text-gray-500">Total Members</span>
            </div>
            <p className="text-2xl font-bold text-black">{totalMembers}</p>
            <p className="text-[10px] text-green-600 mt-1">Across all branches</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart size={18} className="text-orange-500" />
              <span className="text-xs text-gray-500">New Believers</span>
            </div>
            <p className="text-2xl font-bold text-black">{totalNewBelievers}</p>
            <p className="text-[10px] text-green-600 mt-1">Total conversions</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-green-500" />
              <span className="text-xs text-gray-500">Avg Attendance</span>
            </div>
            <p className="text-2xl font-bold text-black">{avgAttendance}%</p>
            <p className="text-[10px] text-gray-500 mt-1">Across branches</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={18} className="text-red-500" />
              <span className="text-xs text-gray-500">Unread Alerts</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{unreadAlerts.length}</p>
            <p className="text-[10px] text-gray-500 mt-1">Needs attention</p>
          </div>
        </div>

        {/* Branch Performance Cards */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-black flex items-center gap-2">
              <Building2 size={20} className="text-purple-500" />
              Branch Performance
            </h3>
            <Link href="/dashboard/branches" className="text-xs text-purple-600 hover:text-purple-700 font-medium">
              View Details →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map(branch => {
              const s = branchStats[branch.id];
              if (!s) return null;
              return (
                <div key={branch.id} className="border border-gray-100 rounded-xl p-4 hover:border-purple-200 transition">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-linear-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
                      <Building2 size={14} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-black text-sm">{branch.name}</p>
                      <p className="text-[10px] text-gray-500">{(s as { pastor?: string }).pastor || branch.location || 'Branch'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <p className="text-sm font-bold text-black">{s.members}</p>
                      <p className="text-[9px] text-gray-500">Members</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-green-600">{s.newBelievers}</p>
                      <p className="text-[9px] text-gray-500">New</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-orange-600">{s.attendance}%</p>
                      <p className="text-[9px] text-gray-500">Attendance</p>
                    </div>
                  </div>
                  {/* Attendance bar */}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.attendance >= 75 ? 'bg-green-500' : s.attendance >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${s.attendance}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts Preview */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-black flex items-center gap-2">
              <Bell size={20} className="text-red-500" />
              Recent Alerts
            </h3>
            <Link href="/dashboard/alerts" className="text-xs text-purple-600 hover:text-purple-700 font-medium">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {unreadAlerts.slice(0, 4).map(alert => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${
                alert.priority === 'high' ? 'border-l-red-500 bg-red-50/50' :
                alert.priority === 'medium' ? 'border-l-amber-500 bg-amber-50/30' :
                'border-l-green-500 bg-green-50/30'
              }`}>
                <div className="flex-1">
                  <p className="text-sm font-medium text-black">{alert.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{alert.message}</p>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${
                  alert.type === 'absence' ? 'bg-red-100 text-red-700' :
                  alert.type === 'birthday' ? 'bg-pink-100 text-pink-700' :
                  'bg-green-100 text-green-700'
                }`}>{alert.type}</span>
              </div>
            ))}
            {unreadAlerts.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-4">No unread alerts ✨</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/dashboard/branches" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition">
            <Building2 size={22} className="text-purple-500" />
            <span className="text-xs font-medium text-gray-700">All Branches</span>
          </Link>
          <Link href="/dashboard/shepherds" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition">
            <Users size={22} className="text-blue-500" />
            <span className="text-xs font-medium text-gray-700">Shepherds</span>
          </Link>
          <Link href="/dashboard/follow-ups" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition">
            <Phone size={22} className="text-green-500" />
            <span className="text-xs font-medium text-gray-700">Follow-ups</span>
          </Link>
          <Link href="/dashboard/reports" className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition">
            <MapPin size={22} className="text-orange-500" />
            <span className="text-xs font-medium text-gray-700">Reports</span>
          </Link>
        </div>

        {/* Shepherds Overview */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black mb-4">👥 Shepherds Across Branches</h3>
          <p className="text-sm text-gray-500 mb-3">{totalShepherds} shepherds managing {totalMembers} members across {branches.length} branches</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {branches.map(branch => {
              const s = branchStats[branch.id];
              if (!s) return null;
              return (
                <div key={branch.id} className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-400 to-purple-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">{s.shepherds}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">{branch.name}</p>
                    <p className="text-xs text-gray-500">{s.shepherds} shepherds · {s.members} members</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // SUPER ADMIN / DEFAULT DASHBOARD
  // ═══════════════════════════════════════════
  const statCards = [
    { label: 'New Believers', value: stats.newBelievers, icon: Heart, color: 'from-orange-400 to-orange-600', bg: 'bg-orange-50' },
    { label: 'First Timers', value: stats.firstTimers, icon: UserPlus, color: 'from-gray-700 to-black', bg: 'bg-gray-50' },
    { label: 'Total Members', value: stats.members, icon: Users, color: 'from-orange-300 to-orange-500', bg: 'bg-orange-50' },
    { label: 'Flagged (Inactive)', value: stats.flaggedMembers, icon: AlertTriangle, color: 'from-red-400 to-red-600', bg: 'bg-red-50' },
  ];

  const isFreshAccount = !isDemo && stats.newBelievers === 0 && stats.firstTimers === 0 && stats.members === 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-linear-to-r from-orange-400 to-orange-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-orange-100 mt-1">Here&apos;s your church growth overview</p>
      </div>

      {/* Getting Started Banner — only shown on fresh accounts with no data */}
      {isFreshAccount && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="text-base font-semibold text-blue-800 mb-2">Getting Started</h3>
          <p className="text-sm text-blue-700 mb-3">Your dashboard is ready! Here&apos;s how to get going:</p>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-blue-700">
            <li>Go to <strong>Bacentas</strong> and create your cell groups first</li>
            <li>Invite your team via <strong>Settings → Invite User</strong></li>
            <li>Recorders can start adding <strong>New Believers</strong> and <strong>First Timers</strong></li>
            <li>Shepherds mark <strong>Attendance</strong> every Sunday</li>
          </ol>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                <p className="text-3xl font-bold text-black mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-linear-to-br ${card.color} flex items-center justify-center shadow-sm`}>
                <card.icon size={22} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Team Sync Overview */}
      {(profile?.role === 'super_admin' || profile?.role === 'bishop') && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black mb-1">🔄 Team Sync</h3>
          <p className="text-sm text-gray-500 mb-4">Data flowing in from all shepherds and recorders</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Shepherd contributions */}
            {(() => {
              const shepherdCounts: Record<string, { name: string; count: number }> = {};
              if (isDemo) {
                DEMO_MEMBERS.forEach(m => {
                  if (m.assigned_shepherd) {
                    const user = DEMO_USERS[m.assigned_shepherd];
                    if (!shepherdCounts[m.assigned_shepherd]) {
                      shepherdCounts[m.assigned_shepherd] = { name: user?.name || 'Unknown', count: 0 };
                    }
                    shepherdCounts[m.assigned_shepherd].count++;
                  }
                });
              }
              return Object.entries(shepherdCounts).map(([id, { name, count }]) => (
                <div key={id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">🐑</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">{name}</p>
                    <p className="text-xs text-gray-500">{count} members managed</p>
                  </div>
                </div>
              ));
            })()}
            {/* Recorder contributions */}
            {(() => {
              const recorderCounts: Record<string, { name: string; count: number }> = {};
              if (isDemo) {
                DEMO_NEW_BELIEVERS.forEach(b => {
                  const user = DEMO_USERS[b.recorded_by];
                  if (!recorderCounts[b.recorded_by]) {
                    recorderCounts[b.recorded_by] = { name: user?.name || 'Unknown', count: 0 };
                  }
                  recorderCounts[b.recorded_by].count++;
                });
              }
              return Object.entries(recorderCounts).map(([id, { name, count }]) => (
                <div key={id} className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-400 to-green-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">📋</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-black">{name}</p>
                    <p className="text-xs text-gray-500">{count} new believers recorded</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Time-scale selector — controls the granularity of every trend chart below */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-black">Trends</h2>
          <p className="text-sm text-gray-500">View the charts by day, week, or month.</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 self-start">
          {([['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setGranularity(value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                granularity === value ? 'bg-orange-500 text-white' : 'text-gray-600 hover:text-black'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance growth line chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black">Church Growth in Attendance</h3>
          <p className="text-sm text-gray-500 mb-4">Total people present per {periodNoun} (number of people)</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={attendanceGrowthData} margin={{ top: 5, right: 12, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} label={{ value: 'People present', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }} />
              <Tooltip formatter={(value) => [`${value} people`, 'Present']} />
              <Line type="monotone" dataKey="present" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="People Present" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Additions bar chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black">{periodWord} Addition of First Timers and New Believers</h3>
          <p className="text-sm text-gray-500 mb-4">New people added per {periodNoun} (number of people)</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={additionsData} margin={{ top: 5, right: 12, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} label={{ value: 'People added', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }} />
              <Tooltip formatter={(value, name) => [`${value} people`, name]} />
              <Bar dataKey="newBelievers" fill="#f97316" name="New Believers" radius={[4, 4, 0, 0]} />
              <Bar dataKey="firstTimers" fill="#000000" name="First Timers" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attendance composition + first timers trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black">{periodWord} Attendance (Present vs Absent)</h3>
          <p className="text-sm text-gray-500 mb-4">Present and absent counts per {periodNoun} (number of people)</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attendanceGrowthData} margin={{ top: 5, right: 12, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} label={{ value: 'People', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }} />
              <Tooltip formatter={(value, name) => [`${value} people`, name]} />
              <Bar dataKey="present" stackId="a" fill="#22c55e" name="Present" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black">{periodWord} First Timers</h3>
          <p className="text-sm text-gray-500 mb-4">New first timers per {periodNoun} (number of people)</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={firstTimerTrendData} margin={{ top: 5, right: 12, left: 8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} allowDecimals={false} label={{ value: 'First timers', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }} />
              <Tooltip formatter={(value) => [`${value} people`, 'First Timers']} />
              <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} name="First Timers" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bacenta Pie Chart */}
      {bacentaData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-black mb-4">Members by Bacenta</h3>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={bacentaData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#f97316"
                  dataKey="value"
                  label
                >
                  {bacentaData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// ACCOUNT SETUP — handles all first-time flows
// ═══════════════════════════════════════════
type SetupRole = 'super_admin' | 'bishop' | 'shepherd' | 'recorder';

function AccountSetup({ existingProfile }: { existingProfile?: Profile }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(!existingProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState(existingProfile?.full_name || '');
  const [role, setRole] = useState<SetupRole>((existingProfile?.role as SetupRole) || 'super_admin');
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const isAdminRole = role === 'super_admin' || role === 'bishop';

  useEffect(() => {
    if (existingProfile) return; // already have profile data
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: import('@supabase/supabase-js').User | null } }) => {
      if (user) {
        setUserId(user.id);
        setEmail(user.email || '');
        const meta = user.user_metadata ?? {};
        if (meta.full_name) setFullName(meta.full_name as string);
        if (meta.role) setRole(meta.role as SetupRole);
      }
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body: Record<string, string> = {
      userId: userId || existingProfile?.id || '',
      full_name: fullName || existingProfile?.full_name || '',
      email: email || existingProfile?.email || '',
      role: role || existingProfile?.role || 'super_admin',
    };
    if (isAdminRole) {
      body.branchName = branchName;
      body.branchCode = branchCode;
      body.branchLocation = branchLocation;
    } else {
      body.branchCode = joinCode;
    }
    const res = await fetch('/api/auth/setup-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) { window.location.reload(); return; }
    const data = await res.json().catch(() => ({}));
    setError(data.error || 'Something went wrong. Please try again.');
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading your account...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center mb-4">
            {isAdminRole
              ? <Building2 size={28} className="text-orange-500" />
              : <Users size={28} className="text-orange-500" />}
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {existingProfile ? 'Set Up Your Branch' : 'Finish Setting Up Your Account'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {existingProfile ? 'Create your branch to start using the dashboard' : 'A few details and you\'re ready to go'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {!existingProfile && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Pastor John Adeyemi"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Role *</label>
                <select value={role} onChange={e => setRole(e.target.value as SetupRole)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black">
                  <option value="super_admin">Super Admin / Pastor</option>
                  <option value="shepherd">Shepherd</option>
                  <option value="recorder">New Believer Officer</option>
                </select>
              </div>
            </>
          )}

          {isAdminRole && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input type="text" required value={branchName} onChange={e => setBranchName(e.target.value)}
                  placeholder="e.g. EPC Ikeja"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code *</label>
                <input type="text" required value={branchCode} onChange={e => setBranchCode(e.target.value.toUpperCase())}
                  placeholder="e.g. IKJ" maxLength={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black" />
                <p className="text-xs text-gray-400 mt-1">Share this code with your shepherds and recorders so they can join</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location (optional)</label>
                <input type="text" value={branchLocation} onChange={e => setBranchLocation(e.target.value)}
                  placeholder="e.g. Ikeja, Lagos"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black" />
              </div>
            </>
          )}

          {!isAdminRole && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code *</label>
              <input type="text" required value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Get this from your pastor / admin"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black" />
              <p className="text-xs text-gray-400 mt-1">Your admin will give you this code</p>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full py-3 bg-linear-to-r from-orange-400 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50">
            {saving ? 'Setting up...' : isAdminRole ? 'Create Branch & Open Dashboard' : 'Join Branch & Open Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

function BranchSetup({ profile }: { profile: Profile }) { return <AccountSetup existingProfile={profile} />; }
function ProfileRepair() { return <AccountSetup />; }


