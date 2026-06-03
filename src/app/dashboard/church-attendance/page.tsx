'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Member, Bacenta } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Plus, X, Search, BarChart3, Grid3X3,
  ChevronLeft, ChevronRight, UserCheck, UserX, FolderTree, Edit2,
} from 'lucide-react';
import React from 'react';

function getSundaysFromMonth(year: number, month: number): Date[] {
  const sundays: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const end = new Date(year, 11, 31);
  while (d <= end) {
    sundays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

type Tab = 'overview' | 'tracker';

interface AddForm {
  full_name: string;
  phone_number: string;
  address: string;
  bacenta: string;
  who_brought: string;
  is_first_timer: boolean;
}

export default function ChurchAttendancePage() {
  const { profile } = useAuth();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [members, setMembers] = useState<Member[]>([]);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [loading, setLoading] = useState(true);

  // Overview state
  const [search, setSearch] = useState('');
  const [filterBacenta, setFilterBacenta] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({
    full_name: '', phone_number: '', address: '', bacenta: '', who_brought: '', is_first_timer: false,
  });
  const [adding, setAdding] = useState(false);

  // Bacenta management state
  const [showBacentaModal, setShowBacentaModal] = useState(false);
  const [newBacenta, setNewBacenta] = useState({ name: '', leader_name: '', location: '' });
  const [addingBacenta, setAddingBacenta] = useState(false);

  // Tracker state
  const now = new Date();
  const [trackerYear, setTrackerYear] = useState(now.getFullYear());
  const [trackerMonth, setTrackerMonth] = useState(now.getMonth());
  const [trackerBacenta, setTrackerBacenta] = useState('all');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<string, boolean>>>({});
  const [loadingAtt, setLoadingAtt] = useState(false);

  useEffect(() => { if (profile) fetchData(); }, [profile]);

  useEffect(() => {
    if (tab === 'tracker' && members.length > 0) fetchTrackerAttendance();
  }, [tab, trackerYear, trackerMonth, members]);

  async function fetchData() {
    setLoading(true);
    const [mRes, bRes] = await Promise.all([
      supabase.from('members').select('*').eq('branch_id', profile!.branch_id).order('bacenta').order('full_name'),
      supabase.from('bacentas').select('*').eq('branch_id', profile!.branch_id).order('name'),
    ]);
    setMembers(mRes.data || []);
    setBacentas(bRes.data || []);
    setLoading(false);
  }

  async function fetchTrackerAttendance() {
    setLoadingAtt(true);
    const startDate = `${trackerYear}-${String(trackerMonth + 1).padStart(2, '0')}-01`;
    const endDate = `${trackerYear}-12-31`;
    const { data } = await supabase
      .from('attendance')
      .select('person_id, date, is_present')
      .in('person_id', members.map(m => m.id))
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

  async function toggleAttendance(memberId: string, dateStr: string) {
    const current = (attendanceMap[memberId] || {})[dateStr];
    const newVal = current === undefined ? true : current === true ? false : undefined;
    setAttendanceMap(prev => {
      const updated = { ...prev, [memberId]: { ...(prev[memberId] || {}) } };
      if (newVal === undefined) delete updated[memberId][dateStr];
      else updated[memberId][dateStr] = newVal;
      return updated;
    });
    if (newVal === undefined) {
      await supabase.from('attendance').delete().eq('person_id', memberId).eq('date', dateStr);
    } else {
      await supabase.from('attendance').upsert(
        { person_id: memberId, date: dateStr, is_present: newVal, branch_id: profile!.branch_id },
        { onConflict: 'person_id,date' }
      );
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.full_name || !addForm.phone_number) return;
    setAdding(true);
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('members').insert({
      full_name: addForm.full_name,
      phone_number: addForm.phone_number,
      address: addForm.address || '',
      bacenta: addForm.bacenta || 'Unassigned',
      who_brought: addForm.who_brought || '',
      date_joined: today,
      membership_date: today,
      branch_id: profile!.branch_id,
      status: 'active',
    });
    if (addForm.is_first_timer) {
      await supabase.from('first_timers').insert({
        full_name: addForm.full_name,
        phone_number: addForm.phone_number,
        address: addForm.address || '',
        bacenta: addForm.bacenta || 'Unassigned',
        who_brought: addForm.who_brought || '',
        date_joined: today,
        branch_id: profile!.branch_id,
        status: 'first_timer',
      });
    }
    setAddForm({ full_name: '', phone_number: '', address: '', bacenta: '', who_brought: '', is_first_timer: false });
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

  const allBacentas = useMemo(() => {
    const s = new Set(members.map(m => m.bacenta).filter(Boolean));
    return Array.from(s).sort();
  }, [members]);

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

  const sundaysByMonth = useMemo(() => {
    const groups: { label: string; dates: Date[] }[] = [];
    sundays.forEach(s => {
      const lbl = s.toLocaleString('en', { month: 'short', year: '2-digit' });
      const last = groups[groups.length - 1];
      if (last && last.label === lbl) last.dates.push(s);
      else groups.push({ label: lbl, dates: [s] });
    });
    return groups;
  }, [sundays]);

  const trackerMembers = useMemo(() =>
    members.filter(m => trackerBacenta === 'all' || m.bacenta === trackerBacenta),
    [members, trackerBacenta]);

  const trackerBacentaList = useMemo(() =>
    allBacentas.filter(b => trackerBacenta === 'all' || b === trackerBacenta),
    [allBacentas, trackerBacenta]);

  const totalActive = members.filter(m => m.status === 'active').length;
  const totalFlagged = members.filter(m => m.status === 'flagged').length;

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
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition"
        >
          <Plus size={18} />
          Add Member
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['overview', BarChart3, 'Overview'], ['tracker', Grid3X3, 'Attendance Tracker']] as const).map(([key, Icon, label]) => (
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
              <span className="font-bold text-black min-w-[120px] text-center text-sm">
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
              {sundays.length} Sundays &middot; {trackerMembers.length} members
            </span>
          </div>

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

          {loadingAtt ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: '72vh' }}>
                <table className="border-collapse text-xs" style={{ minWidth: `${200 + sundays.length * 34}px` }}>
                  <thead className="sticky top-0 z-20">
                    {/* Month row */}
                    <tr>
                      <th
                        className="sticky left-0 z-30 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-700 border-b border-r border-gray-200"
                        style={{ minWidth: 200 }}
                      >
                        <div className="flex items-center gap-1">
                          <Users size={13} className="text-orange-500" />
                          Member
                        </div>
                      </th>
                      {sundaysByMonth.map(({ label, dates }) => (
                        <th
                          key={label}
                          colSpan={dates.length}
                          className="px-2 py-2 text-center font-semibold text-orange-700 bg-orange-50 border-b border-l border-gray-200 whitespace-nowrap"
                        >
                          {label}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center font-semibold text-gray-700 bg-gray-50 border-b border-l border-gray-200 whitespace-nowrap">
                        Total
                      </th>
                    </tr>
                    {/* Date row */}
                    <tr>
                      <th className="sticky left-0 z-30 bg-gray-50 px-3 py-1.5 border-b border-r border-gray-200" style={{ minWidth: 200 }}></th>
                      {sundays.map(s => (
                        <th
                          key={toDateStr(s)}
                          className="px-0.5 py-1.5 text-center border-b border-l border-gray-100 bg-white font-normal text-gray-500"
                          style={{ minWidth: 30 }}
                        >
                          <div className="text-[10px]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 44 }}>
                            {s.toLocaleDateString('en', { month: 'numeric', day: 'numeric' })}
                          </div>
                        </th>
                      ))}
                      <th className="px-2 py-1.5 text-center border-b border-l border-gray-100 bg-white text-[10px] text-gray-500">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackerBacentaList.map(bacenta => {
                      const bMembers = trackerMembers.filter(m => m.bacenta === bacenta);
                      if (bMembers.length === 0) return null;
                      return (
                        <React.Fragment key={bacenta}>
                          {/* Bacenta header row */}
                          <tr>
                            <td
                              colSpan={sundays.length + 2}
                              className="sticky left-0 px-3 py-1.5 text-[11px] font-bold text-orange-700 uppercase tracking-wide bg-orange-50 border-b border-gray-200"
                            >
                              {bacenta}
                              <span className="text-orange-400 font-normal ml-1">({bMembers.length})</span>
                            </td>
                          </tr>
                          {bMembers.map((member, idx) => {
                            const mAtt = attendanceMap[member.id] || {};
                            const recorded = sundays.filter(s => mAtt[toDateStr(s)] !== undefined).length;
                            const present = sundays.filter(s => mAtt[toDateStr(s)] === true).length;
                            const pct = recorded > 0 ? Math.round((present / recorded) * 100) : null;
                            return (
                              <tr key={member.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                                <td
                                  className="sticky left-0 z-10 bg-inherit px-3 py-1 border-r border-gray-200 font-medium text-black whitespace-nowrap"
                                  style={{ minWidth: 200 }}
                                >
                                  {member.full_name}
                                </td>
                                {sundays.map(s => {
                                  const ds = toDateStr(s);
                                  const val = mAtt[ds];
                                  return (
                                    <td key={ds} className="px-0.5 py-1 text-center border-l border-gray-100">
                                      <button
                                        onClick={() => toggleAttendance(member.id, ds)}
                                        title={val === true ? 'Present — click to mark absent' : val === false ? 'Absent — click to clear' : 'Not recorded — click to mark present'}
                                        className={`w-5 h-5 rounded mx-auto block transition hover:opacity-70 cursor-pointer ${
                                          val === true ? 'bg-green-500' :
                                          val === false ? 'bg-red-400' : 'bg-gray-200 hover:bg-gray-300'
                                        }`}
                                      />
                                    </td>
                                  );
                                })}
                                <td className="px-2 py-1 text-center border-l border-gray-100 font-medium">
                                  {pct !== null ? (
                                    <span className={`text-[11px] ${pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                                      {pct}%
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 text-[11px]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    {/* Sunday Totals Row */}
                    <tr className="bg-orange-50 border-t-2 border-orange-200">
                      <td className="sticky left-0 z-10 bg-orange-50 px-3 py-2 border-r border-gray-200 font-bold text-orange-700 text-[11px] whitespace-nowrap" style={{ minWidth: 200 }}>
                        SUNDAY TOTAL
                      </td>
                      {sundays.map(s => {
                        const ds = toDateStr(s);
                        const present = trackerMembers.filter(m => (attendanceMap[m.id] || {})[ds] === true).length;
                        const absent = trackerMembers.filter(m => (attendanceMap[m.id] || {})[ds] === false).length;
                        return (
                          <td key={ds} className="px-0.5 py-2 text-center border-l border-gray-200">
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1 text-[10px]">
                                <span className="w-3 h-3 rounded bg-green-500"></span>
                                <span className="font-bold text-green-700">{present}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <span className="w-3 h-3 rounded bg-red-400"></span>
                                <span className="font-bold text-red-600">{absent}</span>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center border-l border-gray-200 font-bold text-orange-700">
                        {trackerMembers.length}
                      </td>
                    </tr>
                    {trackerMembers.length === 0 && (
                      <tr>
                        <td colSpan={sundays.length + 2} className="text-center py-12 text-gray-400">
                          No members to display
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-black">Add Member</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
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
                  onChange={e => setAddForm(p => ({ ...p, full_name: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="e.g. John Akpan"
                />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Bacenta *</label>
                <select
                  value={addForm.bacenta}
                  onChange={e => setAddForm(p => ({ ...p, bacenta: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="">Select bacenta...</option>
                  {bacentas.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  {allBacentas.filter(b => !bacentas.find(x => x.name === b)).map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
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
              <button
                type="submit"
                disabled={adding}
                className="w-full py-3 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add Member'}
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
                className="w-full py-3 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50"
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
