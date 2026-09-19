'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Bacenta, Profile, UserRole } from '@/lib/types';
import { UserPlus, X, Shield, MessageCircle, Save, Check } from 'lucide-react';
import BacentaSelect from '@/components/BacentaSelect';

export default function SettingsPage() {
  const { profile, isDemo } = useAuth();
  const supabase = createClient();
  const [users, setUsers] = useState<Profile[]>([]);
  const [bacentas, setBacentas] = useState<Bacenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappPhoneId, setWhatsappPhoneId] = useState('');
  const [whatsappSaved, setWhatsappSaved] = useState(false);
  const [whatsappSaving, setWhatsappSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchUsers();
      fetchBacentas();
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
      .select('whatsapp_phone, whatsapp_phone_number_id')
      .eq('branch_id', profile!.branch_id)
      .single();
    if (data?.whatsapp_phone) setWhatsappPhone(data.whatsapp_phone);
    if (data?.whatsapp_phone_number_id) setWhatsappPhoneId(data.whatsapp_phone_number_id);
  }

  async function saveWhatsAppConfig() {
    setWhatsappSaving(true);
    if (!isDemo) {
      await supabase
        .from('branch_settings')
        .upsert({
          branch_id: profile!.branch_id,
          whatsapp_phone: whatsappPhone,
          whatsapp_phone_number_id: whatsappPhoneId || null,
        }, { onConflict: 'branch_id' });
    }
    setWhatsappSaving(false);
    setWhatsappSaved(true);
    setTimeout(() => setWhatsappSaved(false), 3000);
  }

  async function fetchUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*, bacenta:bacentas!profiles_bacenta_id_fkey(*), shepherd_bacentas(bacenta:bacentas(*))')
      .eq('branch_id', profile!.branch_id)
      .order('created_at', { ascending: false });
    const mapped = (data || []).map((user: Profile & { shepherd_bacentas?: { bacenta: Bacenta | null }[] }) => ({
      ...user,
      bacentas: (user.shepherd_bacentas || []).map((row) => row.bacenta).filter(Boolean) as Bacenta[],
    }));
    setUsers(mapped);
    setLoading(false);
  }

  async function fetchBacentas() {
    const { data } = await supabase
      .from('bacentas')
      .select('*')
      .eq('branch_id', profile!.branch_id)
      .order('name');
    setBacentas(data || []);
  }

  async function updateRole(userId: string, role: UserRole) {
    await supabase.from('profiles').update({ role, bacenta_id: role === 'shepherd' ? users.find((u) => u.id === userId)?.bacenta_id || null : null }).eq('id', userId);
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
          className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition"
        >
          <UserPlus size={20} />
          Invite User
        </button>
      </div>

      {/* Branch Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-black mb-1">Branch</h3>
        <p className="text-sm text-gray-600">{profile.branch?.name || 'Unknown Branch'}</p>
      </div>

      {/* WhatsApp Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={18} className="text-green-600" />
          <h3 className="text-base font-semibold text-black">WhatsApp sender</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4 max-w-2xl">
          Sending is per branch, not per staff account. Everyone at {profile.branch?.name || 'this branch'} uses the same church WhatsApp line. Another branch can use a different Meta Phone Number ID. Individual shepherds cannot attach personal WhatsApp numbers.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 max-w-3xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display number</label>
            <input
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+234 801 234 5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Shown to your team. International format.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Phone Number ID</label>
            <input
              type="text"
              value={whatsappPhoneId}
              onChange={(e) => setWhatsappPhoneId(e.target.value)}
              placeholder="123456789012345"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">From Meta WhatsApp Business. Falls back to the server default if blank.</p>
          </div>
        </div>
        <button
          onClick={saveWhatsAppConfig}
          disabled={whatsappSaving}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition disabled:opacity-50"
        >
          {whatsappSaved ? <Check size={16} /> : <Save size={16} />}
          {whatsappSaving ? 'Saving...' : whatsappSaved ? 'Saved' : 'Save WhatsApp sender'}
        </button>
        {whatsappSaved && (
          <p className="mt-2 text-sm text-green-700">Sender updated for this branch.</p>
        )}
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="table-shell">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-black">Team ({users.length})</h3>
          </div>
          {users.length === 0 ? (
            <p className="px-3 py-8 text-sm text-gray-500 text-center">No team members yet. Invite a shepherd or officer to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-compact">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Bacenta</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="person-avatar rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                            <span className="text-white text-[10px] font-bold">
                              {user.full_name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </span>
                          </div>
                          <span className="font-medium text-black">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="text-gray-600">{user.email}</td>
                      <td className="text-gray-600">
                        {user.role === 'shepherd'
                          ? user.bacentas?.map((b) => b.name).join(', ') || user.bacenta?.name || 'Unassigned'
                          : '—'}
                      </td>
                      <td>
                        {user.id === profile.id ? (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${roleColors[user.role]}`}>
                            {user.role.replace('_', ' ')}
                          </span>
                        ) : (
                          <select
                            value={user.role}
                            onChange={(e) => updateRole(user.id, e.target.value as UserRole)}
                            className="px-2 py-1 border border-gray-200 rounded text-xs focus:ring-2 focus:ring-orange-500 outline-none text-black bg-white"
                          >
                            <option value="bishop">Bishop</option>
                            <option value="super_admin">Super Admin</option>
                            <option value="shepherd">Shepherd</option>
                            <option value="recorder">Recorder</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <InviteUserForm
          branchId={profile.branch_id}
          bacentas={bacentas}
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
  bacentas,
  onClose,
  onInvited,
}: {
  branchId: string;
  bacentas: Bacenta[];
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
    bacenta_id: '',
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
        bacenta_id: form.role === 'shepherd' ? form.bacenta_id : undefined,
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
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole, bacenta_id: e.target.value === 'shepherd' ? form.bacenta_id : '' })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black"
            >
              <option value="bishop">Bishop</option>
              <option value="super_admin">Super Admin (Pastor)</option>
              <option value="shepherd">Shepherd</option>
              <option value="recorder">New Believer Recorder</option>
            </select>
          </div>

          {form.role === 'shepherd' && (
            <div>
              <BacentaSelect
                label="Initial Bacenta Assignment"
                value={form.bacenta_id}
                onChange={(value) => setForm({ ...form, bacenta_id: value })}
                options={bacentas.map((b) => ({ value: b.id, label: b.name }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-black bg-white disabled:bg-gray-100 disabled:text-gray-400"
                placeholder={bacentas.length === 0 ? 'Create a bacenta first' : 'Optional: select bacenta...'}
                disabled={bacentas.length === 0}
              />
              {bacentas.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">Create a bacenta before adding shepherd accounts.</p>
              )}
            </div>
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
              className="flex-1 px-4 py-2.5 bg-linear-to-r from-orange-400 to-orange-600 text-white rounded-lg hover:from-orange-500 hover:to-orange-700 font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
