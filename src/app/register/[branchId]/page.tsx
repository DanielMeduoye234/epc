'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Church, CheckCircle2, AlertCircle, Camera, ShieldCheck, X } from 'lucide-react';
import { downscalePhoto } from '@/lib/photos';

interface PublicBranch {
  id: string;
  name: string;
  location: string | null;
}

interface PublicBacenta {
  id: string;
  name: string;
  leader_name: string | null;
}

interface RegisterForm {
  full_name: string;
  phone_number: string;
  bacenta: string;
  address: string;
  who_brought: string;
  is_first_timer: boolean;
}

const EMPTY_FORM: RegisterForm = {
  full_name: '', phone_number: '', bacenta: '', address: '', who_brought: '', is_first_timer: false,
};

export default function BranchRegisterPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;

  const [branch, setBranch] = useState<PublicBranch | null>(null);
  const [bacentas, setBacentas] = useState<PublicBacenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    (async () => {
      try {
        const res = await fetch(`/api/register/${branchId}`);
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error || 'This registration link is not valid.');
        } else {
          setBranch(data.branch);
          setBacentas(data.bacentas);
        }
      } catch {
        setLoadError('Could not load the registration form. Please check your connection and try again.');
      }
      setLoading(false);
    })();
  }, [branchId]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSubmitError('Please choose an image file for your photo.');
      return;
    }
    setSubmitError('');
    const resized = await downscalePhoto(file);
    setPhotoFile(resized);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(resized));
  }

  function removePhoto() {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.phone_number.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const formData = new FormData();
      formData.append('full_name', form.full_name);
      formData.append('phone_number', form.phone_number);
      formData.append('bacenta', form.bacenta);
      formData.append('address', form.address);
      formData.append('who_brought', form.who_brought);
      formData.append('is_first_timer', String(form.is_first_timer));
      if (photoFile) formData.append('photo', photoFile);

      const res = await fetch(`/api/register/${branchId}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || 'Registration failed. Please try again.');
      } else {
        removePhoto();
        setDone(true);
      }
    } catch {
      setSubmitError('Registration failed. Please check your connection and try again.');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !branch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <h1 className="text-lg font-bold text-black mb-1">Link Not Valid</h1>
          <p className="text-sm text-gray-500">{loadError || 'This registration link is not valid.'}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <CheckCircle2 size={44} className="mx-auto text-green-500 mb-3" />
          <h1 className="text-lg font-bold text-black mb-1">You&apos;re Registered!</h1>
          <p className="text-sm text-gray-500">
            Welcome to <span className="font-semibold text-black">{branch.name}</span>.
            We&apos;re glad to have you.
          </p>
          <button
            onClick={() => { setForm(EMPTY_FORM); setDone(false); }}
            className="mt-5 px-5 py-2.5 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
          >
            Register another person
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto bg-linear-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mb-3">
            <Church size={26} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-black">{branch.name}</h1>
          {branch.location && <p className="text-sm text-gray-500">{branch.location}</p>}
          <p className="text-sm text-gray-500 mt-2">Fill in your details to register with this branch</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                required
                type="text"
                value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="e.g. John Akpan"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input
                required
                type="tel"
                value={form.phone_number}
                onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="+234..."
              />
            </div>
            {bacentas.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bacenta</label>
                <select
                  value={form.bacenta}
                  onChange={e => setForm(p => ({ ...p, bacenta: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                >
                  <option value="">Select a bacenta (optional)...</option>
                  {bacentas.map(b => (
                    <option key={b.id} value={b.name}>
                      {b.name}{b.leader_name ? ` - ${b.leader_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Home address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Who Brought You</label>
              <input
                type="text"
                value={form.who_brought}
                onChange={e => setForm(p => ({ ...p, who_brought: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-black text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Name of person"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Photo <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
                id="photo-input"
              />
              {photoPreview ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Your photo"
                    className="w-16 h-16 rounded-full object-cover border-2 border-orange-200"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
                    >
                      <X size={12} />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-orange-300 hover:text-orange-600 transition"
                >
                  <Camera size={18} />
                  Take or upload a photo of your face
                </button>
              )}
            </div>
            <label className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_first_timer}
                onChange={e => setForm(p => ({ ...p, is_first_timer: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-orange-500 rounded cursor-pointer"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">This is my first time</span>
                <span className="block text-xs text-gray-500 mt-0.5">Tick this if you are visiting for the first time</span>
              </div>
            </label>

            <div className="flex items-start gap-2.5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <ShieldCheck size={16} className="text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-600">Privacy notice:</span> The information you
                provide here (including your photo) is collected strictly for church records and
                follow-up purposes only. It will never be sold, rented, or shared with any external
                organisation.
              </p>
            </div>

            {submitError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-linear-to-r from-orange-400 to-orange-600 text-white font-medium rounded-lg hover:from-orange-500 hover:to-orange-700 transition disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
