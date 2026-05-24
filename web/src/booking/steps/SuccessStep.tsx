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
    <div className="text-center py-6 md:py-12">
      <div
        className="mx-auto mb-6 w-16 h-16 rounded-full bg-fg text-surface-fg flex items-center justify-center text-3xl font-light"
        aria-hidden
      >
        ✓
      </div>
      <h1 className="text-3xl md:text-4xl mb-3">Rezervace potvrzena</h1>
      <p className="text-muted mb-8">
        Číslo rezervace:{" "}
        <code className="text-fg font-mono text-sm bg-bg-soft px-2 py-0.5 rounded">
          {result.bookingId}
        </code>
      </p>

      <div className="bg-bg-soft border border-hairline rounded-lg p-6 max-w-md mx-auto mb-8">
        <div className="font-display text-2xl md:text-3xl font-medium tracking-tight">
          {weekday} {D}.{M}.
        </div>
        <div className="text-lg text-fg mt-1">
          {startParts.hhmm}–{endParts.hhmm}
        </div>
        <div className="border-t border-hairline mt-4 pt-4">
          <div className="label-mono mb-1">Celkem</div>
          <div className="font-display text-2xl font-medium">
            {result.totalPrice} Kč
          </div>
        </div>
      </div>

      <p className="text-sm text-muted mb-8 max-w-md mx-auto">
        Potvrzení a odkaz pro zrušení rezervace byly odeslány na váš e-mail.
        (V demo prostředí se e-mail loguje do konzole / kolekce{" "}
        <code className="font-mono text-xs bg-bg-soft px-1.5 py-0.5 rounded">
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
