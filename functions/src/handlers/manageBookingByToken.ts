/**
 * manageBookingByToken — magic-link self-service (Cloud Function, Gen2 onCall).
 *
 * Built in three checkpoints:
 *   CP1 (here): the token → bookingCustomer lookup (D-017 query-by-token).
 *   CP2 (next): the onCall wrapper + 'view' action (PII-minimal summary).
 *   CP3:        the 'cancel' action (transactional status flip + history +
 *               notification).
 *
 * Contract reference: D-017 (query-by-token bearer capability — no
 * constant-time compare) and scope item 12 (URL is /r/:token).
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import {
  convertTimestampsToDate,
  fromFirestore,
  toFirestore,
  type Booking,
  type BookingCustomer,
  type BookingStatus,
  type CustomerProfile,
  type Notification,
  type Service,
  type Stylist,
} from "@hsb/shared";
import { db } from "../lib/firebase.js";
import { manageBookingByTokenInput } from "../schemas/manageBookingByToken.schema.js";

/**
 * Statuses a customer may self-cancel from. 'cancelled' is handled separately
 * (idempotent no-op); 'completed' / 'no_show' are terminal and refuse cancel.
 */
const CANCELLABLE_STATUSES = new Set<BookingStatus>(["pending", "confirmed"]);

/**
 * Resolve a magic-link token to its bookingCustomers record.
 *
 * D-017: the token is a bearer capability validated by an indexed equality
 * lookup — there is no secret-vs-input comparison in app code (so no
 * `timingSafeEqual`); the 256-bit entropy is what defeats guessing. cancelToken
 * is a single-field equality filter, which Firestore auto-indexes, so NO
 * composite index is required (contrast createBooking's slot query).
 *
 * Throws 'not-found' when nothing matches — an invalid or stale link.
 */
export async function findBookingCustomerByToken(
  token: string,
): Promise<BookingCustomer> {
  const snap = await db
    .collection("bookingCustomers")
    .where("cancelToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new HttpsError("not-found", "Odkaz je neplatný nebo již byl použit.");
  }

  // BookingCustomer has no Date-typed fields and its document key is bookingId
  // (also stored as a field), so data() is the record as-is — no Timestamp
  // conversion and no fromFirestore id-injection needed.
  return snap.docs[0].data() as BookingCustomer;
}

/**
 * PII-MINIMAL view of a booking, returned by BOTH actions (view shows it
 * before cancelling; cancel returns it with status:'cancelled' afterwards), so
 * the web page renders one consistent shape regardless of the trigger path.
 *
 * Deliberately omits name / phone / email: knowing the token proves you hold
 * the cancel link, not that the response should echo the customer's contact
 * details back. Service and stylist NAMES (not ids) make the page self-
 * contained — no second lookup against the public collections (option X).
 */
export interface BookingView {
  bookingId: string;
  /** ISO-8601 instant. */
  startAt: string;
  /** ISO-8601 instant. */
  endAt: string;
  /** Display names, in the booking's service order. */
  services: string[];
  stylistName: string;
  totalPrice: number;
  status: BookingStatus;
}

/**
 * Build the display-ready view for a booking (option X — names resolved
 * server-side). Reads the booking, then its stylist and services in parallel.
 *
 * Resilient by design: a missing stylist or a hard-deleted service falls back
 * to a placeholder rather than failing the whole view (soft-deleted records
 * keep active:false but still resolve, so names normally survive). A missing
 * booking, however, means the link points at nothing → 'not-found'.
 */
export async function buildBookingView(
  customer: BookingCustomer,
): Promise<BookingView> {
  const bookingSnap = await db
    .collection("bookings")
    .doc(customer.bookingId)
    .get();
  if (!bookingSnap.exists) {
    // The 1:1 sibling of bookingCustomers should always exist; a missing
    // booking means a dead link.
    throw new HttpsError("not-found", "Rezervace již neexistuje.");
  }
  const booking = fromFirestore<Booking>(bookingSnap);

  // Stylist first in the batch, then one snapshot per serviceId (order
  // preserved by Promise.all, so it matches booking.serviceIds).
  const [stylistSnap, ...serviceSnaps] = await Promise.all([
    db.collection("stylists").doc(booking.stylistId).get(),
    ...booking.serviceIds.map((id) =>
      db.collection("services").doc(id).get(),
    ),
  ]);

  const stylistName = stylistSnap.exists
    ? fromFirestore<Stylist>(stylistSnap).name
    : "—";

  const services = serviceSnaps.map((snap) =>
    snap.exists ? fromFirestore<Service>(snap).name : "(odstraněná služba)",
  );

  return {
    bookingId: booking.id,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    services,
    stylistName,
    totalPrice: booking.totalPrice,
    status: booking.status,
  };
}

/**
 * Cancel a booking via its magic link. Transactional and idempotent.
 *
 * Idempotence (C2): two concurrent cancels race on bookings/{id}; the first
 * commits status→cancelled, the second's commit aborts (the doc it read
 * changed) and retries, re-reads 'cancelled', and short-circuits. The
 * notification is written INSIDE the transaction and only on a real transition,
 * so a retry never double-logs.
 *
 * The post-cancel BookingView is built AFTER the transaction (it re-reads the
 * now-cancelled booking) — which is also the natural return for the
 * already-cancelled path.
 */
export async function cancelBooking(
  customer: BookingCustomer,
): Promise<BookingView> {
  const bookingRef = db.collection("bookings").doc(customer.bookingId);
  // Same derivation as createBooking, from the same stored E.164 string, so it
  // reproduces the profile's document key exactly.
  const phoneHash = createHash("sha256")
    .update(customer.phone)
    .digest("hex")
    .slice(0, 32);
  const profileRef = db.collection("customerProfiles").doc(phoneHash);
  const now = new Date();

  await db.runTransaction(async (tx) => {
    // ---- READS (all before writes) ----
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) {
      throw new HttpsError("not-found", "Rezervace již neexistuje.");
    }
    const booking = fromFirestore<Booking>(bookingSnap);

    // Already cancelled → idempotent no-op (no writes, no notification). The
    // view built after the transaction reflects the cancelled state.
    if (booking.status === "cancelled") return;

    // Terminal states can't be cancelled by the customer.
    if (!CANCELLABLE_STATUSES.has(booking.status)) {
      throw new HttpsError(
        "failed-precondition",
        "Tuto rezervaci již nelze zrušit.",
      );
    }

    // Profile read (for the best-effort history update) — still before writes.
    const profileSnap = await tx.get(profileRef);

    // ---- WRITES ----

    // 1) Source of truth: flip the booking status.
    tx.update(bookingRef, { status: "cancelled", updatedAt: now });

    // 2) Best-effort history sync (C1): bookingHistory is a denormalized cache,
    //    not the source of truth, and is capped at 20 — the entry for this
    //    booking may have been evicted (clients with >20 bookings). Update the
    //    matching entry IN PLACE (preserving newest-first order) only if it's
    //    present; otherwise skip silently. Never fail the cancel over the cache.
    if (profileSnap.exists) {
      const profile = convertTimestampsToDate<CustomerProfile>(
        profileSnap.data(),
      );
      const history = profile.bookingHistory ?? [];
      const idx = history.findIndex((e) => e.bookingId === customer.bookingId);
      if (idx !== -1 && history[idx].status !== "cancelled") {
        const bookingHistory = history.map((e, i) =>
          i === idx ? { ...e, status: "cancelled" as const } : e,
        );
        tx.update(profileRef, { bookingHistory });
      }
    }

    // 3) Notification (C2/C4/C5): inside the txn + gated on the real transition.
    //    Type 'magic_link_cancel' distinguishes self-service from a staff-driven
    //    'booking_cancellation' (Day 4). No magic link in the payload — the link
    //    is spent; the booking is already cancelled.
    const notificationRef = db.collection("notifications").doc();
    const notification: Notification = {
      id: notificationRef.id,
      bookingId: customer.bookingId,
      type: "magic_link_cancel",
      channel: "console_log",
      payload: {
        bookingId: customer.bookingId,
        cancelledAt: now.toISOString(),
        recipientName: customer.name,
        recipientEmail: customer.email,
        recipientPhone: customer.phone,
      },
      sentAt: now,
      status: "sent",
    };
    tx.set(notificationRef, toFirestore(notification));
  });

  // TODO(README §7): no cancellation-policy enforcement (e.g. no 24h cutoff,
  // and a past-dated booking is still cancellable). Deliberately out of MVP
  // scope; a soft "let us know in time" hint lives in the Day 3 UI instead.
  return buildBookingView(customer);
}

/**
 * manageBookingByToken — magic-link self-service callable (/r/:token).
 *
 * Boundary → lookup → dispatch:
 *   1. zod parse maps a malformed payload to 'invalid-argument'.
 *   2. findBookingCustomerByToken resolves the bearer token (D-017); a miss is
 *      'not-found'.
 *   3. 'view' returns the PII-minimal summary; 'cancel' transitions and returns
 *      the same shape — both as BookingView.
 */
export const manageBookingByToken = onCall(async (request) => {
  const parsed = manageBookingByTokenInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      "Neplatný požadavek.",
      parsed.error.flatten(),
    );
  }
  const { token, action } = parsed.data;

  const customer = await findBookingCustomerByToken(token);

  if (action === "view") {
    return buildBookingView(customer);
  }
  return cancelBooking(customer);
});
