'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Camera, CheckCircle2, Clock, HeartHandshake, Search, UserRoundPlus, Video } from 'lucide-react';

interface CounsellingPastor {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  bio: string | null;
  specialties: string[] | null;
  photo_url: string | null;
  google_meet_link: string;
}

type ViewMode = 'book' | 'pastor';

export default function CounsellingPage() {
  const [mode, setMode] = useState<ViewMode>('book');
  const [pastors, setPastors] = useState<CounsellingPastor[]>([]);
  const [loadingPastors, setLoadingPastors] = useState(true);
  const [selectedPastorId, setSelectedPastorId] = useState('');
  const [search, setSearch] = useState('');
  const [bookingStatus, setBookingStatus] = useState<{ type: 'success' | 'error'; message: string; meetingLink?: string } | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [pastorStatus, setPastorStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pastorLoading, setPastorLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({ full_name: '', email: '', phone_number: '', scheduled_date: '', scheduled_time: '', topic: '', notes: '' });
  const [pastorForm, setPastorForm] = useState({ full_name: '', email: '', phone_number: '', bio: '', specialties: '', google_meet_link: '', photo_url: '' });

  useEffect(() => {
    fetchPastors();
  }, []);

  async function fetchPastors() {
    setLoadingPastors(true);
    const res = await fetch('/api/guide/pastors');
    const body = await res.json().catch(() => ({}));
    setPastors(body.pastors || []);
    setLoadingPastors(false);
  }

  const filteredPastors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pastors;
    return pastors.filter((pastor) =>
      pastor.full_name.toLowerCase().includes(query) ||
      (pastor.specialties || []).some((item) => item.toLowerCase().includes(query))
    );
  }, [pastors, search]);

  const selectedPastor = pastors.find((pastor) => pastor.id === selectedPastorId);

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1_000_000) {
      setPastorStatus({ type: 'error', message: 'Use an image below 1MB.' });
      return;
    }
    const photoUrl = await fileToDataUrl(file);
    setPastorForm((prev) => ({ ...prev, photo_url: photoUrl }));
  }

  async function handlePastorSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPastorLoading(true);
    setPastorStatus(null);
    const res = await fetch('/api/guide/pastors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...pastorForm,
        specialties: pastorForm.specialties.split(',').map((item) => item.trim()).filter(Boolean),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPastorStatus({ type: 'error', message: body.error || 'Could not register pastor.' });
      setPastorLoading(false);
      return;
    }
    setPastorStatus({ type: 'success', message: 'Pastor profile saved. Members can now book counselling with you.' });
    setPastorForm({ full_name: '', email: '', phone_number: '', bio: '', specialties: '', google_meet_link: '', photo_url: '' });
    setPastorLoading(false);
    fetchPastors();
  }

  async function handleBookingSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBookingLoading(true);
    setBookingStatus(null);
    const res = await fetch('/api/guide/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pastor_id: selectedPastorId,
        scheduled_date: bookingForm.scheduled_date,
        scheduled_time: bookingForm.scheduled_time,
        topic: bookingForm.topic,
        notes: bookingForm.notes,
        member: {
          full_name: bookingForm.full_name,
          email: bookingForm.email,
          phone_number: bookingForm.phone_number,
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBookingStatus({ type: 'error', message: body.error || 'Could not book counselling session.' });
      setBookingLoading(false);
      return;
    }
    setBookingStatus({ type: 'success', message: 'Counselling session requested. Use the Google Meet link at the scheduled time.', meetingLink: body.booking?.meeting_link });
    setBookingForm({ full_name: '', email: '', phone_number: '', scheduled_date: '', scheduled_time: '', topic: '', notes: '' });
    setSelectedPastorId('');
    setBookingLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-6 text-black sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/guide" className="flex items-center gap-3">
            <img src="/logo.png" alt="EPC Logo" className="h-12 w-12 rounded-full object-contain" />
            <div>
              <p className="font-bold">EPC Guide</p>
              <p className="text-sm text-gray-500">Intimate Counselling</p>
            </div>
          </Link>
          <div className="inline-flex rounded-xl border border-orange-200 bg-white p-1">
            <button onClick={() => setMode('book')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === 'book' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-50'}`}>Book counselling</button>
            <button onClick={() => setMode('pastor')} className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === 'pastor' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-orange-50'}`}>Pastor register</button>
          </div>
        </header>

        <section className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
            <HeartHandshake className="mb-4 text-orange-600" size={34} />
            <h1 className="text-3xl font-black tracking-normal text-gray-950">Private online counselling with EPC pastors.</h1>
            <p className="mt-4 leading-7 text-gray-600">This section keeps counselling records separate from the church growth dashboard. Pastors register here, members book here.</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-orange-50 p-3 text-center"><Video className="mx-auto text-orange-600" size={20} /><p className="mt-2 text-xs font-medium">Google Meet</p></div>
              <div className="rounded-xl bg-orange-50 p-3 text-center"><Clock className="mx-auto text-orange-600" size={20} /><p className="mt-2 text-xs font-medium">Timed sessions</p></div>
              <div className="rounded-xl bg-orange-50 p-3 text-center"><CalendarCheck className="mx-auto text-orange-600" size={20} /><p className="mt-2 text-xs font-medium">Easy booking</p></div>
            </div>
          </div>

          {mode === 'book' ? (
            <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="relative mb-4">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pastors or topics" className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div className="max-h-155 space-y-3 overflow-y-auto pr-1">
                  {loadingPastors ? <p className="py-8 text-center text-sm text-gray-400">Loading pastors...</p> : filteredPastors.map((pastor) => (
                    <button key={pastor.id} onClick={() => setSelectedPastorId(pastor.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedPastorId === pastor.id ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-orange-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                          {pastor.photo_url ? <img src={pastor.photo_url} alt={pastor.full_name} className="h-full w-full object-cover" /> : <span className="font-bold text-gray-500">{pastor.full_name.slice(0, 1)}</span>}
                        </div>
                        <div>
                          <p className="font-bold text-black">{pastor.full_name}</p>
                          <p className="text-xs text-gray-500">{(pastor.specialties || []).join(', ') || 'General counselling'}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {!loadingPastors && filteredPastors.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No pastors registered yet.</p>}
                </div>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold text-black">Book a session</h2>
                {selectedPastor && <p className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm text-orange-700">Selected pastor: {selectedPastor.full_name}</p>}
                {bookingStatus && <div className={`rounded-lg border px-4 py-3 text-sm ${bookingStatus.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{bookingStatus.message}{bookingStatus.meetingLink && <a href={bookingStatus.meetingLink} target="_blank" rel="noreferrer" className="mt-2 block font-semibold underline">Open Google Meet</a>}</div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required value={bookingForm.full_name} onChange={(e) => setBookingForm({ ...bookingForm, full_name: e.target.value })} placeholder="Full name" className="rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                  <input required type="email" value={bookingForm.email} onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })} placeholder="Email" className="rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <input value={bookingForm.phone_number} onChange={(e) => setBookingForm({ ...bookingForm, phone_number: e.target.value })} placeholder="Phone number" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required type="date" value={bookingForm.scheduled_date} onChange={(e) => setBookingForm({ ...bookingForm, scheduled_date: e.target.value })} className="rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                  <input required type="time" value={bookingForm.scheduled_time} onChange={(e) => setBookingForm({ ...bookingForm, scheduled_time: e.target.value })} className="rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <input required value={bookingForm.topic} onChange={(e) => setBookingForm({ ...bookingForm, topic: e.target.value })} placeholder="What do you want counselling about?" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                <textarea value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} placeholder="Anything the pastor should know before the session?" rows={4} className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                <button disabled={bookingLoading || !selectedPastorId} className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50">{bookingLoading ? 'Booking...' : 'Book counselling session'}</button>
              </form>
            </section>
          ) : (
            <form onSubmit={handlePastorSubmit} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold text-black"><UserRoundPlus className="text-orange-600" size={22} /> Pastor quick registration</h2>
              {pastorStatus && <div className={`rounded-lg border px-4 py-3 text-sm ${pastorStatus.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{pastorStatus.message}</div>}
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                  {pastorForm.photo_url ? <img src={pastorForm.photo_url} alt="Pastor preview" className="h-full w-full object-cover" /> : <Camera className="text-gray-400" size={24} />}
                </div>
                <label className="cursor-pointer rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Upload photo
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required value={pastorForm.full_name} onChange={(e) => setPastorForm({ ...pastorForm, full_name: e.target.value })} placeholder="Full name" className="rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
                <input required type="email" value={pastorForm.email} onChange={(e) => setPastorForm({ ...pastorForm, email: e.target.value })} placeholder="Email" className="rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <input value={pastorForm.phone_number} onChange={(e) => setPastorForm({ ...pastorForm, phone_number: e.target.value })} placeholder="Phone number" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
              <input required value={pastorForm.google_meet_link} onChange={(e) => setPastorForm({ ...pastorForm, google_meet_link: e.target.value })} placeholder="Google Meet link, https://meet.google.com/..." className="w-full rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
              <input value={pastorForm.specialties} onChange={(e) => setPastorForm({ ...pastorForm, specialties: e.target.value })} placeholder="Specialties, comma separated" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
              <textarea value={pastorForm.bio} onChange={(e) => setPastorForm({ ...pastorForm, bio: e.target.value })} placeholder="Short introduction" rows={4} className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-black outline-none focus:ring-2 focus:ring-orange-500" />
              <button disabled={pastorLoading} className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50">{pastorLoading ? 'Saving...' : 'Register as pastor'}</button>
              <p className="flex items-center gap-2 text-sm text-gray-500"><CheckCircle2 size={16} className="text-green-600" /> This profile is stored only in the counselling section.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}