/**
 * Reports placeholder page (Phase 3.5 deferred).
 *
 * Editorial Gold-luxury empty state communicating intent: backend data layer is
 * complete (bookings + customerProfiles aggregable in Firestore Console), UI
 * aggregation deferred as managed scope decision. Lists 5 planned report types
 * to signal future direction.
 */
export function ReportsPage() {
  return (
    <div className="max-w-2xl mx-auto py-12 md:py-20 text-center">
      <div
        className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-8 rounded-full flex items-center justify-center bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30"
        aria-hidden
      >
        <svg
          className="w-10 h-10 md:w-12 md:h-12 text-[var(--color-accent)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="M7 14l4-4 4 4 5-5" />
        </svg>
      </div>

      <h1 className="font-display tracking-tight text-[clamp(32px,6vw,56px)] leading-[1.05] mb-4">
        Přehledy v <span className="italic-accent">přípravě</span>.
      </h1>
      <p className="text-white/70 text-lg md:text-xl mb-12 max-w-md mx-auto">
        Backend data jsou připravená. UI agregace přijde v další iteraci.
      </p>

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 max-w-md mx-auto mb-10 text-left">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]/70 mb-4">
          Co tu bude
        </div>
        <ul className="space-y-3 text-sm text-white/80">
          <li className="flex items-start gap-3">
            <span className="text-[var(--color-accent)] mt-0.5">→</span>
            <span>Denní, týdenní, měsíční tržby</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-[var(--color-accent)] mt-0.5">→</span>
            <span>Vytížení kadeřníků v čase</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-[var(--color-accent)] mt-0.5">→</span>
            <span>Statistiky no-show klientů</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-[var(--color-accent)] mt-0.5">→</span>
            <span>Top služby podle revenue</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="text-[var(--color-accent)] mt-0.5">→</span>
            <span>Trendy a heat-mapy obsazenosti</span>
          </li>
        </ul>
      </div>

      <p className="text-sm text-white/50 max-w-md mx-auto">
        Mezitím můžeš data prozkoumat přímo ve{" "}
        <a
          href="https://console.firebase.google.com/project/hair-salon-booking-cs-69a08/firestore"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:text-[var(--color-accent-bright)] transition-colors underline underline-offset-4"
        >
          Firebase Console
        </a>{" "}
        (kolekce{" "}
        <code className="font-mono text-xs bg-white/[0.05] px-1.5 py-0.5 rounded text-white/70">
          bookings
        </code>{" "}
        +{" "}
        <code className="font-mono text-xs bg-white/[0.05] px-1.5 py-0.5 rounded text-white/70">
          customerProfiles
        </code>
        ).
      </p>
    </div>
  );
}
