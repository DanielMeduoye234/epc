'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { PrayerSchedule, BroadcastAudience } from '@/lib/types';
import { DEMO_PRAYER_SCHEDULES } from '@/lib/demo-data';
import { Plus, X, BookHeart, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function nextSendLabel(dayOfWeek: number, time: string) {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  const dayDiff = (dayOfWeek - now.getDay() + 7) % 7;
  if (dayDiff === 0 && next <= now) {
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + dayDiff);
  }
  const sameWeek = next.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameWeek) return `Today ${time}`;
  if (next.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${DAYS[dayOfWeek]} ${time}`;
}

export default function PrayersPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [schedules, setSchedules] = useState<PrayerSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setSchedules(DEMO_PRAYER_SCHEDULES);
        setLoading(false);
      } else {
        fetchSchedules();
      }
    }
  }, [profile, isDemo]);

  async function fetchSchedules() {
    const { data } = await supabase
      .from('prayer_schedules')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .order('day_of_week', { ascending: true });
    setSchedules(data || []);
    setLoading(false);
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    if (isDemo) {
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s));
      return;
    }
    await supabase.from('prayer_schedules').update({ is_active: !currentStatus }).eq('id', id);
    fetchSchedules();
  }

  async function deleteSchedule(id: string) {
    if (!confirm('Are you sure you want to delete this prayer schedule?')) return;
    if (isDemo) {
      setSchedules(prev => prev.filter(s => s.id !== id));
      return;
    }
    await supabase.from('prayer_schedules').delete().eq('id', id);
    fetchSchedules();
  }

  const audienceLabels: Record<string, string> = {
    all: 'Everyone',
    new_believers: 'New Believers',
    first_timers: 'First Timers',
    members: 'Members',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Automated Prayers</h1>
          <p className="text-gray-500 mt-1">Schedule daily prayers to send to members via WhatsApp</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition"
        >
          <Plus size={20} />
          New Prayer Schedule
        </button>
      </div>

      {/* Info Banner */}
      <div className="border border-gray-200 rounded-lg px-3 py-3 bg-white">
        <p className="text-sm font-medium text-black">How sending works</p>
        <p className="text-sm text-gray-600 mt-1">
          Active schedules go out on the chosen day and time over the branch WhatsApp line. Messages replace {'{name}'} with each person. The job checks every 5 minutes, so a 07:00 prayer sends between 07:00 and 07:04. WhatsApp credentials must be set in Settings and on the server.
        </p>
      </div>

      {/* Schedules */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="table-shell px-4 py-10 text-center">
          <BookHeart size={28} className="mx-auto mb-2 text-gray-400" />
          <p className="text-sm font-medium text-black">No prayer schedules yet</p>
          <p className="text-sm text-gray-500 mt-1">Create one to send a weekly WhatsApp prayer to a group.</p>
        </div>
      ) : (
        <div className="table-shell overflow-x-auto">
          <table className="table-compact">
            <thead>
              <tr>
                <th>Prayer</th>
                <th>When</th>
                <th>Audience</th>
                <th>Next send</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id} className={schedule.is_active ? '' : 'opacity-60'}>
                  <td>
                    <p className="font-medium text-black">{schedule.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 max-w-xs">{schedule.message}</p>
                  </td>
                  <td className="whitespace-nowrap">
                    {DAYS[schedule.day_of_week]} {schedule.time}
                  </td>
                  <td>{audienceLabels[schedule.audience]}</td>
                  <td className="whitespace-nowrap text-gray-600">
                    {schedule.is_active ? nextSendLabel(schedule.day_of_week, schedule.time) : 'Paused'}
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${schedule.is_active ? 'text-green-700' : 'text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${schedule.is_active ? 'bg-green-600' : 'bg-gray-400'}`} />
                      {schedule.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleActive(schedule.id, schedule.is_active)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        aria-label={schedule.is_active ? 'Pause schedule' : 'Activate schedule'}
                      >
                        {schedule.is_active ? (
                          <ToggleRight size={20} className="text-orange-600" />
                        ) : (
                          <ToggleLeft size={20} className="text-gray-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSchedule(schedule.id)}
                        className="p-1.5 hover:bg-red-50 rounded"
                        aria-label="Delete schedule"
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Form Modal */}
      {showForm && (
        <PrayerScheduleForm
          branchId={profile!.branch_id}
          createdBy={profile!.id}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            fetchSchedules();
          }}
        />
      )}
    </div>
  );
}

function PrayerScheduleForm({
  branchId,
  createdBy,
  onClose,
  onSaved,
}: {
  branchId: string;
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    day_of_week: 0,
    time: '07:00',
    audience: 'members' as BroadcastAudience,
  });

  // Prayer templates
  const prayerTemplates = [
    {
      label: 'Morning Prayer',
      title: 'Morning Prayer',
      message: 'Good morning {name}.\n\n"The Lord is my shepherd; I shall not want." Psalm 23:1\n\nMay God direct your steps today and give you peace in every situation.\n\nHave a blessed day.',
    },
    {
      label: 'Midweek Strength',
      title: 'Midweek Encouragement',
      message: 'Hi {name}.\n\n"I can do all things through Christ who strengthens me." Philippians 4:13\n\nDo not give up. God is with you in this season. We are praying for you.',
    },
    {
      label: 'Weekend Blessing',
      title: 'Weekend Blessing',
      message: 'Happy weekend {name}.\n\n"The Lord bless you and keep you; the Lord make His face shine upon you." Numbers 6:24-25\n\nMay this weekend be filled with rest and favor. See you in church.',
    },
    {
      label: 'Night Prayer',
      title: 'Night Prayer',
      message: 'Good night {name}.\n\n"He who dwells in the shelter of the Most High will rest in the shadow of the Almighty." Psalm 91:1\n\nMay God grant you peaceful sleep and keep you through the night.',
    },
  ];

  const handleTemplate = (template: typeof prayerTemplates[0]) => {
    setForm({
      ...form,
      title: template.title,
      message: template.message,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('prayer_schedules').insert({
      ...form,
      is_active: true,
      branch_id: branchId,
      created_by: createdBy,
    });

    if (!error) {
      onSaved();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black">New Prayer Schedule</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Templates */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Prayer Templates</label>
          <div className="flex flex-wrap gap-2">
            {prayerTemplates.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => handleTemplate(t)}
                className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium hover:bg-orange-100 transition"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              placeholder="e.g., Monday Morning Prayer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prayer Message <span className="text-gray-400">(use {'{name}'} for personalization)</span>
            </label>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black resize-none"
              placeholder="Type your prayer message..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              >
                {DAYS.map((day, i) => (
                  <option key={day} value={i}>{day}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Send To</label>
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as BroadcastAudience })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
            >
              <option value="all">Everyone</option>
              <option value="members">Members Only</option>
              <option value="new_believers">New Believers Only</option>
              <option value="first_timers">First Timers Only</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
