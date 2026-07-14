'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Member, MemberStatus, Bacenta, FirstTimer, NewBeliever } from '@/lib/types';
import { DEMO_MEMBERS, DEMO_FIRST_TIMERS, DEMO_NEW_BELIEVERS, DEMO_USERS } from '@/lib/demo-data';
import { Search, Users, Plus, X, Lock, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import BacentaSelect from '@/components/BacentaSelect';
import Pagination from '@/components/Pagination';

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
  birthday?: string | null;
}

// Same person can exist in members + first_timers/new_believers (e.g. added as
// member marked "first timer", or auto-promoted). Keep the Regular Member row
// and drop duplicates matched by name/phone across the other lists.
function dedupeIndividuals(list: CombinedMember[]): CombinedMember[] {
  const priority: Record<string, number> = { 'Regular Member': 0, 'First Timer': 1, 'New Believer': 2 };
  const sorted = [...list].sort((a, b) => priority[a.member_type] - priority[b.member_type]);
  const seenNames = new Set<string>();
  const seenPhones = new Set<string>();
  const result: CombinedMember[] = [];
  for (const person of sorted) {
    const name = person.full_name.toLowerCase().trim();
    const phone = person.phone_number?.replace(/\D/g, '') || '';
    if (seenNames.has(name) || (phone && seenPhones.has(phone))) continue;
    seenNames.add(name);
    if (phone) seenPhones.add(phone);
    result.push(person);
  }
  return result;
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
  const [editTarget, setEditTarget] = useState<CombinedMember | null>(null);

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
      const [membersRes, ftRes, nbRes, profilesRes, shepherdBacentasRes, bacentasRes] = await Promise.all([
        supabase.from('members').select('*').eq('branch_id', profile!.branch_id),
        supabase.from('first_timers').select('*').eq('branch_id', profile!.branch_id).eq('status', 'first_timer'),
        supabase.from('new_believers').select('*').eq('branch_id', profile!.branch_id),
        supabase.from('profiles').select('id, full_name').eq('branch_id', profile!.branch_id),
        supabase.from('shepherd_bacentas').select('shepherd:profiles(full_name), bacenta:bacentas(name)').eq('branch_id', profile!.branch_id),
        supabase.from('bacentas').select('name, leader_name').eq('branch_id', profile!.branch_id)
      ]);

      const namesMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => {
        namesMap[p.id] = p.full_name;
      });

      // Bacenta name -> shepherd/leader name. A person in a bacenta inherits its
      // shepherd even without a direct assigned_shepherd value.
      const bacentaShepherdMap: Record<string, string> = {};
      (bacentasRes.data || []).forEach((b: any) => {
        if (b.leader_name) bacentaShepherdMap[b.name] = b.leader_name;
      });
      (shepherdBacentasRes.data || []).forEach((row: any) => {
        if (row.bacenta?.name && row.shepherd?.full_name) {
          bacentaShepherdMap[row.bacenta.name] = row.shepherd.full_name;
        }
      });

      const resolveShepherdName = (assignedShepherd: string | null, bacenta: string) =>
        (assignedShepherd ? namesMap[assignedShepherd] : undefined) || bacentaShepherdMap[bacenta] || undefined;

      const listMembers: CombinedMember[] = (membersRes.data || []).map((m: any) => ({
        ...m,
        member_type: 'Regular Member' as const,
        shepherd_name: resolveShepherdName(m.assigned_shepherd, m.bacenta)
      }));

      const listFirstTimers: CombinedMember[] = (ftRes.data || []).map((ft: any) => ({
        id: ft.id,
        full_name: ft.full_name,
        phone_number: ft.phone_number,
        address: ft.address,
        bacenta: ft.bacenta,
        shepherd_name: resolveShepherdName(ft.assigned_shepherd, ft.bacenta),
        date_joined: ft.date_joined,
        member_type: 'First Timer' as const,
        status: 'active',
        photo_url: ft.photo_url,
        who_brought: ft.who_brought,
        assigned_shepherd: ft.assigned_shepherd,
        branch_id: ft.branch_id,
        birthday: ft.birthday
      }));

      const listNewBelievers: CombinedMember[] = (nbRes.data || []).map((nb: any) => ({
        id: nb.id,
        full_name: nb.full_name,
        phone_number: nb.phone_number,
        address: nb.address,
        bacenta: nb.bacenta,
        shepherd_name: resolveShepherdName(nb.recorded_by, nb.bacenta),
        date_joined: nb.date_saved,
        member_type: 'New Believer' as const,
        status: 'active',
        photo_url: nb.photo_url,
        who_brought: nb.who_brought,
        assigned_shepherd: nb.recorded_by,
        branch_id: nb.branch_id,
        birthday: nb.birthday
      }));

      const combined = dedupeIndividuals([...listMembers, ...listFirstTimers, ...listNewBelievers]);

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
                  <button
                    onClick={() => setEditTarget(member)}
                    className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition shrink-0 ml-1"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
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
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/profile/${member.member_type === 'Regular Member' ? 'member' : member.member_type === 'First Timer' ? 'first-timer' : 'new-believer'}/${member.id}`} className="text-orange-600 hover:text-orange-800 text-xs font-semibold">
                            View Details
                          </Link>
                          <button
                            onClick={() => setEditTarget(member)}
                            className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                        </div>
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
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Edit Individual Modal */}
      {editTarget && (
        <EditIndividualModal
          person={editTarget}
          bacentas={allBacentasOptions.map((b) => b.name)}
          isDemo={isDemo}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setEditTarget(null);
            if (isDemo) {
              setAllIndividuals((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
            } else {
              fetchIndividuals();
            }
          }}
        />
      )}
    </div>
  );
}

function EditIndividualModal({
  person, bacentas, isDemo, onClose, onSaved,
}: {
  person: CombinedMember;
  bacentas: string[];
  isDemo: boolean;
  onClose: () => void;
  onSaved: (updated: CombinedMember) => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: person.full_name,
    phone_number: person.phone_number || '',
    address: person.address || '',
    bacenta: person.bacenta || '',
    who_brought: person.who_brought || '',
    birthday: person.birthday || '',
  });

  const tableForType: Record<CombinedMember['member_type'], string> = {
    'Regular Member': 'members',
    'First Timer': 'first_timers',
    'New Believer': 'new_believers',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (!isDemo) {
      const { error: err } = await supabase
        .from(tableForType[person.member_type])
        .update({
          full_name: form.full_name,
          phone_number: form.phone_number,
          address: form.address,
          bacenta: form.bacenta || 'Unassigned',
          who_brought: form.who_brought,
          birthday: form.birthday || null,
        })
        .eq('id', person.id);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
    }
    onSaved({ ...person, ...form, birthday: form.birthday || null });
  }

  const inputCls = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-black">Edit {person.member_type}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{person.full_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bacenta</label>
            <BacentaSelect
              value={form.bacenta}
              onChange={(value) => setForm({ ...form, bacenta: value })}
              options={[
                { value: '', label: 'Unassigned' },
                ...bacentas.map((name) => ({ value: name, label: name })),
              ]}
              className={`${inputCls} bg-white`}
              placeholder="Select a bacenta..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
            <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Who Brought Them</label>
            <input type="text" value={form.who_brought} onChange={(e) => setForm({ ...form, who_brought: e.target.value })} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
