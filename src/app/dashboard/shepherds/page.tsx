'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { DEMO_MEMBERS, DEMO_USERS, DEMO_FIRST_TIMERS } from '@/lib/demo-data';
import { Users, TrendingUp, TrendingDown, Eye, Phone, MapPin, Calendar, ChevronDown, ChevronUp, Award, AlertTriangle, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface ShepherdProfile {
  id: string;
  name: string;
  email?: string;
  bacentaNames: string[];
  phone?: string;
  role: string;
  totalSheep: number;
  activeSheep: number;
  flaggedSheep: number;
  inactiveSheep: number;
  firstTimers: number;
  avgAttendance: number;
  weeklyRates: number[];
  members: ShepherdMember[];
}

interface ShepherdMember {
  id: string;
  full_name: string;
  photo_url: string | null;
  status: string;
  bacenta: string;
  phone_number: string;
  date_joined: string;
  attendanceRate: number;
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().split('T')[0];
}

export default function ShepherdsPage() {
  const { profile, isDemo } = useAuth();
  const searchParams = useSearchParams();
  const selectedShepherdFromQuery = searchParams.get('shepherdId');
  const supabase = createClient();
  const [shepherds, setShepherds] = useState<ShepherdProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingShepherd, setDeletingShepherd] = useState<ShepherdProfile | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canManageShepherds = profile?.role === 'super_admin' || profile?.role === 'bishop';

  useEffect(() => {
    if (profile) {
      if (isDemo) loadDemoData();
      else fetchShepherdData();
    }
  }, [profile, isDemo]);

  useEffect(() => {
    if (!selectedShepherdFromQuery || shepherds.length === 0) return;
    const exists = shepherds.some((s) => s.id === selectedShepherdFromQuery);
    if (exists) setExpandedId(selectedShepherdFromQuery);
  }, [selectedShepherdFromQuery, shepherds]);

  useEffect(() => {
    if (!profile || isDemo) return;

    const refresh = () => fetchShepherdData();
    const filter = `branch_id=eq.${profile.branch_id}`;
    const channel = supabase.channel(`shepherds-live-${profile.branch_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'first_timers', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shepherd_bacentas', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bacentas', filter }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isDemo]);

  function loadDemoData() {
    const shepherdIds = Object.entries(DEMO_USERS)
      .filter(([, u]) => u.role === 'shepherd')
      .map(([id, u]) => ({ id, name: u.name, bacentaNames: u.bacenta_id === 'bac-1' ? ['Bacenta Alpha'] : u.bacenta_id === 'bac-2' ? ['Bacenta Beta'] : [] }));

    const result: ShepherdProfile[] = shepherdIds.map(({ id, name, bacentaNames }) => {
      const sheep = DEMO_MEMBERS.filter(m => m.assigned_shepherd === id);
      const firstTimers = DEMO_FIRST_TIMERS.filter(ft => ft.assigned_shepherd === id);
      const active = sheep.filter(m => m.status === 'active').length;
      const flagged = sheep.filter(m => m.status === 'flagged').length;
      const inactive = sheep.filter(m => m.status === 'inactive').length;

      // Generate mock attendance rates
      const weeklyRates: number[] = [];
      for (let i = 0; i < 6; i++) {
        const baseRate = active / (sheep.length || 1) * 100;
        weeklyRates.push(Math.min(100, Math.max(10, Math.round(baseRate + (Math.random() - 0.5) * 20))));
      }
      const avgAttendance = Math.round(weeklyRates.reduce((a, b) => a + b, 0) / weeklyRates.length);

      const members: ShepherdMember[] = sheep.map(m => {
        const rate = m.status === 'active' ? Math.floor(Math.random() * 30) + 70 :
                     m.status === 'flagged' ? Math.floor(Math.random() * 25) + 20 :
                     Math.floor(Math.random() * 15) + 5;
        return {
          id: m.id,
          full_name: m.full_name,
          photo_url: m.photo_url,
          status: m.status,
          bacenta: m.bacenta,
          phone_number: m.phone_number,
          date_joined: m.date_joined,
          attendanceRate: rate,
        };
      });

      return {
        id,
        name,
        email: `${name.split(' ')[1]?.toLowerCase()}@epc.church`,
        bacentaNames,
        role: 'shepherd',
        totalSheep: sheep.length,
        activeSheep: active,
        flaggedSheep: flagged,
        inactiveSheep: inactive,
        firstTimers: firstTimers.length,
        avgAttendance,
        weeklyRates,
        members: members.sort((a, b) => a.attendanceRate - b.attendanceRate),
      };
    });

    setShepherds(result.sort((a, b) => b.avgAttendance - a.avgAttendance));
    setLoading(false);
  }

  async function fetchShepherdData() {
    // Get all shepherds in branch
    const { data: shepherdProfiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .eq('role', 'shepherd');

    if (!shepherdProfiles) {
      setLoading(false);
      return;
    }

    // Get all members
    const { data: allMembers } = await supabase
      .from('members')
      .select('*')
      .eq('branch_id', profile!.branch_id);

    // Get all first timers
    const { data: allFirstTimers } = await supabase
      .from('first_timers')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .eq('status', 'first_timer');

    // Get attendance data (last 6 weeks)
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const memberIds = (allMembers || []).map((m: { id: string }) => m.id);

    const { data: attendanceData } = memberIds.length > 0 ? await supabase
      .from('attendance')
      .select('person_id, is_present, date')
      .in('person_id', memberIds)
      .gte('date', sixWeeksAgo.toISOString().split('T')[0]) : { data: [] };

    // Build attendance map
    const attendanceMap: Record<string, { present: number; total: number }> = {};
    const weeklyAttendanceMap: Record<string, Map<string, boolean>> = {};
    const weekKeysSet = new Set<string>();
    memberIds.forEach((id: string) => { attendanceMap[id] = { present: 0, total: 0 }; });
    memberIds.forEach((id: string) => { weeklyAttendanceMap[id] = new Map(); });
    attendanceData?.forEach((a: { person_id: string; is_present: boolean; date: string }) => {
      if (attendanceMap[a.person_id]) {
        attendanceMap[a.person_id].total++;
        if (a.is_present) attendanceMap[a.person_id].present++;
      }

      const weekKey = getWeekKey(a.date);
      weekKeysSet.add(weekKey);
      if (weeklyAttendanceMap[a.person_id]) {
        const existing = weeklyAttendanceMap[a.person_id].get(weekKey);
        if (a.is_present || existing === undefined) {
          weeklyAttendanceMap[a.person_id].set(weekKey, a.is_present);
        }
      }
    });

    const weekKeys = Array.from(weekKeysSet).sort().slice(-6);
    const shepherdIds = shepherdProfiles.map((sp: { id: string }) => sp.id);
    const { data: shepherdBacentas, error: shepherdBacentasError } = shepherdIds.length > 0 ? await supabase
      .from('shepherd_bacentas')
      .select('shepherd_id, bacenta:bacentas(name)')
      .eq('branch_id', profile!.branch_id)
      .in('shepherd_id', shepherdIds) : { data: [] };

    const bacentaMap: Record<string, string[]> = {};
    if (shepherdBacentasError) {
      const { data: legacyProfiles } = await supabase
        .from('profiles')
        .select('id, bacenta:bacentas(name)')
        .eq('branch_id', profile!.branch_id)
        .eq('role', 'shepherd');
      (legacyProfiles || []).forEach((row: { id: string; bacenta: { name: string } | null }) => {
        if (row.bacenta?.name) bacentaMap[row.id] = [row.bacenta.name];
      });
    } else {
      (shepherdBacentas || []).forEach((row: { shepherd_id: string; bacenta: { name: string } | null }) => {
        if (!bacentaMap[row.shepherd_id]) bacentaMap[row.shepherd_id] = [];
        if (row.bacenta?.name) bacentaMap[row.shepherd_id].push(row.bacenta.name);
      });
    }

    const result: ShepherdProfile[] = shepherdProfiles.map((sp: { id: string; full_name: string; email: string }) => {
      // A member belongs to this shepherd if they sit in one of the shepherd's
      // assigned bacentas, or were explicitly assigned to them directly.
      const shepherdBacentaNames = bacentaMap[sp.id] || [];
      const sheep = (allMembers || []).filter((m: { assigned_shepherd: string | null; bacenta: string }) =>
        m.assigned_shepherd === sp.id || shepherdBacentaNames.includes(m.bacenta)
      );
      const firstTimers = (allFirstTimers || []).filter((ft: { assigned_shepherd: string | null; bacenta: string }) =>
        ft.assigned_shepherd === sp.id || shepherdBacentaNames.includes(ft.bacenta)
      );
      const members: ShepherdMember[] = sheep.map((m: { id: string; full_name: string; photo_url: string | null; status: string; bacenta: string; phone_number: string; date_joined: string }) => {
        const record = attendanceMap[m.id] || { present: 0, total: 0 };
        const rate = record.total > 0 ? Math.round((record.present / record.total) * 100) : 0;
        return {
          id: m.id,
          full_name: m.full_name,
          photo_url: m.photo_url,
          status: m.status,
          bacenta: m.bacenta,
          phone_number: m.phone_number,
          date_joined: m.date_joined,
          attendanceRate: rate,
        };
      });

      const avgAttendance = members.length > 0
        ? Math.round(members.reduce((s, m) => s + m.attendanceRate, 0) / members.length)
        : 0;

      const faithful = members.filter((m: ShepherdMember) => m.attendanceRate >= 70).length;
      const atRisk = members.filter((m: ShepherdMember) => m.attendanceRate >= 30 && m.attendanceRate < 70).length;
      const lost = members.filter((m: ShepherdMember) => m.attendanceRate < 30).length;

      const weeklyRates = weekKeys.map((weekKey) => {
        let present = 0;
        let total = 0;
        sheep.forEach((m: { id: string }) => {
          const value = weeklyAttendanceMap[m.id]?.get(weekKey);
          if (value !== undefined) {
            total++;
            if (value) present++;
          }
        });
        return total > 0 ? Math.round((present / total) * 100) : 0;
      });

      return {
        id: sp.id,
        name: sp.full_name,
        email: sp.email,
        bacentaNames: bacentaMap[sp.id] || [],
        role: 'shepherd',
        totalSheep: sheep.length,
        activeSheep: faithful,
        flaggedSheep: atRisk,
        inactiveSheep: lost,
        firstTimers: firstTimers.length,
        avgAttendance,
        weeklyRates,
        members: members.sort((a: ShepherdMember, b: ShepherdMember) => a.attendanceRate - b.attendanceRate),
      };
    });

    setShepherds(result.sort((a, b) => b.avgAttendance - a.avgAttendance));
    setLoading(false);
  }

  async function handleDeleteShepherd() {
    if (!deletingShepherd) return;
    setDeleteBusy(true);
    setDeleteError(null);

    if (isDemo) {
      setShepherds((prev) => prev.filter((s) => s.id !== deletingShepherd.id));
      setDeletingShepherd(null);
      setReassignTo('');
      setDeleteBusy(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/delete-shepherd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shepherd_id: deletingShepherd.id,
          reassign_to: reassignTo || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setDeleteError(result.error || 'Failed to delete shepherd');
        setDeleteBusy(false);
        return;
      }
      setDeletingShepherd(null);
      setReassignTo('');
      setDeleteBusy(false);
      fetchShepherdData();
    } catch {
      setDeleteError('Network error — please try again');
      setDeleteBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalSheep = shepherds.reduce((s, sh) => s + sh.totalSheep, 0);
  const totalActive = shepherds.reduce((s, sh) => s + sh.activeSheep, 0);
  const totalFlagged = shepherds.reduce((s, sh) => s + sh.flaggedSheep, 0);
  const totalInactive = shepherds.reduce((s, sh) => s + sh.inactiveSheep, 0);
  const overallAttendance = totalSheep > 0
    ? Math.round(shepherds.reduce((s, sh) => s + sh.avgAttendance * sh.totalSheep, 0) / totalSheep)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black flex items-center gap-2">
          <Users className="text-orange-500" size={26} />
          Shepherd Performance
        </h1>
        <p className="text-gray-500 mt-1">Detailed view of each shepherd&apos;s flock management</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Shepherds</p>
          <p className="text-2xl font-bold text-black">{shepherds.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Total Sheep</p>
          <p className="text-2xl font-bold text-black">{totalSheep}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Active</p>
          <p className="text-2xl font-bold text-green-600">{totalActive}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-[10px] text-gray-500 uppercase">At Risk</p>
          <p className="text-2xl font-bold text-amber-500">{totalFlagged}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-[10px] text-gray-500 uppercase">Avg Attendance</p>
          <p className={`text-2xl font-bold ${overallAttendance >= 70 ? 'text-green-600' : overallAttendance >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{overallAttendance}%</p>
        </div>
      </div>

      {/* Shepherd Cards */}
      <div className="space-y-4">
        {shepherds.map((shepherd, idx) => {
          const isExpanded = expandedId === shepherd.id;
          const trend = shepherd.weeklyRates.length >= 2
            ? shepherd.weeklyRates[shepherd.weeklyRates.length - 1] - shepherd.weeklyRates[0]
            : 0;

          return (
            <div key={shepherd.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Shepherd Header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : shepherd.id)}
                className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Rank badge */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    idx === 0 ? 'bg-linear-to-br from-yellow-400 to-amber-500' :
                    idx === 1 ? 'bg-linear-to-br from-gray-300 to-gray-500' :
                    'bg-linear-to-br from-orange-400 to-orange-600'
                  }`}>
                    {idx === 0 ? <Award size={22} /> : `#${idx + 1}`}
                  </div>
                  <div>
                    <p className="font-semibold text-black text-base sm:text-lg">{shepherd.name}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{shepherd.totalSheep} sheep</span>
                      <span>·</span>
                      <span>{shepherd.firstTimers} first timers</span>
                      <span>·</span>
                      <span className="text-orange-600">
                        {shepherd.bacentaNames.length > 0 ? shepherd.bacentaNames.join(', ') : 'No bacenta assigned'}
                      </span>
                      {shepherd.email && (
                        <>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden sm:inline">{shepherd.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6">
                  {/* Stats summary */}
                  <div className="hidden sm:flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase">Active</p>
                      <p className="text-sm font-bold text-green-600">{shepherd.activeSheep}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase">Flagged</p>
                      <p className="text-sm font-bold text-amber-500">{shepherd.flaggedSheep}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase">Inactive</p>
                      <p className="text-sm font-bold text-red-500">{shepherd.inactiveSheep}</p>
                    </div>
                  </div>

                  {/* Attendance score */}
                  <div className="text-right">
                    <p className={`text-xl sm:text-2xl font-bold ${
                      shepherd.avgAttendance >= 70 ? 'text-green-600' :
                      shepherd.avgAttendance >= 40 ? 'text-amber-500' : 'text-red-500'
                    }`}>
                      {shepherd.avgAttendance}%
                    </p>
                    {trend !== 0 && (
                      <div className={`flex items-center justify-end gap-0.5 text-[10px] ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {Math.abs(trend)}% trend
                      </div>
                    )}
                  </div>

                  {canManageShepherds && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingShepherd(shepherd);
                        setReassignTo('');
                        setDeleteError(null);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete shepherd"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {/* Performance Overview */}
                  <div className="p-4 sm:p-6 bg-gray-50">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <div className="bg-white rounded-lg p-3 border border-gray-100">
                        <p className="text-[10px] text-gray-500 uppercase">Total Members</p>
                        <p className="text-lg font-bold text-black">{shepherd.totalSheep}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-green-100">
                        <p className="text-[10px] text-gray-500 uppercase">Faithful (70%+)</p>
                        <p className="text-lg font-bold text-green-600">{shepherd.activeSheep}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-amber-100">
                        <p className="text-[10px] text-gray-500 uppercase">At Risk (30-69%)</p>
                        <p className="text-lg font-bold text-amber-500">{shepherd.flaggedSheep}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-red-100">
                        <p className="text-[10px] text-gray-500 uppercase">Lost (&lt;30%)</p>
                        <p className="text-lg font-bold text-red-500">{shepherd.inactiveSheep}</p>
                      </div>
                    </div>

                    {/* Weekly trend bars */}
                    {shepherd.weeklyRates.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-medium text-gray-600 mb-2">Weekly Attendance Trend</p>
                        <div className="flex items-end gap-1 h-16">
                          {shepherd.weeklyRates.map((rate, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center">
                              <span className="text-[8px] text-gray-400 mb-0.5">{rate}%</span>
                              <div className="w-full bg-gray-200 rounded-t relative" style={{ height: '48px' }}>
                                <div
                                  className={`absolute bottom-0 left-0 right-0 rounded-t transition-all ${
                                    rate >= 70 ? 'bg-green-400' : rate >= 40 ? 'bg-amber-400' : 'bg-red-400'
                                  }`}
                                  style={{ height: `${(rate / 100) * 48}px` }}
                                ></div>
                              </div>
                              <span className="text-[8px] text-gray-400 mt-0.5">W{i + 1}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Members table */}
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                        <Eye size={12} /> All Members Under This Shepherd
                      </p>
                      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                        <div className="divide-y divide-gray-50">
                          {shepherd.members.map(member => {
                            const borderColor = member.attendanceRate >= 70 ? 'border-l-green-400' :
                                               member.attendanceRate >= 30 ? 'border-l-amber-400' : 'border-l-red-400';
                            return (
                              <Link
                                key={member.id}
                                href={`/dashboard/profile/member/${member.id}`}
                                className={`flex items-center justify-between px-3 sm:px-4 py-3 hover:bg-orange-50/50 transition border-l-4 ${borderColor}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center overflow-hidden shrink-0">
                                    {member.photo_url ? (
                                      <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-white text-[9px] font-bold">
                                        {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-black">{member.full_name}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                      <span>{member.bacenta}</span>
                                      <span>·</span>
                                      <span className={`font-medium ${
                                        member.status === 'active' ? 'text-green-600' :
                                        member.status === 'flagged' ? 'text-amber-600' : 'text-red-600'
                                      }`}>{member.status}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        member.attendanceRate >= 70 ? 'bg-green-500' :
                                        member.attendanceRate >= 30 ? 'bg-amber-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${member.attendanceRate}%` }}
                                    ></div>
                                  </div>
                                  <span className={`text-xs font-bold min-w-8 text-right ${
                                    member.attendanceRate >= 70 ? 'text-green-600' :
                                    member.attendanceRate >= 30 ? 'text-amber-600' : 'text-red-600'
                                  }`}>
                                    {member.attendanceRate}%
                                  </span>
                                </div>
                              </Link>
                            );
                          })}
                          {shepherd.members.length === 0 && (
                            <div className="text-center py-8 text-gray-400 text-sm">
                              No members assigned yet
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Alert section */}
                    {shepherd.members.filter(m => m.attendanceRate < 30).length > 0 && (
                      <div className="mt-4 bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs font-medium text-red-700 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          {shepherd.members.filter(m => m.attendanceRate < 30).length} member(s) with critical attendance — follow-up recommended
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {shepherds.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No shepherds found in this branch
          </div>
        )}
      </div>

      {/* Delete Shepherd + Reassign Modal */}
      {deletingShepherd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !deleteBusy && setDeletingShepherd(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-black">Delete Shepherd</h2>
              <button onClick={() => setDeletingShepherd(null)} className="text-gray-400 hover:text-black" disabled={deleteBusy}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {deleteError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {deleteError}
                </div>
              )}
              <p className="text-sm text-gray-600">
                You are about to delete <strong className="text-black">{deletingShepherd.name}</strong>.
                {deletingShepherd.totalSheep > 0 ? (
                  <> They currently have <strong className="text-black">{deletingShepherd.totalSheep} member{deletingShepherd.totalSheep === 1 ? '' : 's'}</strong> under their care. Choose another shepherd to take over their members and bacentas, or leave them unassigned.</>
                ) : (
                  <> They have no members assigned. This action cannot be undone.</>
                )}
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reassign members &amp; bacentas to</label>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black bg-white"
                >
                  <option value="">Leave unassigned</option>
                  {shepherds
                    .filter((s) => s.id !== deletingShepherd.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeletingShepherd(null)}
                  disabled={deleteBusy}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteShepherd}
                  disabled={deleteBusy}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium disabled:opacity-50"
                >
                  {deleteBusy ? 'Deleting...' : 'Delete Shepherd'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
