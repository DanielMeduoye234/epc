'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Broadcast, BroadcastAudience, MessageType } from '@/lib/types';
import { DEMO_BROADCASTS } from '@/lib/demo-data';
import { RECOMMENDED_TEMPLATES, templateNameForMessageType } from '@/lib/whatsapp-templates';
import { Send, Plus, X, Image as ImageIcon, Clock, CheckCircle, AlertCircle, Megaphone, FileText, RefreshCw } from 'lucide-react';

type MetaTemplate = {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  rejected_reason?: string;
};

export default function EpcNewsPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (profile) {
      if (isDemo) {
        setBroadcasts(DEMO_BROADCASTS);
        setLoading(false);
      } else {
        fetchBroadcasts();
      }
    }
  }, [profile, isDemo]);

  async function fetchBroadcasts() {
    const { data } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .order('created_at', { ascending: false });
    setBroadcasts(data || []);
    setLoading(false);
  }

  const statusIcons: Record<string, React.ReactNode> = {
    draft: <Clock size={16} className="text-gray-400" />,
    scheduled: <Clock size={16} className="text-blue-500" />,
    sent: <CheckCircle size={16} className="text-green-500" />,
    failed: <AlertCircle size={16} className="text-red-500" />,
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    scheduled: 'bg-blue-100 text-blue-700',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  const audienceLabels: Record<string, string> = {
    all: 'Everyone',
    new_believers: 'New Believers',
    first_timers: 'First Timers',
    members: 'Members',
  };

  const typeLabels: Record<string, string> = {
    news: 'News / Event',
    reminder: 'Service Reminder',
    prayer: 'Prayer',
    event: 'Event',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">EPC News</h1>
          <p className="text-gray-500 mt-1">Send broadcasts to members via WhatsApp</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition"
        >
          <Plus size={20} />
          New Broadcast
        </button>
      </div>

      {!isDemo && <WhatsAppTemplatesPanel />}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickAction
          title="Service Reminder"
          description="Remind everyone about upcoming service"
          icon={<Megaphone size={24} className="text-orange-500" />}
          onClick={() => setShowForm(true)}
        />
        <QuickAction
          title="Check-up Message"
          description="Send a caring message to new believers"
          icon={<Send size={24} className="text-orange-500" />}
          onClick={() => setShowForm(true)}
        />
        <QuickAction
          title="Event Announcement"
          description="Announce an upcoming event with image"
          icon={<ImageIcon size={24} className="text-orange-500" />}
          onClick={() => setShowForm(true)}
        />
      </div>

      {/* Broadcast History */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-black">Broadcast History</h3>
          </div>
          {broadcasts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Megaphone size={48} className="mx-auto mb-3 opacity-50" />
              <p>No broadcasts sent yet</p>
              <p className="text-sm mt-1">Create your first broadcast to reach your members</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {broadcasts.map((broadcast) => (
                <div key={broadcast.id} className="px-6 py-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {statusIcons[broadcast.status]}
                        <h4 className="font-medium text-black truncate">{broadcast.title}</h4>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{broadcast.message}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[broadcast.status]}`}>
                          {broadcast.status}
                        </span>
                        <span className="text-xs text-gray-400">
                          {audienceLabels[broadcast.audience]} • {broadcast.recipients_count} recipients
                        </span>
                        <span className="text-xs text-gray-400">
                          {typeLabels[broadcast.message_type]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">
                        {broadcast.sent_at
                          ? new Date(broadcast.sent_at).toLocaleDateString()
                          : new Date(broadcast.created_at).toLocaleDateString()}
                      </p>
                      {broadcast.image_url && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <ImageIcon size={12} /> Image
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose Form Modal */}
      {showForm && (
        <BroadcastForm
          branchId={profile!.branch_id}
          createdBy={profile!.id}
          onClose={() => setShowForm(false)}
          onSent={() => {
            setShowForm(false);
            fetchBroadcasts();
          }}
        />
      )}
    </div>
  );
}

function statusBadge(status: string) {
  const key = status.toUpperCase();
  if (key === 'APPROVED') return 'bg-green-100 text-green-700';
  if (key === 'PENDING' || key === 'IN_APPEAL') return 'bg-amber-100 text-amber-800';
  if (key === 'REJECTED' || key === 'PAUSED' || key === 'DISABLED') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function WhatsAppTemplatesPanel() {
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadTemplates() {
    setLoading(true);
    const response = await fetch('/api/whatsapp/templates');
    const data = await response.json();
    if (!response.ok) {
      setNotice({ type: 'error', text: data.error || 'Could not load templates from Meta.' });
      setTemplates([]);
    } else {
      setTemplates(data.templates || []);
      setNotice(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function submitRecommended() {
    setSubmitting(true);
    const response = await fetch('/api/whatsapp/templates', { method: 'POST' });
    const data = await response.json();
    setSubmitting(false);
    if (!response.ok) {
      setNotice({ type: 'error', text: data.error || 'Could not submit templates.' });
      return;
    }
    setTemplates(data.templates || []);
    const created = (data.created || []).length;
    const failed = data.failed || [];
    if (failed.length) {
      setNotice({
        type: 'error',
        text: failed.map((f: { name: string; error: string }) => `${f.name}: ${f.error}`).join(' '),
      });
    } else if (created) {
      setNotice({
        type: 'success',
        text: `Submitted ${created} template(s) to Meta. Status starts as Pending until they approve.`,
      });
    } else {
      setNotice({ type: 'success', text: 'These templates are already on Meta. Refresh if status looks stale.' });
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-black flex items-center gap-2">
            <FileText size={18} className="text-orange-500" />
            WhatsApp templates
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Meta must approve these before EPC News can reach people who have not messaged the church number. You still type the custom details when you send.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={loadTemplates}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={submitRecommended}
            disabled={submitting}
            className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit 3 templates to Meta'}
          </button>
        </div>
      </div>

      {notice && (
        <p className={`text-sm rounded-lg px-3 py-2 ${notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {notice.text}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RECOMMENDED_TEMPLATES.map((rec) => {
            const meta = templates.find((t) => t.name === rec.name);
            return (
              <div key={rec.name} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-black">{rec.label}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(meta?.status || 'Not submitted')}`}>
                    {meta?.status || 'Not submitted'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">{rec.description}</p>
                <p className="text-xs text-gray-400 mt-3">{rec.body}</p>
                {meta?.rejected_reason && (
                  <p className="text-xs text-red-600 mt-2">{meta.rejected_reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickAction({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-left hover:border-orange-200 hover:shadow-md transition"
    >
      <div className="mb-3">{icon}</div>
      <h4 className="font-medium text-black">{title}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </button>
  );
}

function BroadcastForm({
  branchId,
  createdBy,
  onClose,
  onSent,
}: {
  branchId: string;
  createdBy: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [sendNow, setSendNow] = useState(true);
  const [error, setError] = useState('');
  const [approvedTemplates, setApprovedTemplates] = useState<MetaTemplate[]>([]);
  const [form, setForm] = useState({
    title: '',
    message: '',
    image_url: '',
    audience: 'all' as BroadcastAudience,
    message_type: 'reminder' as MessageType,
    scheduled_at: '',
    template_name: templateNameForMessageType('reminder'),
  });

  useEffect(() => {
    fetch('/api/whatsapp/templates')
      .then((r) => r.json())
      .then((data) => {
        const approved = ((data.templates || []) as MetaTemplate[]).filter(
          (t) => t.status?.toUpperCase() === 'APPROVED'
        );
        setApprovedTemplates(approved);
      })
      .catch(() => setApprovedTemplates([]));
  }, []);

  // Message templates
  const templates = [
    {
      label: 'Service Reminder',
      title: 'Sunday Service Reminder',
      message: 'Hello {name}! 🙏\n\nThis is a reminder that our Sunday service is tomorrow. We would love to see you there!\n\n📍 Everything by Prayer Church\n⏰ Service starts at 9:00 AM\n\nCome expecting God to move! See you there. 🔥',
      type: 'reminder' as MessageType,
    },
    {
      label: 'Welcome Message',
      title: 'Welcome to EPC Family',
      message: 'Hello {name}! 🎉\n\nWe are so glad you joined us at Everything by Prayer. Your decision to follow Christ is the best decision of your life!\n\nWe are here for you. If you need anything, don\'t hesitate to reach out.\n\nGod bless you! 🙏',
      type: 'news' as MessageType,
    },
    {
      label: 'Check-up',
      message: 'Hi {name}! 💛\n\nJust checking in on you. We noticed you haven\'t been around for a bit and we miss you!\n\nEverything okay? Remember, you are part of this family and we care about you.\n\nHope to see you this Sunday! 🙏',
      title: 'We Miss You!',
      type: 'news' as MessageType,
    },
  ];

  const handleTemplate = (template: typeof templates[0]) => {
    setForm({
      ...form,
      title: template.title,
      message: template.message,
      message_type: template.type,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const response = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        branch_id: branchId,
        created_by: createdBy,
        send_now: sendNow,
        image_url: form.image_url || null,
        scheduled_at: sendNow ? null : form.scheduled_at || null,
        template_name: form.template_name,
        template_language: 'en_US',
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      onSent();
    } else {
      setError(data.error || 'Failed to send. Check that the WhatsApp template is Approved.');
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black">New Broadcast</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Templates */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Quick Templates</label>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
              <select
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value as BroadcastAudience })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              >
                <option value="all">Everyone</option>
                <option value="new_believers">New Believers Only</option>
                <option value="first_timers">First Timers Only</option>
                <option value="members">Members Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message Type</label>
              <select
                value={form.message_type}
                onChange={(e) => {
                  const message_type = e.target.value as MessageType;
                  setForm({
                    ...form,
                    message_type,
                    template_name: templateNameForMessageType(message_type),
                  });
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              >
                <option value="reminder">Sunday announcement</option>
                <option value="event">Special event</option>
                <option value="prayer">Church prayer</option>
                <option value="news">News / Announcement</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp template</label>
            <select
              value={form.template_name}
              onChange={(e) => setForm({ ...form, template_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
            >
              {RECOMMENDED_TEMPLATES.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label}
                  {approvedTemplates.some((a) => a.name === t.name) ? ' (Approved)' : ' (awaiting Meta)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Name goes in automatically. The message box below fills the custom details.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              placeholder="e.g., Sunday Service Reminder"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message <span className="text-gray-400">(use {'{name}'} for personalization)</span>
            </label>
            <textarea
              required
              rows={6}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black resize-none"
              placeholder="Type your message here... Use {name} to personalize with recipient's name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image URL <span className="text-gray-400">(optional - for event flyers, etc.)</span>
            </label>
            <input
              type="url"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              placeholder="https://example.com/flyer.jpg"
            />
            <p className="text-xs text-gray-400 mt-1">Upload your image to Supabase Storage and paste the public URL here</p>
          </div>

          {/* Send Options */}
          <div className="flex items-center gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={sendNow}
                onChange={() => setSendNow(true)}
                className="text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Send Now</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!sendNow}
                onChange={() => setSendNow(false)}
                className="text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Schedule</span>
            </label>
          </div>

          {!sendNow && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Date & Time</label>
              <input
                type="datetime-local"
                required={!sendNow}
                value={form.scheduled_at}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 font-medium disabled:opacity-50"
            >
              <Send size={18} />
              {loading ? 'Sending...' : sendNow ? 'Send Now' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
