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
      <h1 className="text-3xl md:text-4xl mb-2">Potvrzení</h1>
      <p className="text-muted mb-8">
        Zkontrolujte detaily a potvrďte rezervaci.
      </p>

      <div className="bg-bg-soft border border-hairline rounded-lg p-6 space-y-5 max-w-md">
        <Row label="Termín">
          <div className="font-display text-xl font-medium">
            {formatDayHeading(startParts.ymd)}
          </div>
          <div className="text-fg">
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
                  <span className="text-muted">
                    {" · "}
                    {serviceLengths[s.id]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Row>
        <div className="border-t border-hairline pt-4">
          <div className="label-mono mb-1">Celkem</div>
          <div className="font-display text-3xl font-medium tracking-tight">
            {finalPrice} Kč
          </div>
          <div className="text-sm text-muted mt-0.5">{duration} min</div>
        </div>
        <Row label="Vy">
          {customer.name}
          <div className="text-sm text-muted mt-0.5">
            {customer.phone} · {customer.email}
          </div>
        </Row>
      </div>

      {error && (
        <div className="mt-4 text-sm text-danger bg-danger-soft border border-danger/20 rounded-md p-3 max-w-md">
          {error}
        </div>
      )}

      <div className="mt-8 border-t border-hairline pt-6 flex items-center justify-between max-w-md">
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
    <div>
      <div className="label-mono mb-1">{label}</div>
      <div className="font-medium text-fg">{children}</div>
    </div>
  );
}
