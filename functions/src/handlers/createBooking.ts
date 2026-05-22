/**
 * createBooking — public booking creation (Cloud Function, Gen2 onCall).
 *
 * This file is built in two checkpoints:
 *   CP2 (here): `prepareBooking` — load authoritative data, validate the
 *               request against the domain, and compute endAt + totalPrice
 *               SERVER-SIDE (D-014). No persistence yet.
 *   CP3 (next): the `onCall` wrapper + a Firestore transaction that re-checks
 *               the slot (overlaps()) and atomically writes booking,
 *               bookingCustomer, customerProfile and a notification log.
 *
 * Why split: `prepareBooking` is the pure decision layer (reads + rules +
 * pricing). Keeping it as its own function makes the transaction in CP3 thin
 * — it only re-checks the slot and writes — and keeps this logic readable.
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createHash, randomBytes } from "node:crypto";
import {
  computeTotalDuration,
  computeTotalPrice,
  convertTimestampsToDate,
  fromFirestore,
  overlaps,
  toFirestore,
  type Booking,
  type BookingCustomer,
  type BookingHistoryEntry,
  type BookingStatus,
  type CustomerProfile,
  type Notification,
  type Service,
  type ServiceLengthMap,
  type Stylist,
} from "@hsb/shared";
import { db } from "../lib/firebase.js";
import {
  createBookingInput,
  type CreateBookingInput,
} from "../schemas/createBooking.schema.js";

const MS_PER_MINUTE = 60_000;

/**
 * Booking statuses that OCCUPY a slot for conflict purposes. 'cancelled'
 * frees the slot; 'completed' / 'no_show' are terminal past states a future
 * booking won't overlap. Applied in-memory to the slot re-check below.
 */
const OCCUPYING_STATUSES = new Set<BookingStatus>(["pending", "confirmed"]);

/**
 * Lower-bound window for the slot-conflict scan. We query existing bookings of
 * the stylist whose start falls in [newStart - lookback, newEnd); the lookback
 * keeps the read tiny while still capturing any earlier booking that could
 * still be running when the new one starts. It must exceed the longest
 * possible visit — 24h is comfortably above the salon working-day cap the
 * Day 3 availability algorithm enforces.
 */
const SLOT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * The validated, priced result of `prepareBooking`. Everything CP3 needs to
 * run the slot re-check and write the documents — already authoritative, so
 * the transaction never recomputes price or trusts client input.
 */
export interface PreparedBooking {
  stylist: Stylist;
  /** De-duplicated service docs, in request order (see prepareBooking). */
  services: Service[];
  serviceLengths?: ServiceLengthMap;
  startAt: Date;
  /** startAt + server-computed total duration. */
  endAt: Date;
  /** Server-computed total price in CZK (D-014). */
  totalPrice: number;
}

/**
 * Load authoritative data, validate the request, and compute duration & price.
 *
 * Throws `HttpsError` for every domain rejection so the onCall wrapper (CP3)
 * can surface a typed error to the client:
 *   - 'failed-precondition' — booking in the past, inactive stylist/service,
 *     stylist not qualified for a requested service.
 *   - 'not-found'           — stylistId or a serviceId doesn't exist.
 *   - 'invalid-argument'    — serviceLengths references an unknown serviceId.
 *
 * Input-SHAPE errors (malformed payload) are mapped to 'invalid-argument' by
 * the zod parse in the onCall wrapper, before this function is reached.
 */
export async function prepareBooking(
  input: CreateBookingInput,
): Promise<PreparedBooking> {
  const startAt = new Date(input.startAt);

  // Public bookings must be in the future. (Staff walk-ins booked "now" are a
  // separate admin path — Day 4 — not this public callable.)
  if (startAt.getTime() <= Date.now()) {
    throw new HttpsError(
      "failed-precondition",
      "Termín rezervace musí být v budoucnosti.",
    );
  }

  // Cross-field check the schema deliberately deferred: every serviceLengths
  // key must reference a service actually in this booking.
  if (input.serviceLengths) {
    const requestedIds = new Set(input.serviceIds);
    for (const key of Object.keys(input.serviceLengths)) {
      if (!requestedIds.has(key)) {
        throw new HttpsError(
          "invalid-argument",
          `serviceLengths odkazuje na neznámé serviceId: ${key}`,
        );
      }
    }
  }

  // --- Stylist ---
  const stylistSnap = await db
    .collection("stylists")
    .doc(input.stylistId)
    .get();
  if (!stylistSnap.exists) {
    throw new HttpsError("not-found", `Stylista ${input.stylistId} neexistuje.`);
  }
  const stylist = fromFirestore<Stylist>(stylistSnap);
  if (!stylist.active) {
    throw new HttpsError("failed-precondition", "Vybraný stylista není aktivní.");
  }

  // --- Services ---
  // Treat serviceIds as a set: a single visit contains a service at most once,
  // so de-dup before loading. This also stops a duplicated id from
  // double-counting price/duration. The de-duplicated list is what CP3 stores
  // on Booking.serviceIds, so the stored shape matches what was priced.
  const uniqueServiceIds = [...new Set(input.serviceIds)];
  const serviceSnaps = await Promise.all(
    uniqueServiceIds.map((id) => db.collection("services").doc(id).get()),
  );
  const services: Service[] = [];
  for (const snap of serviceSnaps) {
    if (!snap.exists) {
      throw new HttpsError("not-found", `Služba ${snap.id} neexistuje.`);
    }
    const service = fromFirestore<Service>(snap);
    if (!service.active) {
      throw new HttpsError(
        "failed-precondition",
        `Služba „${service.name}" už není v nabídce.`,
      );
    }
    services.push(service);
  }

  // --- Qualification: stylist must perform EVERY requested service ---
  const stylistSkills = new Set(stylist.serviceIds);
  for (const service of services) {
    if (!stylistSkills.has(service.id)) {
      throw new HttpsError(
        "failed-precondition",
        `Stylista ${stylist.name} neprovádí službu „${service.name}".`,
      );
    }
  }

  // --- Server is the authority for duration & price (D-014) ---
  // Both are computed from authoritative Firestore data via @hsb/shared; the
  // client never sends them (strictObject in the schema rejects them outright).
  const durationMinutes = computeTotalDuration(services, input.serviceLengths);
  const totalPrice = computeTotalPrice(services, stylist, input.serviceLengths);
  const endAt = new Date(startAt.getTime() + durationMinutes * MS_PER_MINUTE);

  // TODO(day-3): validate the slot against the stylist's WORKING HOURS,
  // ABSENCES and salon BUSINESS-HOURS OVERRIDES. CP3 only re-checks overlap
  // with existing bookings (no double-booking), which does NOT prevent a
  // booking placed outside working hours or during an absence. The full
  // availability check belongs in the slot generator that Day 3 grows in
  // packages/shared/src/availability.ts (alongside overlaps(), D-016); that
  // same shared function will then be called here server-side. This gap is
  // deliberate and scoped to Day 3 — see FLAG 1 in the Day 2 BLOK B handoff.

  return {
    stylist,
    services,
    serviceLengths: input.serviceLengths,
    startAt,
    endAt,
    totalPrice,
  };
}

/**
 * createBooking — public callable.
 *
 * Boundary → decision → persistence:
 *   1. zod parse maps a malformed payload to 'invalid-argument' (the schema's
 *      strictObject also rejects any attempt to send totalPrice/endAt — D-014).
 *   2. prepareBooking loads data, validates the domain, and prices the booking.
 *   3. A Firestore transaction re-checks the slot (race-condition safe) and
 *      atomically writes all four documents.
 */
export const createBooking = onCall(async (request) => {
  // --- 1. Boundary: validate input SHAPE. Domain rules live in prepareBooking. ---
  const parsed = createBookingInput.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      "Neplatný vstup rezervace.",
      parsed.error.flatten(),
    );
  }
  const input = parsed.data;

  // --- 2. Load + validate + price (no persistence; throws typed HttpsError). ---
  const prepared = await prepareBooking(input);

  // --- Identifiers & secret derived before the transaction (pure, no I/O). ---
  const bookingRef = db.collection("bookings").doc();
  const bookingId = bookingRef.id;
  // 256-bit, URL-safe (~43 chars) — exceeds the 192-bit floor in types.ts.
  const cancelToken = randomBytes(32).toString("base64url");
  // SHA-256 of the E.164 phone, truncated to 32 hex chars (CustomerProfile key).
  const phoneHash = createHash("sha256")
    .update(input.customer.phone)
    .digest("hex")
    .slice(0, 32);
  const profileRef = db.collection("customerProfiles").doc(phoneHash);
  const now = new Date();

  // --- 3. Transaction: slot re-check + atomic writes ---
  await db.runTransaction(async (tx) => {
    // ---- READS (Firestore requires all reads before any write) ----

    // Slot re-check window (see SLOT_LOOKBACK_MS). Composite index required:
    // (stylistId ASC, startAt ASC) — declared in firestore.indexes.json.
    const lookbackStart = new Date(
      prepared.startAt.getTime() - SLOT_LOOKBACK_MS,
    );
    const conflictQuery = db
      .collection("bookings")
      .where("stylistId", "==", prepared.stylist.id)
      .where("startAt", ">=", lookbackStart)
      .where("startAt", "<", prepared.endAt);
    const conflictSnap = await tx.get(conflictQuery);
    const profileSnap = await tx.get(profileRef);

    // ---- Slot validation (race-condition safe: re-checked inside the txn) ----
    for (const doc of conflictSnap.docs) {
      const existing = fromFirestore<Booking>(doc);
      if (!OCCUPYING_STATUSES.has(existing.status)) continue;
      if (
        overlaps(
          prepared.startAt,
          prepared.endAt,
          existing.startAt,
          existing.endAt,
        )
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Tento termín byl právě obsazen. Vyberte prosím jiný čas.",
        );
      }
    }

    // ---- WRITES (atomic) ----

    // 1) bookings/{id} — PUBLIC READ, NO PII.
    const booking: Booking = {
      id: bookingId,
      stylistId: prepared.stylist.id,
      serviceIds: prepared.services.map((s) => s.id),
      // Spread conditionally: a stored `undefined` would make the Admin SDK
      // throw (ignoreUndefinedProperties defaults to false).
      ...(prepared.serviceLengths
        ? { serviceLengths: prepared.serviceLengths }
        : {}),
      startAt: prepared.startAt,
      endAt: prepared.endAt,
      status: "confirmed",
      totalPrice: prepared.totalPrice,
      source: "public",
      createdAt: now,
      updatedAt: now,
    };
    tx.set(bookingRef, toFirestore(booking));

    // 2) bookingCustomers/{bookingId} — STAFF-ONLY, PII. Doc key is bookingId
    //    (a named field, not `id`), so it's written directly (toFirestore only
    //    strips an `id` field, which this type doesn't have).
    const customer: BookingCustomer = {
      bookingId,
      name: input.customer.name,
      phone: input.customer.phone,
      email: input.customer.email,
      cancelToken,
    };
    tx.set(db.collection("bookingCustomers").doc(bookingId), customer);

    // 3) customerProfiles/{phoneHash} — STAFF-ONLY. UPDATE-not-insert:
    //    creating a booking only APPENDS to history. No-show / visit aggregates
    //    are owned by lifecycle transitions (Day 4/5), never touched here
    //    (FLAG 2). History is newest-first, capped at 20 (types.ts).
    const historyEntry: BookingHistoryEntry = {
      bookingId,
      startAt: prepared.startAt,
      status: "confirmed",
      stylistId: prepared.stylist.id,
      totalPrice: prepared.totalPrice,
    };
    if (profileSnap.exists) {
      const existingProfile = convertTimestampsToDate<CustomerProfile>(
        profileSnap.data(),
      );
      const bookingHistory = [
        historyEntry,
        ...(existingProfile.bookingHistory ?? []),
      ].slice(0, 20);
      // Touch ONLY bookingHistory — aggregates stay as-is (FLAG 2).
      tx.update(profileRef, { bookingHistory });
    } else {
      const profile: CustomerProfile = {
        phoneHash,
        bookingHistory: [historyEntry],
        noShowCount: 0,
        lastNoShowAt: null,
        lastVisitAt: null,
        isFlaggedNoShow: false,
      };
      tx.set(profileRef, profile);
    }

    // 4) notifications/{id} — STAFF-ONLY log; mock channel (no real dispatch).
    const notificationRef = db.collection("notifications").doc();
    const notification: Notification = {
      id: notificationRef.id,
      bookingId,
      type: "booking_confirmation",
      channel: "console_log",
      payload: {
        recipientName: input.customer.name,
        recipientEmail: input.customer.email,
        recipientPhone: input.customer.phone,
        // Magic-link self-cancel route (scope item 12). Relative path; the web
        // app prepends its origin. The token reaches the customer via THIS
        // channel — deliberately not in the callable's response below.
        magicLink: `/r/${cancelToken}`,
        startAt: prepared.startAt.toISOString(),
        totalPrice: prepared.totalPrice,
      },
      sentAt: now,
      status: "sent",
    };
    tx.set(notificationRef, toFirestore(notification));
  });

  // PII-minimal confirmation. cancelToken is intentionally omitted — it travels
  // via the notification channel, not the API response.
  return {
    bookingId,
    status: "confirmed" as const,
    startAt: prepared.startAt.toISOString(),
    endAt: prepared.endAt.toISOString(),
    totalPrice: prepared.totalPrice,
  };
});
