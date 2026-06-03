'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { FollowUp, FollowUpType, FollowUpStatus } from '@/lib/types';
import { DEMO_FOLLOWUPS, DEMO_MEMBERS } from '@/lib/demo-data';
import { Phone, MessageCircle, MapPin, BookOpen, Plus, X, CheckCircle, XCircle, Clock, Pencil, Trash2 } from 'lucide-react';

export default function FollowUpsPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<FollowUp | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setFollowUps(DEMO_FOLLOWUPS);
        setLoading(false);
      } else {
        fetchFollowUps();
      }
    }
  }, [profile, isDemo]);

  async function fetchFollowUps() {
    const { data } = await supabase
      .from('follow_ups')
      .select('*, member:members(full_name)')
      .eq('branch_id', profile!.branch_id)
      .order('date', { ascending: false });
    const mapped = (data || []).map((f: Record<string, unknown>) => ({
      ...f,
      member_name: (f.member as { full_name: string } | null)?.full_name || 'Unknown',
    }));
    setFollowUps(mapped as FollowUp[]);
    setLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    if (!isDemo) {
      await supabase.from('follow_ups').delete().eq('id', deleteId);
    }
    setFollowUps(prev => prev.filter(f => f.id !== deleteId));
    setDeleteId(null);
  }

  const getTypeIcon = (type: FollowUpType) => {
    switch (type) {
      case 'call': return <Phone size={16} className="text-blue-500" />;
      case 'visit': return <MapPin size={16} className="text-green-500" />;
      case 'whatsapp': return <MessageCircle size={16} className="text-emerald-500" />;
      case 'prayer': return <BookOpen size={16} className="text-purple-500" />;
    }
  };

  const getStatusBadge = (status: FollowUpStatus) => {
    switch (status) {
      case 'completed': return <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> Done</span>;
      case 'no_answer': return <span className="flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full"><XCircle size={10} /> No Answer</span>;
      case 'scheduled': return <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Clock size={10} /> Scheduled</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalFollowUps = followUps.length;
  const completed = followUps.filter(f => f.status === 'completed').length;
  const thisWeek = followUps.filter(f => {
    const d = new Date(f.date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  const deletingRecord = followUps.find(f => f.id === deleteId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Follow-Up Tracking</h1>
          <p className="text-gray-500 mt-1">Log calls, visits, and messages to your sheep</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition">
          <Plus size={20} /> Log Follow-Up
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-black">{totalFollowUps}</p>
          <p className="text-xs text-gray-500">Total Follow-ups</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{thisWeek}</p>
          <p className="text-xs text-gray-500">This Week</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h3 className="font-semibold text-black mb-4">Follow-Up History</h3>
        <div className="space-y-4">
          {followUps.map((fu, idx) => (
            <div key={fu.id} className="relative flex gap-3">
              {idx < followUps.length - 1 && (
                <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-gray-200" />
              )}
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 z-10">
                {getTypeIcon(fu.type)}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black">
                      {fu.type === 'call' ? 'Called' : fu.type === 'visit' ? 'Visited' : fu.type === 'whatsapp' ? 'Messaged' : 'Prayed for'}{' '}
                      <span className="text-orange-600">{fu.member_name}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{fu.notes}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(fu.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {fu.shepherd_name && ` · by ${fu.shepherd_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {getStatusBadge(fu.status)}
                    <button onClick={() => setEditRecord(fu)}
                      className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition" title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteId(fu.id)}
                      className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {followUps.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No follow-ups logged yet. Start tracking your outreach!
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showForm && (
        <FollowUpForm
          branchId={profile!.branch_id}
          shepherdId={profile!.id}
          shepherdName={profile!.full_name}
          isDemo={isDemo}
          onClose={() => setShowForm(false)}
          onSaved={(newFU) => { setFollowUps(prev => [newFU, ...prev]); setShowForm(false); }}
        />
      )}

      {/* Edit Modal */}
      {editRecord && (
        <FollowUpForm
          branchId={profile!.branch_id}
          shepherdId={profile!.id}
          shepherdName={profile!.full_name}
          isDemo={isDemo}
          initialData={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={(updated) => {
            setFollowUps(prev => prev.map(f => f.id === updated.id ? updated : f));
            setEditRecord(null);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-black mb-2">Delete Follow-Up</h3>
            <p className="text-gray-500 text-sm mb-6">
              Delete the follow-up for <strong>{deletingRecord?.member_name}</strong>? This cannot be undone.
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

function FollowUpForm({
  branchId, shepherdId, shepherdName, isDemo, onClose, onSaved, initialData,
}: {
  branchId: string; shepherdId: string; shepherdName: string; isDemo: boolean;
  onClose: () => void; onSaved: (fu: FollowUp) => void; initialData?: FollowUp;
}) {
  const supabase = createClient();
  const isEditing = !!initialData;
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [form, setForm] = useState({
    member_id: initialData?.member_id || '',
    type: (initialData?.type || 'call') as FollowUpType,
    status: (initialData?.status || 'completed') as FollowUpStatus,
    notes: initialData?.notes || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isDemo) {
      setMembers(DEMO_MEMBERS.map(m => ({ id: m.id, full_name: m.full_name })));
    } else if (!isEditing) {
      supabase.from('members').select('id, full_name').eq('branch_id', branchId).order('full_name')
        .then(({ data }: { data: Array<{ id: string; full_name: string }> | null }) => setMembers(data || []));
    }
  }, [branchId, isDemo, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (isEditing) {
      const updated: FollowUp = {
        ...initialData!,
        type: form.type,
        status: form.status,
        notes: form.notes,
        date: form.date,
      };
      if (!isDemo) {
        await supabase.from('follow_ups').update({
          type: form.type, status: form.status, notes: form.notes, date: form.date,
        }).eq('id', initialData!.id);
      }
      onSaved(updated);
      return;
    }

    const memberName = members.find(m => m.id === form.member_id)?.full_name || 'Unknown';
    const newFU: FollowUp = {
      id: `fu-${Date.now()}`, member_id: form.member_id, member_name: memberName,
      shepherd_id: shepherdId, shepherd_name: shepherdName,
      type: form.type, status: form.status, notes: form.notes, date: form.date,
      branch_id: branchId, created_at: new Date().toISOString(),
    };

    if (!isDemo) {
      const { data } = await supabase.from('follow_ups').insert({
        member_id: form.member_id, shepherd_id: shepherdId, shepherd_name: shepherdName,
        type: form.type, status: form.status, notes: form.notes, date: form.date, branch_id: branchId,
      }).select('*, member:members(full_name)').single();
      if (data) {
        onSaved({ ...data, member_name: (data.member as { full_name: string } | null)?.full_name || memberName });
        return;
      }
    }
    onSaved(newFU);
  };

  const selectCls = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black">{isEditing ? 'Edit Follow-Up' : 'Log Follow-Up'}</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
              <select required value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })} className={selectCls}>
                <option value="">Select member...</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as FollowUpType })} className={selectCls}>
                <option value="call">📞 Phone Call</option>
                <option value="visit">🏠 Home Visit</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="prayer">🙏 Prayer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as FollowUpStatus })} className={selectCls}>
                <option value="completed">✅ Completed</option>
                <option value="no_answer">❌ No Answer</option>
                <option value="scheduled">⏰ Scheduled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black resize-none"
              placeholder="What happened during the follow-up?" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 font-medium disabled:opacity-50">
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
