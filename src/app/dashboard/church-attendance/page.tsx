'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Bacenta, FirstTimer, NewBeliever } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
  Users, Plus, X, Search, BarChart3, Grid3X3, CalendarDays,
  ChevronLeft, ChevronRight, ChevronDown, UserCheck, UserX, FolderTree, AlertCircle, Camera,
} from 'lucide-react';
import { downscalePhoto } from '@/lib/photos';
import React from 'react';
import BacentaSelect from '@/components/BacentaSelect';
import BranchQRCode from '@/components/BranchQRCode';
import { getCached, setCached } from '@/lib/query-cache';
import type { SupabaseClient } from '@supabase/supabase-js';

type ExistingMemberRow = { first_timer_id: string | null; full_name: string; phone_number: string };

async function checkAndPromoteIndividuals(supabase: SupabaseClient, branchId: string) {
  const [ftRes, nbRes] = await Promise.all([
    supabase.from('first_timers').select('*').eq('branch_id', branchId).eq('status', 'first_timer'),
    supabase.from('new_believers').select('*').eq('branch_id', branchId)
  ]);

  const firstTimers: FirstTimer[] = ftRes.data || [];
  const newBelievers: NewBeliever[] = nbRes.data || [];

  if (firstTimers.length === 0 && newBelievers.length === 0) return;

  const { data: currentMembers } = await supabase.from('members').select('full_name, phone_number, first_timer_id').eq('branch_id', branchId);
  const memberRows: ExistingMemberRow[] = currentMembers || [];
  const existingFtIds = new Set(memberRows.map((m) => m.first_timer_id).filter(Boolean));
  const existingNames = new Set(memberRows.map((m) => m.full_name.toLowerCase().trim()));
  const existingPhones = new Set(memberRows.map((m) => m.phone_number.trim()).filter(Boolean));

  if (firstTimers.length > 0) {
    const ftIds = firstTimers.map(f => f.id);
    const { data: ftAtt } = await supabase
      .from('attendance')
      .select('person_id')
      .in('person_id', ftIds)
      .eq('is_present', true);

    const ftCounts: Record<string, number> = {};
    (ftAtt || []).forEach((a: { person_id: string }) => {
      ftCounts[a.person_id] = (ftCounts[a.person_id] || 0) + 1;
    });

    for (const ft of firstTimers) {
      const count = ftCounts[ft.id] || 0;
      if (count >= 2 && !existingFtIds.has(ft.id) && !existingNames.has(ft.full_name.toLowerCase().trim())) {
        await supabase.from('members').insert({
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
          status: 'active'
        });
        await supabase.from('first_timers').update({ status: 'member', promoted_at: new Date().toISOString() }).eq('id', ft.id);
      }
    }
  }

  if (newBelievers.length > 0) {
    const nbIds = newBelievers.map(n => n.id);
    const { data: nbAtt } = await supabase
      .from('attendance')
      .select('person_id')
      .in('person_id', nbIds)
      .eq('is_present', true);

    const nbCounts: Record<string, number> = {};
    (nbAtt || []).forEach((a: { person_id: string }) => {
      nbCounts[a.person_id] = (nbCounts[a.person_id] || 0) + 1;
    });

    for (const nb of newBelievers) {
      const count = nbCounts[nb.id] || 0;
      const isAlreadyMember = existingNames.has(nb.full_name.toLowerCase().trim()) || (nb.phone_number && existingPhones.has(nb.phone_number.trim()));
      if (count >= 2 && !isAlreadyMember) {
        await supabase.from('members').insert({
          full_name: nb.full_name,
          address: nb.address,
          bacenta: nb.bacenta,
          phone_number: nb.phone_number,
          who_brought: nb.who_brought,
          date_joined: nb.date_saved,
          membership_date: new Date().toISOString().split('T')[0],
          assigned_shepherd: nb.recorded_by,
          branch_id: nb.branch_id,
          status: 'active'
        });
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

// Minimal shape this page needs, shared by members, first timers and new believers
interface TrackedPerson {
  id: string;
  full_name: string;
  phone_number: string;
  bacenta: string;
  status: string;
  person_type: PersonType;
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

// Snapshot cached for instant rendering on revisits (see lib/query-cache).
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

export default function ChurchAttendancePage() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [members, setMembers] = useState<TrackedPerson[]>([]);
  const [branchName, setBranchName] = useState('');
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [weeklyAttendance, setWeeklyAttendance] = useState<WeeklyAttendancePoint[]>([]);
  const [weeklyFirstTimers, setWeeklyFirstTimers] = useState<WeeklyFirstTimerPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Overview state
  const [search, setSearch] = useState('');
  const [filterBacenta, setFilterBacenta] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    full_name: '', phone_number: '', address: '', bacenta: '', who_brought: '', is_first_timer: false,
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Bacenta management state
  const [showBacentaModal, setShowBacentaModal] = useState(false);
  const [newBacenta, setNewBacenta] = useState({ name: '', leader_name: '', location: '' });
  const [addingBacenta, setAddingBacenta] = useState(false);

  // Tracker state
  const now = new Date();
  const [trackerYear, setTrackerYear] = useState(now.getFullYear());
  const [trackerMonth, setTrackerMonth] = useState(now.getMonth());
  const [trackerBacenta, setTrackerBacenta] = useState('all');
  const [trackerSearch, setTrackerSearch] = useState('');
  const [pickedSunday, setSelectedSunday] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmarked' | 'absent' | 'present'>('all');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<string, boolean>>>({});
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [showSundayRecords, setShowSundayRecords] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // Render the cached snapshot immediately (no spinner), then refresh in the
    // background so the data on screen is always brought up to date.
    const cached = getCached<PageSnapshot>(`church-attendance:${profile.branch_id}`);
    if (cached) {
      applySnapshot(cached);
      setLoading(false);
    }
    fetchData(!cached);
  }, [profile]);

  useEffect(() => {
    if ((tab === 'tracker' || tab === 'records') && members.length > 0) fetchTrackerAttendance();
  }, [tab, trackerYear, trackerMonth, members]);

  function applySnapshot(snap: PageSnapshot) {
    setMembers(snap.members);
    setBacentas(snap.bacentas);
    setWeeklyAttendance(snap.weeklyAttendance);
    setWeeklyFirstTimers(snap.weeklyFirstTimers);
    setBranchName(snap.branchName);
  }

  async function fetchData(showSpinner = true) {
    if (showSpinner) setLoading(true);
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
    const weeklyStartDate = eightWeeksAgo.toISOString().split('T')[0];

    const [mRes, bRes, attendanceRes, firstTimersRes, branchRes] = await Promise.all([
      supabase.from('members').select('id, full_name, phone_number, bacenta, status').eq('branch_id', profile!.branch_id).order('bacenta').order('full_name'),
      supabase.from('bacentas').select('*').eq('branch_id', profile!.branch_id).order('name'),
      supabase.from('attendance').select('date, is_present').eq('branch_id', profile!.branch_id).gte('date', weeklyStartDate),
      supabase.from('first_timers').select('date_joined').eq('branch_id', profile!.branch_id).gte('date_joined', weeklyStartDate),
      supabase.from('branches').select('name').eq('id', profile!.branch_id).maybeSingle(),
    ]);

    // Only regular members are tracked here — the members table is the single
    // source of truth so counts match the Regular Members page and dashboard.
    const mList: TrackedPerson[] = ((mRes.data || []) as Omit<TrackedPerson, 'person_type'>[]).map((x) => ({ ...x, person_type: 'member' as const }));

    const weekSeed: Record<string, WeeklyAttendancePoint> = {};
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7);
      const key = weekStart.toISOString().split('T')[0];
      weekSeed[key] = { week: getWeekLabel(key), present: 0, absent: 0, attendanceRate: 0 };
    }

    attendanceRes.data?.forEach((row: { date: string; is_present: boolean }) => {
      const weekKey = getWeekStartKey(row.date);
      if (!weekSeed[weekKey]) return;
      if (row.is_present) weekSeed[weekKey].present += 1;
      else weekSeed[weekKey].absent += 1;
    });

    const attendanceSeries = Object.values(weekSeed).map((entry) => {
      const total = entry.present + entry.absent;
      return {
        ...entry,
        attendanceRate: total > 0 ? Math.round((entry.present / total) * 100) : 0,
      };
    });

    const firstTimerSeed: Record<string, WeeklyFirstTimerPoint> = {};
    Object.keys(weekSeed).forEach((key) => {
      firstTimerSeed[key] = { week: getWeekLabel(key), count: 0 };
    });

    firstTimersRes.data?.forEach((row: { date_joined: string }) => {
      const weekKey = getWeekStartKey(row.date_joined);
      if (firstTimerSeed[weekKey]) firstTimerSeed[weekKey].count += 1;
    });

    const snapshot: PageSnapshot = {
      members: mList,
      bacentas: bRes.data || [],
      weeklyAttendance: attendanceSeries,
      weeklyFirstTimers: Object.values(firstTimerSeed),
      branchName: branchRes.data?.name || 'This Branch',
    };
    applySnapshot(snapshot);
    setCached(`church-attendance:${profile!.branch_id}`, snapshot);

    setLoading(false);
  }

  async function fetchTrackerAttendance() {
    setLoadingAtt(true);
    const startDate = `${trackerYear}-${String(trackerMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${trackerYear}-12-31`;
    // Filter on the indexed branch_id column instead of shipping every member
    // id in the request URL — much faster once the member list grows.
    const { data } = await supabase
      .from('attendance')
      .select('person_id, date, is_present')
      .eq('branch_id', profile!.branch_id)
      .gte('date', startDate)
      .lte('date', endDate);

    const map: Record<string, Record<string, boolean>> = {};
    data?.forEach((a: { person_id: string; date: string; is_present: boolean }) => {
      if (!map[a.person_id]) map[a.person_id] = {};
      map[a.person_id][a.date] = a.is_present;
    });
    setAttendanceMap(map);
    setLoadingAtt(false);
  }

  async function toggleAttendance(memberId: string, dateStr: string, next?: boolean | null) {
    const current = (attendanceMap[memberId] || {})[dateStr];
    const newVal = next === null
      ? undefined
      : typeof next === 'boolean'
      ? next
      : current === undefined
      ? true
      : current === true
      ? false
      : undefined;
    setAttendanceError('');
    setAttendanceMap(prev => {
      const updated = { ...prev, [memberId]: { ...(prev[memberId] || {}) } };
      if (newVal === undefined) delete updated[memberId][dateStr];
      else updated[memberId][dateStr] = newVal;
      return updated;
    });

    const targetMember = members.find(m => m.id === memberId);
    const personType = targetMember?.person_type || 'member';

    const { error } = newVal === undefined
      ? await supabase
          .from('attendance')
          .delete()
          .eq('person_id', memberId)
          .eq('person_type', personType)
          .eq('date', dateStr)
          .eq('branch_id', profile!.branch_id)
      : await supabase.from('attendance').upsert(
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

    if (!error && newVal === true) {
      await checkAndPromoteIndividuals(supabase, profile!.branch_id);
      fetchData();
    }

    if (error) {
      setAttendanceMap(prev => {
        const updated = { ...prev, [memberId]: { ...(prev[memberId] || {}) } };
        if (current === undefined) delete updated[memberId][dateStr];
        else updated[memberId][dateStr] = current;
        return updated;
      });
      setAttendanceError(`Attendance was not saved: ${error.message}`);
      return false;
    }
    return true;
  }

  async function bulkSetAttendance(value: boolean | null) {
    if (!selectedSunday || trackerMembers.length === 0) return;
    const membersToUpdate = value === false
      ? filteredTrackerMembers.filter(
          (member) => (attendanceMap[member.id] || {})[selectedSunday] === undefined
        )
      : filteredTrackerMembers;
    await Promise.all(
      membersToUpdate.map((m) => toggleAttendance(m.id, selectedSunday, value))
    );
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAddError('Please choose an image file for the photo.');
      return;
    }
    setAddError('');
    const resized = await downscalePhoto(file);
    setPhotoFile(resized);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(resized));
  }

  function removePhoto() {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = addForm.full_name.trim();
    if (!trimmedName || !addForm.phone_number) return;
    if (duplicateMember) return;
    setAdding(true);
    setAddError('');

    // Re-check against the database right before inserting, in case another
    // device registered the same name after this page was loaded.
    const { data: existingRows } = await supabase
      .from('members')
      .select('full_name')
      .eq('branch_id', profile!.branch_id);
    const nameKey = trimmedName.toLowerCase();
    if ((existingRows || []).some((r: { full_name: string }) => r.full_name.trim().toLowerCase() === nameKey)) {
      setAddError(`"${trimmedName}" is already registered as a member of this branch.`);
      setAdding(false);
      return;
    }

    // Upload the photo first (if any). A failed upload never blocks the
    // member from being added.
    let photoUrl: string | null = null;
    if (photoFile) {
      try {
        const fd = new FormData();
        fd.append('photo', photoFile);
        const res = await fetch('/api/upload-photo', { method: 'POST', body: fd });
        if (res.ok) photoUrl = (await res.json()).url || null;
      } catch {
        photoUrl = null;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    await supabase.from('members').insert({
      full_name: trimmedName,
      phone_number: addForm.phone_number,
      address: addForm.address || '',
      bacenta: addForm.bacenta || 'Unassigned',
      who_brought: addForm.who_brought || '',
      date_joined: today,
      membership_date: today,
      branch_id: profile!.branch_id,
      status: 'active',
      photo_url: photoUrl,
    });
    if (addForm.is_first_timer) {
      await supabase.from('first_timers').insert({
        full_name: trimmedName,
        phone_number: addForm.phone_number,
        address: addForm.address || '',
        bacenta: addForm.bacenta || 'Unassigned',
        who_brought: addForm.who_brought || '',
        date_joined: today,
        branch_id: profile!.branch_id,
        status: 'first_timer',
        photo_url: photoUrl,
      });
    }
    setAddForm({ full_name: '', phone_number: '', address: '', bacenta: '', who_brought: '', is_first_timer: false });
    removePhoto();
    setShowAddModal(false);
    setAdding(false);
    fetchData();
  }

  async function handleAddBacenta(e: React.FormEvent) {
    e.preventDefault();
    if (!newBacenta.name.trim()) return;
    setAddingBacenta(true);
    await supabase.from('bacentas').insert({
      name: newBacenta.name,
      leader_name: newBacenta.leader_name || null,
      location: newBacenta.location || null,
      branch_id: profile!.branch_id,
    });
    setNewBacenta({ name: '', leader_name: '', location: '' });
    setShowBacentaModal(false);
    setAddingBacenta(false);
    fetchData();
  }

  // Live duplicate check while typing in the Add Member modal.
  const duplicateMember = useMemo(() => {
    const name = addForm.full_name.trim().toLowerCase();
    if (!name) return null;
    return members.find((m) => m.full_name.trim().toLowerCase() === name) || null;
  }, [members, addForm.full_name]);

  const allBacentas = useMemo(() => {
    const s = new Set(members.map(m => m.bacenta).filter(Boolean));
    return Array.from(s).sort();
  }, [members]);

  const addMemberBacentas = useMemo(() => {
    const map = new Map<string, Bacenta>();
    bacentas.forEach((b) => map.set(b.name, b));
    allBacentas.forEach((name) => {
      if (!map.has(name)) {
        map.set(name, {
          id: `fallback-${name}`,
          name,
          leader_name: null,
          location: null,
          branch_id: profile!.branch_id,
          created_at: new Date().toISOString(),
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [bacentas, allBacentas, profile]);

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach(m => { counts[m.bacenta] = (counts[m.bacenta] || 0) + 1; });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [members]);

  const filteredMembers = useMemo(() => members.filter(m => {
    const q = search.toLowerCase();
    return (m.full_name.toLowerCase().includes(q) || m.bacenta.toLowerCase().includes(q)) &&
           (filterBacenta === 'all' || m.bacenta === filterBacenta);
  }), [members, search, filterBacenta]);

  const sundays = useMemo(() => getSundaysFromMonth(trackerYear, trackerMonth), [trackerYear, trackerMonth]);

  const trackerMembers = useMemo(() =>
    members.filter(m =>
      (trackerBacenta === 'all' || m.bacenta === trackerBacenta) &&
      m.full_name.toLowerCase().includes(trackerSearch.toLowerCase())
    ),
    [members, trackerBacenta, trackerSearch]);

  // Derive the active Sunday: the user's pick when it belongs to this month,
  // otherwise the first Sunday of the month (no state syncing needed).
  const selectedSunday = useMemo(() => {
    const availableSundays = sundays.map(toDateStr);
    if (availableSundays.length === 0) return '';
    return pickedSunday && availableSundays.includes(pickedSunday) ? pickedSunday : availableSundays[0];
  }, [pickedSunday, sundays]);

  const totalActive = members.filter(m => m.status === 'active').length;
  const totalFlagged = members.filter(m => m.status === 'flagged').length;

  const filteredTrackerMembers = useMemo(() => {
    if (!selectedSunday || statusFilter === 'all') return trackerMembers;
    return trackerMembers.filter((m) => {
      const value = (attendanceMap[m.id] || {})[selectedSunday];
      if (statusFilter === 'unmarked') return value === undefined;
      if (statusFilter === 'absent') return value === false;
      if (statusFilter === 'present') return value === true;
      return true;
    });
  }, [trackerMembers, attendanceMap, selectedSunday, statusFilter]);

  const groupedFilteredTrackerMembers = useMemo(() => {
    const map: Record<string, TrackedPerson[]> = {};
    filteredTrackerMembers.forEach((m) => {
      if (!map[m.bacenta]) map[m.bacenta] = [];
      map[m.bacenta].push(m);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTrackerMembers]);

  const selectedDayStats = useMemo(() => {
    if (!selectedSunday) return { present: 0, absent: 0, unmarked: trackerMembers.length };
    const present = trackerMembers.filter((m) => (attendanceMap[m.id] || {})[selectedSunday] === true).length;
    const absent = trackerMembers.filter((m) => (attendanceMap[m.id] || {})[selectedSunday] === false).length;
    const unmarked = trackerMembers.length - present - absent;
    return { present, absent, unmarked };
  }, [trackerMembers, attendanceMap, selectedSunday]);

  const sundayRecords = useMemo(() => {
    const scopedMembers = members.filter((m) => trackerBacenta === 'all' || m.bacenta === trackerBacenta);
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
  }, [sundays, members, trackerBacenta, attendanceMap]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Church Attendance</h1>
          <p className="text-gray-500 mt-1">Bacenta overview, membership & attendance tracker</p>
        </div>
        <button
          onClick={() => { setAddError(''); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition"
        >
          <Plus size={18} />
          Add Member
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['overview', BarChart3, 'Overview'], ['tracker', Grid3X3, 'Attendance Tracker'], ['records', CalendarDays, 'Monthly Records']] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              tab === key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
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
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Members', value: members.length, color: 'text-black' },
              { label: 'Bacentas', value: allBacentas.length, color: 'text-orange-500' },
              { label: 'Active', value: totalActive, color: 'text-green-600', icon: UserCheck },
              { label: 'Flagged', value: totalFlagged, color: 'text-red-500', icon: UserX },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-black mb-4 text-sm">Weekly Attendance Chart (Last 8 Weeks)</h3>
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
              <h3 className="font-semibold text-black mb-4 text-sm">Weekly First Timers Chart (Last 8 Weeks)</h3>
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

          {/* Bacentas Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-black text-sm flex items-center gap-2">
                <FolderTree size={18} className="text-orange-500" />
                Bacentas
              </h3>
              <button
                onClick={() => setShowBacentaModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
              >
                <Plus size={14} />
                Add Bacenta
              </button>
            </div>
            {bacentas.length === 0 ? (
              <p className="text-sm text-gray-400">No bacentas created yet</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bacentas.map(b => (
                  <div key={b.id} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                    <p className="font-medium text-sm text-black">{b.name}</p>
                    {b.leader_name && <p className="text-xs text-gray-600 mt-0.5">Leader: {b.leader_name}</p>}
                    {b.location && <p className="text-xs text-gray-500 mt-1">{b.location}</p>}
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-600">
                      <Users size={12} />
                      {members.filter(m => m.bacenta === b.name).length} members
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Branch Registration QR Code */}
          <BranchQRCode branchId={profile!.branch_id} branchName={branchName} />

          {/* Bar Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-black mb-4 text-sm">Members per Bacenta</h3>
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
                      formatter={(v) => [v, 'Members']}
                    />
                    <Bar dataKey="count" name="Members" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </div>

          {/* Filters + Table */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or bacenta..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black text-sm"
              />
            </div>
            <select
              value={filterBacenta}
              onChange={e => setFilterBacenta(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black text-sm"
            >
              <option value="all">All Bacentas</option>
              {allBacentas.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="font-semibold text-black text-sm">
                {filterBacenta !== 'all' ? filterBacenta : 'All Members'}
              </span>
              <span className="text-gray-400 font-normal text-sm ml-1">({filteredMembers.length})</span>
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
                  {filteredMembers.map(m => (
                    <tr key={m.id} className="hover:bg-orange-50/30 transition">
                      <td className="px-5 py-3 text-sm text-black font-medium">{m.full_name}</td>
                      <td className="px-5 py-3">
                        <span className="inline-block px-2.5 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-full font-medium">{m.bacenta}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 hidden sm:table-cell">{m.phone_number}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2.5 py-0.5 text-xs rounded-full font-medium capitalize ${
                          m.status === 'active' ? 'bg-green-100 text-green-700' :
                          m.status === 'flagged' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                        }`}>{m.status}</span>
                      </td>
                    </tr>
                  ))}
                  {filteredMembers.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No members found</td></tr>
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
                onClick={() => setTrackerMonth(m => m === 0 ? 11 : m - 1)}
                className="p-0.5 text-gray-500 hover:text-orange-600 transition"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-black min-w-30 text-center text-sm">
                {new Date(trackerYear, trackerMonth).toLocaleString('en', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setTrackerMonth(m => m === 11 ? 0 : m + 1)}
                className="p-0.5 text-gray-500 hover:text-orange-600 transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <select
              value={trackerBacenta}
              onChange={e => setTrackerBacenta(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Bacentas</option>
              {allBacentas.map(b => <option key={b} value={b}>{b}</option>)}
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
              {sundays.length} Sundays &middot; {trackerMembers.length} members
            </span>
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
                          Total in church: <span className="font-semibold text-gray-700">{record.total}</span>
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

          {loadingAtt ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {!selectedSunday ? (
                <div className="text-center py-12 text-gray-400">Select a Sunday to start marking attendance.</div>
              ) : filteredTrackerMembers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No members found for this filter.</div>
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
                          return (
                            <div key={member.id} className="px-3 py-2">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div>
                                  <p className="text-sm font-medium text-black leading-tight">{member.full_name}</p>
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
                                  className={`py-1.5 rounded-lg text-xs font-medium transition border ${
                                    value === true
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-green-300'
                                  }`}
                                >
                                  Present
                                </button>
                                <button
                                  onClick={() => toggleAttendance(member.id, selectedSunday, false)}
                                  className={`py-1.5 rounded-lg text-xs font-medium transition border ${
                                    value === false
                                      ? 'bg-red-500 border-red-500 text-white'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                                  }`}
                                >
                                  Absent
                                </button>
                                <button
                                  onClick={() => toggleAttendance(member.id, selectedSunday, null)}
                                  className={`py-1.5 rounded-lg text-xs font-medium transition border ${
                                    value === undefined
                                      ? 'bg-gray-600 border-gray-600 text-white'
                                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                                  }`}
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
                onClick={() => setTrackerMonth(m => m === 0 ? 11 : m - 1)}
                className="p-0.5 text-gray-500 hover:text-orange-600 transition"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-black min-w-30 text-center text-sm">
                {new Date(trackerYear, trackerMonth).toLocaleString('en', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setTrackerMonth(m => m === 11 ? 0 : m + 1)}
                className="p-0.5 text-gray-500 hover:text-orange-600 transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <select
              value={trackerBacenta}
              onChange={e => setTrackerBacenta(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Bacentas</option>
              {allBacentas.map(b => <option key={b} value={b}>{b}</option>)}
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
                // Averages are per recorded Sunday: the same members attend each
                // week, so summing them across Sundays would double-count people.
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
                      <p className="text-[10px] text-gray-500 uppercase">Sundays Recorded</p>
                      <p className="text-2xl font-bold text-black">{recordedSundays}<span className="text-sm text-gray-400 font-normal"> / {sundayRecords.length}</span></p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Avg Present / Sunday</p>
                      <p className="text-2xl font-bold text-green-600">{avgPresent}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Avg Absent / Sunday</p>
                      <p className="text-2xl font-bold text-red-500">{avgAbsent}</p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <p className="text-[10px] text-gray-500 uppercase">Avg Attendance Rate</p>
                      <p className={`text-2xl font-bold ${avgRate >= 70 ? 'text-green-600' : avgRate >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{avgRate}%</p>
                    </div>
                  </div>
                );
              })()}

              {/* Per-Sunday cumulative table */}
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
                        // Week-over-week movement in headcount — the same people
                        // attend each Sunday, so a running sum would double-count.
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
                                    change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-gray-500'
                                  }`}>
                                    {change > 0 ? `▲ +${change}` : change < 0 ? `▼ ${change}` : '±0'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                      {sundayRecords.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No Sundays in this month</td></tr>
                      )}
                    </tbody>
                    {sundayRecords.length > 0 && (() => {
                      const recorded = sundayRecords.filter((r) => r.total > 0);
                      const n = recorded.length;
                      const avg = (fn: (r: typeof recorded[number]) => number) =>
                        n > 0 ? Math.round(recorded.reduce((s, r) => s + fn(r), 0) / n) : 0;
                      const totalPresent = recorded.reduce((s, r) => s + r.present, 0);
                      const totalMarked = recorded.reduce((s, r) => s + r.total, 0);
                      const monthRate = totalMarked > 0 ? Math.round((totalPresent / totalMarked) * 100) : 0;
                      return (
                        <tfoot>
                          <tr className="bg-gray-50 border-t border-gray-200">
                            <td className="px-5 py-3 text-sm font-bold text-black">Average per Sunday</td>
                            <td className="px-5 py-3 text-sm text-green-700 text-right font-bold">{avg((r) => r.present)}</td>
                            <td className="px-5 py-3 text-sm text-red-600 text-right font-bold">{avg((r) => r.absent)}</td>
                            <td className="px-5 py-3 text-sm text-gray-700 text-right font-bold">{avg((r) => r.total)}</td>
                            <td className="px-5 py-3 text-right">
                              <span className="inline-block px-2 py-0.5 text-xs rounded-full font-bold bg-orange-100 text-orange-700">
                                {n === 0 ? '—' : `${monthRate}%`}
                              </span>
                            </td>
                            <td className="px-5 py-3" />
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-black">Add Member</h2>
              <button onClick={() => { removePhoto(); setShowAddModal(false); }} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  value={addForm.full_name}
                  onChange={e => { setAddError(''); setAddForm(p => ({ ...p, full_name: e.target.value })); }}
                  className={`w-full px-4 py-2.5 border rounded-lg text-black text-sm focus:ring-2 outline-none ${
                    duplicateMember
                      ? 'border-red-300 bg-red-50/50 focus:ring-red-400'
                      : 'border-gray-200 focus:ring-orange-500'
                  }`}
                  placeholder="e.g. John Akpan"
                />
                {duplicateMember && (
                  <p className="flex items-start gap-1.5 mt-1.5 text-xs text-red-600">
                    <AlertCircle size={14} className="mt-px shrink-0" />
                    <span>
                      <span className="font-semibold">{duplicateMember.full_name}</span> already exists
                      in <span className="font-semibold">{duplicateMember.bacenta}</span>. Duplicate names are not allowed.
                    </span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  required
                  type="tel"
                  value={addForm.phone_number}
                  onChange={e => setAddForm(p => ({ ...p, phone_number: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="+234..."
                />
              </div>
              <BacentaSelect
                label="Assign to Bacenta *"
                required
                value={addForm.bacenta}
                onChange={(value) => setAddForm((p) => ({ ...p, bacenta: value }))}
                bacentas={addMemberBacentas}
                includeLeader
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                placeholder="Select a bacenta..."
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={addForm.address}
                  onChange={e => setAddForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Home address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Who Brought Them</label>
                <input
                  type="text"
                  value={addForm.who_brought}
                  onChange={e => setAddForm(p => ({ ...p, who_brought: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Name of person"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {photoPreview ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Member photo"
                      className="w-16 h-16 rounded-full object-cover border-2 border-orange-200"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                      >
                        <X size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-orange-300 hover:text-orange-600 transition"
                  >
                    <Camera size={18} />
                    Take or upload a photo
                  </button>
                )}
              </div>
              <label className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.is_first_timer}
                  onChange={e => setAddForm(p => ({ ...p, is_first_timer: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-orange-500 rounded cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">This is a First Timer</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Will also appear on the First Timers page</span>
                </div>
              </label>
              {addError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {addError}
                </div>
              )}
              <button
                type="submit"
                disabled={adding || !!duplicateMember}
                className="w-full py-3 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : duplicateMember ? 'Name Already Exists' : 'Add Member'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Bacenta Modal */}
      {showBacentaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-black">Add Bacenta</h2>
              <button onClick={() => setShowBacentaModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddBacenta} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bacenta Name *</label>
                <input
                  required
                  type="text"
                  value={newBacenta.name}
                  onChange={e => setNewBacenta(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="e.g. Zina Iyk-Ezeala Bacenta"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leader Name</label>
                <input
                  type="text"
                  value={newBacenta.leader_name}
                  onChange={e => setNewBacenta(p => ({ ...p, leader_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="e.g. Zina Iyk-Ezeala"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newBacenta.location}
                  onChange={e => setNewBacenta(p => ({ ...p, location: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="e.g. Zone A, Lagos"
                />
              </div>
              <button
                type="submit"
                disabled={addingBacenta}
                className="w-full py-3 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50"
              >
                {addingBacenta ? 'Adding...' : 'Add Bacenta'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

