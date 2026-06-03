'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Branch } from '@/lib/types';
import { DEMO_BRANCHES, DEMO_BRANCH_STATS } from '@/lib/demo-data';
import { Building2, Users, UserPlus, TrendingUp, Award, BarChart3 } from 'lucide-react';

type BranchStat = {
  pastor: string;
  members: number;
  newBelievers: number;
  firstTimers: number;
  attendance: number;
  shepherds: number;
};

export default function BranchesPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<Record<string, BranchStat>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setBranches(DEMO_BRANCHES);
        setStats(DEMO_BRANCH_STATS);
        setLoading(false);
      } else {
        fetchBranches();
      }
    }
  }, [profile, isDemo]);

  async function fetchBranches() {
    const { data: branchData } = await supabase.from('branches').select('*').order('name');
    const branchList: Branch[] = branchData || [];
    setBranches(branchList);

    const branchStats: Record<string, BranchStat> = {};
    for (const b of branchList) {
      const [mRes, nbRes, ftRes, shRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('branch_id', b.id),
        supabase.from('new_believers').select('id', { count: 'exact', head: true }).eq('branch_id', b.id),
        supabase.from('first_timers').select('id', { count: 'exact', head: true }).eq('branch_id', b.id).eq('status', 'first_timer'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('branch_id', b.id).eq('role', 'shepherd'),
      ]);
      branchStats[b.id] = {
        pastor: 'Pastor',
        members: mRes.count || 0,
        newBelievers: nbRes.count || 0,
        firstTimers: ftRes.count || 0,
        attendance: 75,
        shepherds: shRes.count || 0,
      };
    }
    setStats(branchStats);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Aggregate stats
  const totalMembers = Object.values(stats).reduce((s, b) => s + b.members, 0);
  const totalNewBelievers = Object.values(stats).reduce((s, b) => s + b.newBelievers, 0);
  const avgAttendance = branches.length > 0
    ? Math.round(Object.values(stats).reduce((s, b) => s + b.attendance, 0) / branches.length)
    : 0;
  const totalShepherds = Object.values(stats).reduce((s, b) => s + b.shepherds, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black flex items-center gap-2">
          <Building2 className="text-orange-500" size={26} />
          Multi-Branch Overview
        </h1>
        <p className="text-gray-500 mt-1">Bishop&apos;s view across all branches</p>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <Users size={20} className="mx-auto text-blue-500 mb-1" />
          <p className="text-xl font-bold text-black">{totalMembers}</p>
          <p className="text-[10px] text-gray-500">Total Members</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <UserPlus size={20} className="mx-auto text-green-500 mb-1" />
          <p className="text-xl font-bold text-black">{totalNewBelievers}</p>
          <p className="text-[10px] text-gray-500">New Believers</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <TrendingUp size={20} className="mx-auto text-orange-500 mb-1" />
          <p className="text-xl font-bold text-black">{avgAttendance}%</p>
          <p className="text-[10px] text-gray-500">Avg Attendance</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <Award size={20} className="mx-auto text-purple-500 mb-1" />
          <p className="text-xl font-bold text-black">{totalShepherds}</p>
          <p className="text-[10px] text-gray-500">Total Shepherds</p>
        </div>
      </div>

      {/* Branch Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map(branch => {
          const s = stats[branch.id];
          if (!s) return null;
          return (
            <div key={branch.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-orange-200 transition">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-black">{branch.name}</h3>
                  <p className="text-xs text-gray-500">{branch.location}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                  <Building2 size={18} className="text-white" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">Pastor: <span className="font-medium text-black">{s.pastor}</span></p>

              {/* Branch metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-sm font-bold text-black">{s.members}</p>
                  <p className="text-[9px] text-gray-500">Members</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-sm font-bold text-green-600">{s.newBelievers}</p>
                  <p className="text-[9px] text-gray-500">New Believers</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-sm font-bold text-blue-600">{s.firstTimers}</p>
                  <p className="text-[9px] text-gray-500">First Timers</p>
                </div>
              </div>

              {/* Attendance bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">Attendance</span>
                  <span className="font-semibold text-black">{s.attendance}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500"
                    style={{ width: `${s.attendance}%` }}
                  />
                </div>
              </div>

              {/* Shepherds */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">{s.shepherds} Shepherds active</span>
                <BarChart3 size={14} className="text-gray-400" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 overflow-x-auto">
        <h3 className="font-semibold text-black mb-4">Branch Comparison</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">Branch</th>
              <th className="pb-2 font-medium text-center">Members</th>
              <th className="pb-2 font-medium text-center">New Believers</th>
              <th className="pb-2 font-medium text-center">First Timers</th>
              <th className="pb-2 font-medium text-center">Attendance</th>
              <th className="pb-2 font-medium text-center">Shepherds</th>
            </tr>
          </thead>
          <tbody>
            {branches.map(branch => {
              const s = stats[branch.id];
              if (!s) return null;
              return (
                <tr key={branch.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2 font-medium text-black">{branch.name}</td>
                  <td className="py-2 text-center">{s.members}</td>
                  <td className="py-2 text-center text-green-600">{s.newBelievers}</td>
                  <td className="py-2 text-center text-blue-600">{s.firstTimers}</td>
                  <td className="py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      s.attendance >= 75 ? 'bg-green-100 text-green-700' : s.attendance >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {s.attendance}%
                    </span>
                  </td>
                  <td className="py-2 text-center">{s.shepherds}</td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="font-bold border-t-2 border-gray-200">
              <td className="py-2 text-black">TOTAL</td>
              <td className="py-2 text-center">{totalMembers}</td>
              <td className="py-2 text-center text-green-600">{totalNewBelievers}</td>
              <td className="py-2 text-center text-blue-600">{Object.values(stats).reduce((s, b) => s + b.firstTimers, 0)}</td>
              <td className="py-2 text-center">
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">{avgAttendance}%</span>
              </td>
              <td className="py-2 text-center">{totalShepherds}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
