'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { DEMO_MEMBERS, DEMO_ATTENDANCE, DEMO_FOLLOWUPS } from '@/lib/demo-data';
import { FileText, Download, Calendar, Users, TrendingUp, Filter } from 'lucide-react';

type ReportType = 'attendance' | 'members' | 'follow_ups' | 'summary';

interface MembersRow {
  full_name: string;
  phone_number: string;
  status: string;
  bacenta: string;
  date_joined: string;
  birthday: string | null;
}

interface AttendanceRow {
  member_name: string;
  date: string;
  status: 'present' | 'absent';
}

interface FollowUpRow {
  member_name: string;
  shepherd_name: string;
  type: string;
  status: string;
  date: string;
  notes: string;
}

interface SummaryStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  attendanceRate: number;
  totalFollowUps: number;
}

export default function ReportsPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [dateRange, setDateRange] = useState({ from: '2026-05-01', to: '2026-05-23' });
  const [generating, setGenerating] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [membersRows, setMembersRows] = useState<MembersRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [followUpRows, setFollowUpRows] = useState<FollowUpRow[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
    attendanceRate: 0,
    totalFollowUps: 0,
  });

  useEffect(() => {
    if (!profile || isDemo) return;
    fetchLiveReportData();
  }, [profile, isDemo, dateRange.from, dateRange.to]);

  async function fetchLiveReportData() {
    if (!profile?.branch_id) return;
    setLoadingData(true);

    const branchId = profile.branch_id;

    const [membersRes, attendanceRes, followUpRes] = await Promise.all([
      supabase
        .from('members')
        .select('id, full_name, phone_number, status, bacenta, date_joined, birthday')
        .eq('branch_id', branchId)
        .gte('date_joined', dateRange.from)
        .lte('date_joined', dateRange.to)
        .order('date_joined', { ascending: false }),
      supabase
        .from('attendance')
        .select('person_id, person_type, date, is_present')
        .eq('branch_id', branchId)
        .eq('person_type', 'member')
        .gte('date', dateRange.from)
        .lte('date', dateRange.to)
        .order('date', { ascending: false }),
      supabase
        .from('follow_ups')
        .select('type, status, date, notes, member:members(full_name), shepherd:profiles(full_name)')
        .eq('branch_id', branchId)
        .gte('date', dateRange.from)
        .lte('date', dateRange.to)
        .order('date', { ascending: false }),
    ]);

    const liveMembers: MembersRow[] = (membersRes.data || []).map((m: Record<string, unknown>) => ({
      full_name: String(m.full_name || ''),
      phone_number: String(m.phone_number || ''),
      status: String(m.status || ''),
      bacenta: String(m.bacenta || ''),
      date_joined: String(m.date_joined || ''),
      birthday: (m.birthday as string | null) || null,
    }));

    const memberIds = Array.from(new Set((attendanceRes.data || []).map((a: Record<string, unknown>) => String(a.person_id))));
    const { data: attendanceMembers } = memberIds.length > 0
      ? await supabase.from('members').select('id, full_name').in('id', memberIds)
      : { data: [] };
    const memberNameMap: Record<string, string> = {};
    (attendanceMembers || []).forEach((m: Record<string, unknown>) => {
      memberNameMap[String(m.id)] = String(m.full_name || 'Unknown');
    });

    const liveAttendance: AttendanceRow[] = (attendanceRes.data || []).map((a: Record<string, unknown>) => ({
      member_name: memberNameMap[String(a.person_id)] || 'Unknown',
      date: String(a.date || ''),
      status: Boolean(a.is_present) ? 'present' : 'absent',
    }));

    const liveFollowUps: FollowUpRow[] = (followUpRes.data || []).map((f: Record<string, unknown>) => ({
      member_name: String((f.member as { full_name?: string } | null)?.full_name || 'Unknown'),
      shepherd_name: String((f.shepherd as { full_name?: string } | null)?.full_name || 'Unknown'),
      type: String(f.type || ''),
      status: String(f.status || ''),
      date: String(f.date || ''),
      notes: String(f.notes || ''),
    }));

    const [allMembersRes, allAttendanceRes] = await Promise.all([
      supabase.from('members').select('status', { count: 'exact' }).eq('branch_id', branchId),
      supabase
        .from('attendance')
        .select('is_present')
        .eq('branch_id', branchId)
        .eq('person_type', 'member')
        .gte('date', dateRange.from)
        .lte('date', dateRange.to),
    ]);

    const allMembers = allMembersRes.data || [];
    const totalAttendance = (allAttendanceRes.data || []).filter((a: Record<string, unknown>) => Boolean(a.is_present)).length;
    const totalAttendanceRows = (allAttendanceRes.data || []).length;

    setMembersRows(liveMembers);
    setAttendanceRows(liveAttendance);
    setFollowUpRows(liveFollowUps);
    setSummary({
      totalMembers: allMembersRes.count || 0,
      activeMembers: allMembers.filter((m: Record<string, unknown>) => m.status === 'active').length,
      inactiveMembers: allMembers.filter((m: Record<string, unknown>) => m.status === 'inactive').length,
      attendanceRate: totalAttendanceRows > 0 ? Math.round((totalAttendance / totalAttendanceRows) * 100) : 0,
      totalFollowUps: liveFollowUps.length,
    });

    setLoadingData(false);
  }

  const demoSummary = useMemo(() => {
    const totalMembers = DEMO_MEMBERS.length;
    const active = DEMO_MEMBERS.filter((m) => m.status === 'active').length;
    const inactive = DEMO_MEMBERS.filter((m) => m.status === 'inactive').length;
    const totalAttendance = DEMO_ATTENDANCE.filter((a) => a.status === 'present').length;
    const totalRecords = DEMO_ATTENDANCE.length;
    const attendanceRate = totalRecords > 0 ? Math.round((totalAttendance / totalRecords) * 100) : 0;

    return {
      totalMembers,
      active,
      inactive,
      attendanceRate,
      totalFollowUps: DEMO_FOLLOWUPS.length,
    };
  }, []);

  const csvRows = {
    members: isDemo ? DEMO_MEMBERS.map((m) => ({
      full_name: m.full_name,
      phone_number: m.phone_number,
      status: m.status,
      bacenta: m.bacenta,
      date_joined: m.date_joined || '',
      birthday: m.birthday,
    })) : membersRows,
    attendance: isDemo ? DEMO_ATTENDANCE.map((a) => ({
      member_name: DEMO_MEMBERS.find((m) => m.id === a.member_id)?.full_name || 'Unknown',
      date: a.date,
      status: a.status,
    })) : attendanceRows,
    followUps: isDemo ? DEMO_FOLLOWUPS.map((f) => ({
      member_name: f.member_name,
      shepherd_name: f.shepherd_name,
      type: f.type,
      status: f.status,
      date: f.date,
      notes: f.notes,
    })) : followUpRows,
    summary: isDemo
      ? {
          totalMembers: demoSummary.totalMembers,
          activeMembers: demoSummary.active,
          inactiveMembers: demoSummary.inactive,
          attendanceRate: demoSummary.attendanceRate,
          totalFollowUps: demoSummary.totalFollowUps,
        }
      : summary,
  };

  const generateCSV = () => {
    setGenerating(true);

    let csvContent = '';
    let filename = '';

    switch (reportType) {
      case 'members': {
        csvContent = 'Name,Phone,Status,Bacenta,Date Joined,Birthday\n';
        csvRows.members.forEach((m) => {
          csvContent += `"${m.full_name}","${m.phone_number}","${m.status}","${m.bacenta}","${m.date_joined || ''}","${m.birthday || ''}"\n`;
        });
        filename = 'members-report.csv';
        break;
      }
      case 'attendance': {
        csvContent = 'Member,Date,Status\n';
        csvRows.attendance.forEach((a) => {
          csvContent += `"${a.member_name}","${a.date}","${a.status}"\n`;
        });
        filename = 'attendance-report.csv';
        break;
      }
      case 'follow_ups': {
        csvContent = 'Member,Shepherd,Type,Status,Date,Notes\n';
        csvRows.followUps.forEach((f) => {
          csvContent += `"${f.member_name}","${f.shepherd_name}","${f.type}","${f.status}","${f.date}","${f.notes}"\n`;
        });
        filename = 'followups-report.csv';
        break;
      }
      case 'summary': {
        csvContent = 'Metric,Value\n';
        csvContent += `"Total Members","${csvRows.summary.totalMembers}"\n`;
        csvContent += `"Active Members","${csvRows.summary.activeMembers}"\n`;
        csvContent += `"Inactive Members","${csvRows.summary.inactiveMembers}"\n`;
        csvContent += `"Attendance Rate","${csvRows.summary.attendanceRate}%"\n`;
        csvContent += `"Total Follow-ups","${csvRows.summary.totalFollowUps}"\n`;
        csvContent += `"Report Period","${dateRange.from} to ${dateRange.to}"\n`;
        filename = 'summary-report.csv';
        break;
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    setTimeout(() => setGenerating(false), 800);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black flex items-center gap-2">
          <FileText className="text-orange-500" size={26} />
          Reports & Export
        </h1>
        <p className="text-gray-500 mt-1">
          Generate and download {isDemo ? 'demo' : 'branch-specific'} church reports
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'summary', label: 'Summary', icon: TrendingUp, desc: 'Overall branch metrics' },
          { key: 'members', label: 'Members', icon: Users, desc: 'Branch member list' },
          { key: 'attendance', label: 'Attendance', icon: Calendar, desc: 'Branch attendance records' },
          { key: 'follow_ups', label: 'Follow-ups', icon: Filter, desc: 'Branch outreach activity' },
        ] as const).map((item) => (
          <button
            key={item.key}
            onClick={() => setReportType(item.key)}
            className={`p-4 rounded-xl border text-left transition ${
              reportType === item.key
                ? 'border-orange-500 bg-orange-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-orange-300'
            }`}
          >
            <item.icon size={20} className={reportType === item.key ? 'text-orange-500' : 'text-gray-400'} />
            <p className="font-medium text-black text-sm mt-2">{item.label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h3 className="font-semibold text-black mb-3 text-sm">Report Period</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-black text-sm">Preview</h3>
          {!isDemo && loadingData && <p className="text-xs text-gray-400">Refreshing...</p>}
        </div>
        <ReportPreview
          type={reportType}
          members={csvRows.members}
          attendance={csvRows.attendance}
          followUps={csvRows.followUps}
          summary={csvRows.summary}
        />
      </div>

      <button
        onClick={generateCSV}
        disabled={generating || (!isDemo && !profile?.branch_id)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-xl hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50"
      >
        {generating ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Download size={20} />
        )}
        {generating ? 'Generating...' : `Download ${reportType.replace('_', ' ')} report (CSV)`}
      </button>
    </div>
  );
}

function ReportPreview({
  type,
  members,
  attendance,
  followUps,
  summary,
}: {
  type: ReportType;
  members: MembersRow[];
  attendance: AttendanceRow[];
  followUps: FollowUpRow[];
  summary: SummaryStats;
}) {
  switch (type) {
    case 'summary':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-lg font-bold">{summary.totalMembers}</p><p className="text-[10px] text-gray-500">Members</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-lg font-bold text-green-600">{summary.activeMembers}</p><p className="text-[10px] text-gray-500">Active</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-lg font-bold text-orange-500">{summary.attendanceRate}%</p><p className="text-[10px] text-gray-500">Att. Rate</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-lg font-bold text-blue-500">{summary.totalFollowUps}</p><p className="text-[10px] text-gray-500">Follow-ups</p></div>
        </div>
      );

    case 'members':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-1">Name</th><th className="pb-1">Status</th><th className="pb-1">Phone</th></tr></thead>
            <tbody>
              {members.slice(0, 4).map((m, idx) => (
                <tr key={`${m.full_name}-${idx}`} className="border-b border-gray-50"><td className="py-1 font-medium text-black">{m.full_name}</td><td className="py-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span></td><td className="py-1 text-gray-500">{m.phone_number}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-2">Showing {Math.min(4, members.length)} of {members.length} records...</p>
        </div>
      );

    case 'attendance':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-1">Member</th><th className="pb-1">Date</th><th className="pb-1">Status</th></tr></thead>
            <tbody>
              {attendance.slice(0, 4).map((a, idx) => (
                <tr key={`${a.member_name}-${a.date}-${idx}`} className="border-b border-gray-50"><td className="py-1 font-medium text-black">{a.member_name}</td><td className="py-1 text-gray-500">{a.date}</td><td className="py-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${a.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.status}</span></td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-2">Showing {Math.min(4, attendance.length)} of {attendance.length} records...</p>
        </div>
      );

    case 'follow_ups':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-1">Member</th><th className="pb-1">Type</th><th className="pb-1">Status</th><th className="pb-1">Date</th></tr></thead>
            <tbody>
              {followUps.slice(0, 4).map((f, idx) => (
                <tr key={`${f.member_name}-${f.date}-${idx}`} className="border-b border-gray-50"><td className="py-1 font-medium text-black">{f.member_name}</td><td className="py-1 text-gray-500">{f.type}</td><td className="py-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${f.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{f.status}</span></td><td className="py-1 text-gray-500">{f.date}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-2">Showing {Math.min(4, followUps.length)} of {followUps.length} records...</p>
        </div>
      );
  }
}
