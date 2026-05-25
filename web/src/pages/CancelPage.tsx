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
      const result = await manageBookingByToken({ token, action: "cancel" });
      setView(result.data);
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Nepodařilo se zrušit rezervaci.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 pt-24 md:pt-32 pb-10 md:pb-14">
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-9 w-1/2 rounded-md bg-bg-soft" />
          <div className="h-48 rounded-lg bg-bg-soft" />
        </div>
      )}

      {!loading && !view && (
        <div>
          <h1 className="text-3xl md:text-4xl mb-3">Zrušení rezervace</h1>
          <div className="text-sm text-danger bg-danger-soft border border-danger/20 rounded-md p-3 max-w-md">
            {error ?? "Rezervace nenalezena."}
          </div>
          <Link to="/" className="btn-ghost mt-6 inline-flex">
            ← Zpět na úvod
          </Link>
        </div>
      )}

      {!loading && view && (
        <CancelView
          view={view}
          error={error}
          cancelling={cancelling}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

function CancelView({
  view,
  error,
  cancelling,
  onCancel,
}: {
  view: BookingView;
  error: string | null;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const start = new Date(view.startAt);
  const end = new Date(view.endAt);
  const startParts = instantToWallParts(start, SALON_TZ);
  const endParts = instantToWallParts(end, SALON_TZ);
  const canCancel = view.status === "pending" || view.status === "confirmed";
  const isCancelled = view.status === "cancelled";

  return (
    <div>
      <h1 className="text-3xl md:text-4xl mb-2">
        {isCancelled ? "Rezervace zrušena" : "Vaše rezervace"}
      </h1>
      <p className="text-muted mb-8">
        {isCancelled
          ? "Tato rezervace už není aktivní."
          : "Detail rezervace + možnost samostatného zrušení."}
      </p>

      <div className="bg-bg-soft border border-hairline rounded-lg p-6 space-y-5 max-w-md">
        <div>
          <div className="label-mono mb-1">Termín</div>
          <div className="font-display text-xl font-medium">
            {formatDayHeading(startParts.ymd)}
          </div>
          <div className="text-fg">
            {startParts.hhmm}–{endParts.hhmm}
          </div>
        </div>
        <div>
          <div className="label-mono mb-1">Kadeřník</div>
          <div className="font-medium text-fg">{view.stylistName}</div>
        </div>
        <div>
          <div className="label-mono mb-1">Služby</div>
          <ul className="font-medium text-fg space-y-1">
            {view.services.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        </div>
        <div className="border-t border-hairline pt-4">
          <div className="label-mono mb-1">Celkem · Stav</div>
          <div className="font-display text-2xl font-medium">
            {view.totalPrice} Kč
          </div>
          <div
            className={`text-sm mt-1 ${
              isCancelled ? "text-muted" : "text-fg"
            }`}
          >
            {STATUS_LABELS[view.status]}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-sm text-danger bg-danger-soft border border-danger/20 rounded-md p-3 max-w-md">
          {error}
        </div>
      )}

      <div className="mt-8 max-w-md space-y-4">
        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="inline-flex items-center justify-center bg-danger text-surface-fg px-6 py-2.5 rounded-md hover:opacity-90 transition disabled:opacity-40 min-h-[44px] font-medium"
          >
            {cancelling ? "Ruším…" : "Zrušit rezervaci"}
          </button>
        ) : isCancelled ? (
          <div className="text-sm text-muted">
            Rezervace byla zrušena. Pokud potřebujete novou,{" "}
            <Link
              to="/book"
              className="text-fg underline underline-offset-2 hover:text-accent-strong"
            >
              rezervujte si jiný termín
            </Link>
            .
          </div>
        ) : (
          <div className="text-sm text-muted">
            Tato rezervace už nemůže být zrušena (
            {STATUS_LABELS[view.status]}). Pro nový termín{" "}
            <Link
              to="/book"
              className="text-fg underline underline-offset-2 hover:text-accent-strong"
            >
              začněte zde
            </Link>
            .
          </div>
        )}
        <div>
          <Link to="/" className="btn-ghost inline-flex">
            ← Zpět na úvod
          </Link>
        </div>
      </div>
    </div>
  );
}
