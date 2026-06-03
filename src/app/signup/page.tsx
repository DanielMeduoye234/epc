'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isDemoMode } from '@/lib/demo-data';
import { Shield, Users, Heart } from 'lucide-react';

type SignupRole = 'super_admin' | 'shepherd' | 'recorder';

const roles: { value: SignupRole; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'super_admin', label: 'Super Admin / Pastor', description: 'Full dashboard control. You will set up your branch after signup.', icon: <Shield size={24} /> },
  { value: 'shepherd', label: 'Shepherd', description: 'Track your sheep attendance every Sunday. You need a branch code from your admin.', icon: <Users size={24} /> },
  { value: 'recorder', label: 'New Believer Officer', description: 'Record new believers who gave their lives to Christ. You need a branch code from your admin.', icon: <Heart size={24} /> },
];

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SignupRole>('super_admin');
  const [branchCode, setBranchCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const needsBranchCode = role === 'shepherd' || role === 'recorder';

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isDemoMode()) {
      setSuccess(true);
      setLoading(false);
      return;
    }

    // For shepherd/recorder: look up the branch by code first
    let branchId: string | null = null;
    if (needsBranchCode) {
      if (!branchCode.trim()) {
        setError('Please enter the branch code provided by your admin.');
        setLoading(false);
        return;
      }
      const { data: branch } = await supabase
        .from('branches')
        .select('id')
        .eq('branch_code', branchCode.trim().toUpperCase())
        .maybeSingle();
      if (!branch) {
        setError('Branch code not found. Please check with your admin and try again.');
        setLoading(false);
        return;
      }
      branchId = branch.id;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Create profile via server route (uses service role key — bypasses RLS)
    if (data.user) {
      const profileBody: Record<string, string> = {
        userId: data.user.id,
        full_name: fullName,
        email,
        role,
      };
      if (branchId) profileBody.branch_id = branchId;

      const res = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileBody),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Account created but profile setup failed. Please try logging in.');
        setLoading(false);
        return;
      }
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-black mb-2">Account Created!</h2>
          <p className="text-gray-500 mb-6">
            {isDemoMode()
              ? 'In demo mode, no actual account was created. Go back to login.'
              : 'Check your email to verify your account, then sign in.'}
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-700 transition"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-lg">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center">
            <img src="/logo.png" alt="EPC Logo" className="w-16 h-16 object-contain rounded-full" />
          </div>
          <h1 className="text-2xl font-bold text-black">Create Your Account</h1>
          <p className="text-gray-500 mt-1">Join the EPC Church Growth Dashboard</p>
        </div>

        {/* Signup Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-black"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-black"
                placeholder="you@epc.church"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition text-black"
                placeholder="Minimum 6 characters"
              />
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Select Your Role</label>
              <div className="space-y-3">
                {roles.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition ${
                      role === r.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={(e) => setRole(e.target.value as SignupRole)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      role === r.value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {r.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${role === r.value ? 'text-orange-700' : 'text-black'}`}>
                        {r.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      role === r.value ? 'border-orange-500' : 'border-gray-300'
                    }`}>
                      {role === r.value && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Branch code — only for shepherd/recorder joining an existing branch */}
            {needsBranchCode && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-blue-800 mb-1">Branch Code *</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                  required={needsBranchCode}
                  className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black bg-white"
                  placeholder="e.g. IKJ"
                />
                <p className="text-xs text-blue-600 mt-1">Ask your Super Admin or Pastor for the branch code.</p>
              </div>
            )}

            {role === 'super_admin' && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
                As Super Admin, you will create your branch immediately after signing in.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-orange-600 font-medium hover:text-orange-700">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
