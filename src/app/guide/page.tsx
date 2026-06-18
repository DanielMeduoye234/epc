import Link from 'next/link';
import { BarChart3, HeartHandshake, LockKeyhole, ArrowRight } from 'lucide-react';

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white sm:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="EPC Logo" className="h-12 w-12 rounded-full object-contain" />
            <div>
              <p className="font-bold leading-tight">EPC Guide</p>
              <p className="text-sm text-slate-400">Choose your purpose</p>
            </div>
          </Link>
        </nav>

        <section className="flex flex-1 flex-col justify-center py-16">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full bg-orange-500/15 px-3 py-1 text-sm font-semibold text-orange-300">What is your purpose here?</p>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">Choose where EPC Guide should take you.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">The counselling side and the dashboard side are separate experiences with separate data.</p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Link href="/guide/counselling" className="group rounded-3xl border border-orange-400/30 bg-orange-500 p-6 shadow-xl shadow-orange-950/40 transition hover:-translate-y-1 hover:bg-orange-400">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-600">
                <HeartHandshake size={30} />
              </div>
              <h2 className="mt-8 text-3xl font-black">Intimate Counselling</h2>
              <p className="mt-3 max-w-xl leading-7 text-orange-50">Register as a pastor or book a confidential counselling session as a member.</p>
              <span className="mt-8 inline-flex items-center gap-2 font-bold text-white">
                Enter counselling
                <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </span>
            </Link>

            <Link href="/login" className="group rounded-3xl border border-slate-700 bg-white p-6 text-slate-950 shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:border-orange-300">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <BarChart3 size={30} />
              </div>
              <h2 className="mt-8 text-3xl font-black">Data Retrieval</h2>
              <p className="mt-3 max-w-xl leading-7 text-slate-600">Open the protected church growth dashboard for new believers, members, attendance, and reports.</p>
              <span className="mt-8 inline-flex items-center gap-2 font-bold text-slate-950">
                Go to dashboard
                <LockKeyhole size={18} />
              </span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}