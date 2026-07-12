'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Member, MemberStatus, Bacenta, FirstTimer, NewBeliever } from '@/lib/types';
import { DEMO_MEMBERS, DEMO_FIRST_TIMERS, DEMO_NEW_BELIEVERS, DEMO_USERS } from '@/lib/demo-data';
import { Search, Users, Plus, X, Lock, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import BacentaSelect from '@/components/BacentaSelect';

interface CombinedMember {
  id: string;
  full_name: string;
  phone_number: string;
  address: string;
  bacenta: string;
  shepherd_name?: string;
  date_joined: string;
  member_type: 'Regular Member' | 'First Timer' | 'New Believer';
  status: string;
  photo_url: string | null;
  who_brought: string;
  assigned_shepherd?: string | null;
  branch_id: string;
}

export default function MembersPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [allIndividuals, setAllIndividuals] = useState<CombinedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bacentaFilter, setBacentaFilter] = useState<string>('all');
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        // Load demo data
        const namesMap: Record<string, string> = {};
        Object.entries(DEMO_USERS).forEach(([id, user]) => {
          namesMap[id] = user.name;
        });

        const listMembers: CombinedMember[] = DEMO_MEMBERS.map(m => ({
          ...m,
          member_type: 'Regular Member' as const,
          shepherd_name: m.assigned_shepherd ? namesMap[m.assigned_shepherd] || 'Unknown' : undefined
        }));

        const listFirstTimers: CombinedMember[] = DEMO_FIRST_TIMERS.filter(ft => ft.status === 'first_timer').map(ft => ({
          id: ft.id,
          full_name: ft.full_name,
          phone_number: ft.phone_number,
          address: ft.address,
          bacenta: ft.bacenta,
          shepherd_name: ft.assigned_shepherd ? namesMap[ft.assigned_shepherd] || 'Unknown' : undefined,
          date_joined: ft.date_joined,
          member_type: 'First Timer' as const,
          status: 'active',
          photo_url: ft.photo_url,
          who_brought: ft.who_brought,
          assigned_shepherd: ft.assigned_shepherd,
          branch_id: ft.branch_id
        }));

        const listNewBelievers: CombinedMember[] = DEMO_NEW_BELIEVERS.map(nb => ({
          id: nb.id,
          full_name: nb.full_name,
          phone_number: nb.phone_number,
          address: nb.address,
          bacenta: nb.bacenta,
          shepherd_name: nb.recorded_by ? namesMap[nb.recorded_by] || 'Unknown' : undefined,
          date_joined: nb.date_saved,
          member_type: 'New Believer' as const,
          status: 'active',
          photo_url: nb.photo_url,
          who_brought: nb.who_brought,
          assigned_shepherd: nb.recorded_by,
          branch_id: nb.branch_id
        }));

        const combined = [...listMembers, ...listFirstTimers, ...listNewBelievers];

        if (profile.role === 'shepherd') {
          const bacentaNames = (profile.bacentas || []).map((b) => b.name).filter(Boolean);
          setAllIndividuals(combined.filter(m =>
            m.assigned_shepherd === profile.id || bacentaNames.includes(m.bacenta)
          ));
        } else {
          setAllIndividuals(combined);
        }
        setLoading(false);
      } else {
        fetchIndividuals();
      }
    }
  }, [profile, isDemo]);

  async function fetchIndividuals() {
    if (profile!.role === 'super_admin' || profile!.role === 'bishop' || profile!.role === 'shepherd') {
      const [membersRes, ftRes, nbRes, profilesRes] = await Promise.all([
        supabase.from('members').select('*').eq('branch_id', profile!.branch_id),
        supabase.from('first_timers').select('*').eq('branch_id', profile!.branch_id).eq('status', 'first_timer'),
        supabase.from('new_believers').select('*').eq('branch_id', profile!.branch_id),
        supabase.from('profiles').select('id, full_name').eq('branch_id', profile!.branch_id)
      ]);

      const namesMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => {
        namesMap[p.id] = p.full_name;
      });

      const listMembers: CombinedMember[] = (membersRes.data || []).map((m: any) => ({
        ...m,
        member_type: 'Regular Member' as const,
        shepherd_name: m.assigned_shepherd ? namesMap[m.assigned_shepherd] || 'Unknown' : undefined
      }));

      const listFirstTimers: CombinedMember[] = (ftRes.data || []).map((ft: any) => ({
        id: ft.id,
        full_name: ft.full_name,
        phone_number: ft.phone_number,
        address: ft.address,
        bacenta: ft.bacenta,
        shepherd_name: ft.assigned_shepherd ? namesMap[ft.assigned_shepherd] || 'Unknown' : undefined,
        date_joined: ft.date_joined,
        member_type: 'First Timer' as const,
        status: 'active',
        photo_url: ft.photo_url,
        who_brought: ft.who_brought,
        assigned_shepherd: ft.assigned_shepherd,
        branch_id: ft.branch_id
      }));

      const listNewBelievers: CombinedMember[] = (nbRes.data || []).map((nb: any) => ({
        id: nb.id,
        full_name: nb.full_name,
        phone_number: nb.phone_number,
        address: nb.address,
        bacenta: nb.bacenta,
        shepherd_name: nb.recorded_by ? namesMap[nb.recorded_by] || 'Unknown' : undefined,
        date_joined: nb.date_saved,
        member_type: 'New Believer' as const,
        status: 'active',
        photo_url: nb.photo_url,
        who_brought: nb.who_brought,
        assigned_shepherd: nb.recorded_by,
        branch_id: nb.branch_id
      }));

      const combined = [...listMembers, ...listFirstTimers, ...listNewBelievers];

      if (profile!.role === 'shepherd') {
        const bacentaNames = (profile!.bacentas || []).map((b) => b.name).filter(Boolean);
        const flock = combined.filter((m) =>
          m.assigned_shepherd === profile!.id || bacentaNames.includes(m.bacenta)
        );
        setAllIndividuals(flock);
      } else {
        setAllIndividuals(combined);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!profile) return;
    if (isDemo) return;
    supabase.from('bacentas').select('*').eq('branch_id', profile.branch_id).order('name')
      .then(({ data }: { data: any }) => {
        setBacentas(data || []);
      });
  }, [profile, isDemo]);

  const filtered = allIndividuals.filter((m) => {
    const matchesSearch =
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.bacenta.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesBacenta = bacentaFilter === 'all' || m.bacenta === bacentaFilter;
    return matchesSearch && matchesStatus && matchesBacenta;
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    flagged: 'bg-red-100 text-red-700',
  };

  const typeColors: Record<string, string> = {
    'Regular Member': 'bg-blue-100 text-blue-800',
    'First Timer': 'bg-purple-100 text-purple-800',
    'New Believer': 'bg-orange-100 text-orange-800',
  };

  const allBacentasOptions = useMemo(() => {
    if (isDemo) {
      const bNames = Array.from(new Set(allIndividuals.map(x => x.bacenta).filter(Boolean)));
      return bNames.map(name => ({ id: name, name }));
    }
    return bacentas;
  }, [bacentas, allIndividuals, isDemo]);

  if (profile?.role === 'recorder') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Lock size={28} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Access Restricted</h2>
        <p className="text-sm text-gray-500">Members are managed by Shepherds and Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">
            {profile?.role === 'shepherd' ? 'My Sheep Fold (All)' : 'All Individuals'}
          </h1>
          <p className="text-gray-500 mt-1">
            {profile?.role === 'shepherd' ? 'All sheep under your care' : 'Every individual in the platform (New Believers, First Timers, Regular Members)'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-gray-400" />
            <span className="text-sm text-gray-500">{filtered.length} total</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name or bacenta..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" />
        </div>
        <div className="sm:w-52">
          <BacentaSelect
            value={bacentaFilter}
            onChange={(val) => { setBacentaFilter(val); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'All Bacentas' },
              ...allBacentasOptions.map(b => ({ value: b.name, label: b.name }))
            ]}
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black w-full"
            placeholder="All Bacentas"
          />
        </div>
        <div className="sm:w-52">
          <BacentaSelect
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'flagged', label: 'Flagged' },
            ]}
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black w-full"
            placeholder="All Status"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {paginatedData.map((member) => (
              <div key={member.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <Link href={`/dashboard/profile/${member.member_type === 'Regular Member' ? 'member' : member.member_type === 'First Timer' ? 'first-timer' : 'new-believer'}/${member.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 overflow-hidden">
                      {member.photo_url ? (
                        <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-xs font-bold">
                          {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-black truncate">{member.full_name}</p>
                      <p className="text-xs text-gray-500">
                        {member.bacenta} &middot; {new Date(member.date_joined).toLocaleDateString()}
                        {member.shepherd_name && (
                          <span className="text-blue-600"> &middot; 🐑 {member.shepherd_name}</span>
                        )}
                      </p>
                      <div className="mt-1 flex gap-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${typeColors[member.member_type]}`}>
                          {member.member_type}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${statusColors[member.status] || 'bg-gray-100 text-gray-700'}`}>
                      {member.status}
                    </span>
                  </Link>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {search ? 'No results found' : 'No entries yet'}
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Person</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Phone</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Address</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Bacenta</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Shepherd / Leader</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Date Joined / Saved</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedData.map((member) => (
                    <tr key={member.id} className="hover:bg-orange-50/50 transition">
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/profile/${member.member_type === 'Regular Member' ? 'member' : member.member_type === 'First Timer' ? 'first-timer' : 'new-believer'}/${member.id}`} className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 overflow-hidden">
                            {member.photo_url ? (
                              <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white text-xs font-bold">
                                {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-black hover:text-orange-600 block">{member.full_name}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{member.phone_number || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm max-w-45 truncate" title={member.address}>{member.address || 'N/A'}</td>
                      <td className="px-6 py-4 text-gray-600">{member.bacenta || 'Unassigned'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-700 bg-blue-50">
                          🐑 {member.shepherd_name || 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{new Date(member.date_joined).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded text-xs font-medium capitalize ${typeColors[member.member_type]}`}>
                          {member.member_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColors[member.status] || 'bg-gray-100 text-gray-700'}`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/profile/${member.member_type === 'Regular Member' ? 'member' : member.member_type === 'First Timer' ? 'first-timer' : 'new-believer'}/${member.id}`} className="text-orange-600 hover:text-orange-800 text-xs font-semibold">
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-gray-400">
                        {search ? 'No results found' : 'No individuals found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border border-gray-100 rounded-xl bg-gray-50/50 mt-4 bg-white shadow-sm">
              <div className="text-sm text-gray-500">
                Showing <span className="font-semibold text-black">{Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}</span> to{' '}
                <span className="font-semibold text-black">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of{' '}
                <span className="font-semibold text-black">{filtered.length}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                        currentPage === page
                          ? 'bg-orange-500 text-white'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
