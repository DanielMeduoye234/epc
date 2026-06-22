'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { createBirthdayMessage, isBirthdayToday, nextBirthdayDate } from '@/lib/birthdays';
import { Gift, MessageCircle, Search, Send, Sparkles } from 'lucide-react';

interface BirthdayMember {
  id: string;
  full_name: string;
  phone_number: string;
  birthday: string;
  bacenta: string;
  status: string;
}

export default function BirthdaysPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [members, setMembers] = useState<BirthdayMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (profile) fetchBirthdays();
  }, [profile]);

  async function fetchBirthdays() {
    setLoading(true);
    const { data } = await supabase
      .from('members')
      .select('id, full_name, phone_number, birthday, bacenta, status')
      .eq('branch_id', profile!.branch_id)
      .not('birthday', 'is', null)
      .order('full_name');
    setMembers((data || []) as BirthdayMember[]);
    setLoading(false);
  }

  const sortedMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return members
      .filter((member) => member.full_name.toLowerCase().includes(normalizedSearch) || member.bacenta.toLowerCase().includes(normalizedSearch))
      .map((member) => ({ ...member, nextBirthday: nextBirthdayDate(member.birthday) }))
      .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime());
  }, [members, search]);

  const todayBirthdays = sortedMembers.filter((member) => isBirthdayToday(member.birthday));
  const upcomingBirthdays = sortedMembers.filter((member) => !isBirthdayToday(member.birthday)).slice(0, 10);
  const selectedPreviewMember = todayBirthdays[0] || sortedMembers[0];

  async function sendBirthdayMessage(memberId: string) {
    setSendingId(memberId);
    setNotice(null);
    const response = await fetch('/api/birthdays/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice({ type: 'error', message: body.error || 'Could not send birthday message.' });
      setSendingId(null);
      return;
    }
    setNotice({ type: 'success', message: 'Birthday WhatsApp sent successfully.' });
    setSendingId(null);
  }

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
            <Gift className="text-orange-500" size={26} />
            Birthdays
          </h1>
          <p className="text-gray-500 mt-1">Record member birthdays and send WhatsApp greetings from Bishop Alex Kofi Opata</p>
        </div>
        <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 text-orange-700 text-sm font-semibold">
          {todayBirthdays.length} birthday{todayBirthdays.length === 1 ? '' : 's'} today
        </div>
      </div>

      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {notice.message}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_0.85fr] gap-5">
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-black">Member birthday list</h2>
              <p className="text-sm text-gray-500">Today first, then upcoming birthdays</p>
            </div>
            <div className="relative sm:w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member or bacenta"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-black outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {sortedMembers.map((member) => {
              const isToday = isBirthdayToday(member.birthday);
              return (
                <div key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-orange-50/40 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-black">{member.full_name}</p>
                      {isToday && <span className="text-[10px] font-bold text-orange-700 bg-orange-100 rounded-full px-2 py-0.5">TODAY</span>}
                    </div>
                    <p className="text-sm text-gray-500">{member.bacenta} · {member.nextBirthday.toLocaleDateString('en', { month: 'long', day: 'numeric' })}</p>
                  </div>
                  <button
                    onClick={() => sendBirthdayMessage(member.id)}
                    disabled={sendingId === member.id || !member.phone_number}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {sendingId === member.id ? 'Sending...' : <><Send size={15} /> Send WhatsApp</>}
                  </button>
                </div>
              );
            })}
            {sortedMembers.length === 0 && (
              <div className="text-center py-12 text-gray-400">No birthdays recorded yet.</div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="text-green-600" size={22} />
              <h2 className="font-bold text-black">WhatsApp draft</h2>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 whitespace-pre-line text-sm leading-6 text-gray-700">
              {selectedPreviewMember ? createBirthdayMessage(selectedPreviewMember.full_name) : createBirthdayMessage('Beloved Member')}
            </div>
          </div>

          <div className="bg-linear-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white shadow-sm">
            <Sparkles size={24} />
            <h2 className="font-bold text-lg mt-3">Automatic sending</h2>
            <p className="text-sm text-orange-50 mt-2 leading-6">
              Schedule `/api/cron/send-birthdays` once each morning to send greetings for members whose birthday is today.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-black mb-3">Upcoming</h2>
            <div className="space-y-3">
              {upcomingBirthdays.map((member) => (
                <div key={member.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{member.full_name}</span>
                  <span className="text-gray-400">{member.nextBirthday.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
              {upcomingBirthdays.length === 0 && <p className="text-sm text-gray-400">No upcoming birthdays.</p>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}