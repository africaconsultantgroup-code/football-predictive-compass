import Link from "next/link";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white sm:py-20">
      <div className="mx-auto max-w-md">
        <Link className="inline-flex items-center gap-3 text-sm font-semibold" href="/">
          <span className="flex size-9 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-300/10 text-emerald-300">PC</span>
          Predictive Compass
        </Link>
        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
          {children}
        </section>
      </div>
    </main>
  );
}
