import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { instantToWallParts, SALON_TZ } from "@hsb/shared";
import type { BookingStatus } from "@hsb/shared";
import { functions } from "../lib/firebase";

/**
 * Mirrors `BookingView` in `functions/src/handlers/manageBookingByToken.ts`
 * (not exported from @hsb/shared — functions-internal). Small drift risk
 * acknowledged; if the server shape changes the client must follow.
 * Cleanup candidate: lift BookingView into @hsb/shared with the rest of
 * the callable contracts.
 */
type BookingView = {
  bookingId: string;
  startAt: string; // ISO
  endAt: string;
  services: string[]; // display names, in booking order
  stylistName: string;
  totalPrice: number;
  status: BookingStatus;
};

type ManageInput = { token: string; action: "view" | "cancel" };

const manageBookingByToken = httpsCallable<ManageInput, BookingView>(
  functions,
  "manageBookingByToken",
);

const WEEKDAYS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Čeká na potvrzení",
  confirmed: "Potvrzeno",
  completed: "Proběhlo",
  no_show: "Nedostavil(a) se",
  cancelled: "Zrušeno",
};

function formatDayHeading(ymd: string): string {
  const [Y, M, D] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(Y!, M! - 1, D!));
  return `${WEEKDAYS[date.getUTCDay()]} ${D}.${M}.`;
}

export function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<BookingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Load on mount — server validates token via indexed equality lookup
  // (D-017 query-by-token, bearer capability). Token entropy (256 bits)
  // is the actual protection; rules don't gate this collection because
  // it's CF-only access via admin SDK.
  useEffect(() => {
    if (!token) {
      setError("Chybí token rezervace v URL.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await manageBookingByToken({ token, action: "view" });
        if (!cancelled) setView(result.data);
      } catch (e) {
        if (!cancelled) {
          const err = e as { message?: string };
          setError(err.message ?? "Nepodařilo se načíst rezervaci.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCancel() {
    if (!token) return;
    setCancelling(true);
    setError(null);
    try {
      // manageBookingByToken('cancel') is idempotent — re-call on
      // already-cancelled booking returns same status, no error.
      const result = await manageBookingByToken({ token, action: "cancel" });
      setView(result.data);
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Nepodařilo se zrušit rezervaci.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <div className="text-stone-500">Načítám rezervaci…</div>;
  }

  if (!view) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-4">Zrušení rezervace</h1>
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 max-w-md">
          {error ?? "Rezervace nenalezena."}
        </div>
        <Link
          to="/"
          className="mt-6 inline-block text-stone-600 hover:text-stone-900 px-2 py-2"
        >
          ← Zpět na úvod
        </Link>
      </div>
    );
  }

  const start = new Date(view.startAt);
  const end = new Date(view.endAt);
  const startParts = instantToWallParts(start, SALON_TZ);
  const endParts = instantToWallParts(end, SALON_TZ);
  const canCancel = view.status === "pending" || view.status === "confirmed";
  const isCancelled = view.status === "cancelled";

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">
        {isCancelled ? "Rezervace zrušena" : "Vaše rezervace"}
      </h1>

      <div className="bg-stone-100 rounded-md p-4 space-y-3 max-w-md">
        <div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">
            Termín
          </div>
          <div className="font-medium">
            {formatDayHeading(startParts.ymd)} · {startParts.hhmm}–
            {endParts.hhmm}
          </div>
        </div>
        <div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">
            Kadeřník
          </div>
          <div className="font-medium">{view.stylistName}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">
            Služby
          </div>
          <ul className="font-medium">
            {view.services.map((name, i) => (
              <li key={i}>· {name}</li>
            ))}
          </ul>
        </div>
        <div className="border-t border-stone-300 pt-2">
          <div className="text-xs text-stone-500 uppercase tracking-wide">
            Celkem · Stav
          </div>
          <div className="font-medium">
            {view.totalPrice} Kč ·{" "}
            <span className={isCancelled ? "text-stone-500" : ""}>
              {STATUS_LABELS[view.status]}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 max-w-md">
          {error}
        </div>
      )}

      <div className="mt-6 max-w-md space-y-4">
        {canCancel ? (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="bg-red-700 text-white px-6 py-2 rounded-md hover:bg-red-800 transition disabled:opacity-40"
          >
            {cancelling ? "Ruším…" : "Zrušit rezervaci"}
          </button>
        ) : isCancelled ? (
          <div className="text-sm text-stone-600">
            Rezervace byla zrušena. Pokud potřebujete novou,{" "}
            <Link to="/book" className="text-stone-900 underline">
              rezervujte si jiný termín
            </Link>
            .
          </div>
        ) : (
          <div className="text-sm text-stone-600">
            Tato rezervace už nemůže být zrušena (
            {STATUS_LABELS[view.status]}). Pro nový termín{" "}
            <Link to="/book" className="text-stone-900 underline">
              začněte zde
            </Link>
            .
          </div>
        )}
        <div>
          <Link
            to="/"
            className="inline-block text-stone-600 hover:text-stone-900"
          >
            ← Zpět na úvod
          </Link>
        </div>
      </div>
    </div>
  );
}
