import { BookingShell } from "../../booking/BookingShell";

/**
 * Walk-in booking — admin-mounted booking flow.
 *
 * Reuses the public `BookingShell` (D-018 D3 anyone-mode + qualified-stylist
 * pool + slot generator) with `minLeadTimeMinutes=0` so recepční can book
 * for NOW (walk-in / phone call). The server-side createBooking wrapper
 * independently bypasses the lead-time gate for staff callers (auth token
 * role = owner/receptionist/stylist) and tags the booking with
 * `source: 'admin'` so reports can distinguish guest vs admin origin.
 *
 * Customer GDPR consent is checked by the recepční on the customer's
 * behalf (verbal consent over the phone is the real-world authority —
 * UI checkbox is the audit record).
 */
export function AdminWalkIn() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Nová rezervace (walk-in)</h1>
      <p className="text-sm text-stone-500 mb-6">
        Rezervace zadaná z administrace. Lead-time je přeskočen — můžete
        rezervovat ihned.
      </p>
      <BookingShell minLeadTimeMinutesOverride={0} />
    </div>
  );
}
