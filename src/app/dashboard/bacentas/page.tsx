'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Plus, X, Trash2, Edit2, Users, FolderTree } from 'lucide-react';

interface Bacenta {
  id: string;
  name: string;
  leader_name: string | null;
  location: string | null;
  branch_id: string;
  created_at: string;
  member_count?: number;
}

const DEMO_BACENTAS: Bacenta[] = [
  { id: 'bac-1', name: 'Bacenta Alpha', leader_name: 'Brother Samuel', location: 'Zone A, Lagos', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z', member_count: 4 },
  { id: 'bac-2', name: 'Bacenta Beta', leader_name: 'Sister Joy', location: 'Zone B, Ikeja', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z', member_count: 3 },
  { id: 'bac-3', name: 'Bacenta Omega', leader_name: 'Brother Daniel', location: 'Zone C, Lekki', branch_id: 'demo-branch-001', created_at: '2025-06-01T10:00:00Z', member_count: 3 },
];

export default function BacentasPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', leader_name: '', location: '' });

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setBacentas(DEMO_BACENTAS);
        setLoading(false);
      } else {
        fetchBacentas();
      }
    }
  }, [profile, isDemo]);

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
          return { ...b, member_count: count || 0 };
        })
      );
      setBacentas(withCounts);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (isDemo) {
      if (editingId) {
        setBacentas(prev => prev.map(b => b.id === editingId ? { ...b, ...form } : b));
      } else {
        const newBacenta: Bacenta = {
          id: `bac-${Date.now()}`,
          name: form.name,
          leader_name: form.leader_name || null,
          location: form.location || null,
          branch_id: 'demo-branch-001',
          created_at: new Date().toISOString(),
          member_count: 0,
        };
        setBacentas(prev => [...prev, newBacenta]);
      }
      resetForm();
      return;
    }

    if (editingId) {
      await supabase.from('bacentas').update({
        name: form.name,
        leader_name: form.leader_name || null,
        location: form.location || null,
      }).eq('id', editingId);
    } else {
      await supabase.from('bacentas').insert({
        name: form.name,
        leader_name: form.leader_name || null,
        location: form.location || null,
        branch_id: profile!.branch_id,
      });
    }
    resetForm();
    fetchBacentas();
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
    setForm({ name: bacenta.name, leader_name: bacenta.leader_name || '', location: bacenta.location || '' });
    setShowForm(true);
  }

  function resetForm() {
    setForm({ name: '', leader_name: '', location: '' });
    setEditingId(null);
    setShowForm(false);
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
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 transition font-medium"
        >
          <Plus size={18} />
          Add Bacenta
        </button>
      </div>

      {/* Bacenta Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bacentas.map((bacenta) => (
            <div key={bacenta.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
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
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(bacenta)}
                    className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(bacenta.id)}
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
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 transition font-medium"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
