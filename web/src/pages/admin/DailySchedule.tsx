import { useMemo, useState } from "react";
import { instantToWallParts, SALON_TZ } from "@hsb/shared";
import type {
  Absence,
  BookingStatus,
  PaymentMethod,
  Service,
  Stylist,
} from "@hsb/shared";
import { useServices, useStylists } from "../../booking/useBookingData";
import {
  cancelBooking,
  completeBooking,
  markNoShow,
  useDailyBookings,
  type DailyBooking,
} from "../../admin/useDailyBookings";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const PX_PER_HOUR = 60;
const TOTAL_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * PX_PER_HOUR;

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: "bg-amber-100 border-amber-400 text-amber-900",
  confirmed: "bg-white/[0.08] border-white/30 text-white",
  completed: "bg-emerald-100 border-emerald-400 text-emerald-900",
  no_show: "bg-red-100 border-red-400 text-red-900",
  cancelled: "bg-white/[0.03] border-white/15 text-white/40 line-through",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Čeká",
  confirmed: "Potvrzeno",
  completed: "Proběhlo",
  no_show: "Nedostavil(a) se",
  cancelled: "Zrušeno",
};

function ymdToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ymdToDate(ymd: string): Date {
  const [Y, M, D] = ymd.split("-").map(Number);
  const d = new Date();
  d.setFullYear(Y!, M! - 1, D!);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Positioned timeline: top offset = minutes from DAY_START_HOUR; height = duration. */
function topPx(d: Date): number {
  const wall = instantToWallParts(d, SALON_TZ);
  const [h, m] = wall.hhmm.split(":").map(Number);
  const minutesFromStart = (h! - DAY_START_HOUR) * 60 + m!;
  return Math.max(0, (minutesFromStart / 60) * PX_PER_HOUR);
}

function heightPx(start: Date, end: Date): number {
  return Math.max(20, ((end.getTime() - start.getTime()) / 3_600_000) * PX_PER_HOUR);
}

export function DailySchedule() {
  const [ymd, setYmd] = useState(ymdToday());
  const date = useMemo(() => ymdToDate(ymd), [ymd]);
  const { services } = useServices();
  const { stylists } = useStylists();
  const { data, loading, error, reload } = useDailyBookings(
    date,
    stylists ?? [],
  );
  const [drawerFor, setDrawerFor] = useState<DailyBooking | null>(null);

  if (!stylists || !services) {
    return <div className="text-white/50">Načítám…</div>;
  }
  const servicesById = new Map(services.map((s) => [s.id, s]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl md:text-3xl tracking-tight text-white">Rozvrh</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-white/60">
            Datum:{" "}
            <input
              type="date"
              value={ymd}
              onChange={(e) => setYmd(e.target.value)}
              className="border border-white/15 rounded-md px-2 py-1 ml-1"
            />
          </label>
          <button
            type="button"
            onClick={() => setYmd(ymdToday())}
            className="text-sm text-white/60 hover:text-white px-3 py-1 border border-white/15 rounded-md"
          >
            Dnes
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/[0.05] border border-[var(--color-danger)]/30 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl overflow-auto">
        <div className="flex" style={{ minWidth: `${100 + stylists.length * 160}px` }}>
          {/* Hours column */}
          <div className="w-24 border-r border-white/10 flex-shrink-0">
            <div className="h-10 border-b border-white/10" />
            <div className="relative" style={{ height: TOTAL_HEIGHT }}>
              {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 text-xs text-white/50 px-2"
                  style={{ top: i * PX_PER_HOUR - 6 }}
                >
                  {String(DAY_START_HOUR + i).padStart(2, "0")}:00
                </div>
              ))}
            </div>
          </div>

          {/* Stylist columns */}
          {stylists.map((stylist) => (
            <StylistColumn
              key={stylist.id}
              stylist={stylist}
              bookings={data?.bookingsByStylist.get(stylist.id) ?? []}
              absences={data?.absencesByStylist.get(stylist.id) ?? []}
              servicesById={servicesById}
              onClickBooking={setDrawerFor}
              loading={loading && !data}
            />
          ))}
        </div>
      </div>

      {drawerFor && (
        <BookingDrawer
          booking={drawerFor}
          stylistName={stylists.find((s) => s.id === drawerFor.booking.stylistId)?.name ?? "?"}
          servicesById={servicesById}
          onClose={() => setDrawerFor(null)}
          onMutated={() => {
            setDrawerFor(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function StylistColumn({
  stylist,
  bookings,
  absences,
  servicesById,
  onClickBooking,
  loading,
}: {
  stylist: Stylist;
  bookings: DailyBooking[];
  absences: Absence[];
  servicesById: Map<string, Service>;
  onClickBooking: (b: DailyBooking) => void;
  loading: boolean;
}) {
  return (
    <div className="flex-1 min-w-[160px] border-r border-white/10 last:border-r-0">
      <div className="h-10 border-b border-white/10 px-2 py-2 text-sm font-medium truncate">
        {stylist.name}
      </div>
      <div className="relative" style={{ height: TOTAL_HEIGHT }}>
        {/* Hour grid lines */}
        {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 right-0 border-t border-white/5"
            style={{ top: (i + 1) * PX_PER_HOUR }}
          />
        ))}

        {/* Absence blocks (background, low z) */}
        {absences.map((a) => {
          const top = topPx(a.startAt);
          const height = heightPx(a.startAt, a.endAt);
          // Skip absences that don't overlap the day window visually
          if (top >= TOTAL_HEIGHT || top + height <= 0) return null;
          return (
            <div
              key={a.id}
              className="absolute left-1 right-1 bg-white/[0.05] border border-dashed border-white/15 text-xs text-white/60 px-2 py-1 rounded"
              style={{
                top: Math.max(0, top),
                height: Math.min(TOTAL_HEIGHT - Math.max(0, top), height),
              }}
              title={`${a.reason}${a.notes ? ` — ${a.notes}` : ""}`}
            >
              {a.reason}
            </div>
          );
        })}

        {/* Booking blocks (foreground) */}
        {bookings.map((db) => (
          <BookingBlock
            key={db.booking.id}
            db={db}
            servicesById={servicesById}
            onClick={() => onClickBooking(db)}
          />
        ))}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">
            Načítám…
          </div>
        )}
      </div>
    </div>
  );
}

function BookingBlock({
  db,
  servicesById,
  onClick,
}: {
  db: DailyBooking;
  servicesById: Map<string, Service>;
  onClick: () => void;
}) {
  const { booking, customer } = db;
  const top = topPx(booking.startAt);
  const height = heightPx(booking.startAt, booking.endAt);
  if (top >= TOTAL_HEIGHT || top + height <= 0) return null;
  const start = instantToWallParts(booking.startAt, SALON_TZ).hhmm;
  const end = instantToWallParts(booking.endAt, SALON_TZ).hhmm;
  const serviceNames = booking.serviceIds
    .map((id) => servicesById.get(id)?.name ?? "?")
    .join(" + ");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute left-1 right-1 border rounded px-2 py-1 text-xs text-left overflow-hidden hover:shadow-md transition ${STATUS_COLORS[booking.status]}`}
      style={{
        top: Math.max(0, top),
        height: Math.min(TOTAL_HEIGHT - Math.max(0, top), height),
      }}
    >
      <div className="font-medium truncate">
        {start}–{end}
      </div>
      <div className="truncate">{customer?.name ?? "(bez klienta)"}</div>
      <div className="truncate opacity-75">{serviceNames}</div>
    </button>
  );
}

function BookingDrawer({
  booking,
  stylistName,
  servicesById,
  onClose,
  onMutated,
}: {
  booking: DailyBooking;
  stylistName: string;
  servicesById: Map<string, Service>;
  onClose: () => void;
  onMutated: () => void;
}) {
  const { booking: b, customer } = booking;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTerminal =
    b.status === "completed" ||
    b.status === "no_show" ||
    b.status === "cancelled";

  async function runAction(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onMutated();
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Operace selhala.");
      setBusy(false);
    }
  }

  const start = instantToWallParts(b.startAt, SALON_TZ).hhmm;
  const end = instantToWallParts(b.endAt, SALON_TZ).hhmm;

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-bg-base)] border border-white/10 backdrop-blur-xl rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wide">
              {STATUS_LABELS[b.status]}
            </div>
            <h2 className="text-lg font-semibold">
              {start}–{end} · {stylistName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white/80 text-2xl leading-none"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wide">
              Klient
            </div>
            <div className="font-medium">{customer?.name ?? "—"}</div>
            {customer && (
              <div className="text-white/60">
                {customer.phone} · {customer.email}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wide">
              Služby
            </div>
            <ul className="font-medium">
              {b.serviceIds.map((id) => (
                <li key={id}>· {servicesById.get(id)?.name ?? id}</li>
              ))}
            </ul>
          </div>
          <div className="border-t border-white/10 pt-2">
            <div className="text-xs text-white/50 uppercase tracking-wide">
              Cena
            </div>
            <div className="font-medium">
              {b.totalPrice} Kč
              {b.paymentMethod && (
                <span className="text-white/50 ml-2">
                  ({b.paymentMethod})
                </span>
              )}
            </div>
          </div>
          <div className="text-xs text-white/40">ID: {b.id}</div>
        </div>

        {error && (
          <div className="mt-4 text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/[0.05] border border-[var(--color-danger)]/30 rounded-xl p-3">
            {error}
          </div>
        )}

        {!isTerminal && (
          <div className="mt-6 space-y-2">
            <div className="text-xs text-white/50 uppercase tracking-wide">
              Akce
            </div>
            <PaymentCompleteSection
              busy={busy}
              onComplete={(pm) => runAction(() => completeBooking(b.id, pm))}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(() => markNoShow(b.id))}
                className="flex-1 text-sm px-3 py-2 border border-red-500/40 text-red-300 rounded-md hover:bg-red-500/10 disabled:opacity-40 transition-colors"
              >
                Nedostavil(a) se
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runAction(() => cancelBooking(b.id))}
                className="flex-1 text-sm px-3 py-2 border border-white/15 text-white/80 rounded-md hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
              >
                Zrušit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentCompleteSection({
  busy,
  onComplete,
}: {
  busy: boolean;
  onComplete: (pm: PaymentMethod) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={busy}
        className="w-full text-sm px-3 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 disabled:opacity-40"
      >
        Označit jako proběhlo…
      </button>
    );
  }
  return (
    <div className="border border-emerald-500/40 bg-emerald-500/[0.08] rounded-md p-3">
      <div className="text-xs text-emerald-300 mb-2">Platba:</div>
      <div className="flex gap-2">
        {(["cash", "card", "transfer"] as const).map((pm) => (
          <button
            key={pm}
            type="button"
            disabled={busy}
            onClick={() => onComplete(pm)}
            className="flex-1 text-sm px-3 py-2 bg-emerald-700 text-white rounded-md hover:bg-emerald-800 disabled:opacity-40 capitalize"
          >
            {pm === "cash" ? "Hotově" : pm === "card" ? "Kartou" : "Převodem"}
          </button>
        ))}
      </div>
    </div>
  );
}
