'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Member, MemberStatus, Bacenta } from '@/lib/types';
import { DEMO_MEMBERS, DEMO_NEW_BELIEVERS, DEMO_USERS } from '@/lib/demo-data';
import { isInShepherdFlock, normalizeBacentaName, shepherdBacentaNames } from '@/lib/flock';
import { Search, Users, Plus, X, Lock, Pencil, UserMinus, Trash2, AlertTriangle, Download, Upload, Phone } from 'lucide-react';
import Link from 'next/link';
import BacentaSelect from '@/components/BacentaSelect';
import Pagination from '@/components/Pagination';
import WhatsAppMessageModal, { WhatsAppRecipient } from '@/components/WhatsAppMessageModal';
import CsvImportModal from '@/components/CsvImportModal';
import { exportToCsv } from '@/lib/csv';
import { syncNewBelieversToMembers, mergeNewBelieversIntoDemoMembers } from '@/lib/sync-believers';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

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
  const [bacentaFilter, setBacentaFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editMember, setEditMember] = useState<MemberWithShepherd | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState('');
  const [deactivating, setDeactivating] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<MemberWithShepherd | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [assigningBacentaId, setAssigningBacentaId] = useState<string | null>(null);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [addForm, setAddForm] = useState({
    full_name: '', phone_number: '', address: '', bacenta: '', who_brought: '',
  });
  const [adding, setAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [whatsAppRecipient, setWhatsAppRecipient] = useState<WhatsAppRecipient | null>(null);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        const mergedDemo = mergeNewBelieversIntoDemoMembers(DEMO_MEMBERS, DEMO_NEW_BELIEVERS);
        const withNames: MemberWithShepherd[] = mergedDemo.map(m => ({
          ...m,
          shepherd_name: m.assigned_shepherd ? DEMO_USERS[m.assigned_shepherd]?.name || 'Unknown' : undefined,
        }));
        if (profile.role === 'shepherd') {
          const bacentaNames = shepherdBacentaNames(profile);
          setMembers(withNames.filter(m => isInShepherdFlock(m, profile.id, bacentaNames)));
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
      try {
        // Automatically sync any new believers in this branch into members with zero duplication
        await syncNewBelieversToMembers(supabase, profile!.branch_id);
      } catch (syncErr) {
        console.error('Auto-sync new believers to members error:', syncErr);
      }

      const [{ data }, shepherdBacentasRes, bacentasLeaderRes] = await Promise.all([
        supabase
          .from('members')
          .select('*, shepherd:profiles!members_assigned_shepherd_fkey(full_name)')
          .eq('branch_id', profile!.branch_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('shepherd_bacentas')
          .select('shepherd:profiles(full_name), bacenta:bacentas(name)')
          .eq('branch_id', profile!.branch_id),
        supabase
          .from('bacentas')
          .select('name, leader_name')
          .eq('branch_id', profile!.branch_id),
      ]);

      // Members without a direct shepherd inherit the one assigned to their bacenta
      const bacentaShepherdMap: Record<string, string> = {};
      (bacentasLeaderRes.data || []).forEach((b: { name: string; leader_name: string | null }) => {
        const key = normalizeBacentaName(b.name);
        if (key && b.leader_name) bacentaShepherdMap[key] = b.leader_name;
      });
      (shepherdBacentasRes.data || []).forEach((row: { shepherd: { full_name: string } | null; bacenta: { name: string } | null }) => {
        const key = normalizeBacentaName(row.bacenta?.name);
        if (key && row.shepherd?.full_name) {
          bacentaShepherdMap[key] = row.shepherd.full_name;
        }
      });

      const membersWithNames: MemberWithShepherd[] = (data || []).map((m: Record<string, unknown>) => ({
        ...m,
        shepherd_name:
          (m.shepherd as { full_name: string } | null)?.full_name ||
          bacentaShepherdMap[normalizeBacentaName(m.bacenta as string)] ||
          undefined,
      })) as MemberWithShepherd[];

      if (profile!.role === 'shepherd') {
        const bacentaNames = shepherdBacentaNames(profile!);
        const flock = membersWithNames.filter((m) => isInShepherdFlock(m, profile!.id, bacentaNames));
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

  async function handleDeactivate() {
    if (!deactivateId) return;
    setDeactivating(true);
    setDeactivateError('');
    if (!isDemo) {
      // Preserve the member row and every linked attendance record.
      const { error } = await supabase.from('members').update({ status: 'inactive' }).eq('id', deactivateId);
      if (error) {
        setDeactivateError(`Member could not be deactivated: ${error.message}`);
        setDeactivating(false);
        return;
      }
    }
    setMembers(prev => prev.map((member) => member.id === deactivateId ? { ...member, status: 'inactive' } : member));
    setDeactivating(false);
    setDeactivateId(null);
  }

  async function handleDelete() {
    if (!memberToDelete) return;
    setDeleting(true);
    setDeleteError('');

    if (isDemo) {
      setMembers(prev => prev.filter((m) => m.id !== memberToDelete.id));
      setDeleting(false);
      setMemberToDelete(null);
      return;
    }

    try {
      const res = await fetch('/api/members/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberToDelete.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setDeleteError(data.error || 'Failed to delete member record.');
        setDeleting(false);
        return;
      }

      setMembers(prev => prev.filter((m) => m.id !== memberToDelete.id));
      setDeleting(false);
      setMemberToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setDeleteError(`Could not delete member: ${msg}`);
      setDeleting(false);
    }
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
    const matchesBacenta = bacentaFilter === 'all' || m.bacenta === bacentaFilter;
    return matchesSearch && matchesStatus && matchesBacenta;
  });

  // Every bacenta that actually appears in the member list (covers "Others" etc.)
  const bacentaFilterOptions = useMemo(() => {
    const names = new Set<string>();
    members.forEach((m) => { if (m.bacenta) names.add(m.bacenta); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [members]);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    flagged: 'bg-red-100 text-red-700',
  };

  const deactivatingMember = members.find(m => m.id === deactivateId);

  const handleExport = () => {
    const today = new Date().toISOString().split('T')[0];
    const dataToExport = filtered.map((m) => ({
      full_name: m.full_name,
      phone_number: m.phone_number,
      address: m.address,
      bacenta: m.bacenta,
      shepherd: m.shepherd_name || '',
      date_joined: m.date_joined ? new Date(m.date_joined).toLocaleDateString() : '',
      membership_date: m.membership_date ? new Date(m.membership_date).toLocaleDateString() : '',
      status: m.status,
      category: m.new_believer_id ? 'New Believer' : m.first_timer_id ? 'First Timer' : 'Regular Member',
      birthday: m.birthday || '',
    }));

    exportToCsv(
      `epc-members-${today}.csv`,
      [
        { label: 'Member', key: 'full_name' },
        { label: 'Category', key: 'category' },
        { label: 'Phone', key: 'phone_number' },
        { label: 'Address', key: 'address' },
        { label: 'Bacenta', key: 'bacenta' },
        { label: 'Shepherd', key: 'shepherd' },
        { label: 'Date Joined', key: 'date_joined' },
        { label: 'Membership Date', key: 'membership_date' },
        { label: 'Status', key: 'status' },
        { label: 'Birthday', key: 'birthday' },
      ],
      dataToExport
    );
  };

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
        <p className="text-sm text-gray-500">Members are managed by Shepherds and Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">
            {profile?.role === 'shepherd' ? 'My Sheep' : 'Members'}
          </h1>
          <p className="text-gray-500 mt-1">
            {profile?.role === 'shepherd' ? 'Manage and track your sheep fold' : 'All church members'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden md:flex items-center gap-1.5 text-gray-500 text-sm mr-1">
            <Users size={18} className="text-gray-400" />
            <span>{filtered.length} {filtered.length === 1 ? 'member' : 'members'}</span>
          </div>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition shadow-2xs text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Export current table to CSV"
          >
            <Download size={17} className="text-gray-500" />
            Export CSV
          </button>
          {(profile?.role === 'shepherd' || profile?.role === 'super_admin' || profile?.role === 'bishop') && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-orange-50 border border-orange-200 text-orange-700 font-medium rounded-lg hover:bg-orange-100 transition shadow-2xs text-sm cursor-pointer"
                title="Upload CSV to import records"
              >
                <Upload size={17} className="text-orange-600" />
                Upload CSV
              </button>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white text-sm font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition shadow-2xs cursor-pointer">
                <Plus size={16} /> {profile?.role === 'shepherd' ? 'Add Sheep' : 'Add Member'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or bacenta..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black text-sm"
          />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-4">
          <div className="sm:w-52">
            <BacentaSelect
              value={bacentaFilter}
              onChange={(val) => { setBacentaFilter(val); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Bacentas' },
                ...bacentaFilterOptions.map((name) => ({ value: name, label: name })),
              ]}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black w-full text-xs sm:text-sm"
              placeholder="All Bacentas"
            />
          </div>
          <div className="sm:w-44">
            <BacentaSelect
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'flagged', label: 'Flagged' },
              ]}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black w-full text-xs sm:text-sm"
              placeholder="All Status"
            />
          </div>
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
              <div
                key={member.id}
                className="bg-white rounded-2xl shadow-xs border border-gray-100 p-4 transition hover:border-orange-200"
              >
                {/* Header Row: Avatar, Identity & Status */}
                <div className="flex items-start gap-3">
                  <Link
                    href={`/dashboard/profile/member/${member.id}`}
                    className="shrink-0 active:scale-95 transition-transform"
                  >
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-xs overflow-hidden ring-2 ring-orange-100">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>
                          {member.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/dashboard/profile/member/${member.id}`}
                        className="min-w-0 flex-1 block group"
                      >
                        <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-orange-600 transition break-words">
                          {member.full_name}
                        </h3>
                        {member.nickname && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            Known as: <span className="text-gray-600 font-medium">{member.nickname}</span>
                          </p>
                        )}
                      </Link>

                      {/* Status badge */}
                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusColors[member.status]}`}
                      >
                        {member.status}
                      </span>
                    </div>

                    {/* Member category tags (New Believer / First Timer) */}
                    {(member.new_believer_id || member.first_timer_id) && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {member.new_believer_id && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            New Believer
                          </span>
                        )}
                        {member.first_timer_id && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            First Timer
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Metadata Details */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                    <span className="text-gray-400 text-[11px] font-medium">Bacenta:</span>
                    <span className="font-semibold text-gray-800">{member.bacenta || 'Unassigned'}</span>
                  </span>

                  <span className="text-gray-300 select-none">•</span>

                  <span className="text-gray-500">
                    Joined {new Date(member.membership_date).toLocaleDateString()}
                  </span>

                  {profile?.role === 'super_admin' && member.shepherd_name && (
                    <>
                      <span className="text-gray-300 select-none">•</span>
                      <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                        <span>🐑</span>
                        <span>{member.shepherd_name}</span>
                      </span>
                    </>
                  )}

                  {member.phone_number && (
                    <>
                      <span className="text-gray-300 select-none">•</span>
                      <a
                        href={`tel:${member.phone_number}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-600 hover:text-orange-600 hover:underline"
                        title="Call phone number"
                      >
                        <Phone size={12} className="text-gray-400" />
                        <span>{member.phone_number}</span>
                      </a>
                    </>
                  )}
                </div>

                {/* Bottom Action Bar */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setWhatsAppRecipient({
                        name: member.full_name,
                        phoneNumber: member.phone_number,
                        nickname: member.nickname,
                        category: 'member',
                        bacenta: member.bacenta,
                        photoUrl: member.photo_url,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer"
                  >
                    <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                    <span>WhatsApp</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditMember(member)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition active:scale-95 cursor-pointer"
                      title="Edit"
                      aria-label="Edit Member"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setDeactivateError('');
                        setDeactivateId(member.id);
                      }}
                      className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition active:scale-95 cursor-pointer"
                      title="Deactivate"
                      aria-label="Deactivate Member"
                    >
                      <UserMinus size={15} />
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError('');
                        setMemberToDelete(member);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition active:scale-95 cursor-pointer"
                      title="Delete completely"
                      aria-label="Delete Member"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                {search ? 'No results found' : 'No members yet'}
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block table-shell">
            <div className="overflow-x-auto">
              <table className="table-compact">
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
                          <div className="person-avatar rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 overflow-hidden">
                            {member.photo_url ? (
                              <img src={member.photo_url} alt={member.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white text-xs font-bold">
                                {member.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-black hover:text-orange-600 block">{member.full_name}</span>
                              {member.new_believer_id && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  New Believer
                                </span>
                              )}
                            </div>
                            {member.nickname && <span className="text-xs text-gray-400">Known as: {member.nickname}</span>}
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-sm">{member.phone_number}</span>
                          <button
                            type="button"
                            title="Send WhatsApp template / message"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWhatsAppRecipient({
                                name: member.full_name,
                                phoneNumber: member.phone_number,
                                nickname: member.nickname,
                                category: 'member',
                                bacenta: member.bacenta,
                                photoUrl: member.photo_url,
                              });
                            }}
                            className="p-1 hover:bg-green-50 rounded-full transition group"
                          >
                            <WhatsAppIcon className="w-5 h-5 text-[#25D366] group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
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
                          <button onClick={() => { setDeactivateError(''); setDeactivateId(member.id); }}
                            className="p-1.5 hover:bg-amber-50 text-gray-400 hover:text-amber-600 rounded transition" title="Deactivate">
                            <UserMinus size={15} />
                          </button>
                          <button onClick={() => { setDeleteError(''); setMemberToDelete(member); }}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition" title="Delete completely">
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
            {/* Desktop Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              embedded
            />
          </div>

          {/* Mobile Pagination Controls */}
          <div className="sm:hidden mt-3">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
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

      {/* Deactivation Confirmation */}
      {deactivateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !deactivating && setDeactivateId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-black mb-2">Deactivate Member</h3>
            <p className="text-gray-500 text-sm mb-6">
              Deactivate <strong>{deactivatingMember?.full_name}</strong>? Their profile and complete attendance history will be preserved.
            </p>
            {deactivateError && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deactivateError}
              </div>
            )}
            <div className="flex gap-3">
              <button disabled={deactivating} onClick={() => setDeactivateId(null)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50">Cancel</button>
              <button disabled={deactivating} onClick={handleDeactivate} className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50">
                {deactivating ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => !deleting && setMemberToDelete(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-black">Delete Member Completely</h3>
                <p className="text-xs text-gray-500">Permanent database deletion</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-3">
              Are you sure you want to completely delete <strong>{memberToDelete.full_name}</strong>?
            </p>
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              ⚠️ Warning: All records for this member (including attendance history, messages, and follow-ups) will be permanently deleted from the database. This action cannot be undone.
            </p>
            {deleteError && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button disabled={deleting} onClick={() => setMemberToDelete(null)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50">Cancel</button>
              <button disabled={deleting} onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Trash2 size={16} />
                {deleting ? 'Deleting…' : 'Delete Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Template & Media Modal */}
      <WhatsAppMessageModal
        recipient={whatsAppRecipient}
        isOpen={!!whatsAppRecipient}
        onClose={() => setWhatsAppRecipient(null)}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          if (!isDemo) fetchMembers();
        }}
        entityType="members"
        branchId={profile?.branch_id || ''}
        userId={profile?.id || ''}
        isDemo={isDemo}
        availableBacentas={bacentas}
        userRole={profile?.role}
      />
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
    birthday: member.birthday || '',
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
      const { error: err } = await supabase
        .from('members')
        .update({ ...form, birthday: form.birthday || null })
        .eq('id', member.id);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
            <input type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} className={inputCls} />
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
