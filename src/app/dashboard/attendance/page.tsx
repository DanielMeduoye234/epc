'use client';
/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Bacenta, FirstTimer, NewBeliever, Member } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
  Users, Plus, X, Search, BarChart3, Grid3X3, CalendarDays,
  ChevronLeft, ChevronRight, ChevronDown, UserCheck, UserX, FolderTree, AlertCircle, Camera, RefreshCw,
  UserCheck2, Check,
} from 'lucide-react';
import { downscalePhoto } from '@/lib/photos';
import React from 'react';
import BacentaSelect from '@/components/BacentaSelect';
import { getCached, setCached } from '@/lib/query-cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { migrateAttendanceHistory } from '@/lib/attendance-integrity';
import {
  isInShepherdFlock,
  isLikelySamePerson,
  phonesOverlap,
  shepherdBacentaNames,
  normalizeBacentaName,
} from '@/lib/flock';
import {
  DEMO_MEMBERS,
  DEMO_FIRST_TIMERS,
  DEMO_NEW_BELIEVERS,
  DEMO_USERS,
  DEMO_BACENTAS,
} from '@/lib/demo-data';

type ExistingMemberRow = { id: string; first_timer_id: string | null; new_believer_id?: string | null; full_name: string; phone_number: string };

async function checkAndPromoteIndividuals(supabase: SupabaseClient, branchId: string) {
  const [ftRes, nbRes] = await Promise.all([
    supabase.from('first_timers').select('*').eq('branch_id', branchId).eq('status', 'first_timer'),
    supabase.from('new_believers').select('*').eq('branch_id', branchId),
  ]);

  const firstTimers: FirstTimer[] = ftRes.data || [];
  const newBelievers: NewBeliever[] = nbRes.data || [];

  if (firstTimers.length === 0 && newBelievers.length === 0) return;

  const { data: currentMembers, error: membersError } = await supabase
    .from('members')
    .select('id, full_name, phone_number, first_timer_id, new_believer_id')
    .eq('branch_id', branchId);

  if (ftRes.error || nbRes.error || membersError) {
    throw new Error(ftRes.error?.message || nbRes.error?.message || membersError?.message || 'Promotion data could not be loaded');
  }

  const memberRows: ExistingMemberRow[] = currentMembers || [];
  const existingFtIds = new Set(memberRows.map((m) => m.first_timer_id).filter(Boolean));
  const existingNbIds = new Set(memberRows.map((m) => m.new_believer_id).filter(Boolean));
  const existingNames = new Set(memberRows.map((m) => m.full_name.toLowerCase().trim()));
  const existingPhones = new Set(memberRows.map((m) => m.phone_number?.trim()).filter(Boolean));

  if (firstTimers.length > 0) {
    const ftIds = firstTimers.map((f) => f.id);
    const { data: ftAtt, error: ftAttendanceError } = await supabase
      .from('attendance')
      .select('person_id')
      .in('person_id', ftIds)
      .eq('is_present', true);

    if (ftAttendanceError) throw new Error(`First-timer attendance could not be checked: ${ftAttendanceError.message}`);

    const ftCounts: Record<string, number> = {};
    (ftAtt || []).forEach((a: { person_id: string }) => {
      ftCounts[a.person_id] = (ftCounts[a.person_id] || 0) + 1;
    });

    for (const ft of firstTimers) {
      const count = ftCounts[ft.id] || 0;
      const existingCandidates = memberRows.filter((member) =>
        member.first_timer_id === ft.id ||
        isLikelySamePerson(member, ft) ||
        phonesOverlap(member.phone_number, ft.phone_number)
      );

      if (count >= 2 && existingCandidates.length === 1) {
        const existingMember = existingCandidates[0];
        await migrateAttendanceHistory(supabase, ft.id, 'first_timer', existingMember.id, branchId);
        const { error: statusError } = await supabase
          .from('first_timers')
          .update({ status: 'member', promoted_at: new Date().toISOString() })
          .eq('id', ft.id);
        if (statusError) throw new Error(`Attendance was preserved, but promotion status failed: ${statusError.message}`);
        existingFtIds.add(ft.id);
        continue;
      }

      if (count >= 2 && !existingFtIds.has(ft.id) && !existingNames.has(ft.full_name.toLowerCase().trim())) {
        const { data: newMem, error: memberError } = await supabase
          .from('members')
          .insert({
            first_timer_id: ft.id,
            full_name: ft.full_name,
            first_name: ft.first_name,
            last_name: ft.last_name,
            nickname: ft.nickname,
            address: ft.address,
            bacenta: ft.bacenta,
            phone_number: ft.phone_number,
            who_brought: ft.who_brought,
            date_joined: ft.date_joined,
            membership_date: new Date().toISOString().split('T')[0],
            assigned_shepherd: ft.assigned_shepherd,
            branch_id: ft.branch_id,
            status: 'active',
          })
          .select('id')
          .maybeSingle();

        if (memberError || !newMem?.id) {
          throw new Error(`First timer could not be promoted: ${memberError?.message || 'member ID was not returned'}`);
        }
        if (newMem.id) {
          await migrateAttendanceHistory(supabase, ft.id, 'first_timer', newMem.id, branchId);
          const { error: statusError } = await supabase
            .from('first_timers')
            .update({ status: 'member', promoted_at: new Date().toISOString() })
            .eq('id', ft.id);
          if (statusError) throw new Error(`Attendance was preserved, but promotion status failed: ${statusError.message}`);
          existingFtIds.add(ft.id);
          existingNames.add(ft.full_name.toLowerCase().trim());
          if (ft.phone_number) existingPhones.add(ft.phone_number.trim());
        }
      }
    }
  }

  if (newBelievers.length > 0) {
    const nbIds = newBelievers.map((n) => n.id);
    const { data: nbAtt, error: nbAttendanceError } = await supabase
      .from('attendance')
      .select('person_id')
      .in('person_id', nbIds)
      .eq('is_present', true);

    if (nbAttendanceError) throw new Error(`New-believer attendance could not be checked: ${nbAttendanceError.message}`);

    const nbCounts: Record<string, number> = {};
    (nbAtt || []).forEach((a: { person_id: string }) => {
      nbCounts[a.person_id] = (nbCounts[a.person_id] || 0) + 1;
    });

    for (const nb of newBelievers) {
      const count = nbCounts[nb.id] || 0;
      const existingCandidates = memberRows.filter((member) =>
        member.new_believer_id === nb.id ||
        isLikelySamePerson(member, nb) ||
        phonesOverlap(member.phone_number, nb.phone_number)
      );
      const isAlreadyMember = existingCandidates.length > 0;
      if (count >= 2 && existingCandidates.length === 1) {
        if (!existingCandidates[0].new_believer_id) {
          await supabase.from('members').update({ new_believer_id: nb.id }).eq('id', existingCandidates[0].id);
          existingCandidates[0].new_believer_id = nb.id;
        }
        await migrateAttendanceHistory(supabase, nb.id, 'new_believer', existingCandidates[0].id, branchId);
        continue;
      }
      if (count >= 2 && !isAlreadyMember && !existingNbIds.has(nb.id)) {
        const { data: newMem, error: memberError } = await supabase
          .from('members')
          .insert({
            new_believer_id: nb.id,
            full_name: nb.full_name,
            address: nb.address,
            bacenta: nb.bacenta,
            phone_number: nb.phone_number,
            who_brought: nb.who_brought,
            date_joined: nb.date_saved,
            membership_date: new Date().toISOString().split('T')[0],
            assigned_shepherd: null,
            branch_id: nb.branch_id,
            status: 'active',
          })
          .select('id')
          .maybeSingle();

        if (memberError || !newMem?.id) {
          throw new Error(`New believer could not be promoted: ${memberError?.message || 'member ID was not returned'}`);
        }
        if (newMem.id) {
          await migrateAttendanceHistory(supabase, nb.id, 'new_believer', newMem.id, branchId);
          existingNames.add(nb.full_name.toLowerCase().trim());
          if (nb.phone_number) existingPhones.add(nb.phone_number.trim());
        }
      }
    }
  }
}

function getSundaysFromMonth(year: number, month: number): Date[] {
  const sundays: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const end = new Date(year, month + 1, 0);
  while (d <= end) {
    sundays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

function toDateStr(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type Tab = 'overview' | 'tracker' | 'records';
type PersonType = 'member' | 'first_timer' | 'new_believer';

interface TrackedPerson {
  id: string;
  full_name: string;
  phone_number: string;
  bacenta: string;
  status: string;
  person_type: PersonType;
  assigned_shepherd?: string | null;
  is_archived?: boolean;
}

interface AddForm {
  full_name: string;
  phone_number: string;
  address: string;
  bacenta: string;
  who_brought: string;
  is_first_timer: boolean;
}

interface WeeklyAttendancePoint {
  week: string;
  present: number;
  absent: number;
  attendanceRate: number;
}

interface WeeklyFirstTimerPoint {
  week: string;
  count: number;
}

interface AttendanceQueryRow {
  id: string;
  person_id: string;
  person_type: PersonType;
  date: string;
  is_present: boolean;
}

interface ShepherdOption {
  id: string;
  name: string;
  bacentaNames: string[];
}

const ATTENDANCE_PAGE_SIZE = 1000;

async function fetchAllAttendanceRows(
  supabase: SupabaseClient,
  branchId: string,
  startDate: string,
  endDate?: string
): Promise<{ data: AttendanceQueryRow[]; error: { message: string } | null }> {
  const rows: AttendanceQueryRow[] = [];
  for (let from = 0; ; from += ATTENDANCE_PAGE_SIZE) {
    let query = supabase
      .from('attendance')
      .select('id, person_id, person_type, date, is_present')
      .eq('branch_id', branchId)
      .gte('date', startDate)
      .order('id', { ascending: true })
      .range(from, from + ATTENDANCE_PAGE_SIZE - 1);
    if (endDate) query = query.lte('date', endDate);

    const { data, error } = await query;
    if (error) return { data: [], error };
    const page = (data || []) as AttendanceQueryRow[];
    rows.push(...page);
    if (page.length < ATTENDANCE_PAGE_SIZE) return { data: rows, error: null };
  }
}

interface PageSnapshot {
  members: TrackedPerson[];
  bacentas: Bacenta[];
  weeklyAttendance: WeeklyAttendancePoint[];
  weeklyFirstTimers: WeeklyFirstTimerPoint[];
  branchName: string;
}

function getWeekStartKey(dateStr: string): string {
  const date = new Date(dateStr);
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  return weekStart.toISOString().split('T')[0];
}

function getWeekLabel(weekStart: string): string {
  const date = new Date(weekStart);
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function AttendancePage() {
  const { profile, isDemo } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [allBranchMembers, setAllBranchMembers] = useState<TrackedPerson[]>([]);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [shepherdList, setShepherdList] = useState<ShepherdOption[]>([]);
  const [selectedShepherdId, setSelectedShepherdId] = useState<string>('');

  const [archivedAttendancePeople, setArchivedAttendancePeople] = useState<TrackedPerson[]>([]);
  const [branchName, setBranchName] = useState('');
  const [weeklyAttendanceRaw, setWeeklyAttendanceRaw] = useState<AttendanceQueryRow[]>([]);
  const [weeklyFirstTimersRaw, setWeeklyFirstTimersRaw] = useState<{ date_joined: string; bacenta?: string; assigned_shepherd?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  // Overview search and filter
  const [search, setSearch] = useState('');
  const [filterBacenta, setFilterBacenta] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    full_name: '',
    phone_number: '',
    address: '',
    bacenta: '',
    who_brought: '',
    is_first_timer: false,
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const promotionCheckRunning = useRef(false);
  const dataFetchRequestRef = useRef(0);

  // Tracker state
  const now = new Date();
  const [trackerYear, setTrackerYear] = useState(now.getFullYear());
  const [trackerMonth, setTrackerMonth] = useState(now.getMonth());
  const [trackerBacenta, setTrackerBacenta] = useState('all');
  const [trackerSearch, setTrackerSearch] = useState('');
  const [selectedSunday, setSelectedSunday] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmarked' | 'absent' | 'present'>('all');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<string, boolean>>>({});
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [showSundayRecords, setShowSundayRecords] = useState(false);
  const loadedMonthRef = useRef<string>('');
  const pendingSavesRef = useRef<Map<string, boolean | undefined>>(new Map());
  const trackerFetchRequestRef = useRef(0);
  const attendanceMutationVersionRef = useRef(0);
  const recentEditsRef = useRef<Map<string, { value: boolean | undefined; version: number }>>(new Map());
  const [savingAttendanceKeys, setSavingAttendanceKeys] = useState<Set<string>>(new Set());

  const isShepherd = profile?.role === 'shepherd';
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'bishop';

  // Effective Shepherd ID & Bacenta Scope
  const activeShepherdId = isShepherd ? (profile?.id || '') : selectedShepherdId;

  // Active shepherd bacentas
  const activeShepherdBacentaNames = useMemo(() => {
    if (isShepherd && profile) {
      return shepherdBacentaNames(profile);
    }
    if (activeShepherdId && activeShepherdId !== 'all') {
      const sh = shepherdList.find((s) => s.id === activeShepherdId);
      return sh?.bacentaNames || [];
    }
    return [];
  }, [isShepherd, profile, activeShepherdId, shepherdList]);

  // Flock-filtered members
  const members = useMemo(() => {
    if (!activeShepherdId || activeShepherdId === 'all') {
      return allBranchMembers;
    }
    return allBranchMembers.filter((m) =>
      isInShepherdFlock(m, activeShepherdId, activeShepherdBacentaNames)
    );
  }, [allBranchMembers, activeShepherdId, activeShepherdBacentaNames]);

  // Flock-filtered bacentas
  const flockBacentas = useMemo(() => {
    if (isShepherd && activeShepherdBacentaNames.length > 0) {
      return bacentas.filter((b) =>
        activeShepherdBacentaNames.some((name) => normalizeBacentaName(name) === normalizeBacentaName(b.name))
      );
    }
    if (activeShepherdId && activeShepherdId !== 'all' && activeShepherdBacentaNames.length > 0) {
      return bacentas.filter((b) =>
        activeShepherdBacentaNames.some((name) => normalizeBacentaName(name) === normalizeBacentaName(b.name))
      );
    }
    return bacentas;
  }, [bacentas, isShepherd, activeShepherdId, activeShepherdBacentaNames]);

  // All distinct bacentas in the current flock
  const allBacentas = useMemo(() => {
    const list = Array.from(new Set(members.map((m) => m.bacenta).filter(Boolean)));
    if (flockBacentas.length > 0) {
      flockBacentas.forEach((b) => {
        if (!list.includes(b.name)) list.push(b.name);
      });
    }
    return list.sort();
  }, [members, flockBacentas]);

  // 8-Week series for the flock
  const weeklyAttendance = useMemo(() => {
    const weekSeed: Record<string, WeeklyAttendancePoint> = {};
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
      const key = weekStart.toISOString().split('T')[0];
      weekSeed[key] = { week: getWeekLabel(key), present: 0, absent: 0, attendanceRate: 0 };
    }

    const flockMemberIds = new Set(members.map((m) => m.id));

    weeklyAttendanceRaw.forEach((row) => {
      if (!flockMemberIds.has(row.person_id)) return;
      const weekKey = getWeekStartKey(row.date);
      if (!weekSeed[weekKey]) return;
      if (row.is_present) weekSeed[weekKey].present += 1;
      else weekSeed[weekKey].absent += 1;
    });

    return Object.values(weekSeed).map((entry) => {
      const total = entry.present + entry.absent;
      return {
        ...entry,
        attendanceRate: total > 0 ? Math.round((entry.present / total) * 100) : 0,
      };
    });
  }, [members, weeklyAttendanceRaw]);

  // 8-Week first timers series for flock
  const weeklyFirstTimers = useMemo(() => {
    const weekSeed: Record<string, WeeklyFirstTimerPoint> = {};
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
      const key = weekStart.toISOString().split('T')[0];
      weekSeed[key] = { week: getWeekLabel(key), count: 0 };
    }

    weeklyFirstTimersRaw.forEach((row) => {
      if (activeShepherdId && activeShepherdId !== 'all') {
        const belongs = isInShepherdFlock(
          { assigned_shepherd: row.assigned_shepherd, bacenta: row.bacenta },
          activeShepherdId,
          activeShepherdBacentaNames
        );
        if (!belongs) return;
      }
      const weekKey = getWeekStartKey(row.date_joined);
      if (weekSeed[weekKey]) weekSeed[weekKey].count += 1;
    });

    return Object.values(weekSeed);
  }, [weeklyFirstTimersRaw, activeShepherdId, activeShepherdBacentaNames]);

  // Initialize
  useEffect(() => {
    if (!profile) return;
    if (isShepherd) {
      setSelectedShepherdId(profile.id);
    }
    const cached = getCached<PageSnapshot>(`shepherd-data:${profile.branch_id}:${profile.id}`);
    if (cached) {
      applySnapshot(cached);
      setLoading(false);
    }
    fetchData(!cached);
  }, [profile]);

  useEffect(() => {
    if (tab === 'tracker' || tab === 'records') {
      const monthKey = `${trackerYear}-${trackerMonth}`;
      if (loadedMonthRef.current !== monthKey) {
        fetchTrackerAttendance(true);
      }
    }
  }, [tab, trackerYear, trackerMonth, profile?.branch_id]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingSavesRef.current.size === 0) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, []);

  useEffect(() => {
    const refreshOnFocus = () => {
      if ((tab === 'tracker' || tab === 'records') && document.visibilityState === 'visible') {
        void fetchTrackerAttendance(true);
      }
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [tab, trackerYear, trackerMonth, profile?.branch_id]);

  function applySnapshot(snap: PageSnapshot) {
    setAllBranchMembers(snap.members);
    setBacentas(snap.bacentas);
    setBranchName(snap.branchName);
  }

  async function fetchData(showSpinner = true) {
    if (!profile) return false;
    const requestId = ++dataFetchRequestRef.current;
    if (showSpinner) setLoading(true);

    if (isDemo) {
      // Demo dataset setup
      const demoShepherds: ShepherdOption[] = Object.entries(DEMO_USERS)
        .filter(([, u]) => u.role === 'shepherd')
        .map(([id, u]) => ({
          id,
          name: u.name,
          bacentaNames: u.bacenta_id ? [DEMO_BACENTAS.find(b => b.id === u.bacenta_id)?.name || ''] : [],
        }));
      setShepherdList(demoShepherds);
      if (!isShepherd && (!selectedShepherdId || selectedShepherdId === 'all')) {
        setSelectedShepherdId(demoShepherds[0]?.id || 'all');
      }

      const listMembers: TrackedPerson[] = DEMO_MEMBERS.map((m) => ({
        ...m,
        person_type: 'member',
      }));
      setAllBranchMembers(listMembers);
      setBacentas(DEMO_BACENTAS);
      setBranchName('EPC Demo Branch');

      // Demo attendance seed (past 8 weeks)
      const demoAttendanceRows: AttendanceQueryRow[] = [];
      listMembers.forEach((m) => {
        for (let i = 0; i < 8; i++) {
          const d = new Date();
          d.setDate(d.getDate() - (d.getDay() === 0 ? 0 : d.getDay()) - i * 7);
          demoAttendanceRows.push({
            id: `att-demo-${m.id}-${i}`,
            person_id: m.id,
            person_type: 'member',
            date: toDateStr(d),
            is_present: Math.random() > 0.3,
          });
        }
      });
      setWeeklyAttendanceRaw(demoAttendanceRows);

      const demoFt = DEMO_FIRST_TIMERS.map((ft) => ({
        date_joined: ft.date_joined,
        bacenta: ft.bacenta,
        assigned_shepherd: ft.assigned_shepherd,
      }));
      setWeeklyFirstTimersRaw(demoFt);

      setLoading(false);
      return true;
    }

    const branchId = profile.branch_id;
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const weeklyStartDate = eightWeeksAgo.toISOString().split('T')[0];

    const [mRes, bRes, attendanceRes, firstTimersRes, branchRes, shepherdsRes] = await Promise.all([
      supabase
        .from('members')
        .select('id, full_name, phone_number, bacenta, status, assigned_shepherd')
        .eq('branch_id', branchId)
        .order('bacenta')
        .order('full_name'),
      supabase.from('bacentas').select('*').eq('branch_id', branchId).order('name'),
      fetchAllAttendanceRows(supabase, branchId, weeklyStartDate),
      supabase
        .from('first_timers')
        .select('date_joined, bacenta, assigned_shepherd')
        .eq('branch_id', branchId)
        .gte('date_joined', weeklyStartDate),
      supabase.from('branches').select('name').eq('id', branchId).maybeSingle(),
      isAdmin
        ? supabase.from('profiles').select('id, full_name, bacentas:bacentas(name)').eq('branch_id', branchId).eq('role', 'shepherd')
        : Promise.resolve({ data: [] }),
    ]);

    if (requestId !== dataFetchRequestRef.current) return false;

    const loadError = mRes.error || bRes.error || attendanceRes.error || firstTimersRes.error || branchRes.error;
    if (loadError) {
      setPageError(`Could not refresh shepherd data: ${loadError.message}`);
      setLoading(false);
      return false;
    }

    const mList: TrackedPerson[] = ((mRes.data || []) as Omit<TrackedPerson, 'person_type'>[]).map((x) => ({
      ...x,
      person_type: 'member' as const,
    }));

    if (isAdmin && shepherdsRes.data) {
      const shList: ShepherdOption[] = (shepherdsRes.data as Array<{ id: string; full_name: string; bacentas?: Array<{ name: string }> | null }>).map((s) => ({
        id: s.id,
        name: s.full_name,
        bacentaNames: (s.bacentas || []).map((b) => b.name).filter(Boolean),
      }));
      setShepherdList(shList);
      if (!selectedShepherdId && shList.length > 0) {
        setSelectedShepherdId(shList[0].id);
      }
    }

    setAllBranchMembers(mList);
    setBacentas(bRes.data || []);
    setWeeklyAttendanceRaw(attendanceRes.data || []);
    setWeeklyFirstTimersRaw(firstTimersRes.data || []);
    setBranchName(branchRes.data?.name || 'This Branch');

    const snapshot: PageSnapshot = {
      members: mList,
      bacentas: bRes.data || [],
      weeklyAttendance: [],
      weeklyFirstTimers: [],
      branchName: branchRes.data?.name || 'This Branch',
    };
    applySnapshot(snapshot);
    setCached(`shepherd-data:${branchId}:${profile.id}`, snapshot);

    setPageError('');
    setLoading(false);
    return true;
  }

  async function fetchTrackerAttendance(force = false) {
    if (!profile) return;
    const currentMonthKey = `${profile.branch_id}:${trackerYear}-${trackerMonth}`;
    if (!force && loadedMonthRef.current === currentMonthKey && Object.keys(attendanceMap).length > 0) {
      return;
    }
    const requestId = ++trackerFetchRequestRef.current;
    const mutationVersionAtStart = attendanceMutationVersionRef.current;
    setLoadingAtt(true);
    const startDate = `${trackerYear}-${String(trackerMonth + 1).padStart(2, '0')}-01`;
    const endDate = toDateStr(new Date(trackerYear, trackerMonth + 1, 0));

    if (isDemo) {
      const map: Record<string, Record<string, boolean>> = {};
      const demoSundays = getSundaysFromMonth(trackerYear, trackerMonth);
      allBranchMembers.forEach((m) => {
        map[m.id] = {};
        demoSundays.forEach((s) => {
          map[m.id][toDateStr(s)] = Math.random() > 0.35;
        });
      });
      setAttendanceMap(map);
      loadedMonthRef.current = currentMonthKey;
      setLoadingAtt(false);
      return;
    }

    const { data, error } = await fetchAllAttendanceRows(
      supabase,
      profile.branch_id,
      startDate,
      endDate
    );

    if (requestId !== trackerFetchRequestRef.current) return;

    if (error) {
      setAttendanceError(`Could not load attendance: ${error.message}`);
      setLoadingAtt(false);
      return;
    }

    const map: Record<string, Record<string, boolean>> = {};
    data.forEach((a) => {
      if (!map[a.person_id]) map[a.person_id] = {};
      map[a.person_id][a.date] = a.is_present;
    });

    const knownMemberIds = new Set(allBranchMembers.map((member) => member.id));
    const archivedIds = Array.from(new Set<string>(
      data
        .filter((row) => row.person_type === 'member' && !knownMemberIds.has(row.person_id))
        .map((row) => row.person_id)
    ));
    setArchivedAttendancePeople(archivedIds.map((id) => ({
      id,
      full_name: `Archived member ${id.slice(0, 6).toUpperCase()}`,
      phone_number: '',
      bacenta: 'Archived records',
      status: 'inactive',
      person_type: 'member',
      is_archived: true,
    })));

    setAttendanceMap(() => {
      const merged = { ...map };
      recentEditsRef.current.forEach((edit, saveKey) => {
        if (edit.version <= mutationVersionAtStart) return;
        const [memId, dateStr] = saveKey.split(':::');
        if (memId && dateStr) {
          if (edit.value === undefined) {
            if (merged[memId]) delete merged[memId][dateStr];
          } else {
            if (!merged[memId]) merged[memId] = {};
            merged[memId][dateStr] = edit.value;
          }
        }
      });
      return merged;
    });

    loadedMonthRef.current = currentMonthKey;
    setLoadingAtt(false);
  }

  async function toggleAttendance(
    memberId: string,
    dateStr: string,
    next?: boolean | null,
    options?: { skipClearConfirmation?: boolean }
  ) {
    const saveKey = `${memberId}:::${dateStr}`;
    if (pendingSavesRef.current.has(saveKey)) return false;

    const current = (attendanceMap[memberId] || {})[dateStr];
    const targetMember = [...members, ...archivedAttendancePeople].find((m) => m.id === memberId);
    if (!targetMember || targetMember.is_archived) return false;

    if (
      next === null &&
      current !== undefined &&
      !options?.skipClearConfirmation &&
      !window.confirm(`Clear ${targetMember.full_name}'s stored attendance for ${dateStr}?`)
    ) {
      return false;
    }

    const newVal = next === null
      ? undefined
      : typeof next === 'boolean'
      ? next
      : current === undefined
      ? true
      : current === true
      ? false
      : undefined;

    const mutationVersion = ++attendanceMutationVersionRef.current;
    pendingSavesRef.current.set(saveKey, newVal);
    recentEditsRef.current.set(saveKey, { value: newVal, version: mutationVersion });
    setSavingAttendanceKeys((prev) => new Set(prev).add(saveKey));

    setAttendanceError('');
    setAttendanceMap((prev) => {
      const updated = { ...prev, [memberId]: { ...(prev[memberId] || {}) } };
      if (newVal === undefined) delete updated[memberId][dateStr];
      else updated[memberId][dateStr] = newVal;
      return updated;
    });

    if (isDemo) {
      pendingSavesRef.current.delete(saveKey);
      setSavingAttendanceKeys((prev) => {
        const nextKeys = new Set(prev);
        nextKeys.delete(saveKey);
        return nextKeys;
      });
      return true;
    }

    const personType = targetMember.person_type;
    let dbError: { message?: string } | null = null;
    try {
      if (newVal === undefined) {
        const { error } = await supabase
          .from('attendance')
          .delete()
          .eq('person_id', memberId)
          .eq('date', dateStr)
          .eq('branch_id', profile!.branch_id);
        dbError = error;
      } else {
        const { error } = await supabase.from('attendance').upsert(
          {
            person_id: memberId,
            person_type: personType,
            date: dateStr,
            is_present: newVal,
            marked_by: profile!.id,
            branch_id: profile!.branch_id,
          },
          { onConflict: 'person_id,date,person_type' }
        );
        dbError = error;
      }
    } catch (err: unknown) {
      dbError = err instanceof Error ? err : { message: 'Database write failed' };
    } finally {
      pendingSavesRef.current.delete(saveKey);
      setSavingAttendanceKeys((prev) => {
        const nextKeys = new Set(prev);
        nextKeys.delete(saveKey);
        return nextKeys;
      });
    }

    if (dbError) {
      setAttendanceMap((prev) => {
        const updated = { ...prev, [memberId]: { ...(prev[memberId] || {}) } };
        if (current === undefined) delete updated[memberId][dateStr];
        else updated[memberId][dateStr] = current;
        return updated;
      });
      const latestEdit = recentEditsRef.current.get(saveKey);
      if (latestEdit?.version === mutationVersion) recentEditsRef.current.delete(saveKey);
      setAttendanceError(`Attendance was not saved: ${dbError.message || 'Database write failed'}`);
      return false;
    }

    if (newVal === true && !promotionCheckRunning.current) {
      promotionCheckRunning.current = true;
      checkAndPromoteIndividuals(supabase, profile!.branch_id)
        .then(async () => {
          await fetchData(false);
          await fetchTrackerAttendance(true);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Promotion refresh failed';
          setAttendanceError(`Attendance saved, but related records could not refresh: ${message}`);
        })
        .finally(() => {
          promotionCheckRunning.current = false;
        });
    }

    return true;
  }

  async function bulkSetAttendance(value: boolean | null) {
    if (!selectedSunday || trackerMembers.length === 0) return;
    const editableMembers = filteredTrackerMembers.filter((m) => !m.is_archived);
    const membersToUpdate = value === false
      ? editableMembers.filter(
          (m) => (attendanceMap[m.id] || {})[selectedSunday] === undefined
        )
      : editableMembers;

    if (
      value === null &&
      !window.confirm(`Clear attendance for all ${membersToUpdate.length} visible members on ${selectedSunday}?`)
    ) {
      return;
    }

    await Promise.all(
      membersToUpdate.map((m) =>
        toggleAttendance(m.id, selectedSunday, value, { skipClearConfirmation: true })
      )
    );
  }

  function changeTrackerMonth(offset: number) {
    const d = new Date(trackerYear, trackerMonth + offset, 1);
    setTrackerYear(d.getFullYear());
    setTrackerMonth(d.getMonth());
  }

  const sundays = useMemo(() => getSundaysFromMonth(trackerYear, trackerMonth), [trackerYear, trackerMonth]);

  useEffect(() => {
    if (sundays.length === 0) {
      setSelectedSunday('');
      return;
    }
    const current = sundays.find((s) => toDateStr(s) === selectedSunday);
    if (!current) {
      const todayStr = toDateStr(new Date());
      const matchToday = sundays.find((s) => toDateStr(s) === todayStr);
      setSelectedSunday(toDateStr(matchToday || sundays[0]));
    }
  }, [sundays]);

  // Overview filtered table
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.full_name.toLowerCase().includes(search.toLowerCase()) ||
        m.bacenta.toLowerCase().includes(search.toLowerCase());
      const matchBacenta = filterBacenta === 'all' || m.bacenta === filterBacenta;
      return matchSearch && matchBacenta;
    });
  }, [members, search, filterBacenta]);

  const totalActive = members.filter((m) => m.status === 'active').length;
  const totalFlagged = members.filter((m) => m.status === 'flagged').length;

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      if (m.bacenta) counts[m.bacenta] = (counts[m.bacenta] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [members]);

  const resolvedArchivedAttendancePeople = useMemo(() => {
    const activeIds = new Set(members.map((m) => m.id));
    return archivedAttendancePeople.filter((m) => !activeIds.has(m.id));
  }, [members, archivedAttendancePeople]);

  const trackerMembers = useMemo(() => {
    const base = [...members, ...resolvedArchivedAttendancePeople];
    if (trackerBacenta === 'all') return base;
    return base.filter((m) => m.bacenta === trackerBacenta);
  }, [members, resolvedArchivedAttendancePeople, trackerBacenta]);

  const filteredTrackerMembers = useMemo(() => {
    return trackerMembers.filter((m) => {
      const matchSearch = m.full_name.toLowerCase().includes(trackerSearch.toLowerCase());
      if (!matchSearch) return false;
      if (!selectedSunday) return true;
      const val = (attendanceMap[m.id] || {})[selectedSunday];
      if (statusFilter === 'all') return true;
      if (statusFilter === 'unmarked') return val === undefined;
      if (statusFilter === 'present') return val === true;
      if (statusFilter === 'absent') return val === false;
      return true;
    });
  }, [trackerMembers, trackerSearch, selectedSunday, statusFilter, attendanceMap]);

  const groupedFilteredTrackerMembers = useMemo(() => {
    const groups = new Map<string, TrackedPerson[]>();
    filteredTrackerMembers.forEach((member) => {
      const groupKey = member.bacenta || 'Unassigned Bacenta';
      const existing = groups.get(groupKey);
      if (existing) existing.push(member);
      else groups.set(groupKey, [member]);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTrackerMembers]);

  const selectedDayStats = useMemo(() => {
    if (!selectedSunday) return { present: 0, absent: 0, unmarked: 0 };
    let present = 0;
    let absent = 0;
    let unmarked = 0;
    trackerMembers.forEach((m) => {
      const val = (attendanceMap[m.id] || {})[selectedSunday];
      if (val === true) present++;
      else if (val === false) absent++;
      else unmarked++;
    });
    return { present, absent, unmarked };
  }, [trackerMembers, selectedSunday, attendanceMap]);

  const sundayRecords = useMemo(() => {
    const scopedMembers = [...members, ...resolvedArchivedAttendancePeople].filter(
      (m) => trackerBacenta === 'all' || m.bacenta === trackerBacenta
    );
    return sundays.map((s) => {
      const dayKey = toDateStr(s);
      const present = scopedMembers.filter((m) => (attendanceMap[m.id] || {})[dayKey] === true).length;
      const absent = scopedMembers.filter((m) => (attendanceMap[m.id] || {})[dayKey] === false).length;
      const total = present + absent;
      return {
        dayKey,
        label: s.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' }),
        present,
        absent,
        total,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
      };
    });
  }, [sundays, members, resolvedArchivedAttendancePeople, trackerBacenta, attendanceMap]);

  // Handle Add Sheep/Member
  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.full_name || !addForm.bacenta) {
      setAddError('Full name and Bacenta are required');
      return;
    }
    setAdding(true);
    setAddError('');

    try {
      let photo_url: string | null = null;
      if (photoFile && !isDemo) {
        const fileExt = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `photos/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('photos').upload(filePath, photoFile);
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath);
        photo_url = urlData.publicUrl;
      }

      const assignedShepherdId = isShepherd ? profile?.id : (activeShepherdId !== 'all' ? activeShepherdId : null);

      if (addForm.is_first_timer) {
        if (!isDemo) {
          const { error } = await supabase.from('first_timers').insert({
            full_name: addForm.full_name,
            phone_number: addForm.phone_number,
            address: addForm.address,
            bacenta: addForm.bacenta,
            who_brought: addForm.who_brought,
            date_joined: new Date().toISOString().split('T')[0],
            branch_id: profile!.branch_id,
            assigned_shepherd: assignedShepherdId,
            photo_url,
            status: 'first_timer',
          });
          if (error) throw new Error(error.message);
        }
      } else {
        if (!isDemo) {
          const { error } = await supabase.from('members').insert({
            full_name: addForm.full_name,
            phone_number: addForm.phone_number,
            address: addForm.address,
            bacenta: addForm.bacenta,
            who_brought: addForm.who_brought,
            date_joined: new Date().toISOString().split('T')[0],
            membership_date: new Date().toISOString().split('T')[0],
            branch_id: profile!.branch_id,
            assigned_shepherd: assignedShepherdId,
            photo_url,
            status: 'active',
          });
          if (error) throw new Error(error.message);
        }
      }

      setShowAddModal(false);
      setAddForm({ full_name: '', phone_number: '', address: '', bacenta: '', who_brought: '', is_first_timer: false });
      setPhotoFile(null);
      setPhotoPreview('');
      await fetchData(false);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            <span>Shepherd&apos;s Data</span>
            <span role="img" aria-label="sheep">🐑</span>
          </h1>
          <p className="text-gray-500 mt-1">
            {isShepherd
              ? 'Flock overview, membership & attendance tracker for your sheep'
              : 'Shepherd-level overview, membership & attendance tracker'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Shepherd Selector for Bishops / Admins */}
          {isAdmin && shepherdList.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Shepherd:</span>
              <select
                value={selectedShepherdId}
                onChange={(e) => setSelectedShepherdId(e.target.value)}
                className="px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-sm text-black font-medium focus:ring-2 focus:ring-orange-500 outline-none"
              >
                <option value="all">All Shepherds (Combined)</option>
                {shepherdList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => { setAddError(''); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 shadow-sm transition"
          >
            <Plus size={18} />
            Add Sheep
          </button>
        </div>
      </div>

      {pageError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      )}

      {savingAttendanceKeys.size > 0 && (
        <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          Saving {savingAttendanceKeys.size} attendance change{savingAttendanceKeys.size === 1 ? '' : 's'}…
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ['overview', BarChart3, 'Overview'],
          ['tracker', Grid3X3, 'Attendance Tracker'],
          ['records', CalendarDays, 'Monthly Records'],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Sheep', value: members.length, color: 'text-black' },
              { label: 'Bacentas in Care', value: allBacentas.length, color: 'text-orange-500' },
              { label: 'Active', value: totalActive, color: 'text-green-600', icon: UserCheck },
              { label: 'Flagged', value: totalFlagged, color: 'text-red-500', icon: UserX },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-black mb-4 text-sm">Flock Attendance (Last 8 Weeks)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyAttendance} margin={{ top: 5, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="present" fill="#22c55e" name="Present" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-black mb-4 text-sm">First Timers &amp; New Souls (Last 8 Weeks)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyFirstTimers} margin={{ top: 5, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                    <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} name="First Timers" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Shepherd Bacentas Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-black text-sm flex items-center gap-2">
                <FolderTree size={18} className="text-orange-500" />
                Flock Bacentas
              </h3>
            </div>
            {allBacentas.length === 0 ? (
              <p className="text-sm text-gray-400">No bacentas assigned to this flock yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allBacentas.map((bacName) => {
                  const bacObj = flockBacentas.find((b) => b.name === bacName);
                  const memCount = members.filter((m) => m.bacenta === bacName).length;
                  return (
                    <div key={bacName} className="p-3.5 bg-orange-50/70 rounded-xl border border-orange-100">
                      <p className="font-semibold text-sm text-black">{bacName}</p>
                      {bacObj?.leader_name && <p className="text-xs text-gray-600 mt-0.5">Leader: {bacObj.leader_name}</p>}
                      {bacObj?.location && <p className="text-xs text-gray-500 mt-0.5">{bacObj.location}</p>}
                      <div className="flex items-center gap-1.5 mt-2.5 text-xs text-gray-700 font-medium">
                        <Users size={13} className="text-orange-500" />
                        <span>{memCount} sheep</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Members per Bacenta Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-black mb-4 text-sm">Sheep per Bacenta</h3>
            {chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      formatter={(v) => [v, 'Sheep']}
                    />
                    <Bar dataKey="count" name="Sheep" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No flock data yet</div>
            )}
          </div>

          {/* Filters + Table */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search sheep by name or bacenta..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black text-sm"
              />
            </div>
            <select
              value={filterBacenta}
              onChange={(e) => setFilterBacenta(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black text-sm"
            >
              <option value="all">All Flock Bacentas</option>
              {allBacentas.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <span className="font-semibold text-black text-sm">
                  {filterBacenta !== 'all' ? filterBacenta : 'All Flock Members'}
                </span>
                <span className="text-gray-400 font-normal text-sm ml-1">({filteredMembers.length})</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Bacenta</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase hidden sm:table-cell">Phone</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-orange-50/30 transition">
                      <td className="px-5 py-3 text-sm text-black font-medium">{m.full_name}</td>
                      <td className="px-5 py-3">
                        <span className="inline-block px-2.5 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-full font-medium">
                          {m.bacenta}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">{m.phone_number}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full font-medium capitalize ${
                          m.status === 'active' ? 'bg-green-100 text-green-700' :
                          m.status === 'flagged' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-gray-400 text-sm">
                        No sheep found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== TRACKER TAB ===== */}
      {tab === 'tracker' && (
        <div className="space-y-4">
          {/* Tracker controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <button
                onClick={() => changeTrackerMonth(-1)}
                className="p-0.5 text-gray-500 hover:text-orange-600 transition"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-black min-w-30 text-center text-sm">
                {new Date(trackerYear, trackerMonth).toLocaleString('en', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => changeTrackerMonth(1)}
                className="p-0.5 text-gray-500 hover:text-orange-600 transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <select
              value={trackerBacenta}
              onChange={(e) => setTrackerBacenta(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Flock Bacentas</option>
              {allBacentas.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={selectedSunday}
              onChange={(e) => setSelectedSunday(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
              disabled={sundays.length === 0}
            >
              {sundays.length === 0 ? (
                <option value="">No Sundays in selected month</option>
              ) : (
                sundays.map((s) => {
                  const ds = toDateStr(s);
                  return (
                    <option key={ds} value={ds}>
                      {s.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </option>
                  );
                })
              )}
            </select>

            <span className="text-xs text-gray-400">
              {sundays.length} Sundays &middot; {trackerMembers.length} sheep
            </span>

            <button
              type="button"
              onClick={() => fetchTrackerAttendance(true)}
              disabled={loadingAtt || savingAttendanceKeys.size > 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-600 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingAtt ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={trackerSearch}
              onChange={(e) => setTrackerSearch(e.target.value)}
              placeholder="Search member name..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: 'all', label: 'All' },
              { key: 'unmarked', label: 'Unmarked' },
              { key: 'absent', label: 'Absent' },
              { key: 'present', label: 'Present' },
            ] as const).map((item) => (
              <button
                key={item.key}
                onClick={() => setStatusFilter(item.key)}
                className={`px-3 py-1.5 text-xs rounded-full border transition ${
                  statusFilter === item.key
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => bulkSetAttendance(false)}
              className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition"
              disabled={!selectedSunday || filteredTrackerMembers.length === 0}
            >
              Mark Visible Absent
            </button>
            <button
              onClick={() => bulkSetAttendance(null)}
              className="px-3 py-1.5 text-xs rounded-lg bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 transition"
              disabled={!selectedSunday || filteredTrackerMembers.length === 0}
            >
              Clear Visible
            </button>
          </div>

          {attendanceError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {attendanceError}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-green-500 inline-block"></span> Present
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-red-400 inline-block"></span> Absent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-gray-200 inline-block"></span> Not recorded
            </span>
          </div>

          {selectedSunday && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg border border-gray-100 p-3 text-center">
                <p className="text-[10px] uppercase text-gray-500">Present</p>
                <p className="text-xl font-bold text-green-600">{selectedDayStats.present}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-100 p-3 text-center">
                <p className="text-[10px] uppercase text-gray-500">Absent</p>
                <p className="text-xl font-bold text-red-500">{selectedDayStats.absent}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-100 p-3 text-center">
                <p className="text-[10px] uppercase text-gray-500">Unmarked</p>
                <p className="text-xl font-bold text-gray-500">{selectedDayStats.unmarked}</p>
              </div>
            </div>
          )}

          {/* Sunday Records Collapsible */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSundayRecords((prev) => !prev)}
              aria-expanded={showSundayRecords}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition"
            >
              <div>
                <h3 className="text-sm font-semibold text-black">Sunday Records (Stored Attendance)</h3>
                <p className="text-xs text-gray-500 mt-0.5">Present and absent totals saved for each Sunday in this month.</p>
              </div>
              <ChevronDown
                size={18}
                className={`text-gray-400 shrink-0 transition-transform ${showSundayRecords ? 'rotate-180' : ''}`}
              />
            </button>
            {showSundayRecords && (
              sundayRecords.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400 border-t border-gray-100">No Sundays in this month.</div>
              ) : (
                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {sundayRecords.map((record) => (
                    <button
                      key={record.dayKey}
                      onClick={() => setSelectedSunday(record.dayKey)}
                      className={`w-full px-4 py-3 text-left transition ${
                        selectedSunday === record.dayKey ? 'bg-orange-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-black">{record.label}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            Total marked: <span className="font-semibold text-gray-700">{record.total}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-green-700">Present: {record.present}</span>
                          <span className="text-red-600">Absent: {record.absent}</span>
                          <span className="text-gray-600">Rate: {record.attendanceRate}%</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Member Marking List */}
          {loadingAtt ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {!selectedSunday ? (
                <div className="text-center py-12 text-gray-400">Select a Sunday to start marking attendance.</div>
              ) : filteredTrackerMembers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No sheep found for this filter.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {groupedFilteredTrackerMembers.map(([bacenta, groupMembers]) => (
                    <div key={bacenta}>
                      <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 text-xs font-semibold text-orange-700 uppercase tracking-wide">
                        {bacenta} <span className="text-orange-400 normal-case">({groupMembers.length})</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {groupMembers.map((member) => {
                          const value = (attendanceMap[member.id] || {})[selectedSunday];
                          const saveKey = `${member.id}:::${selectedSunday}`;
                          const isSavingAttendance = savingAttendanceKeys.has(saveKey);
                          return (
                            <div key={member.id} className="px-3 py-2">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div>
                                  <p className="text-sm font-medium text-black leading-tight">{member.full_name}</p>
                                  {member.is_archived && (
                                    <p className="text-[10px] text-amber-700 mt-0.5">Read-only history — member profile was deleted</p>
                                  )}
                                </div>
                                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                                  value === true
                                    ? 'bg-green-100 text-green-700'
                                    : value === false
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {value === true ? 'Present' : value === false ? 'Absent' : 'Not recorded'}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <button
                                  onClick={() => toggleAttendance(member.id, selectedSunday, true)}
                                  disabled={isSavingAttendance || member.is_archived}
                                  className={`py-1.5 rounded-lg text-xs font-medium transition border ${
                                    value === true
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-green-300'
                                  } disabled:cursor-wait disabled:opacity-60`}
                                >
                                  Present
                                </button>
                                <button
                                  onClick={() => toggleAttendance(member.id, selectedSunday, false)}
                                  disabled={isSavingAttendance || member.is_archived}
                                  className={`py-1.5 rounded-lg text-xs font-medium transition border ${
                                    value === false
                                      ? 'bg-red-500 border-red-500 text-white'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                                  } disabled:cursor-wait disabled:opacity-60`}
                                >
                                  Absent
                                </button>
                                <button
                                  onClick={() => toggleAttendance(member.id, selectedSunday, null)}
                                  disabled={isSavingAttendance || member.is_archived}
                                  className={`py-1.5 rounded-lg text-xs font-medium transition border ${
                                    value === undefined
                                      ? 'bg-gray-600 border-gray-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                                  } disabled:cursor-wait disabled:opacity-60`}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== MONTHLY RECORDS TAB ===== */}
      {tab === 'records' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <button
                onClick={() => setTrackerMonth((m) => (m === 0 ? 11 : m - 1))}
                className="p-0.5 text-gray-500 hover:text-orange-600 transition"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-black min-w-30 text-center text-sm">
                {new Date(trackerYear, trackerMonth).toLocaleString('en', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setTrackerMonth((m) => (m === 11 ? 0 : m + 1))}
                className="p-0.5 text-gray-500 hover:text-orange-600 transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <select
              value={trackerBacenta}
              onChange={(e) => setTrackerBacenta(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Flock Bacentas</option>
              {allBacentas.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <span className="text-xs text-gray-400">
              {sundays.length} Sundays this month
            </span>
          </div>

          {loadingAtt ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Cumulative summary cards */}
              {(() => {
                const recorded = sundayRecords.filter((r) => r.total > 0);
                const recordedSundays = recorded.length;
                const totalPresent = recorded.reduce((s, r) => s + r.present, 0);
                const totalAbsent = recorded.reduce((s, r) => s + r.absent, 0);
                const totalMarked = totalPresent + totalAbsent;
                const avgPresent = recordedSundays > 0 ? Math.round(totalPresent / recordedSundays) : 0;
                const avgAbsent = recordedSundays > 0 ? Math.round(totalAbsent / recordedSundays) : 0;
                const avgRate = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Sundays Recorded</p>
                      <p className="text-2xl font-bold text-black">
                        {recordedSundays}<span className="text-sm text-gray-400 font-normal"> / {sundayRecords.length}</span>
                      </p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Avg Present / Sunday</p>
                      <p className="text-2xl font-bold text-green-600">{avgPresent}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Avg Absent / Sunday</p>
                      <p className="text-2xl font-bold text-red-500">{avgAbsent}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Avg Attendance Rate</p>
                      <p className={`text-2xl font-bold ${avgRate >= 70 ? 'text-green-600' : avgRate >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {avgRate}%
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Sunday-by-Sunday records table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-black">
                    Sunday-by-Sunday Record — {new Date(trackerYear, trackerMonth).toLocaleString('en', { month: 'long', year: 'numeric' })}
                    {trackerBacenta !== 'all' && <span className="text-gray-400 font-normal"> · {trackerBacenta}</span>}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Attendance saved for each Sunday in the month, with the change from the previous recorded Sunday.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Sunday</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Present</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Absent</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Total Marked</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Rate</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-600 uppercase">Change vs Prev Sunday</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(() => {
                        let prevPresent: number | null = null;
                        return sundayRecords.map((record) => {
                          const isRecorded = record.total > 0;
                          const change = isRecorded && prevPresent !== null ? record.present - prevPresent : null;
                          if (isRecorded) prevPresent = record.present;
                          return (
                            <tr key={record.dayKey} className="hover:bg-orange-50/30 transition">
                              <td className="px-5 py-3 text-sm font-medium text-black">{record.label}</td>
                              <td className="px-5 py-3 text-sm text-green-700 text-right font-semibold">{isRecorded ? record.present : '—'}</td>
                              <td className="px-5 py-3 text-sm text-red-600 text-right font-semibold">{isRecorded ? record.absent : '—'}</td>
                              <td className="px-5 py-3 text-sm text-gray-600 text-right">{isRecorded ? record.total : '—'}</td>
                              <td className="px-5 py-3 text-right">
                                <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${
                                  record.total === 0 ? 'bg-gray-100 text-gray-500' :
                                  record.attendanceRate >= 70 ? 'bg-green-100 text-green-700' :
                                  record.attendanceRate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {record.total === 0 ? '—' : `${record.attendanceRate}%`}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                {change === null ? (
                                  <span className="text-sm text-gray-400">—</span>
                                ) : (
                                  <span className={`text-sm font-bold ${
                                    change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
                                  }`}>
                                    {change > 0 ? `+${change}` : `${change}`}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add Member / Sheep Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-black">Add Sheep to Flock</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {addError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                <AlertCircle size={16} />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+234..."
                  value={addForm.phone_number}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Residential address"
                  value={addForm.address}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Bacenta *</label>
                <BacentaSelect
                  bacentas={flockBacentas.length > 0 ? flockBacentas : bacentas}
                  value={addForm.bacenta}
                  onChange={(val) => setAddForm((prev) => ({ ...prev, bacenta: val }))}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Who Brought Them</label>
                <input
                  type="text"
                  placeholder="Inviter's name"
                  value={addForm.who_brought}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, who_brought: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_first_timer_cb"
                  checked={addForm.is_first_timer}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, is_first_timer: e.target.checked }))}
                  className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400"
                />
                <label htmlFor="is_first_timer_cb" className="text-xs text-gray-700">
                  Register as First Timer (tracked towards membership)
                </label>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Member Photo</label>
                <div className="flex items-center gap-3">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-12 h-12 rounded-full object-cover ring-2 ring-orange-400" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <Camera size={18} />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={photoInputRef}
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const downscaled = await downscalePhoto(file);
                      setPhotoFile(downscaled);
                      setPhotoPreview(URL.createObjectURL(downscaled));
                    }}
                    className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="px-4 py-2 text-xs font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {adding ? 'Saving...' : 'Add to Flock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
