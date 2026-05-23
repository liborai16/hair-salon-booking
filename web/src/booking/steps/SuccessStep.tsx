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
    <div className="text-center py-8">
      <div className="text-5xl mb-4">✓</div>
      <h1 className="text-2xl font-semibold mb-2">Rezervace potvrzena</h1>
      <p className="text-stone-600 mb-6">
        Číslo rezervace:{" "}
        <code className="text-stone-900">{result.bookingId}</code>
      </p>

      <div className="bg-stone-100 rounded-md p-4 max-w-md mx-auto mb-6">
        <div className="font-medium text-lg">
          {weekday} {D}.{M}. · {startParts.hhmm}–{endParts.hhmm}
        </div>
        <div className="text-stone-600 mt-2">{result.totalPrice} Kč</div>
      </div>

      <p className="text-sm text-stone-500 mb-6 max-w-md mx-auto">
        Potvrzení a odkaz pro zrušení rezervace byly odeslány na váš e-mail.
        (V demo prostředí se e-mail loguje do konzole / kolekce{" "}
        <code>notifications/</code>.)
      </p>

      <div className="flex justify-center gap-4">
        <Link
          to="/"
          className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 transition"
        >
          Zpět na úvod
        </Link>
      </div>
    </div>
  );
}
