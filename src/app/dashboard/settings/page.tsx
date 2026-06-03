'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Profile, UserRole } from '@/lib/types';
import { UserPlus, X, Shield, MessageCircle, Save, Check } from 'lucide-react';

export default function SettingsPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappSaved, setWhatsappSaved] = useState(false);
  const [whatsappSaving, setWhatsappSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchUsers();
      loadWhatsAppConfig();
    }
  }, [profile]);

  async function loadWhatsAppConfig() {
    if (isDemo) {
      setWhatsappPhone('+234 801 234 5678');
      return;
    }
    const { data } = await supabase
      .from('branch_settings')
      .select('whatsapp_phone')
      .eq('branch_id', profile!.branch_id)
      .single();
    if (data?.whatsapp_phone) setWhatsappPhone(data.whatsapp_phone);
  }

  async function saveWhatsAppConfig() {
    setWhatsappSaving(true);
    if (!isDemo) {
      await supabase
        .from('branch_settings')
        .upsert({
          branch_id: profile!.branch_id,
          whatsapp_phone: whatsappPhone,
        }, { onConflict: 'branch_id' });
    }
    setWhatsappSaving(false);
    setWhatsappSaved(true);
    setTimeout(() => setWhatsappSaved(false), 3000);
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }

  async function updateRole(userId: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', userId);
    fetchUsers();
  }

  const roleColors: Record<string, string> = {
    bishop: 'bg-purple-100 text-purple-700',
    super_admin: 'bg-orange-100 text-orange-700',
    shepherd: 'bg-blue-100 text-blue-700',
    recorder: 'bg-green-100 text-green-700',
  };

  if (profile?.role !== 'super_admin' && profile?.role !== 'bishop') {
    return (
      <div className="text-center py-12">
        <Shield size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-400">You don&apos;t have permission to access settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-black">Settings</h1>
          <p className="text-gray-500 mt-1">Manage users and roles for your branch</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition"
        >
          <UserPlus size={20} />
          Invite User
        </button>
      </div>

      {/* Branch Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-black mb-2">Branch Information</h3>
        <p className="text-gray-600">{profile.branch?.name || 'Unknown Branch'}</p>
      </div>

      {/* WhatsApp Configuration */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={20} className="text-green-500" />
          <h3 className="text-lg font-semibold text-black">WhatsApp Configuration</h3>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Set the sender phone number for broadcasts and prayer reminders via WhatsApp Business API
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sender Phone Number</label>
            <input
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+234 801 234 5678"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-black"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Use international format. This number must be registered with WhatsApp Business API.
            </p>
          </div>
          <div className="flex items-end">
            <button
              onClick={saveWhatsAppConfig}
              disabled={whatsappSaving || !whatsappPhone}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition disabled:opacity-50"
            >
              {whatsappSaved ? <Check size={18} /> : <Save size={18} />}
              {whatsappSaving ? 'Saving...' : whatsappSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
        {whatsappSaved && (
          <div className="mt-3 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
            WhatsApp sender number updated successfully!
          </div>
        )}
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-black">Team Members ({users.length})</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {user.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-black">{user.full_name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {user.id === profile.id ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) => updateRole(user.id, e.target.value as UserRole)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
                    >
                      <option value="bishop">Bishop</option>
                      <option value="super_admin">Super Admin (Pastor)</option>
                      <option value="shepherd">Shepherd</option>
                      <option value="recorder">Recorder</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteUserForm
          branchId={profile.branch_id}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}

function InviteUserForm({
  branchId,
  onClose,
  onInvited,
}: {
  branchId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'shepherd' as UserRole,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        role: form.role,
        branch_id: branchId,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || 'Failed to create user');
      setLoading(false);
      return;
    }

    onInvited();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-black">Invite User</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              placeholder="user@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
              placeholder="Min 6 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
            >
              <option value="bishop">Bishop</option>
              <option value="super_admin">Super Admin (Pastor)</option>
              <option value="shepherd">Shepherd</option>
              <option value="recorder">New Believer Recorder</option>
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
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
