import Link from "next/link";

// /dispatch — operator console for B2B Insights subscribers.
// This is the screen they OPEN every shift, not the marketing dossier
// at /insights. Four sub-surfaces share this chrome:
//   /dispatch        — live console (watched ports auto-refresh)
//   /dispatch/load   — load enrichment (paste origin+receiver+appt)
//   /dispatch/alerts — alerts manager (anomaly thresholds + channels)
//   /dispatch/export — CSV export for spreadsheet workflows

export const metadata = {
  title: "Cruzar Dispatch — operator console",
  description:
    "Live wait + forecast + anomaly across your watched ports. Built for dispatchers who keep one screen open all shift.",
};

const NAV: Array<{ href: string; en: string; es: string }> = [
  { href: "/dispatch", en: "Console", es: "Consola" },
  { href: "/dispatch/load", en: "Load advisor", es: "Asesor de carga" },
  { href: "/dispatch/paperwork", en: "Paperwork", es: "Trámites" },
  { href: "/dispatch/alerts", en: "Alerts", es: "Alertas" },
  { href: "/dispatch/account", en: "Account", es: "Cuenta" },
  { href: "/dispatch/export", en: "Export", es: "Exportar" },
];

export default function DispatchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a1020] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#070b18]/95 backdrop-blur supports-[backdrop-filter]:bg-[#070b18]/70">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
            <div className="flex items-baseline gap-3">
              <Link href="/dispatch" className="font-mono text-[15px] font-semibold tracking-tight text-amber-300 hover:text-amber-200">
                Cruzar Dispatch
              </Link>
              <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">
                operator console · consola de operador
              </span>
            </div>
            <nav className="flex items-center gap-1 text-[12.5px]">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2.5 py-1 text-white/70 hover:bg-white/[0.06] hover:text-white transition"
                >
                  {item.en}
                  <span className="ml-1.5 text-white/35" lang="es">
                    · {item.es}
                  </span>
                </Link>
              ))}
              <span className="mx-2 text-white/15">|</span>
              <Link
                href="/insights"
                className="rounded-lg px-2.5 py-1 text-[11.5px] text-white/40 hover:text-white/80 transition"
              >
                ← /insights
              </Link>
            </nav>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
