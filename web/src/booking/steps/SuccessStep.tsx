import { Link } from "react-router-dom";
import { instantToWallParts, SALON_TZ } from "@hsb/shared";
import type { BookingResult } from "../state";

const WEEKDAYS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

type Props = {
  result: BookingResult;
};

export function SuccessStep({ result }: Props) {
  const start = new Date(result.startAt);
  const end = new Date(result.endAt);
  const startParts = instantToWallParts(start, SALON_TZ);
  const endParts = instantToWallParts(end, SALON_TZ);
  const [Y, M, D] = startParts.ymd.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(Y!, M! - 1, D!)).getUTCDay()];

  return (
    <div className="text-center py-12 md:py-20 max-w-2xl mx-auto">
      {/* Gold check chip with pop-in animation */}
      <div
        className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-8 rounded-full flex items-center justify-center bg-[var(--color-accent)] shadow-[0_0_60px_rgba(212,165,116,0.5)] animate-success-pop"
        aria-hidden
      >
        <svg
          className="w-10 h-10 md:w-12 md:h-12 text-[var(--color-bg-base)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5L20 7" />
        </svg>
      </div>

      <h1 className="font-display tracking-tight text-[clamp(40px,8vw,80px)] leading-[1.05] mb-4">
        Rezervace <span className="italic-accent">potvrzena</span>.
      </h1>
      <p className="text-white/70 text-lg md:text-xl mb-2">
        Děkujeme, brzy se uvidíme.
      </p>
      <p className="text-xs text-white/40 mb-10">
        Číslo rezervace{" "}
        <code className="text-white/60 font-mono">{result.bookingId}</code>
      </p>

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 max-w-md mx-auto mb-8 text-left">
        <div className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2">
          Termín
        </div>
        <div className="font-display text-2xl md:text-3xl font-medium tracking-tight">
          {weekday} {D}.{M}.
        </div>
        <div className="text-lg text-white/70 mt-1">
          {startParts.hhmm}–{endParts.hhmm}
        </div>
        <div className="flex items-center justify-between pt-5 mt-5 border-t border-white/10">
          <div className="text-xs uppercase tracking-[0.15em] text-white/60">
            Cena celkem
          </div>
          <div className="font-display text-2xl md:text-3xl tracking-tight text-[var(--color-accent)] tabular-nums">
            {result.totalPrice} Kč
          </div>
        </div>
      </div>

      <p className="text-sm text-white/50 max-w-md mx-auto mb-12">
        Potvrzení a odkaz pro zrušení rezervace byly odeslány na váš e-mail.
        (V demo prostředí se e-mail loguje do konzole / kolekce{" "}
        <code className="font-mono text-xs text-white/70 bg-white/[0.05] px-1.5 py-0.5 rounded">
          notifications/
        </code>
        .)
      </p>

      <div className="flex justify-center">
        <Link to="/" className="btn-primary btn-primary-hover">
          Zpět na úvod
        </Link>
      </div>
    </div>
  );
}
