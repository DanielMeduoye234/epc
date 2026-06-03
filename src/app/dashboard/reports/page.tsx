'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { DEMO_MEMBERS, DEMO_ATTENDANCE, DEMO_FOLLOWUPS } from '@/lib/demo-data';
import { FileText, Download, Calendar, Users, TrendingUp, Filter } from 'lucide-react';

type ReportType = 'attendance' | 'members' | 'follow_ups' | 'summary';

export default function ReportsPage() {
  const { profile, isDemo } = useAuth();
  const [reportType, setReportType] = useState<ReportType>('summary');
  const [dateRange, setDateRange] = useState({ from: '2026-05-01', to: '2026-05-23' });
  const [generating, setGenerating] = useState(false);

  const generateCSV = () => {
    if (!isDemo) return;
    setGenerating(true);

    let csvContent = '';
    let filename = '';

    switch (reportType) {
      case 'members': {
        csvContent = 'Name,Phone,Status,Bacenta,Date Joined,Birthday\n';
        DEMO_MEMBERS.forEach(m => {
          csvContent += `"${m.full_name}","${m.phone_number}","${m.status}","${m.bacenta}","${m.date_joined || ''}","${m.birthday || ''}"\n`;
        });
        filename = 'members-report.csv';
        break;
      }
      case 'attendance': {
        csvContent = 'Member,Date,Status\n';
        DEMO_ATTENDANCE.forEach(a => {
          const member = DEMO_MEMBERS.find(m => m.id === a.member_id);
          csvContent += `"${member?.full_name || 'Unknown'}","${a.date}","${a.status}"\n`;
        });
        filename = 'attendance-report.csv';
        break;
      }
      case 'follow_ups': {
        csvContent = 'Member,Shepherd,Type,Status,Date,Notes\n';
        DEMO_FOLLOWUPS.forEach(f => {
          csvContent += `"${f.member_name}","${f.shepherd_name}","${f.type}","${f.status}","${f.date}","${f.notes}"\n`;
        });
        filename = 'followups-report.csv';
        break;
      }
      case 'summary': {
        const totalMembers = DEMO_MEMBERS.length;
        const active = DEMO_MEMBERS.filter(m => m.status === 'active').length;
        const inactive = DEMO_MEMBERS.filter(m => m.status === 'inactive').length;
        const totalAttendance = DEMO_ATTENDANCE.filter(a => a.status === 'present').length;
        const totalRecords = DEMO_ATTENDANCE.length;
        const attendanceRate = totalRecords > 0 ? Math.round((totalAttendance / totalRecords) * 100) : 0;

        csvContent = 'Metric,Value\n';
        csvContent += `"Total Members","${totalMembers}"\n`;
        csvContent += `"Active Members","${active}"\n`;
        csvContent += `"Inactive Members","${inactive}"\n`;
        csvContent += `"Attendance Rate","${attendanceRate}%"\n`;
        csvContent += `"Total Follow-ups","${DEMO_FOLLOWUPS.length}"\n`;
        csvContent += `"Report Period","${dateRange.from} to ${dateRange.to}"\n`;
        filename = 'summary-report.csv';
        break;
      }
    }

    // Download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    setTimeout(() => setGenerating(false), 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black flex items-center gap-2">
          <FileText className="text-orange-500" size={26} />
          Reports & Export
        </h1>
        <p className="text-gray-500 mt-1">Generate and download church reports</p>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'summary', label: 'Summary', icon: TrendingUp, desc: 'Overall church metrics' },
          { key: 'members', label: 'Members', icon: Users, desc: 'Full member list' },
          { key: 'attendance', label: 'Attendance', icon: Calendar, desc: 'Attendance records' },
          { key: 'follow_ups', label: 'Follow-ups', icon: Filter, desc: 'Outreach activity' },
        ] as const).map(item => (
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

      {/* Date Range */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h3 className="font-semibold text-black mb-3 text-sm">Report Period</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black text-sm"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h3 className="font-semibold text-black mb-3 text-sm">Preview</h3>
        <ReportPreview type={reportType} />
      </div>

      {/* Generate Button */}
      <button
        onClick={generateCSV}
        disabled={generating}
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

function ReportPreview({ type }: { type: ReportType }) {
  switch (type) {
    case 'summary': {
      const totalMembers = DEMO_MEMBERS.length;
      const active = DEMO_MEMBERS.filter(m => m.status === 'active').length;
      const totalAttendance = DEMO_ATTENDANCE.filter(a => a.status === 'present').length;
      const totalRecords = DEMO_ATTENDANCE.length;
      const rate = totalRecords > 0 ? Math.round((totalAttendance / totalRecords) * 100) : 0;
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-lg font-bold">{totalMembers}</p><p className="text-[10px] text-gray-500">Members</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-lg font-bold text-green-600">{active}</p><p className="text-[10px] text-gray-500">Active</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-lg font-bold text-orange-500">{rate}%</p><p className="text-[10px] text-gray-500">Att. Rate</p></div>
          <div className="p-3 bg-gray-50 rounded-lg"><p className="text-lg font-bold text-blue-500">{DEMO_FOLLOWUPS.length}</p><p className="text-[10px] text-gray-500">Follow-ups</p></div>
        </div>
      );
    }
    case 'members':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-1">Name</th><th className="pb-1">Status</th><th className="pb-1">Phone</th></tr></thead>
            <tbody>
              {DEMO_MEMBERS.slice(0, 4).map(m => (
                <tr key={m.id} className="border-b border-gray-50"><td className="py-1 font-medium text-black">{m.full_name}</td><td className="py-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.status}</span></td><td className="py-1 text-gray-500">{m.phone_number}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-2">Showing 4 of {DEMO_MEMBERS.length} records...</p>
        </div>
      );
    case 'attendance':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-1">Member</th><th className="pb-1">Date</th><th className="pb-1">Status</th></tr></thead>
            <tbody>
              {DEMO_ATTENDANCE.slice(0, 4).map((a, idx) => {
                const member = DEMO_MEMBERS.find(m => m.id === a.member_id);
                return (
                  <tr key={idx} className="border-b border-gray-50"><td className="py-1 font-medium text-black">{member?.full_name || '?'}</td><td className="py-1 text-gray-500">{a.date}</td><td className="py-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${a.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{a.status}</span></td></tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-2">Showing 4 of {DEMO_ATTENDANCE.length} records...</p>
        </div>
      );
    case 'follow_ups':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500 border-b"><th className="pb-1">Member</th><th className="pb-1">Type</th><th className="pb-1">Status</th><th className="pb-1">Date</th></tr></thead>
            <tbody>
              {DEMO_FOLLOWUPS.slice(0, 4).map(f => (
                <tr key={f.id} className="border-b border-gray-50"><td className="py-1 font-medium text-black">{f.member_name}</td><td className="py-1 text-gray-500">{f.type}</td><td className="py-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${f.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{f.status}</span></td><td className="py-1 text-gray-500">{f.date}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-2">Showing 4 of {DEMO_FOLLOWUPS.length} records...</p>
        </div>
      );
  }
}
