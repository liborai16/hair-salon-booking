import { useState } from "react";
import {
  computeTotalDuration,
  computeTotalPrice,
  instantToWallParts,
  SALON_TZ,
} from "@hsb/shared";
import type { Service, ServiceLengthMap, Stylist } from "@hsb/shared";
import { createBookingCallable } from "../useBookingData";
import type { BookingResult, SelectedSlot } from "../state";

const WEEKDAYS = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

function formatDayHeading(ymd: string): string {
  const [Y, M, D] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(Y!, M! - 1, D!));
  return `${WEEKDAYS[date.getUTCDay()]} ${D}.${M}.`;
}

type Props = {
  services: Service[];
  serviceLengths: ServiceLengthMap;
  stylist: Stylist;
  slot: SelectedSlot;
  customer: { name: string; phone: string; email: string };
  onPrev: () => void;
  onSuccess: (result: BookingResult) => void;
};

export function ConfirmStep({
  services,
  serviceLengths,
  stylist,
  slot,
  customer,
  onPrev,
  onSuccess,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Final price uses actual stylist tier + overrides (D-014 authoritative
  // value will be recomputed by the server — this is the matching estimate).
  const finalPrice = computeTotalPrice(services, stylist, serviceLengths);
  const duration = computeTotalDuration(services, serviceLengths);
  const startParts = instantToWallParts(slot.start, SALON_TZ);
  const endParts = instantToWallParts(slot.end, SALON_TZ);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const hasLengths = Object.keys(serviceLengths).length > 0;
      const response = await createBookingCallable({
        stylistId: stylist.id,
        serviceIds: services.map((s) => s.id),
        ...(hasLengths ? { serviceLengths } : {}),
        startAt: slot.start.toISOString(),
        customer,
      });
      onSuccess(response.data);
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message ?? "Neznámá chyba.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl md:text-4xl tracking-tight mb-2">
        Potvrzení
      </h1>
      <p className="text-white/60 mb-8">
        Zkontrolujte detaily a potvrďte rezervaci.
      </p>

      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 max-w-md">
        <div className="divide-y divide-white/5">
          <Row label="Termín">
            <div className="font-display text-xl font-medium">
              {formatDayHeading(startParts.ymd)}
            </div>
            <div className="text-white/70">
              {startParts.hhmm}–{endParts.hhmm}
            </div>
          </Row>
          <Row label="Kadeřník">{stylist.name}</Row>
          <Row label="Služby">
            <ul className="space-y-1">
              {services.map((s) => (
                <li key={s.id}>
                  {s.name}
                  {serviceLengths[s.id] && (
                    <span className="text-white/40">
                      {" · "}
                      {serviceLengths[s.id]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Row>
          <Row label="Vy">
            {customer.name}
            <div className="text-sm text-white/50 mt-0.5">
              {customer.phone} · {customer.email}
            </div>
          </Row>
        </div>
        <div className="flex items-center justify-between pt-5 mt-5 border-t border-white/10">
          <div>
            <div className="text-xs uppercase tracking-[0.15em] text-white/60">
              Cena celkem
            </div>
            <div className="text-xs text-white/40 mt-0.5">{duration} min</div>
          </div>
          <div className="font-display text-3xl md:text-4xl tracking-tight text-[var(--color-accent)] tabular-nums">
            {finalPrice} Kč
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[0.05] text-sm text-[var(--color-danger)] max-w-md">
          {error}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between max-w-md">
        <button
          type="button"
          onClick={onPrev}
          disabled={submitting}
          className="btn-ghost"
        >
          ← Zpět
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="btn-primary btn-primary-hover"
        >
          {submitting ? "Rezervuji…" : "Rezervovat"}
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-3">
      <div className="text-xs uppercase tracking-[0.15em] text-white/40">
        {label}
      </div>
      <div className="text-base md:text-lg text-white">{children}</div>
    </div>
  );
}
