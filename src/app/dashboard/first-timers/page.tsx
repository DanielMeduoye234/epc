'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { FirstTimer, Bacenta } from '@/lib/types';
import { DEMO_BACENTAS, DEMO_FIRST_TIMERS } from '@/lib/demo-data';
import { Plus, Search, X, Pencil, Trash2, Download, Upload, Phone } from 'lucide-react';
import Link from 'next/link';
import BacentaSelect from '@/components/BacentaSelect';
import Pagination from '@/components/Pagination';
import WhatsAppMessageModal, { WhatsAppRecipient } from '@/components/WhatsAppMessageModal';
import CsvImportModal from '@/components/CsvImportModal';
import { exportToCsv } from '@/lib/csv';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

type FirstTimerWithAttendance = FirstTimer & { _max_in_month?: number };

export default function FirstTimersPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [firstTimers, setFirstTimers] = useState<FirstTimerWithAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [editRecord, setEditRecord] = useState<FirstTimerWithAttendance | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [whatsAppRecipient, setWhatsAppRecipient] = useState<WhatsAppRecipient | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setFirstTimers(DEMO_FIRST_TIMERS.map(ft => ({
          ...ft,
          first_name: null,
          last_name: null,
          nickname: null,
          birthday: null,
        })));
        setBacentas(DEMO_BACENTAS);
        setLoading(false);
      } else {
        fetchFirstTimers();
        supabase
          .from('bacentas')
          .select('*')
          .eq('branch_id', profile.branch_id)
          .order('name')
          .then(({ data }: { data: Bacenta[] | null }) => setBacentas(data || []));
      }
    }
  }, [profile, isDemo]);

  async function fetchFirstTimers() {
    let query = supabase
      .from('first_timers')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .eq('status', 'first_timer')
      .order('created_at', { ascending: false });

    if (profile!.role === 'shepherd') {
      query = query.eq('assigned_shepherd', profile!.id);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      const ids = data.map((ft: FirstTimer) => ft.id);
      const { data: attData } = await supabase
        .from('attendance')
        .select('person_id, date')
        .in('person_id', ids)
        .eq('is_present', true);

      const attByPerson: Record<string, string[]> = {};
      (attData || []).forEach((a: { person_id: string; date: string }) => {
        if (!attByPerson[a.person_id]) attByPerson[a.person_id] = [];
        attByPerson[a.person_id].push(a.date);
      });

      const withAttendance = data.map((ft: FirstTimer) => {
        const dates = attByPerson[ft.id] || [];
        const monthCounts: Record<string, number> = {};
        dates.forEach(d => {
          const month = d.slice(0, 7);
          monthCounts[month] = (monthCounts[month] || 0) + 1;
        });
        const maxInMonth = Object.values(monthCounts).length > 0 ? Math.max(...Object.values(monthCounts)) : 0;
        return { ...ft, attendance_count: dates.length, _max_in_month: maxInMonth };
      });
      setFirstTimers(withAttendance);
    } else {
      setFirstTimers(data || []);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    if (!isDemo) {
      await supabase.from('first_timers').delete().eq('id', deleteId);
    }
    setFirstTimers(prev => prev.filter(ft => ft.id !== deleteId));
    setDeleteId(null);
  }

  const handleExport = () => {
    const today = new Date().toISOString().split('T')[0];
    const dataToExport = filtered.map(ft => ({
      full_name: ft.full_name,
      phone_number: ft.phone_number,
      address: ft.address,
      bacenta: ft.bacenta,
      who_brought: ft.who_brought,
      date_joined: ft.date_joined ? new Date(ft.date_joined).toLocaleDateString() : '',
      attendance_count: ft.attendance_count ?? 0,
      birthday: ft.birthday || '',
    }));

    exportToCsv(
      `epc-first-timers-${today}.csv`,
      [
        { label: 'Person', key: 'full_name' },
        { label: 'Phone', key: 'phone_number' },
        { label: 'Address', key: 'address' },
        { label: 'Bacenta', key: 'bacenta' },
        { label: 'Who Brought', key: 'who_brought' },
        { label: 'Date Joined', key: 'date_joined' },
        { label: 'Attendance Count', key: 'attendance_count' },
        { label: 'Birthday', key: 'birthday' },
      ],
      dataToExport
    );
  };

  const filtered = firstTimers.filter(
    (ft) =>
      ft.full_name.toLowerCase().includes(search.toLowerCase()) ||
      ft.bacenta.toLowerCase().includes(search.toLowerCase())
  );

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const deletingRecord = firstTimers.find(ft => ft.id === deleteId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">First Timers</h1>
          <p className="text-gray-500 mt-1">First-time visitors — promoted to Member when attending twice in a month</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition shadow-2xs text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="Export current table to CSV"
          >
            <Download size={17} className="text-gray-500" />
            Export CSV
          </button>
          {(profile?.role === 'super_admin' || profile?.role === 'bishop' || profile?.role === 'shepherd' || profile?.role === 'recorder') && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-orange-50 border border-orange-200 text-orange-700 font-medium rounded-lg hover:bg-orange-100 transition shadow-2xs text-sm cursor-pointer"
                title="Upload CSV to import records"
              >
                <Upload size={17} className="text-orange-600" />
                Upload CSV
              </button>
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition shadow-2xs text-sm cursor-pointer">
                <Plus size={18} /> Add First Timer
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search by name or bacenta..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black text-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {paginatedData.map((ft) => {
              const maxInMonth = ft._max_in_month ?? 0;
              const isReady = maxInMonth >= 2;
              return (
                <div
                  key={ft.id}
                  className="bg-white rounded-2xl shadow-xs border border-gray-100 p-4 transition hover:border-orange-200"
                >
                  {/* Header: Avatar, Name, Ready Pill */}
                  <div className="flex items-start gap-3">
                    <Link
                      href={`/dashboard/profile/first-timer/${ft.id}`}
                      className="shrink-0 active:scale-95 transition-transform"
                    >
                      <div className="w-12 h-12 rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-xs overflow-hidden ring-2 ring-orange-100">
                        {ft.photo_url ? (
                          <img
                            src={ft.photo_url}
                            alt={ft.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>
                            {ft.full_name
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
                          href={`/dashboard/profile/first-timer/${ft.id}`}
                          className="min-w-0 flex-1 block group"
                        >
                          <h3 className="font-semibold text-gray-900 text-base leading-snug group-hover:text-orange-600 transition break-words">
                            {ft.full_name}
                          </h3>
                          {ft.nickname && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              Known as: <span className="text-gray-600 font-medium">{ft.nickname}</span>
                            </p>
                          )}
                        </Link>

                        {/* Readiness badge */}
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            isReady
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-50 text-orange-700 border border-orange-200/60'
                          }`}
                        >
                          {maxInMonth}/2 {isReady ? 'Ready!' : 'Month'}
                        </span>
                      </div>

                      {/* Attendance Progress Bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-linear-to-r from-orange-400 to-orange-600 rounded-full transition-all"
                            style={{ width: `${Math.min((maxInMonth / 2) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-400 font-medium">
                          {maxInMonth} of 2 attendances
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details Section */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                      <span className="text-gray-400 text-[11px] font-medium">Bacenta:</span>
                      <span className="font-semibold text-gray-800">{ft.bacenta || 'Unassigned'}</span>
                    </span>

                    <span className="text-gray-300 select-none">•</span>

                    <span className="text-gray-500">
                      Joined {new Date(ft.date_joined).toLocaleDateString()}
                    </span>

                    {ft.phone_number && (
                      <>
                        <span className="text-gray-300 select-none">•</span>
                        <a
                          href={`tel:${ft.phone_number}`}
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-gray-600 hover:text-orange-600 hover:underline"
                          title="Call phone number"
                        >
                          <Phone size={12} className="text-gray-400" />
                          <span>{ft.phone_number}</span>
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
                          name: ft.full_name,
                          phoneNumber: ft.phone_number,
                          nickname: ft.nickname,
                          category: 'first_timer',
                          bacenta: ft.bacenta,
                          photoUrl: ft.photo_url,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                      <span>WhatsApp</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditRecord(ft)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition active:scale-95 cursor-pointer"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteId(ft.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition active:scale-95 cursor-pointer"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-100">
                {search ? 'No results found' : 'No first timers recorded yet'}
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block table-shell">
            <div className="overflow-x-auto">
              <table className="table-compact">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Person</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Phone</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Address</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Bacenta</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">Date Joined</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-gray-700">This Month</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedData.map((ft) => {
                    const maxInMonth = ft._max_in_month ?? 0;
                    const isReady = maxInMonth >= 2;
                    return (
                      <tr key={ft.id} className="hover:bg-orange-50/50 transition">
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/profile/first-timer/${ft.id}`} className="flex items-center gap-3">
                            <div className="person-avatar rounded-full bg-linear-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0 overflow-hidden">
                              {ft.photo_url ? (
                                <img src={ft.photo_url} alt={ft.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white text-xs font-bold">
                                  {ft.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-black hover:text-orange-600 block">{ft.full_name}</span>
                              {ft.nickname && <span className="text-xs text-gray-400">Known as: {ft.nickname}</span>}
                            </div>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 text-sm">{ft.phone_number}</span>
                            <button
                              type="button"
                              title="Send WhatsApp template / message"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhatsAppRecipient({
                                  name: ft.full_name,
                                  phoneNumber: ft.phone_number,
                                  nickname: ft.nickname,
                                  category: 'first_timer',
                                  bacenta: ft.bacenta,
                                  photoUrl: ft.photo_url,
                                });
                              }}
                              className="p-1 hover:bg-green-50 rounded-full transition group"
                            >
                              <WhatsAppIcon className="w-5 h-5 text-[#25D366] group-hover:scale-110 transition-transform" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 text-sm max-w-45 truncate" title={ft.address}>{ft.address}</td>
                        <td className="px-6 py-4 text-gray-600">{ft.bacenta}</td>
                        <td className="px-6 py-4 text-gray-600">{new Date(ft.date_joined).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full bg-linear-to-r from-orange-400 to-orange-600 rounded-full transition-all"
                                style={{ width: `${Math.min(maxInMonth / 2 * 100, 100)}%` }} />
                            </div>
                            <span className={`text-xs font-medium ${isReady ? 'text-green-600' : 'text-gray-500'}`}>
                              {maxInMonth}/2 {isReady ? '— Ready!' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditRecord(ft)}
                              className="p-1.5 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition" title="Edit">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => setDeleteId(ft.id)}
                              className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">
                        {search ? 'No results found' : 'No first timers recorded yet'}
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

      {showForm && (
        <FirstTimerForm profile={profile!} isDemo={isDemo}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); if (!isDemo) fetchFirstTimers(); }} />
      )}

      {editRecord && (
        <FirstTimerForm profile={profile!} isDemo={isDemo} initialData={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={() => { setEditRecord(null); if (!isDemo) fetchFirstTimers(); }} />
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-black mb-2">Delete Record</h3>
            <p className="text-gray-500 text-sm mb-6">
              Are you sure you want to delete <strong>{deletingRecord?.full_name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium">Delete</button>
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
          if (!isDemo) fetchFirstTimers();
        }}
        entityType="first_timers"
        branchId={profile?.branch_id || ''}
        userId={profile?.id || ''}
        isDemo={isDemo}
        availableBacentas={bacentas}
        userRole={profile?.role}
      />
    </div>
  );
}

function FirstTimerForm({
  profile, isDemo, onClose, onSaved, initialData,
}: {
  profile: NonNullable<ReturnType<typeof useAuth>['profile']>; isDemo: boolean; onClose: () => void; onSaved: () => void; initialData?: FirstTimerWithAttendance;
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
    bacenta: initialData?.bacenta || profile.bacentas?.[0]?.name || profile.bacenta?.name || '',
    phone_number: initialData?.phone_number || '',
    who_brought: initialData?.who_brought || '',
    birthday: initialData?.birthday || '',
    date_joined: initialData?.date_joined || new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isDemo) { setBacentas(DEMO_BACENTAS); return; }
    if (profile.role === 'shepherd') {
      setBacentas(profile.bacentas && profile.bacentas.length > 0 ? profile.bacentas : profile.bacenta ? [profile.bacenta] : []);
      return;
    }
    supabase.from('bacentas').select('*').eq('branch_id', profile.branch_id).order('name')
      .then(({ data }: { data: Bacenta[] | null }) => setBacentas(data || []));
  }, [profile, isDemo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);
    const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
    if (isDemo) { onSaved(); return; }

    const payload = {
      full_name, first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      nickname: form.nickname.trim() || null, address: form.address, bacenta: form.bacenta,
      phone_number: form.phone_number, who_brought: form.who_brought,
      birthday: form.birthday || null, date_joined: form.date_joined,
    };

    const { error } = isEditing
      ? await supabase.from('first_timers').update(payload).eq('id', initialData!.id)
      : await supabase.from('first_timers').insert({
        ...payload,
        branch_id: profile.branch_id,
        assigned_shepherd: profile.role === 'shepherd' ? profile.id : null,
        status: 'first_timer',
      });

    if (error) { setFormError(error.message || 'Failed to save.'); setLoading(false); }
    else { onSaved(); }
  };

  const inputCls = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black">{isEditing ? 'Edit First Timer' : 'Add First Timer'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X size={20} className="text-gray-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{formError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className={inputCls} placeholder="First name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className={inputCls} placeholder="Last name" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nickname <span className="text-gray-400">(Known As)</span></label>
            <input type="text" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} className={inputCls} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
            <input type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Enter address" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Bacenta</label>
            <BacentaSelect
              required
              value={form.bacenta}
              onChange={(value) => setForm({ ...form, bacenta: value })}
              bacentas={bacentas}
              includeLeader
              className={`${inputCls} bg-white`}
              placeholder="Select a bacenta..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (WhatsApp)</label>
            <input type="tel" required value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} className={inputCls} placeholder="+234 xxx xxx xxxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Who Brought You to Church</label>
            <input type="text" required value={form.who_brought} onChange={e => setForm({ ...form, who_brought: e.target.value })} className={inputCls} placeholder="Name of person" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day You Joined the Church</label>
            <input type="date" required value={form.date_joined} onChange={e => setForm({ ...form, date_joined: e.target.value })} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
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

