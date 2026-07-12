'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Member, MemberStatus, Bacenta } from '@/lib/types';
import { DEMO_MEMBERS, DEMO_USERS } from '@/lib/demo-data';
import { Search, Users, Plus, X, Lock, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import BacentaSelect from '@/components/BacentaSelect';

interface MemberWithShepherd extends Member {
  shepherd_name?: string;
}

export default function RegularMembersPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [members, setMembers] = useState<MemberWithShepherd[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState<MemberWithShepherd | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assigningBacentaId, setAssigningBacentaId] = useState<string | null>(null);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [addForm, setAddForm] = useState({
    full_name: '', phone_number: '', address: '', bacenta: '', who_brought: '',
  });
  const [adding, setAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        const withNames: MemberWithShepherd[] = DEMO_MEMBERS.map(m => ({
          ...m,
          shepherd_name: m.assigned_shepherd ? DEMO_USERS[m.assigned_shepherd]?.name || 'Unknown' : undefined,
        }));
        if (profile.role === 'shepherd') {
          const bacentaNames = (profile.bacentas || []).map((b) => b.name).filter(Boolean);
          setMembers(withNames.filter(m =>
            m.assigned_shepherd === profile.id || bacentaNames.includes(m.bacenta)
          ));
        } else {
          setMembers(withNames);
        }
        setLoading(false);
      } else {
        fetchMembers();
      }
    }
  }, [profile, isDemo]);

  async function fetchMembers() {
    if (profile!.role === 'super_admin' || profile!.role === 'bishop' || profile!.role === 'shepherd') {
      const { data } = await supabase
        .from('members')
        .select('*, shepherd:profiles!members_assigned_shepherd_fkey(full_name)')
        .eq('branch_id', profile!.branch_id)
        .order('created_at', { ascending: false });

      const membersWithNames: MemberWithShepherd[] = (data || []).map((m: Record<string, unknown>) => ({
        ...m,
        shepherd_name: (m.shepherd as { full_name: string } | null)?.full_name || undefined,
      })) as MemberWithShepherd[];

      if (profile!.role === 'shepherd') {
        const bacentaNames = (profile!.bacentas || []).map((b) => b.name).filter(Boolean);
        const flock = membersWithNames.filter((m) =>
          m.assigned_shepherd === profile!.id || bacentaNames.includes(m.bacenta)
        );
        setMembers(flock);
      } else {
        setMembers(membersWithNames);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!profile) return;
    if (isDemo) return;
    supabase.from('bacentas').select('*').eq('branch_id', profile.branch_id).order('name')
      .then(({ data }: { data: Bacenta[] | null }) => {
        setBacentas(data || []);
        const defaultBacenta = profile.bacentas?.[0]?.name || profile.bacenta?.name;
        if (profile.role === 'shepherd' && defaultBacenta) {
          setAddForm((prev) => ({ ...prev, bacenta: prev.bacenta || defaultBacenta }));
        }
      });
  }, [profile, isDemo]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.full_name || !addForm.phone_number) return;
    setAdding(true);

    if (isDemo) {
      const newMember: Member = {
        id: `m-${Date.now()}`, first_timer_id: null, full_name: addForm.full_name,
        first_name: null, last_name: null, nickname: null,
        phone_number: addForm.phone_number, address: addForm.address,
        bacenta: addForm.bacenta || profile!.bacentas?.[0]?.name || profile!.bacenta?.name || 'Unassigned', who_brought: addForm.who_brought,
        date_joined: new Date().toISOString().split('T')[0],
        membership_date: new Date().toISOString().split('T')[0],
        assigned_shepherd: profile!.role === 'shepherd' ? profile!.id : null, branch_id: profile!.branch_id,
        status: 'active', photo_url: null, created_at: new Date().toISOString(),
      };
      setMembers(prev => [newMember, ...prev]);
    } else {
      await supabase.from('members').insert({
        full_name: addForm.full_name, phone_number: addForm.phone_number,
        address: addForm.address, bacenta: addForm.bacenta || profile!.bacentas?.[0]?.name || profile!.bacenta?.name || 'Unassigned',
        who_brought: addForm.who_brought,
        date_joined: new Date().toISOString().split('T')[0],
        membership_date: new Date().toISOString().split('T')[0],
        assigned_shepherd: profile!.role === 'shepherd' ? profile!.id : null, branch_id: profile!.branch_id, status: 'active',
      });
      fetchMembers();
    }

    setAddForm({ full_name: '', phone_number: '', address: '', bacenta: profile!.role === 'shepherd' ? profile!.bacentas?.[0]?.name || profile!.bacenta?.name || '' : '', who_brought: '' });
    setShowAddModal(false);
    setAdding(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    if (!isDemo) {
      await supabase.from('members').delete().eq('id', deleteId);
    }
    setMembers(prev => prev.filter(m => m.id !== deleteId));
    setDeleteId(null);
  }

  async function handleInlineBacentaAssign(member: MemberWithShepherd, bacenta: string) {
    const nextBacenta = bacenta || 'Unassigned';
    if (member.bacenta === nextBacenta) {
      setAssigningBacentaId(null);
      return;
    }

    if (isDemo) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, bacenta: nextBacenta } : m)));
      setAssigningBacentaId(null);
      return;
    }

    const { error } = await supabase
      .from('members')
      .update({ bacenta: nextBacenta })
      .eq('id', member.id);

    if (!error) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, bacenta: nextBacenta } : m)));
      setAssigningBacentaId(null);
    }
  }

  const filtered = members.filter((m) => {
    const matchesSearch =
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.bacenta.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    flagged: 'bg-red-100 text-red-700',
  };

  const deletingMember = members.find(m => m.id === deleteId);

  const addMemberBacentas = useMemo(() => {
    if (profile?.role === 'shepherd') {
      return profile.bacentas && profile.bacentas.length > 0
        ? profile.bacentas
        : profile.bacenta ? [profile.bacenta] : [];
    }

    const map = new Map<string, Bacenta>();
    bacentas.forEach((b) => map.set(b.name, b));
    members.forEach((m) => {
      if (!map.has(m.bacenta)) {
        map.set(m.bacenta, {
          id: `fallback-${m.bacenta}`,
          name: m.bacenta,
          leader_name: null,
          location: null,
          branch_id: m.branch_id,
          created_at: new Date().toISOString(),
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [bacentas, members, profile]);

  if (profile?.role === 'recorder') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Lock size={28} className="text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Access Restricted</h2>
        <p className="text-sm text-gray-500">Regular members are managed by Shepherds and Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">
            {profile?.role === 'shepherd' ? 'My Regular Sheep' : 'Regular Members'}
          </h1>
          <p className="text-gray-500 mt-1">
            {profile?.role === 'shepherd' ? 'Manage and track your regular sheep fold' : 'All regular church members'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-gray-400" />
            <span className="text-sm text-gray-500">{filtered.length} members</span>
          </div>
          {(profile?.role === 'shepherd' || profile?.role === 'super_admin' || profile?.role === 'bishop') && (
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white text-sm font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition">
              <Plus size={16} /> {profile?.role === 'shepherd' ? 'Add Sheep' : 'Add Member'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name or bacenta..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" />
        </div>
        <div className="sm:w-56">
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
                  <Link href={`/dashboard/profile/member/${member.id}`} className="flex items-center gap-3 flex-1 min-w-0">
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
                        {member.bacenta} &middot; {new Date(member.membership_date).toLocaleDateString()}
                        {profile?.role === 'super_admin' && member.shepherd_name && (
                          <span className="text-blue-600"> &middot; 🐑 {member.shepherd_name}</span>
                        )}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${statusColors[member.status]}`}>
                      {member.status}
                    </span>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <button onClick={() => setEditMember(member)}
                      className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(member.id)}
                      className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {search ? 'No results found' : 'No members yet'}
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Member</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Phone</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Address</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Bacenta</th>
                    {(profile?.role === 'super_admin' || profile?.role === 'bishop') && (
                      <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Shepherd</th>
                    )}
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Date Joined</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedData.map((member) => (
                    <tr key={member.id} className="hover:bg-orange-50/50 transition">
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/profile/member/${member.id}`} className="flex items-center gap-3">
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
                            {member.nickname && <span className="text-xs text-gray-400">Known as: {member.nickname}</span>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-600 text-sm">{member.phone_number}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm max-w-45 truncate" title={member.address}>{member.address}</td>
                      <td className="px-6 py-4">
                        {assigningBacentaId === member.id ? (
                          <BacentaSelect
                            value={member.bacenta}
                            onChange={(val) => handleInlineBacentaAssign(member, val)}
                            options={[
                              { value: '', label: 'Unassigned' },
                              ...addMemberBacentas.map((b) => ({ value: b.name, label: b.name })),
                            ]}
                            className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                          />
                        ) : (
                          <button
                            onClick={() => setAssigningBacentaId(member.id)}
                            className="text-gray-600 hover:text-orange-600 border-b border-dashed border-gray-300 hover:border-orange-500 pb-0.5 text-sm"
                          >
                            {member.bacenta}
                          </button>
                        )}
                      </td>
                      {(profile?.role === 'super_admin' || profile?.role === 'bishop') && (
                        <td className="px-6 py-4">
                          <button
                            disabled
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                              member.assigned_shepherd
                                ? 'text-blue-700 bg-blue-50'
                                : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                            }`}
                          >
                            🐑 {member.shepherd_name || 'Unassigned'}
                          </button>
                        </td>
                      )}
                      <td className="px-6 py-4 text-gray-600">{new Date(member.membership_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColors[member.status]}`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditMember(member)}
                            className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteId(member.id)}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={(profile?.role === 'super_admin' || profile?.role === 'bishop') ? 8 : 7} className="text-center py-12 text-gray-400">
                        {search ? 'No results found' : 'No members yet'}
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

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-black">{profile?.role === 'shepherd' ? 'Add New Sheep' : 'Add New Member'}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-5 space-y-4">
              {(['full_name', 'phone_number', 'address', 'who_brought'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field === 'full_name' ? 'Full Name *' : field === 'phone_number' ? 'Phone Number *' : field === 'who_brought' ? 'Who Brought Them' : field.charAt(0).toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    type={field === 'phone_number' ? 'tel' : 'text'}
                    required={field === 'full_name' || field === 'phone_number'}
                    value={addForm[field]}
                    onChange={(e) => setAddForm(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
                    placeholder={field === 'full_name' ? 'e.g. John Akpan' : field === 'phone_number' ? '+234...' : ''}
                  />
                </div>
              ))}
              <BacentaSelect
                label="Bacenta"
                value={addForm.bacenta}
                onChange={(value) => setAddForm((prev) => ({ ...prev, bacenta: value }))}
                bacentas={addMemberBacentas}
                includeLeader
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
                placeholder="Select a bacenta..."
              />
              <button type="submit" disabled={adding}
                className="w-full py-3 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50">
                {adding ? 'Adding...' : profile?.role === 'shepherd' ? 'Add to My Sheep' : 'Add Member'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editMember && (
        <EditMemberModal
          member={editMember}
          isDemo={isDemo}
          onClose={() => setEditMember(null)}
          onSaved={() => { setEditMember(null); if (!isDemo) fetchMembers(); }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-black mb-2">Delete Member</h3>
            <p className="text-gray-500 text-sm mb-6">
              Are you sure you want to delete <strong>{deletingMember?.full_name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditMemberModal({
  member, isDemo, onClose, onSaved,
}: {
  member: MemberWithShepherd; isDemo: boolean; onClose: () => void; onSaved: () => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [form, setForm] = useState({
    full_name: member.full_name,
    phone_number: member.phone_number,
    address: member.address,
    bacenta: member.bacenta,
    who_brought: member.who_brought,
    status: member.status as MemberStatus,
  });

  useEffect(() => {
    supabase.from('bacentas').select('*').eq('branch_id', member.branch_id).order('name')
      .then(({ data }: { data: Bacenta[] | null }) => setBacentas(data || []));
  }, [member.branch_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    if (!isDemo) {
      const { error: err } = await supabase.from('members').update(form).eq('id', member.id);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    onSaved();
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-black">Edit Member</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input type="tel" required value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bacenta</label>
            <BacentaSelect
              value={form.bacenta}
              onChange={(value) => setForm({ ...form, bacenta: value })}
              bacentas={bacentas}
              includeLeader
              className={`${inputCls} bg-white`}
              placeholder="Select a bacenta..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Who Brought Them</label>
            <input type="text" value={form.who_brought} onChange={e => setForm({ ...form, who_brought: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <BacentaSelect
              value={form.status}
              onChange={(value) => setForm({ ...form, status: value as MemberStatus })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'flagged', label: 'Flagged' },
              ]}
              className={`${inputCls} bg-white`}
              placeholder="Select status..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
