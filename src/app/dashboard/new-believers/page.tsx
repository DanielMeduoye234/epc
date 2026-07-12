'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { NewBeliever, Bacenta } from '@/lib/types';
import { DEMO_BACENTAS, DEMO_NEW_BELIEVERS, DEMO_USERS } from '@/lib/demo-data';
import { Plus, Search, X, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import BacentaSelect from '@/components/BacentaSelect';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

interface NewBelieverWithRecorder extends NewBeliever {
  recorder_name?: string;
}

export default function NewBelieversPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [believers, setBelievers] = useState<NewBelieverWithRecorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<NewBelieverWithRecorder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        const withNames: NewBelieverWithRecorder[] = DEMO_NEW_BELIEVERS.map(b => ({
          ...b,
          first_name: null,
          last_name: null,
          nickname: null,
          birthday: null,
          recorder_name: DEMO_USERS[b.recorded_by]?.name || 'Unknown',
        }));
        setBelievers(withNames);
        setLoading(false);
      } else {
        fetchBelievers();
      }
    }
  }, [profile, isDemo]);

  async function fetchBelievers() {
    const { data } = await supabase
      .from('new_believers')
      .select('*, recorder:profiles!new_believers_recorded_by_fkey(full_name)')
      .eq('branch_id', profile!.branch_id)
      .order('created_at', { ascending: false });

    const withNames: NewBelieverWithRecorder[] = (data || []).map((b: Record<string, unknown>) => ({
      ...b,
      recorder_name: (b.recorder as { full_name: string } | null)?.full_name || undefined,
    })) as NewBelieverWithRecorder[];
    setBelievers(withNames);
    setLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    if (!isDemo) {
      await supabase.from('new_believers').delete().eq('id', deleteId);
    }
    setBelievers(prev => prev.filter(b => b.id !== deleteId));
    setDeleteId(null);
  }

  const filtered = believers.filter(
    (b) =>
      b.full_name.toLowerCase().includes(search.toLowerCase()) ||
      b.bacenta.toLowerCase().includes(search.toLowerCase()) ||
      b.who_brought.toLowerCase().includes(search.toLowerCase())
  );

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const deletingRecord = believers.find(b => b.id === deleteId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">New Believers</h1>
          <p className="text-gray-500 mt-1">People who gave their lives to Christ</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition"
        >
          <Plus size={20} />
          Add New Believer
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, bacenta, or who brought them..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Person</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Phone</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Address</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Bacenta</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Who Brought</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Recorded By</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Date Saved</th>
                  <th className="px-6 py-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.map((believer) => (
                  <tr key={believer.id} className="hover:bg-orange-50/50 transition">
                    <td className="px-6 py-4">
                      <Link href={`/dashboard/profile/new-believer/${believer.id}`} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 overflow-hidden">
                          {believer.photo_url ? (
                            <img src={believer.photo_url} alt={believer.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-xs font-bold">
                              {believer.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-medium text-black hover:text-orange-600 block">{believer.full_name}</span>
                          {believer.nickname && (
                            <span className="text-xs text-gray-400">Known as: {believer.nickname}</span>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-sm">{believer.phone_number}</span>
                        <a
                          href={`https://wa.me/${believer.phone_number.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Chat on WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <WhatsAppIcon className="w-5 h-5 text-[#25D366] hover:opacity-75 transition-opacity" />
                        </a>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm max-w-45 truncate" title={believer.address}>{believer.address}</td>
                    <td className="px-6 py-4 text-gray-600">{believer.bacenta}</td>
                    <td className="px-6 py-4 text-gray-600">{believer.who_brought}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                        {believer.recorder_name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{new Date(believer.date_saved).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditRecord(believer)}
                          className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(believer.id)}
                          className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      {search ? 'No results found' : 'No new believers recorded yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
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
        </div>
      )}

      {/* Add Form Modal */}
      {showForm && (
        <NewBelieverForm
          branchId={profile!.branch_id}
          recordedBy={profile!.id}
          isDemo={isDemo}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            if (!isDemo) fetchBelievers();
          }}
        />
      )}

      {/* Edit Form Modal */}
      {editRecord && (
        <NewBelieverForm
          branchId={profile!.branch_id}
          recordedBy={profile!.id}
          isDemo={isDemo}
          initialData={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={() => {
            setEditRecord(null);
            if (!isDemo) fetchBelievers();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-black mb-2">Delete Record</h3>
            <p className="text-gray-500 text-sm mb-6">
              Are you sure you want to delete <strong>{deletingRecord?.full_name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewBelieverForm({
  branchId,
  recordedBy,
  isDemo,
  onClose,
  onSaved,
  initialData,
}: {
  branchId: string;
  recordedBy: string;
  isDemo: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialData?: NewBelieverWithRecorder;
}) {
  const supabase = createClient();
  const isEditing = !!initialData;
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [form, setForm] = useState({
    first_name: initialData?.first_name || (initialData ? initialData.full_name.split(' ')[0] : ''),
    last_name: initialData?.last_name || (initialData ? initialData.full_name.split(' ').slice(1).join(' ') : ''),
    nickname: initialData?.nickname || '',
    address: initialData?.address || '',
    bacenta: initialData?.bacenta || '',
    phone_number: initialData?.phone_number || '',
    who_brought: initialData?.who_brought || '',
    birthday: initialData?.birthday || '',
    date_saved: initialData?.date_saved || new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isDemo) {
      setBacentas(DEMO_BACENTAS);
    } else {
      supabase
        .from('bacentas')
        .select('*')
        .eq('branch_id', branchId)
        .order('name')
        .then(({ data }: { data: Bacenta[] | null }) => setBacentas(data || []));
    }
  }, [branchId, isDemo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();

    if (isDemo) { onSaved(); return; }

    const payload = {
      full_name,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      nickname: form.nickname.trim() || null,
      address: form.address,
      bacenta: form.bacenta,
      phone_number: form.phone_number,
      who_brought: form.who_brought,
      birthday: form.birthday || null,
      date_saved: form.date_saved,
    };

    const { error } = isEditing
      ? await supabase.from('new_believers').update(payload).eq('id', initialData!.id)
      : await supabase.from('new_believers').insert({ ...payload, branch_id: branchId, recorded_by: recordedBy });

    if (error) {
      setFormError(error.message || 'Failed to save. Please try again.');
      setLoading(false);
    } else {
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black">{isEditing ? 'Edit New Believer' : 'Record New Believer'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{formError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" placeholder="First name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" placeholder="Last name" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nickname <span className="text-gray-400">(Known As)</span></label>
            <input type="text" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" placeholder="Optional nickname" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
            <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" placeholder="Enter address" />
          </div>

          <BacentaSelect
            label="Assign to Bacenta"
            required
            value={form.bacenta}
            onChange={(value) => setForm({ ...form, bacenta: value })}
            bacentas={bacentas}
            includeLeader
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (WhatsApp)</label>
            <input type="tel" required value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" placeholder="+234 xxx xxx xxxx" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Who Brought You to Church</label>
            <input type="text" required value={form.who_brought} onChange={(e) => setForm({ ...form, who_brought: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" placeholder="Name of person" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Saved</label>
            <input type="date" required value={form.date_saved} onChange={(e) => setForm({ ...form, date_saved: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black" />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 font-medium disabled:opacity-50">
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
