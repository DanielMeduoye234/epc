'use client';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @next/next/no-img-element */

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Member, FirstTimer, NewBeliever } from '@/lib/types';
import { DEMO_MEMBERS, DEMO_FIRST_TIMERS, DEMO_NEW_BELIEVERS, DEMO_USERS } from '@/lib/demo-data';
import Link from 'next/link';
import {
  CalendarCheck, Save, Eye, BarChart3, Users, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, Search,
} from 'lucide-react';
import React from 'react';

interface MemberWithHistory extends Member {
  recentWeeks?: boolean[];
  person_type: 'member' | 'first_timer' | 'new_believer';
}

interface ShepherdStats {
  id: string;
  name: string;
  totalSheep: number;
  faithful: number;
  atRisk: number;
  lost: number;
  avgAttendance: number;
  weeklyRates: number[];
}

async function checkAndPromoteIndividuals(supabase: any, branchId: string) {
  // 1. Get all active first_timers and new_believers in this branch
  const [ftRes, nbRes] = await Promise.all([
    supabase.from('first_timers').select('*').eq('branch_id', branchId).eq('status', 'first_timer'),
    supabase.from('new_believers').select('*').eq('branch_id', branchId)
  ]);

  const firstTimers: FirstTimer[] = ftRes.data || [];
  const newBelievers: NewBeliever[] = nbRes.data || [];

  if (firstTimers.length === 0 && newBelievers.length === 0) return;

  // Get current members to avoid duplicates
  const { data: currentMembers } = await supabase.from('members').select('full_name, phone_number, first_timer_id').eq('branch_id', branchId);
  const existingFtIds = new Set((currentMembers || []).map((m: any) => m.first_timer_id).filter(Boolean));
  const existingNames = new Set((currentMembers || []).map((m: any) => m.full_name.toLowerCase().trim()));
  const existingPhones = new Set((currentMembers || []).map((m: any) => m.phone_number.trim()).filter(Boolean));

  // 2. Fetch present attendance counts for first timers
  if (firstTimers.length > 0) {
    const ftIds = firstTimers.map(f => f.id);
    const { data: ftAtt } = await supabase
      .from('attendance')
      .select('person_id')
      .in('person_id', ftIds)
      .eq('is_present', true);

    const ftCounts: Record<string, number> = {};
    (ftAtt || []).forEach((a: any) => {
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

  // 3. Fetch present attendance counts for new believers
  if (newBelievers.length > 0) {
    const nbIds = newBelievers.map(n => n.id);
    const { data: nbAtt } = await supabase
      .from('attendance')
      .select('person_id')
      .in('person_id', nbIds)
      .eq('is_present', true);

    const nbCounts: Record<string, number> = {};
    (nbAtt || []).forEach((a: any) => {
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

export default function AttendancePage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [members, setMembers] = useState<MemberWithHistory[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [shepherdStats, setShepherdStats] = useState<ShepherdStats[]>([]);
  const [shepherdNameMap, setShepherdNameMap] = useState<Record<string, string>>({});
  const [expandedShepherd, setExpandedShepherd] = useState<string | null>(null);
  const [selectedShepherdId, setSelectedShepherdId] = useState('');

  const [search, setSearch] = useState('');
  const [bacentaFilter, setBacentaFilter] = useState('all');

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'bishop';

  // Shepherd's Data is no longer available to super admins — send them home
  const router = useRouter();
  useEffect(() => {
    if (profile?.role === 'super_admin') router.replace('/dashboard');
  }, [profile, router]);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        const demoMap: Record<string, string> = {};
        Object.entries(DEMO_USERS)
          .filter(([, user]) => user.role === 'shepherd')
          .forEach(([id, user]) => {
            demoMap[id] = user.name;
          });
        setShepherdNameMap(demoMap);

        const listMembers: MemberWithHistory[] = DEMO_MEMBERS.map(m => ({ ...m, person_type: 'member' }));
        const listFirstTimers: MemberWithHistory[] = DEMO_FIRST_TIMERS.filter(ft => ft.status === 'first_timer').map(ft => ({
          ...ft,
          person_type: 'first_timer',
          status: 'active'
        })) as any;
        const listNewBelievers: MemberWithHistory[] = DEMO_NEW_BELIEVERS.map(nb => ({
          ...nb,
          person_type: 'new_believer',
          date_joined: nb.date_saved,
          assigned_shepherd: nb.recorded_by,
          status: 'active'
        })) as any;

        const combined = [...listMembers, ...listFirstTimers, ...listNewBelievers];

        const membersWithHistory: MemberWithHistory[] = combined.map(m => {
          const weeks: boolean[] = [];
          for (let i = 0; i < 6; i++) {
            weeks.push(Math.random() > 0.25);
          }
          return { ...m, recentWeeks: weeks };
        });

        if (profile.role === 'shepherd') {
          const bacentaNames = (profile.bacentas || []).map((b) => b.name).filter(Boolean);
          setMembers(membersWithHistory.filter(m =>
            m.assigned_shepherd === profile.id || bacentaNames.includes(m.bacenta)
          ));
        } else {
          setMembers(membersWithHistory);
        }
        if (isAdmin) buildShepherdStats(membersWithHistory, demoMap);
        setLoading(false);
      } else {
        fetchMembers();
      }
    }
  }, [profile, isDemo]);

  useEffect(() => {
    if (profile && members.length > 0 && !isDemo && !isAdmin) fetchExistingAttendance();
  }, [date, members]);

  function buildShepherdStats(allMembers: MemberWithHistory[], namesMap?: Record<string, string>) {
    const shepherdMap: Record<string, MemberWithHistory[]> = {};
    allMembers.forEach(m => {
      const sid = m.assigned_shepherd || 'unassigned';
      if (!shepherdMap[sid]) shepherdMap[sid] = [];
      shepherdMap[sid].push(m);
    });

    const stats: ShepherdStats[] = Object.entries(shepherdMap).map(([sid, sheep]) => {
      const faithful = sheep.filter(s => (s.recentWeeks || []).filter(Boolean).length >= 4).length;
      const lost = sheep.filter(s => (s.recentWeeks || []).filter(Boolean).length === 0).length;
      const atRisk = sheep.length - faithful - lost;
      const totalAttendances = sheep.reduce((acc, s) => acc + (s.recentWeeks || []).filter(Boolean).length, 0);
      const possibleAttendances = sheep.length * 6;
      const avgAttendance = possibleAttendances > 0 ? Math.round((totalAttendances / possibleAttendances) * 100) : 0;

      const weeklyRates = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 6; i++) {
        const presentCount = sheep.filter(s => s.recentWeeks?.[i]).length;
        weeklyRates[i] = sheep.length > 0 ? Math.round((presentCount / sheep.length) * 100) : 0;
      }

      const name = namesMap?.[sid] || (sid === 'unassigned' ? 'Unassigned' : sid);
      return { id: sid, name, totalSheep: sheep.length, faithful, atRisk, lost, avgAttendance, weeklyRates };
    });
    stats.sort((a, b) => b.avgAttendance - a.avgAttendance);
    setShepherdStats(stats);
    setSelectedShepherdId((prev) => {
      const exists = stats.some((s) => s.id === prev);
      if (exists) return prev;
      return stats[0]?.id || '';
    });
  }

  async function fetchMembers() {
    const [mRes, ftRes, nbRes, profilesRes] = await Promise.all([
      supabase.from('members').select('*').eq('branch_id', profile!.branch_id),
      supabase.from('first_timers').select('*').eq('branch_id', profile!.branch_id).eq('status', 'first_timer'),
      supabase.from('new_believers').select('*').eq('branch_id', profile!.branch_id),
      supabase.from('profiles').select('id, full_name').eq('branch_id', profile!.branch_id)
    ]);

    const mList: MemberWithHistory[] = (mRes.data || []).map((x: any) => ({ ...x, person_type: 'member' }));
    const ftList: MemberWithHistory[] = (ftRes.data || []).map((x: any) => ({
      ...x,
      person_type: 'first_timer',
      status: 'active'
    })) as any;
    const nbList: MemberWithHistory[] = (nbRes.data || []).map((x: any) => ({
      ...x,
      person_type: 'new_believer',
      date_joined: x.date_saved,
      assigned_shepherd: x.recorded_by,
      status: 'active'
    })) as any;

    let membersList = [...mList, ...ftList, ...nbList];

    if (profile!.role === 'shepherd') {
      const bacentaNames = (profile!.bacentas || []).map((b) => b.name).filter(Boolean);
      membersList = membersList.filter((m: MemberWithHistory) =>
        m.assigned_shepherd === profile!.id || bacentaNames.includes(m.bacenta)
      );
    }

    let namesMap: Record<string, string> = shepherdNameMap;
    if (isAdmin) {
      namesMap = {};
      (profilesRes.data || []).forEach((sp: { id: string; full_name: string }) => {
        namesMap[sp.id] = sp.full_name;
      });
      setShepherdNameMap(namesMap);
    }

    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const memberIds = membersList.map((m: MemberWithHistory) => m.id);

    if (memberIds.length > 0) {
      const { data: historyData } = await supabase
        .from('attendance')
        .select('person_id, is_present, date')
        .in('person_id', memberIds)
        .gte('date', sixWeeksAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      const weekMap: Record<string, Map<string, boolean>> = {};
      memberIds.forEach((id: string) => { weekMap[id] = new Map(); });

      historyData?.forEach((a: { person_id: string; is_present: boolean; date: string }) => {
        const weekKey = getWeekKey(a.date);
        if (weekMap[a.person_id]) {
          if (a.is_present || !weekMap[a.person_id].has(weekKey)) {
            weekMap[a.person_id].set(weekKey, a.is_present);
          }
        }
      });

      const membersWithHistory: MemberWithHistory[] = membersList.map((m: MemberWithHistory) => {
        const weeks = Array.from(weekMap[m.id].values()).slice(-6);
        return { ...m, recentWeeks: weeks };
      });

      setMembers(membersWithHistory);
      if (isAdmin) buildShepherdStats(membersWithHistory, namesMap);
    } else {
      setMembers(membersList);
      if (isAdmin) buildShepherdStats([], namesMap);
    }
    setLoading(false);
  }

  function getWeekKey(dateStr: string): string {
    const d = new Date(dateStr);
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return start.toISOString().split('T')[0];
  }

  async function fetchExistingAttendance() {
    const memberIds = members.map(m => m.id);
    const { data } = await supabase
      .from('attendance')
      .select('person_id, is_present')
      .in('person_id', memberIds)
      .eq('date', date);

    const existing: Record<string, boolean> = {};
    (data || []).forEach((row: { person_id: string; is_present: boolean }) => {
      existing[row.person_id] = row.is_present;
    });
    setAttendance(existing);
  }

  async function handleSave() {
    if (members.length === 0) return;
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    const memberIds = members.map(m => m.id);
    const { error: delError } = await supabase.from('attendance').delete().in('person_id', memberIds).eq('date', date);
    if (delError) {
      setSaving(false);
      setSaveError(true);
      return;
    }
    const { error: insError } = await supabase.from('attendance').insert(
      members.map(m => ({
        person_id: m.id,
        person_type: m.person_type,
        date,
        is_present: attendance[m.id] ?? false,
        marked_by: profile!.id,
        branch_id: profile!.branch_id,
      }))
    );
    setSaving(false);
    if (!insError) {
      setSaved(true);
      if (!isDemo) {
        await checkAndPromoteIndividuals(supabase, profile!.branch_id);
      }
      setTimeout(() => setSaved(false), 3000);
    } else {
      setSaveError(true);
    }
  }

  const toggleAttendance = (memberId: string) => {
    setAttendance(prev => ({ ...prev, [memberId]: !prev[memberId] }));
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;

  const getFaithfulness = (member: MemberWithHistory) => {
    if (!member.recentWeeks || member.recentWeeks.length === 0) return 'unknown';
    const rate = member.recentWeeks.filter(Boolean).length / member.recentWeeks.length;
    if (rate >= 0.7) return 'faithful';
    if (rate >= 0.3) return 'at-risk';
    return 'lost';
  };

  // Shepherd view: all unique bacentas from their members
  const shepherdBacentas = useMemo(() => {
    const s = new Set(members.map(m => m.bacenta).filter(Boolean));
    return Array.from(s).sort();
  }, [members]);

  // Filtered members for shepherd view
  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(m =>
      (m.full_name.toLowerCase().includes(q) || m.bacenta.toLowerCase().includes(q)) &&
      (bacentaFilter === 'all' || m.bacenta === bacentaFilter)
    );
  }, [members, search, bacentaFilter]);

  // Super admins are redirected away (see effect above) — render nothing meanwhile
  if (profile?.role === 'super_admin') return null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ==================== BISHOP ADMIN VIEW ====================
  if (isAdmin) {
    const totalSheep = shepherdStats.reduce((s, sh) => s + sh.totalSheep, 0);
    const totalFaithful = shepherdStats.reduce((s, sh) => s + sh.faithful, 0);
    const totalAtRisk = shepherdStats.reduce((s, sh) => s + sh.atRisk, 0);
    const totalLost = shepherdStats.reduce((s, sh) => s + sh.lost, 0);
    const overallAttendance = totalSheep > 0
      ? Math.round(shepherdStats.reduce((s, sh) => s + sh.avgAttendance * sh.totalSheep, 0) / totalSheep)
      : 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            <BarChart3 className="text-orange-500" size={26} />
            Shepherd&apos;s Data
            </h1>
            <p className="text-gray-500 mt-1">Church-wide attendance overview across all shepherds</p>
          </div>
          {shepherdStats.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedShepherdId}
                onChange={(e) => setSelectedShepherdId(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
              >
                {shepherdStats.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Link
                href={`/dashboard/shepherds${selectedShepherdId ? `?shepherdId=${encodeURIComponent(selectedShepherdId)}` : ''}`}
                className="px-3 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition"
              >
                View Performance
              </Link>
            </div>
          )}
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500 uppercase">Total Members</p>
                <p className="text-2xl font-bold text-black mt-1">{totalSheep}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Users size={12} className="text-orange-500" />
                  <span className="text-[10px] text-gray-400">{shepherdStats.length} shepherds</span>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500 uppercase">Overall Attendance</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">{overallAttendance}%</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div className="bg-linear-to-r from-orange-400 to-orange-600 h-1.5 rounded-full" style={{ width: `${overallAttendance}%` }}></div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500 uppercase">Faithful 🐑</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{totalFaithful}</p>
                <p className="text-[10px] text-gray-400 mt-1">≥70% attendance</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <p className="text-xs text-gray-500 uppercase">Needs Attention</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{totalAtRisk + totalLost}</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  <span className="text-amber-500">{totalAtRisk} at risk</span> · <span className="text-red-500">{totalLost} lost</span>
                </p>
              </div>
        </div>

        {/* Per-Shepherd Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-black flex items-center gap-2">
              <Eye size={18} className="text-orange-500" />
              Shepherd Performance
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Click a shepherd to see their flock breakdown</p>
          </div>

          {shepherdStats.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No shepherd data yet. Add members and mark attendance to see stats here.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {shepherdStats.map((shepherd, idx) => {
                const isExpanded = expandedShepherd === shepherd.id;
                const trend = shepherd.weeklyRates.length >= 2
                  ? shepherd.weeklyRates[shepherd.weeklyRates.length - 1] - shepherd.weeklyRates[shepherd.weeklyRates.length - 2]
                  : 0;
                const sheepForShepherd = members.filter(m => (m.assigned_shepherd || 'unassigned') === shepherd.id);

                return (
                  <div key={shepherd.id}>
                    <div
                      onClick={() => setExpandedShepherd(isExpanded ? null : shepherd.id)}
                      className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          idx === 0 ? 'bg-linear-to-br from-yellow-400 to-orange-500' :
                          idx === 1 ? 'bg-linear-to-br from-gray-300 to-gray-500' :
                          'bg-linear-to-br from-orange-400 to-orange-600'
                        }`}>
                          {shepherd.name.split(' ').pop()?.[0] || '?'}
                        </div>
                        <div>
                          <p className="font-medium text-black text-sm sm:text-base">{shepherd.name}</p>
                          <p className="text-xs text-gray-500">{shepherd.totalSheep} sheep</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-end gap-0.5 h-6">
                          {shepherd.weeklyRates.map((rate, i) => (
                            <div
                              key={i}
                              className="w-2 rounded-t bg-linear-to-t from-orange-400 to-orange-300 transition-all"
                              style={{ height: `${Math.max(rate * 0.24, 2)}px` }}
                              title={`Week ${i + 1}: ${rate}%`}
                            />
                          ))}
                        </div>

                        <div className="text-right min-w-15">
                          <p className={`text-lg font-bold ${
                            shepherd.avgAttendance >= 70 ? 'text-green-600' :
                            shepherd.avgAttendance >= 40 ? 'text-amber-500' : 'text-red-500'
                          }`}>
                            {shepherd.avgAttendance}%
                          </p>
                          {trend !== 0 && (
                            <div className={`flex items-center justify-end gap-0.5 text-[10px] ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {Math.abs(trend)}%
                            </div>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <div className="flex items-center gap-0.5">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-[10px] text-gray-600">{shepherd.faithful}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-[10px] text-gray-600">{shepherd.atRisk}</span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span className="text-[10px] text-gray-600">{shepherd.lost}</span>
                          </div>
                        </div>

                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {sheepForShepherd.map(sheep => {
                            const faith = getFaithfulness(sheep);
                            const ringColor = faith === 'faithful' ? 'ring-green-400' :
                                             faith === 'at-risk' ? 'ring-amber-400' :
                                             faith === 'lost' ? 'ring-red-400' : 'ring-gray-300';
                            return (
                              <div key={sheep.id} className="flex flex-col items-center p-2 bg-white rounded-lg border border-gray-100 min-w-14">
                                <div className={`w-8 h-8 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center ring-2 ${ringColor} overflow-hidden`}>
                                  {sheep.photo_url ? (
                                    <img src={sheep.photo_url} alt={sheep.full_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-white text-[9px] font-bold">
                                      {sheep.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9px] text-gray-700 mt-1 text-center truncate w-full">{sheep.full_name.split(' ')[0]}</p>
                                {sheep.recentWeeks && (
                                  <div className="flex gap-0.5 mt-0.5">
                                    {sheep.recentWeeks.slice(-4).map((present, i) => (
                                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-green-500' : 'bg-red-400'}`}></div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== SHEPHERD VIEW ====================
  const filteredCount = filteredMembers.filter(m => attendance[m.id]).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Shepherd&apos;s Data</h1>
          <p className="text-gray-500 mt-1">Weekly attendance overview for your sheep</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
          />
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          Attendance saved successfully!
        </div>
      )}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Failed to save attendance. Please try again.
        </div>
      )}

      {/* Search + filter */}
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
        {shepherdBacentas.length > 1 && (
          <select
            value={bacentaFilter}
            onChange={e => setBacentaFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-black text-sm"
          >
            <option value="all">All Bacentas</option>
            {shepherdBacentas.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>

      {/* Eagle Eye Overview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Eye size={18} className="text-orange-500" />
          <h3 className="font-semibold text-black text-sm">Eagle Eye — Faithfulness at a Glance</h3>
        </div>
        <div className="flex flex-wrap gap-4 mb-3 text-[10px] sm:text-xs">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span> Faithful</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> At Risk</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Lost</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block"></span> No Data</span>
        </div>
        {filteredMembers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No members assigned to you yet. Ask your admin to assign members.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredMembers.map(member => {
              const faith = getFaithfulness(member);
              const bgColor = faith === 'faithful' ? 'bg-green-100 border-green-400' :
                             faith === 'at-risk' ? 'bg-amber-100 border-amber-400' :
                             faith === 'lost' ? 'bg-red-100 border-red-400' : 'bg-gray-100 border-gray-300';
              const dotColor = faith === 'faithful' ? 'bg-green-500' :
                              faith === 'at-risk' ? 'bg-amber-500' :
                              faith === 'lost' ? 'bg-red-500' : 'bg-gray-400';
              const todayMarked = attendance[member.id];
              return (
                <div
                  key={member.id}
                  className={`relative flex flex-col items-center p-2 rounded-lg border ${bgColor} transition min-w-13`}
                >
                  {todayMarked !== undefined && (
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                      todayMarked ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {todayMarked ? '✓' : '✗'}
                    </div>
                  )}
                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center overflow-hidden">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-[9px] font-bold">
                        {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] sm:text-[10px] text-gray-700 mt-1 text-center truncate w-full">{member.full_name.split(' ')[0]}</p>
                  {member.recentWeeks && (
                    <div className="flex gap-0.5 mt-1">
                      {member.recentWeeks.slice(-4).map((present, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-green-500' : 'bg-red-400'}`}></div>
                      ))}
                    </div>
                  )}
                  <div className={`w-2 h-2 rounded-full ${dotColor} mt-1`}></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarCheck size={22} className="text-orange-500" />
          <div>
            <p className="text-xs sm:text-sm text-gray-500">
              {new Date(date).toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-base sm:text-lg font-semibold text-black">
              {presentCount} / {members.length} present
              {filteredMembers.length < members.length && (
                <span className="text-sm text-gray-400 font-normal ml-1">({filteredCount} shown)</span>
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-orange-500">
            {members.length > 0 ? Math.round((presentCount / members.length) * 100) : 0}%
          </p>
          <p className="text-[10px] text-gray-400 uppercase">today</p>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filteredMembers.map(member => {
            const faith = getFaithfulness(member);
            const borderAccent = faith === 'faithful' ? 'border-l-green-400' :
                                faith === 'at-risk' ? 'border-l-amber-400' :
                                faith === 'lost' ? 'border-l-red-400' : 'border-l-gray-200';
            return (
              <div
                key={member.id}
                className={`flex items-center justify-between px-4 sm:px-6 py-4 transition border-l-4 ${borderAccent}`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 overflow-hidden">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-sm font-bold">
                        {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-black text-sm sm:text-base">{member.full_name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs sm:text-sm text-gray-500">{member.bacenta}</p>
                      {member.recentWeeks && (
                        <div className="flex gap-0.5">
                          {member.recentWeeks.slice(-6).map((present, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-green-400' : 'bg-red-300'}`}></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition ${
                    attendance[member.id]
                      ? 'bg-green-100 text-green-600 border-2 border-green-300'
                      : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                  }`}
                >
                  {attendance[member.id] ? '✓' : '✗'}
                </div>
              </div>
            );
          })}
          {filteredMembers.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              {search || bacentaFilter !== 'all' ? 'No results found' : 'No members assigned yet'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

