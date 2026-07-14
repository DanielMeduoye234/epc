'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Plus, X, Trash2, Edit2, Users, FolderTree, ChevronDown, Search, Check, MapPin, User } from 'lucide-react';
import Link from 'next/link';
import { DEMO_MEMBERS } from '@/lib/demo-data';

interface Bacenta {
  id: string;
  name: string;
  leader_name: string | null;
  location: string | null;
  branch_id: string;
  created_at: string;
  member_count?: number;
  shepherds?: { id: string; full_name: string }[];
}

interface ShepherdOption {
  id: string;
  full_name: string;
}

const DEMO_BACENTAS: Bacenta[] = [
  { id: 'bac-1', name: 'Bacenta Alpha', leader_name: 'Brother Samuel', location: 'Zone A, Lagos', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z', member_count: 4, shepherds: [{ id: 'demo-user-001', full_name: 'Shepherd Samuel' }] },
  { id: 'bac-2', name: 'Bacenta Beta', leader_name: 'Sister Joy', location: 'Zone B, Ikeja', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z', member_count: 3, shepherds: [{ id: 'demo-user-002', full_name: 'Shepherd Grace' }] },
  { id: 'bac-3', name: 'Bacenta Omega', leader_name: 'Brother Daniel', location: 'Zone C, Lekki', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z', member_count: 3 },
];

export default function BacentasPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shepherds, setShepherds] = useState<ShepherdOption[]>([]);
  const [form, setForm] = useState({ name: '', leader_name: '', location: '', shepherd_ids: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [profileBacenta, setProfileBacenta] = useState<Bacenta | null>(null);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setBacentas(DEMO_BACENTAS);
        setShepherds([
          { id: 'demo-user-001', full_name: 'Shepherd Samuel' },
          { id: 'demo-user-002', full_name: 'Shepherd Grace' },
        ]);
        setLoading(false);
      } else {
        fetchBacentas();
        fetchShepherds();
      }
    }
  }, [profile, isDemo]);

  async function fetchShepherds() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('branch_id', profile!.branch_id)
      .eq('role', 'shepherd')
      .order('full_name');
    setShepherds(data || []);
  }

  async function fetchBacentas() {
    const { data } = await supabase
      .from('bacentas')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .order('name');

    if (data) {
      // Get member counts for each bacenta
      const withCounts = await Promise.all(
        data.map(async (b: Bacenta) => {
          const { count } = await supabase
            .from('members')
            .select('id', { count: 'exact', head: true })
            .eq('branch_id', profile!.branch_id)
            .eq('bacenta', b.name);
          const { data: shepherds, error: shepherdLinksError } = await supabase
            .from('shepherd_bacentas')
            .select('shepherd:profiles(id, full_name)')
            .eq('branch_id', profile!.branch_id)
            .eq('bacenta_id', b.id);
          let linkedShepherds = (shepherds || [])
            .map((row: { shepherd: ShepherdOption | null }) => row.shepherd)
            .filter(Boolean) as ShepherdOption[];

          if (shepherdLinksError) {
            const { data: legacyShepherds } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('branch_id', profile!.branch_id)
              .eq('role', 'shepherd')
              .eq('bacenta_id', b.id);
            linkedShepherds = legacyShepherds || [];
          }
          return { ...b, member_count: count || 0, shepherds: linkedShepherds };
        })
      );
      setBacentas(withCounts);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setFormError(null);

    if (isDemo) {
      const selectedShepherds = shepherds.filter((s) => form.shepherd_ids.includes(s.id));
      if (editingId) {
        setBacentas(prev => prev.map(b => b.id === editingId ? { ...b, name: form.name, leader_name: form.leader_name || null, location: form.location || null, shepherds: selectedShepherds } : b));
      } else {
        const newBacenta: Bacenta = {
          id: `bac-${Date.now()}`,
          name: form.name,
          leader_name: form.leader_name || null,
          location: form.location || null,
          branch_id: 'demo-branch-001',
          created_at: new Date().toISOString(),
          member_count: 0,
          shepherds: selectedShepherds,
        };
        setBacentas(prev => [...prev, newBacenta]);
      }
      resetForm();
      setSaving(false);
      return;
    }

    if (editingId) {
      const current = bacentas.find((b) => b.id === editingId);
      const { error: updateError } = await supabase.from('bacentas').update({
        name: form.name,
        leader_name: form.leader_name || null,
        location: form.location || null,
      }).eq('id', editingId);

      if (updateError) {
        setFormError(updateError.message);
        setSaving(false);
        return;
      }

      const { error: deleteLinksError } = await supabase.from('shepherd_bacentas').delete().eq('bacenta_id', editingId).eq('branch_id', profile!.branch_id);
      if (deleteLinksError) {
        setFormError(deleteLinksError.message);
        setSaving(false);
        return;
      }

      if (form.shepherd_ids.length > 0) {
        const { error: insertLinksError } = await supabase.from('shepherd_bacentas').insert(form.shepherd_ids.map((shepherdId) => ({
          shepherd_id: shepherdId,
          bacenta_id: editingId,
          branch_id: profile!.branch_id,
        })));
        if (insertLinksError) {
          setFormError(insertLinksError.message);
          setSaving(false);
          return;
        }
      }

      if (current && current.name !== form.name) {
        const results = await Promise.all([
          supabase
            .from('members')
            .update({ bacenta: form.name })
            .eq('branch_id', profile!.branch_id)
            .eq('bacenta', current.name),
          supabase
            .from('first_timers')
            .update({ bacenta: form.name })
            .eq('branch_id', profile!.branch_id)
            .eq('bacenta', current.name),
          supabase
            .from('new_believers')
            .update({ bacenta: form.name })
            .eq('branch_id', profile!.branch_id)
            .eq('bacenta', current.name),
        ]);
        const renameError = results.find((result) => result.error)?.error;
        if (renameError) {
          setFormError(renameError.message);
          setSaving(false);
          return;
        }
      }
    } else {
      const { data: newBacenta, error: insertError } = await supabase.from('bacentas').insert({
        name: form.name,
        leader_name: form.leader_name || null,
        location: form.location || null,
        branch_id: profile!.branch_id,
      }).select('id').single();

      if (insertError) {
        setFormError(insertError.message);
        setSaving(false);
        return;
      }

      if (newBacenta && form.shepherd_ids.length > 0) {
        const { error: insertLinksError } = await supabase.from('shepherd_bacentas').insert(form.shepherd_ids.map((shepherdId) => ({
          shepherd_id: shepherdId,
          bacenta_id: newBacenta.id,
          branch_id: profile!.branch_id,
        })));
        if (insertLinksError) {
          setFormError(insertLinksError.message);
          setSaving(false);
          return;
        }
      }
    }
    resetForm();
    fetchBacentas();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this bacenta?')) return;
    if (isDemo) {
      setBacentas(prev => prev.filter(b => b.id !== id));
      return;
    }
    await supabase.from('bacentas').delete().eq('id', id);
    fetchBacentas();
  }

  function startEdit(bacenta: Bacenta) {
    setEditingId(bacenta.id);
    setForm({
      name: bacenta.name,
      leader_name: bacenta.leader_name || '',
      location: bacenta.location || '',
      shepherd_ids: bacenta.shepherds?.map((s) => s.id) || [],
    });
    setShowForm(true);
  }

  function resetForm() {
    setForm({ name: '', leader_name: '', location: '', shepherd_ids: [] });
    setEditingId(null);
    setFormError(null);
    setSaving(false);
    setShowForm(false);
  }

  function toggleShepherd(shepherdId: string) {
    setForm((prev) => ({
      ...prev,
      shepherd_ids: prev.shepherd_ids.includes(shepherdId)
        ? prev.shepherd_ids.filter((id) => id !== shepherdId)
        : [...prev.shepherd_ids, shepherdId],
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Bacentas</h1>
          <p className="text-gray-500 mt-1">Manage bacenta groups for your branch</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 transition font-medium"
        >
          <Plus size={18} />
          Add Bacenta
        </button>
      </div>

      {/* Summary Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-[10px] text-gray-500 uppercase">Total Bacentas</p>
            <p className="text-2xl font-bold text-orange-600">{bacentas.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-[10px] text-gray-500 uppercase">Total Members</p>
            <p className="text-2xl font-bold text-black">{bacentas.reduce((sum, b) => sum + (b.member_count || 0), 0)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 col-span-2 sm:col-span-1">
            <p className="text-[10px] text-gray-500 uppercase">With Shepherd</p>
            <p className="text-2xl font-bold text-green-600">{bacentas.filter((b) => (b.shepherds || []).length > 0).length}</p>
          </div>
        </div>
      )}

      {/* Bacenta Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bacentas.map((bacenta) => (
            <div
              key={bacenta.id}
              onClick={() => setProfileBacenta(bacenta)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <FolderTree size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-black">{bacenta.name}</h3>
                    {bacenta.leader_name && (
                      <p className="text-xs text-gray-500">Leader: {bacenta.leader_name}</p>
                    )}
                    <p className="text-xs text-blue-600 mt-0.5">
                      Shepherd: {bacenta.shepherds?.map((s) => s.full_name).join(', ') || 'Unassigned'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(bacenta); }}
                    className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(bacenta.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                {bacenta.location && (
                  <p className="text-xs text-gray-400">{bacenta.location}</p>
                )}
                <div className="flex items-center gap-1 text-sm text-gray-600 ml-auto">
                  <Users size={14} />
                  <span>{bacenta.member_count || 0} members</span>
                </div>
              </div>
            </div>
          ))}
          {bacentas.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              No bacentas created yet. Click &quot;Add Bacenta&quot; to get started.
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-black">
                {editingId ? 'Edit Bacenta' : 'Add New Bacenta'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-black">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bacenta Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Bacenta Grace"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leader Name</label>
                <input
                  type="text"
                  value={form.leader_name}
                  onChange={(e) => setForm({ ...form, leader_name: e.target.value })}
                  placeholder="e.g. Brother Samuel"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Zone A, Lagos"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Shepherds</label>
                {shepherds.length === 0 ? (
                  <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                    Create shepherd accounts before assigning them to this bacenta.
                  </div>
                ) : (
                  <ShepherdMultiSelect
                    shepherds={shepherds}
                    selectedIds={form.shepherd_ids}
                    onToggle={toggleShepherd}
                  />
                )}
                <p className="text-xs text-gray-400 mt-1">A shepherd can be assigned to more than one bacenta.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 transition font-medium disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bacenta Profile Modal */}
      {profileBacenta && (
        <BacentaProfileModal
          bacenta={profileBacenta}
          branchId={profile!.branch_id}
          isDemo={isDemo}
          onClose={() => setProfileBacenta(null)}
        />
      )}
    </div>
  );
}

interface BacentaMemberRow {
  id: string;
  full_name: string;
  phone_number: string;
  photo_url: string | null;
  status: string;
}

function BacentaProfileModal({
  bacenta, branchId, isDemo, onClose,
}: {
  bacenta: Bacenta;
  branchId: string;
  isDemo: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [members, setMembers] = useState<BacentaMemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isDemo) {
        const demoRows: BacentaMemberRow[] = DEMO_MEMBERS
          .filter((m) => m.bacenta === bacenta.name)
          .map((m) => ({
            id: m.id,
            full_name: m.full_name,
            phone_number: m.phone_number,
            photo_url: m.photo_url,
            status: m.status,
          }));
        if (!cancelled) {
          setMembers(demoRows);
          setLoadingMembers(false);
        }
        return;
      }

      // Regular members only — keeps this count in sync with the card and the
      // Regular Members page.
      const { data } = await supabase
        .from('members')
        .select('id, full_name, phone_number, photo_url, status')
        .eq('branch_id', branchId)
        .eq('bacenta', bacenta.name)
        .order('full_name');

      if (!cancelled) {
        setMembers(data || []);
        setLoadingMembers(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bacenta.id]);

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
    flagged: 'bg-red-100 text-red-700',
  };

  const leaderNames = (bacenta.shepherds || []).map((s) => s.full_name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <FolderTree size={24} className="text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-black">{bacenta.name}</h2>
                {bacenta.location && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} /> {bacenta.location}
                  </p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-black p-1">
              <X size={20} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-[10px] text-blue-600 uppercase font-semibold flex items-center gap-1">
                <User size={11} /> Leader / Shepherd
              </p>
              <p className="text-sm font-medium text-black mt-1">
                {leaderNames.length > 0 ? leaderNames.join(', ') : bacenta.leader_name || 'Unassigned'}
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-[10px] text-orange-600 uppercase font-semibold flex items-center gap-1">
                <Users size={11} /> Members
              </p>
              <p className="text-sm font-medium text-black mt-1">
                {loadingMembers ? '...' : members.length}
              </p>
            </div>
          </div>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingMembers ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No members in this bacenta yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {members.map((m) => (
                <Link
                  key={m.id}
                  href={`/dashboard/profile/member/${m.id}`}
                  className="flex items-center justify-between gap-3 px-2 py-2.5 hover:bg-orange-50/50 rounded-lg transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-[10px] font-bold">
                          {m.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black truncate">{m.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{m.phone_number || 'No phone'}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold capitalize shrink-0 ${statusColors[m.status] || 'bg-gray-100 text-gray-700'}`}>
                    {m.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShepherdMultiSelect({
  shepherds,
  selectedIds,
  onToggle,
}: {
  shepherds: ShepherdOption[];
  selectedIds: string[];
  onToggle: (shepherdId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedShepherds = useMemo(
    () => shepherds.filter((shepherd) => selectedIds.includes(shepherd.id)),
    [shepherds, selectedIds]
  );
  const filteredShepherds = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return shepherds;
    return shepherds.filter((shepherd) => shepherd.full_name.toLowerCase().includes(normalizedQuery));
  }, [query, shepherds]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full min-h-12 px-4 py-2.5 border border-gray-200 rounded-lg bg-white text-left flex items-center justify-between gap-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
      >
        <span className={selectedShepherds.length > 0 ? 'text-black' : 'text-gray-500'}>
          {selectedShepherds.length > 0
            ? `${selectedShepherds.length} shepherd${selectedShepherds.length === 1 ? '' : 's'} selected`
            : 'Select shepherds...'}
        </span>
        <ChevronDown size={18} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {selectedShepherds.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedShepherds.map((shepherd) => (
            <button
              key={shepherd.id}
              type="button"
              onClick={() => onToggle(shepherd.id)}
              className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
            >
              {shepherd.full_name}
              <X size={12} />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search shepherds..."
                className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-200 text-sm text-black focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredShepherds.map((shepherd) => {
              const selected = selectedIds.includes(shepherd.id);
              return (
                <button
                  key={shepherd.id}
                  type="button"
                  onClick={() => onToggle(shepherd.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm text-left hover:bg-orange-50"
                >
                  <span className="font-medium text-black">{shepherd.full_name}</span>
                  <span className={`w-5 h-5 rounded border flex items-center justify-center ${selected ? 'bg-orange-500 border-orange-500 text-white' : 'border-gray-300 text-transparent'}`}>
                    <Check size={13} />
                  </span>
                </button>
              );
            })}
            {filteredShepherds.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-400">No shepherds found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
