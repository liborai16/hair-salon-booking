/**
 * @hsb/shared/availability — time-slot domain logic.
 *
 * Day 2 (D-016): the pure interval-overlap primitive `overlaps()` that
 * createBooking's transactional slot re-check needs.
 *
 * Day 3 (D-018): the slot generator built on top of `overlaps()` — three
 * exported functions sharing one `checkSlot` core:
 *   - checkSlot              — atomic core (server validates ONE slot)
 *   - generateSlotsForStylist— single-stylist iterator over 15-min grid
 *   - generateAvailableSlots — anyone-mode fan-out + flatten
 *
 * One semantics of "is this slot free?", consumed by createBooking
 * server-side AND the booking flow UI client-side. Caller contract +
 * `now: Date` injection rationale + considered-rejected alternatives
 * (server-side Cloud Function, pre-computed cache) — see D-018.
 *
 * Pure: no Firestore, no I/O, no Date.now(). Operates on JS `Date`
 * instants (the domain time type — see D-013). Timezone-aware via Intl
 * `formatToParts` + `Date.UTC` (D-018 D6, zero-dep).
 */

import { SLOT_GRANULARITY_MIN } from "./pricing.js";
import type {
  Absence,
  Booking,
  BusinessHoursOverride,
  Service,
  ServiceLengthMap,
  Stylist,
} from "./types.js";

// ============================================================
// Constants
// ============================================================

/**
 * IANA timezone of the salon. Wall-clock TimeRange strings (`"HH:MM"` in
 * `Stylist.weeklyHours` / `BusinessHoursOverride.hours`) are interpreted in
 * this zone; conversion to/from UTC `Date` instants happens via Intl-based
 * helpers in the bodies phase (D-018 D6).
 *
 * No `DEFAULT_` prefix: TZ is a salon fact (immutable), not a tunable —
 * unlike `DEFAULT_MIN_LEAD_TIME_MINUTES` / `DEFAULT_GRANULARITY_MIN`
 * which callers may override per call.
 */
export const SALON_TZ = "Europe/Prague";

/**
 * Default slot-start grid granularity in minutes (15). Re-exported from
 * `pricing.ts` (D-014, single source of truth for slot timing) so callers
 * can import the default directly from `@hsb/shared` without coupling to
 * pricing internals. Tunable per call via `SlotQuery.granularityMin`.
 */
export const DEFAULT_GRANULARITY_MIN: number = SLOT_GRANULARITY_MIN;

/**
 * Default minimum lead time for a public booking, in minutes. Day-of online
 * booking industry baseline (Booksy / Reservio default ~2h). Tunable per
 * call via `SlotQuery.minLeadTimeMinutes`. README §6 documented assumption.
 * See D-018 minLeadTime rationale.
 *
 * Named `_MINUTES` (not `_MIN`) to disambiguate from "minimum" — "Min" in
 * the middle of `MIN_LEAD_TIME_MIN` would collide semantically (min-lead =
 * minimum, MIN-suffix = minutes unit). Asymmetric with `GRANULARITY_MIN`
 * (where Min has no collision) is deliberate self-documenting.
 */
export const DEFAULT_MIN_LEAD_TIME_MINUTES = 120;

// ============================================================
// Public types — API surface
// ============================================================

/**
 * One bookable time slot for a specific stylist.
 *
 * Intervals are half-open `[start, end)` (consistent with `overlaps()` and
 * `Absence.endAt`); back-to-back bookings (one ends exactly when the next
 * starts) do NOT overlap. `end = start + computeTotalDuration(services,
 * lengths)` from `pricing.ts`.
 */
export interface Slot {
  stylistId: string;
  start: Date;
  end: Date;
}

/**
 * Per-stylist inputs to availability checks.
 *
 * **Caller contract (D-018):** the caller (UI or `createBooking`) is
 * responsible for:
 *  - Deserializing Firestore Timestamps → JS `Date` (`fromFirestore`, D-013).
 *  - Status-filtering `bookings` to occupying only (`pending`/`confirmed`);
 *    cancelled / completed / no_show are pre-filtered.
 *  - Scope-filtering `absences` to THIS stylist × the `[from, to)` window
 *    (a superset is OK; surplus is cheap).
 *
 * The generator stays defensively robust (internally ignores non-occupying
 * booking statuses) but the contract is caller-filters.
 */
export interface StylistAvailabilityInput {
  /** The stylist whose availability is queried. Must carry `weeklyHours`,
   *  `serviceIds` (qualification), and `active`. */
  stylist: Stylist;

  /** Absences for THIS stylist intersecting the query window. Each absence
   *  is half-open `[startAt, endAt)` — full-day and partial absences both
   *  reduce to a single `overlaps()` test. */
  absences: Absence[];

  /** Existing occupying bookings for THIS stylist that may conflict. Caller
   *  pre-filters by status (D-018 Caller contract); generator additionally
   *  guards (defensive). **Server overlap re-check:** `createBooking`
   *  passes `[]` here and runs `overlaps()` directly inside the Firestore
   *  transaction with txn-read bookings (race-safe) — see D-018 dělba
   *  odpovědnosti. */
  bookings: Booking[];
}

/**
 * Shared query parameters for both `checkSlot` and the generators.
 *
 * `now` is intentionally a **parameter, not `Date.now()`** — see D-018 for
 * the 4 rationales (testability, determinism, caller-controlled, server
 * temporal consistency between `checkSlot` lead-time check and
 * `bookings.createdAt` written in the transaction).
 */
export interface SlotQuery {
  /** Authoritative `Service` docs in the booking (loaded by caller). Total
   *  duration is computed via `computeTotalDuration` (pricing.ts).
   *
   *  **Must be non-empty;** behavior on `[]` is undefined
   *  (`computeTotalDuration` would return 0, producing nonsensical
   *  zero-duration slots). Strict validation (e.g. `min(1)`) lives at the
   *  API boundary in `createBooking.schema.ts`, not here. */
  services: Service[];

  /** Optional per-service length variants for 'barveni' services.
   *
   *  Keys MUST reference IDs present in `services`; the generator silently
   *  ignores extra keys (strict validation — rejection with typed error —
   *  lives at the API boundary in `createBooking`, ř. 109-117). This keeps
   *  the internal generator forgiving while the boundary stays strict. */
  serviceLengths?: ServiceLengthMap;

  /** Inclusive lower bound of the generation/check window. */
  from: Date;

  /** Exclusive upper bound. For `checkSlot` one-shot server validation the
   *  caller may pass `to = from + granularityMin` (a single-point window). */
  to: Date;

  /** Current instant (clock source). Used for `in_past` and `too_soon`.
   *  Caller injects — D-018. */
  now: Date;

  /** Salon-level business-hours overrides (holidays, special hours). Sparse —
   *  only populated dates. Per-day precedence is intersection with
   *  `stylist.weeklyHours[weekday]` (D-018 D2). */
  override?: BusinessHoursOverride[];

  /** Slot-start grid granularity in minutes. Defaults to
   *  `DEFAULT_GRANULARITY_MIN` (15, re-exported from pricing.ts). */
  granularityMin?: number;

  /** Minimum lead time in minutes — slots with
   *  `start < now + minLeadTimeMinutes` are rejected with reason
   *  `'too_soon'`. Defaults to `DEFAULT_MIN_LEAD_TIME_MINUTES` (120).
   *  Pass `0` for no lead-time enforcement (demo / seed). */
  minLeadTimeMinutes?: number;
}

/**
 * Why a candidate slot was rejected. **First-fail single-reason semantics**
 * (cheap-first short-circuit; array-reasons alternative rejected YAGNI —
 * D-018). The reason order = check order, documented on `checkSlot`.
 */
export type SlotRejectionReason =
  | "not_qualified"           // stylist.serviceIds doesn't cover all requested services
  | "in_past"                 // slot start < query.now
  | "too_soon"                // slot start < query.now + minLeadTimeMinutes
  | "salon_closed"            // override.open === false for this date
  | "outside_working_hours"   // outside intersection(weeklyHours[weekday], override.hours?)
  | "absence"                 // overlaps an Absence interval
  | "booking_conflict";       // overlaps an existing occupying Booking

/**
 * Result of `checkSlot`. **Discriminated union** on `valid`: `true` means
 * bookable (no payload — the slot start/end is what the caller already had);
 * `false` carries the typed `reason` for UX-friendly error surfacing
 * (server hlásí klientovi konkrétní důvod, ne generic "nelze rezervovat").
 */
export type SlotCheck =
  | { valid: true }
  | { valid: false; reason: SlotRejectionReason };

// ============================================================
// Domain primitive — overlap test (D-016, unchanged)
// ============================================================

/**
 * Do two time intervals overlap?
 *
 * Intervals are HALF-OPEN: `[start, end)`. Two bookings that merely
 * touch — one ends exactly when the next begins (10:00–10:30 and
 * 10:30–11:00) — do NOT overlap. That is the right semantics for a
 * booking grid: the chair is free again at the boundary instant, so
 * back-to-back bookings are allowed.
 *
 * Precondition: each interval is well-formed (`start <= end`). Callers
 * derive `end = start + duration`, so this holds by construction.
 *
 * @returns `true` iff `[aStart, aEnd)` and `[bStart, bEnd)` share any instant.
 */
export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

// ============================================================
// Availability API (D-018) — signatures; bodies in next phase
// ============================================================

/**
 * Validate a single candidate slot `(start, computeTotalDuration(services))`.
 *
 * Called by:
 *  - `createBooking` server-side BEFORE the Firestore transaction to reject
 *    "outside working hours / absence / salon closed" cheaply. The
 *    overlap-race re-check stays INSIDE the txn with `overlaps()` directly
 *    against txn-read bookings — see D-018 dělba odpovědnosti.
 *  - `generateSlotsForStylist` iterating the 15-min grid (one call per
 *    candidate start).
 *
 * **Check order — cheap-first short-circuit, first-fail single-reason:**
 *   1. `not_qualified`         — O(services) set membership in `stylist.serviceIds`
 *   2. `in_past`               — O(1) compare against `query.now`
 *   3. `too_soon`              — O(1) compare against `query.now + minLeadTimeMinutes`
 *   4. `salon_closed`          — O(overrides) lookup by date string
 *   5. `outside_working_hours` — O(1) interval check (intersection per D-018 D2)
 *   6. `absence`               — O(absences) via `overlaps()`
 *   7. `booking_conflict`      — O(bookings) via `overlaps()` over occupying
 *
 * Order is deliberate AND defines reason priority for multi-violation slots:
 * a slot that's both `in_past` and `outside_working_hours` returns
 * `in_past` (the first failing rule). Array-reasons alternative rejected
 * YAGNI in D-018.
 *
 * @param start  Candidate slot start (instant). When called from a generator
 *               it is aligned to `query.granularityMin`; for server one-shot
 *               validation the caller passes the exact start the client
 *               requested (no alignment enforced — alignment is the
 *               generator's, not `checkSlot`'s, contract).
 * @param input  Per-stylist data. Caller MUST deserialize Firestore
 *               Timestamps → `Date` (`fromFirestore`, D-013) and pre-filter
 *               `bookings` to occupying statuses (see `StylistAvailabilityInput`
 *               and D-018 Caller contract). Generator is defensively robust;
 *               contract is caller-filters.
 * @param query  Shared query parameters incl. injected `now`.
 *
 * @returns `{ valid: true }` if bookable; otherwise
 *          `{ valid: false, reason }` with the first failing rule.
 *
 * @example
 *   // Half-open intervals: a booking ending at 10:00 does NOT block a slot
 *   // starting at 10:00 — back-to-back is allowed (D-016, overlaps()).
 *   //   existing booking: [09:30, 10:00)
 *   //   new candidate:    [10:00, 10:30)
 *   //   → { valid: true }
 *   const check = checkSlot(start, input, query);
 *   if (check.valid) await book(start);
 *   else surfaceReasonToUser(check.reason);
 */
export function checkSlot(
  start: Date,
  input: StylistAvailabilityInput,
  query: SlotQuery,
): SlotCheck {
  void start; void input; void query;
  throw new Error("TODO(day-3 bodies): see D-018 architektura + check order");
}

/**
 * Generate all bookable slots for ONE stylist over `[query.from, query.to)`,
 * iterating the `granularityMin` (default 15-min) grid and rejecting via
 * `checkSlot`. Each returned `Slot` carries `stylistId` for consistency
 * with `generateAvailableSlots`.
 *
 * **Day iteration** is calendar `YYYY-MM-DD` (UTC date arithmetic increment
 * — UTC has no DST, so `+1 day` is always safe), per-day wall-clock window
 * computed via Intl-based helpers (D-018 D6). Slots whose `end` would
 * exceed the effective working window are dropped (long service at end of
 * day; e.g. 2.5h svatební styling starting at 16:30 when salon closes 18:00).
 *
 * **Performance (informational, for caller awareness):**
 * O(days × slots-per-day × (|absences| + |bookings|)) per stylist. For a
 * typical salon window (~10 work-hours × 4 slots/hour × ~30 days × < 50
 * bookings) the iteration is well under 10 ms in-browser. See D-018
 * considered-rejected alternatives (`listAvailableSlots` Cloud Function;
 * pre-computed daily cache deferred to scale-driven refactor).
 *
 * @param input  Per-stylist data; same caller contract as `checkSlot`.
 * @param query  Window + services + injected `now`.
 *
 * @returns Slots sorted ascending by `start`. **Empty array** if no
 *          bookable slot exists in the window (e.g. stylist on holiday
 *          throughout, or `query.from >= query.to`).
 */
export function generateSlotsForStylist(
  input: StylistAvailabilityInput,
  query: SlotQuery,
): Slot[] {
  void input; void query;
  throw new Error("TODO(day-3 bodies): iterate calendar days + grid; call checkSlot");
}

/**
 * Anyone-mode fan-out: generate slots across MULTIPLE stylists and flatten.
 *
 * Each returned `Slot` carries `stylistId` — the UI must know whom to book
 * (`createBooking` requires a concrete `stylistId`). **Grouping the same
 * time across stylists** ("10:00 volní: Marie, Jana") is UI responsibility,
 * not the generator's; the generator returns facts in a deterministic
 * order, the UI presents them (D-018 D3).
 *
 * @param inputs One `StylistAvailabilityInput` per qualified stylist.
 *               Caller pre-filters: include only stylists whose
 *               `serviceIds` cover all `query.services`. Generator
 *               additionally rejects via `not_qualified` (defensive).
 * @param query  Shared query parameters.
 *
 * @returns Slots sorted ascending by `(start, stylistId)`. Chronological
 *          primary so a `groupBy(start)` UI view ("v 10:00 volní: ...") is
 *          a single adjacent-row pass; `stylistId` secondary so
 *          `groupBy(stylistId)` from this sorted list preserves per-stylist
 *          chronological order (stable groupBy). **Empty array** when
 *          `inputs` is empty or no stylist has any bookable slot in the
 *          window.
 */
export function generateAvailableSlots(
  inputs: StylistAvailabilityInput[],
  query: SlotQuery,
): Slot[] {
  void inputs; void query;
  throw new Error("TODO(day-3 bodies): map generateSlotsForStylist + flatten + sort (start, stylistId)");
}

// TODO(day-3 bodies): Intl-based TZ helpers `wallToInstant(ymd, hhmm, tz)`
// and `instantToWallParts(instant, tz)` per D-018 D6 (formatToParts +
// Date.UTC, zero-dep). Plus a day-iterator over calendar YYYY-MM-DD.
//
// TODO(day-5): unit tests — overlap edge cases (back-to-back, identical,
// contained) AND the D-018 D6 TZ regression anchor (4 dates × 2 patterns
// + 3 day-lengths from the _tz_probe; pre-staged in D-018 D6).
