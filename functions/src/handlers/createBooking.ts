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
import { randomBytes } from "node:crypto";
import {
  checkSlot,
  computeTotalDuration,
  computeTotalPrice,
  convertTimestampsToDate,
  DEFAULT_MIN_LEAD_TIME_MINUTES,
  fromFirestore,
  hashCustomerPhone,
  overlaps,
  toFirestore,
  type Absence,
  type Booking,
  type BookingCustomer,
  type BookingHistoryEntry,
  type BookingStatus,
  type BusinessHoursOverride,
  type CustomerProfile,
  type Notification,
  type SalonSettings,
  type Service,
  type ServiceLengthMap,
  type SlotRejectionReason,
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
  /**
   * Stylist's absences that may overlap `[startAt, endAt)`. Bounded by a
   * Firestore query (`stylistId == X AND endAt >= startAt`) plus an in-memory
   * filter (`startAt < endAt`). Passed to `checkSlot` in the wrapper for the
   * absence conflict check. D-018 integration footprint.
   */
  absences: Absence[];
  /**
   * Salon-level business-hours overrides from `salonSettings/main`, or `[]`
   * if the doc is missing (early salon setup). Passed to `checkSlot` for the
   * `salon_closed` + `outside_working_hours` (intersection) checks. D-018 D2.
   */
  override: BusinessHoursOverride[];
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

  // --- Sanitize serviceLengths to the documented invariant ---
  // Booking.serviceLengths must only carry lengths for 'barveni' services that
  // define lengthVariants (see types.ts). The subset check above proved every
  // key is a service in this booking; here we additionally DROP keys for
  // services that don't use hair length, so a stored Booking can't violate its
  // own invariant with client-supplied junk ("server is the authority" — the
  // client doesn't decide what we persist). Pricing/duration already ignore
  // length for such services, so this changes what we STORE, not the result.
  const lengthCapableIds = new Set(
    services
      .filter((s) => s.category === "barveni" && s.lengthVariants !== undefined)
      .map((s) => s.id),
  );
  let serviceLengths: ServiceLengthMap | undefined;
  if (input.serviceLengths) {
    const filtered: ServiceLengthMap = {};
    for (const [id, length] of Object.entries(input.serviceLengths)) {
      if (lengthCapableIds.has(id)) filtered[id] = length;
    }
    // Collapse to undefined when nothing relevant remains, so the invariant
    // "present ⇒ at least one barveni service" holds (and no empty object is
    // stored — which would also satisfy the Admin SDK's no-undefined rule).
    serviceLengths = Object.keys(filtered).length > 0 ? filtered : undefined;
  }

  // --- Server is the authority for duration & price (D-014) ---
  // Both are computed from authoritative Firestore data via @hsb/shared; the
  // client never sends them (strictObject in the schema rejects them outright).
  const durationMinutes = computeTotalDuration(services, serviceLengths);
  const totalPrice = computeTotalPrice(services, stylist, serviceLengths);
  const endAt = new Date(startAt.getTime() + durationMinutes * MS_PER_MINUTE);

  // --- Static availability inputs (D-018 integration): absences for this
  // stylist + salon-level overrides. Time-sensitive validation (checkSlot)
  // runs in the wrapper, not here — prepareBooking stays deterministic.
  // Both reads in parallel; both tolerate "no matches": empty absences =
  // stylist has no absences in window, missing salonSettings/main = no
  // overrides configured (slot uses pure weeklyHours). Composite index
  // `(absences: stylistId, endAt)` declared in firestore.indexes.json. ---
  const [absencesSnap, settingsSnap] = await Promise.all([
    db
      .collection("absences")
      .where("stylistId", "==", stylist.id)
      .where("endAt", ">=", startAt)
      .get(),
    db.collection("salonSettings").doc("main").get(),
  ]);

  // In-memory filter: keep absences that may overlap [startAt, endAt). The
  // Firestore query already excluded past absences (endAt < startAt); here
  // we further drop future-only absences (startAt >= endAt). D-018 Caller
  // contract permits a superset, this just tightens it a bit.
  const absences: Absence[] = absencesSnap.docs
    .map((snap) => fromFirestore<Absence>(snap))
    .filter((a) => a.startAt.getTime() < endAt.getTime());

  // Defensive: settings doc may not exist yet (early salon setup). Treat as
  // "no overrides configured" — slot validation uses pure weeklyHours.
  // Uses convertTimestampsToDate (not fromFirestore) because SalonSettings
  // is a singleton without an `id` field (doc ID is hardcoded "main"); same
  // pattern as CustomerProfile read below (ř. 338).
  const override: BusinessHoursOverride[] = settingsSnap.exists
    ? convertTimestampsToDate<SalonSettings>(settingsSnap.data())
        .businessHoursOverride ?? []
    : [];

  return {
    stylist,
    services,
    serviceLengths,
    startAt,
    endAt,
    totalPrice,
    absences,
    override,
  };
}

/**
 * Map a `SlotRejectionReason` from `checkSlot` to an `HttpsError` shape
 * (code + Czech message + typed details payload for client-side handling).
 *
 * Most reasons are user-facing precondition failures (`failed-precondition`)
 * and the message can be surfaced directly. Two reasons are **defensive**
 * (`not_qualified` / `in_past`) — they should have been caught earlier in
 * `prepareBooking` (ř. 156-165 / ř. 98). Reaching them via `checkSlot`
 * indicates a consistency bug between the two validation layers; map to
 * `internal` and log so observability flags the bug instead of masking it
 * as a generic precondition failure.
 *
 * `booking_conflict` is mapped to `aborted` defensively too: the wrapper
 * passes `bookings: []` so the race-check stays inside the Firestore
 * transaction; this reason should be unreachable pre-txn, but if a future
 * change accidentally exposes it, `aborted` signals the right retry hint.
 *
 * `details: { reason }` lets the client switch on a typed code (E1) — e.g.
 * suggest "try a later slot" for `too_soon` vs "try a different stylist"
 * for `absence` — without parsing the human-readable message string.
 */
function mapSlotReasonToError(
  reason: SlotRejectionReason,
  minLeadTimeMinutes: number,
): { code: "failed-precondition" | "internal" | "aborted"; message: string } {
  switch (reason) {
    case "too_soon": {
      // Dynamic hours per E2 — message stays accurate if the default is tuned.
      const hours = Math.max(1, Math.round(minLeadTimeMinutes / 60));
      return {
        code: "failed-precondition",
        message: `Rezervaci je nutné vytvořit alespoň ${hours}h předem.`,
      };
    }
    case "salon_closed":
      return {
        code: "failed-precondition",
        message: "Salon je v tento den uzavřen.",
      };
    case "outside_working_hours":
      return {
        code: "failed-precondition",
        message: "Stylista v tento čas nepracuje.",
      };
    case "absence":
      return {
        code: "failed-precondition",
        message: "Stylista má v tento čas absenci.",
      };
    case "not_qualified":
    case "in_past":
      // Defensive: prepareBooking already rejects these. Reaching here means
      // a bug — surface as internal so logs flag it instead of masking.
      console.warn(
        `checkSlot defensive reach: ${reason} — prepareBooking validation drift`,
      );
      return {
        code: "internal",
        message: "Vnitřní chyba validace rezervace.",
      };
    case "booking_conflict":
      // Wrapper passes bookings: []; this should be unreachable pre-txn. If
      // it ever fires, "aborted" tells the client to retry (the transaction
      // is the authoritative race-check anyway).
      return {
        code: "aborted",
        message: "Termín byl právě obsazen, zkuste jiný čas.",
      };
  }
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

  // --- 2b. Time-sensitive validation via shared checkSlot (D-018 integration). ---
  // This catches the static failures cheaply, BEFORE the transaction starts:
  // working hours, absence, salon override, lead time. Overlap with existing
  // bookings stays INSIDE the transaction (race-safe re-check below) — so we
  // pass `bookings: []` here, keeping checkSlot the single source of slot-
  // validity truth without duplicating the race logic.
  //
  // `now` is created HERE and reused for both the lead-time check AND every
  // write below — temporal consistency per D-018 BS-2 (avoids drift between
  // the lead-time gate and bookings.createdAt).
  const now = new Date();
  const minLeadTimeMinutes = DEFAULT_MIN_LEAD_TIME_MINUTES;
  const check = checkSlot(
    prepared.startAt,
    {
      stylist: prepared.stylist,
      absences: prepared.absences,
      bookings: [], // race-check stays inside the Firestore transaction
    },
    {
      services: prepared.services,
      serviceLengths: prepared.serviceLengths,
      // One-shot window: just the slot itself (from = start, to = end).
      from: prepared.startAt,
      to: prepared.endAt,
      now,
      override: prepared.override,
      minLeadTimeMinutes,
    },
  );
  if (!check.valid) {
    const mapped = mapSlotReasonToError(check.reason, minLeadTimeMinutes);
    throw new HttpsError(mapped.code, mapped.message, { reason: check.reason });
  }

  // --- Identifiers & secret derived before the transaction (pure, no I/O). ---
  const bookingRef = db.collection("bookings").doc();
  const bookingId = bookingRef.id;
  // 256-bit, URL-safe (~43 chars) — exceeds the 192-bit floor in types.ts.
  const cancelToken = randomBytes(32).toString("base64url");
  // CustomerProfile doc key (D5 lift: shared helper, mirrors seed + future UI).
  // Async per Web Crypto API — handler is already async (onCall), trivial await.
  const phoneHash = await hashCustomerPhone(input.customer.phone);
  const profileRef = db.collection("customerProfiles").doc(phoneHash);

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
