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
      // Firebase httpsCallable error shape — message is localized by
      // server (D-018 E2 dynamic), details.reason gives typed reason for
      // future client-side switching. For MVP just display the message.
      const err = e as { message?: string };
      setError(err.message ?? "Neznámá chyba.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">4. Potvrzení</h1>

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
          <div className="font-medium">{stylist.name}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">
            Služby
          </div>
          <ul className="font-medium">
            {services.map((s) => (
              <li key={s.id}>
                · {s.name}
                {serviceLengths[s.id] ? ` (${serviceLengths[s.id]})` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-stone-300 pt-2">
          <div className="text-xs text-stone-500 uppercase tracking-wide">
            Celkem
          </div>
          <div className="font-medium">
            {duration} min · {finalPrice} Kč
          </div>
        </div>
        <div>
          <div className="text-xs text-stone-500 uppercase tracking-wide">
            Vy
          </div>
          <div className="font-medium">
            {customer.name} · {customer.phone} · {customer.email}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3 max-w-md">
          {error}
        </div>
      )}

      <div className="mt-6 border-t border-stone-200 pt-6 flex items-center justify-between max-w-md">
        <button
          type="button"
          onClick={onPrev}
          disabled={submitting}
          className="text-stone-600 hover:text-stone-900 px-4 py-2 disabled:opacity-40"
        >
          ← Zpět
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="bg-stone-900 text-white px-6 py-2 rounded-md hover:bg-stone-800 transition disabled:opacity-40"
        >
          {submitting ? "Rezervuji…" : "Rezervovat"}
        </button>
      </div>
    </div>
  );
}
