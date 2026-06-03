'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Visitation } from '@/lib/types';
import { DEMO_VISITATIONS, DEMO_MEMBERS } from '@/lib/demo-data';
import { MapPin, Plus, CheckCircle, Circle, Calendar, X, Pencil, Trash2 } from 'lucide-react';

export default function VisitationsPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<Visitation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setVisitations(DEMO_VISITATIONS);
        setLoading(false);
      } else {
        fetchVisitations();
      }
    }
  }, [profile, isDemo]);

  async function fetchVisitations() {
    const { data } = await supabase
      .from('visitations')
      .select('*, member:members(full_name)')
      .eq('branch_id', profile!.branch_id)
      .order('scheduled_date', { ascending: false });
    const mapped = (data || []).map((v: Record<string, unknown>) => ({
      ...v,
      member_name: (v.member as { full_name: string } | null)?.full_name || 'Unknown',
    }));
    setVisitations(mapped as Visitation[]);
    setLoading(false);
  }

  const markCompleted = async (id: string) => {
    setVisitations(prev => prev.map(v => v.id === id ? { ...v, completed: true } : v));
    if (!isDemo) {
      await supabase.from('visitations').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', id);
    }
  };

  async function handleDelete() {
    if (!deleteId) return;
    if (!isDemo) {
      await supabase.from('visitations').delete().eq('id', deleteId);
    }
    setVisitations(prev => prev.filter(v => v.id !== deleteId));
    setDeleteId(null);
  }

  const upcoming = visitations.filter(v => !v.completed).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const completed = visitations.filter(v => v.completed);
  const deletingRecord = visitations.find(v => v.id === deleteId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            <MapPin className="text-orange-500" size={26} />
            Visitation Scheduler
          </h1>
          <p className="text-gray-500 mt-1">Plan and track home visits to your sheep</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition">
          <Plus size={20} /> Schedule Visit
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{upcoming.length}</p>
          <p className="text-xs text-gray-500">Upcoming</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{completed.length}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
      </div>

      {/* Upcoming Visits */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-orange-500" />
          Upcoming Visits
        </h3>
        <div className="space-y-3">
          {upcoming.map(v => (
            <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-orange-200 transition">
              <button onClick={() => markCompleted(v.id)} className="mt-0.5 text-gray-300 hover:text-green-500 transition">
                <Circle size={22} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-black text-sm">{v.member_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{v.notes}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
                    📅 {new Date(v.scheduled_date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  {v.address && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <MapPin size={10} /> {v.address}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] text-gray-400 mr-1">{v.shepherd_name}</span>
                <button onClick={() => setEditRecord(v)}
                  className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition" title="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={() => setDeleteId(v.id)}
                  className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {upcoming.length === 0 && (
            <p className="text-center py-6 text-gray-400 text-sm">No upcoming visits. Schedule one!</p>
          )}
        </div>
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <h3 className="font-semibold text-black mb-4 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-500" />
            Completed Visits
          </h3>
          <div className="space-y-3">
            {completed.map(v => (
              <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <CheckCircle size={22} className="text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-black text-sm line-through">{v.member_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{v.notes}</p>
                  <span className="text-[10px] text-gray-400">
                    {new Date(v.scheduled_date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <button onClick={() => setDeleteId(v.id)}
                  className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition flex-shrink-0" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <VisitationForm
          branchId={profile!.branch_id}
          shepherdId={profile!.id}
          shepherdName={profile!.full_name}
          isDemo={isDemo}
          onClose={() => setShowForm(false)}
          onSaved={(v) => { setVisitations(prev => [v, ...prev]); setShowForm(false); }}
        />
      )}

      {/* Edit Form */}
      {editRecord && (
        <VisitationForm
          branchId={profile!.branch_id}
          shepherdId={profile!.id}
          shepherdName={profile!.full_name}
          isDemo={isDemo}
          initialData={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={(updated) => {
            setVisitations(prev => prev.map(v => v.id === updated.id ? updated : v));
            setEditRecord(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-black mb-2">Delete Visitation</h3>
            <p className="text-gray-500 text-sm mb-6">
              Delete the visit to <strong>{deletingRecord?.member_name}</strong>? This cannot be undone.
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

function VisitationForm({
  branchId, shepherdId, shepherdName, isDemo, onClose, onSaved, initialData,
}: {
  branchId: string; shepherdId: string; shepherdName: string; isDemo: boolean;
  onClose: () => void; onSaved: (v: Visitation) => void; initialData?: Visitation;
}) {
  const supabase = createClient();
  const isEditing = !!initialData;
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({
    member_id: initialData?.member_id || '',
    scheduled_date: initialData?.scheduled_date || '',
    notes: initialData?.notes || '',
    address: initialData?.address || '',
  });

  useEffect(() => {
    if (isEditing) return;
    if (isDemo) {
      setMembers(DEMO_MEMBERS.map(m => ({ id: m.id, full_name: m.full_name })));
    } else {
      supabase.from('members').select('id, full_name').eq('branch_id', branchId).order('full_name')
        .then(({ data }: { data: Array<{ id: string; full_name: string }> | null }) => setMembers(data || []));
    }
  }, [branchId, isDemo, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (isEditing) {
      const updated: Visitation = { ...initialData!, scheduled_date: form.scheduled_date, notes: form.notes, address: form.address };
      if (!isDemo) {
        await supabase.from('visitations').update({
          scheduled_date: form.scheduled_date, notes: form.notes, address: form.address,
        }).eq('id', initialData!.id);
      }
      onSaved(updated);
      return;
    }

    const memberName = members.find(m => m.id === form.member_id)?.full_name || 'Unknown';
    const newV: Visitation = {
      id: `vs-${Date.now()}`, member_id: form.member_id, member_name: memberName,
      shepherd_id: shepherdId, shepherd_name: shepherdName,
      scheduled_date: form.scheduled_date, completed: false,
      notes: form.notes, address: form.address,
      branch_id: branchId, created_at: new Date().toISOString(),
    };

    if (!isDemo) {
      const { data } = await supabase.from('visitations').insert({
        member_id: form.member_id, shepherd_id: shepherdId, shepherd_name: shepherdName,
        scheduled_date: form.scheduled_date, notes: form.notes, address: form.address,
        branch_id: branchId, completed: false,
      }).select('*, member:members(full_name)').single();
      if (data) {
        onSaved({ ...data, member_name: (data.member as { full_name: string } | null)?.full_name || memberName });
        return;
      }
    }
    onSaved(newV);
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black">{isEditing ? 'Edit Visit' : 'Schedule Home Visit'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEditing ? (
            <div className="px-4 py-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Member</p>
              <p className="font-medium text-black">{initialData!.member_name}</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member to Visit</label>
              <select required value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })} className={`${inputCls} bg-white`}>
                <option value="">Select member...</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visit Date</label>
            <input type="date" required value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Enter visit address" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Reason</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
              className={`${inputCls} resize-none`} placeholder="Why are you visiting?" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 font-medium disabled:opacity-50">
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
