export default function Home() {
  return (
    <main className="bg-black text-white min-h-screen flex flex-col">
      {/* ── NAV ── */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-yellow-600/30">
        <span className="text-xl font-bold tracking-widest text-yellow-400 uppercase">
          Jay&apos;s Graphic Arts
        </span>
        <div className="flex gap-4">
          <a
            href="/login"
            className="px-5 py-2 text-sm font-semibold text-yellow-400 border border-yellow-600 rounded hover:bg-yellow-600/10 transition"
          >
            Sign In
          </a>
          <a
            href="/register"
            className="px-5 py-2 text-sm font-semibold text-black bg-yellow-400 rounded hover:bg-yellow-300 transition"
          >
            Get Started
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <p className="text-yellow-400 text-xs font-bold tracking-[0.3em] uppercase mb-4">
          Enterprise Operating System
        </p>
        <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6">
          JGA Enterprise OS
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-10">
          A modular, compliance-first operational platform built for Jay&apos;s
          Graphic Arts LLC — intake, contracts, projects, payments, and more.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="/register"
            className="px-8 py-3 text-base font-bold text-black bg-yellow-400 rounded-lg hover:bg-yellow-300 transition"
          >
            Request Access
          </a>
          <a
            href="/login"
            className="px-8 py-3 text-base font-bold text-yellow-400 border border-yellow-600 rounded-lg hover:bg-yellow-600/10 transition"
          >
            Sign In
          </a>
        </div>
      </section>

      {/* ── FEATURE STRIP ── */}
      <section className="border-t border-yellow-600/20 px-8 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Intake & Onboarding',
              body: 'Capture client details, generate scoped quotes, and open projects in minutes.',
            },
            {
              title: 'Contract-Gated Production',
              body: 'No project goes active without a signed contract and confirmed deposit.',
            },
            {
              title: 'Revenue Engine',
              body: 'Append-only ledger, milestone payments, and automated balance tracking.',
            },
            {
              title: 'Contractor Portal',
              body: 'System B isolates contractor access to only the tasks they own.',
            },
            {
              title: 'Compliance & Audit',
              body: '8 system laws enforced at every layer — human review flagged automatically.',
            },
            {
              title: 'Owner Command Dashboard',
              body: 'Full visibility: revenue, disputes, contracts, and live system health.',
            },
          ].map(({ title, body }) => (
            <div
              key={title}
              className="border border-yellow-600/30 rounded-lg p-6 hover:border-yellow-500 transition"
            >
              <h3 className="text-yellow-400 font-bold text-sm uppercase tracking-widest mb-2">
                {title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-yellow-600/20 px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
        <span>
          &copy; {new Date().getFullYear()} Jay&apos;s Graphic Arts LLC. All rights reserved.
        </span>
        <span className="text-yellow-700">
          JGA Enterprise OS &mdash; built on Next.js &amp; Supabase
        </span>
      </footer>
    </main>
  );
}

