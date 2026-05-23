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

import { computeTotalDuration, SLOT_GRANULARITY_MIN } from "./pricing.js";
import type {
  Absence,
  Booking,
  BookingStatus,
  BusinessHoursOverride,
  Service,
  ServiceLengthMap,
  Stylist,
  WeeklyHours,
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
// Timezone helpers (D-018 D6) — Intl formatToParts + Date.UTC
// ============================================================

/**
 * Map UTC day index (0=Sunday..6=Saturday from `Date.getUTCDay`) to
 * `WeeklyHours` field name. The order MUST match how the JS `Date` API
 * numbers weekdays (Sunday=0), not the human "week starts Monday" intuition.
 */
const UTC_DAY_TO_WEEKDAY: ReadonlyArray<keyof WeeklyHours> = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

/**
 * Compute the UTC offset (in milliseconds) of `tz` at the given `instant`.
 *
 * Internal helper for `wallToInstant`. Uses `Intl.DateTimeFormat.formatToParts`
 * (NOT `toLocaleString` round-trip — D-018 D6) to avoid host-specific string
 * parsing. Positive for zones ahead of UTC (Europe/Prague: +3,600,000 ms
 * winter / +7,200,000 ms summer).
 */
function getOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(instant).map((x) => [x.type, x.value]),
  );
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUTC - instant.getTime();
}

/**
 * Convert a wall-clock time `(ymd, hhmm)` in zone `tz` to a UTC `Date` instant.
 *
 * Implementation: build a "naive UTC" guess from the components, then
 * subtract the zone offset at that instant (single-pass; sufficient because
 * the offset is constant within any non-DST-transition hour). DST-aware via
 * Intl's IANA database. Empirical proof across both 2026 DST edges in
 * D-018 D6.
 *
 * Exported (not private) so Day 5 tests can directly anchor the TZ
 * regression suite — 4 dates × 2 patterns + 3 day-lengths from the D-018 D6
 * `_tz_probe`.
 *
 * **Precondition (no runtime validation):** `ymd` is `"YYYY-MM-DD"`, `hhmm`
 * is `"HH:MM"` (24-hour), `tz` is a valid IANA zone name. Bad input yields
 * an `Invalid Date` or `RangeError` from `Intl`; the caller (generator +
 * tests) passes already-typed `TimeRange` values from `types.ts`, so
 * defensive parsing is omitted (KISS).
 *
 * **Known undefined zone:** the DST-transition hour itself (Europe/Prague:
 * 02:00–03:00 on the last March / October Sundays) is inherently ambiguous
 * — spring-gap is nonexistent, fall-back has two valid UTC instants. Salon
 * working hours (8–18) never touch this window; see D-018 Known limitations.
 *
 * @example
 *   wallToInstant("2026-07-15", "10:00", "Europe/Prague")
 *   // → 2026-07-15T08:00:00.000Z  (CEST, UTC+2)
 *   wallToInstant("2026-01-15", "10:00", "Europe/Prague")
 *   // → 2026-01-15T09:00:00.000Z  (CET, UTC+1)
 */
export function wallToInstant(ymd: string, hhmm: string, tz: string): Date {
  // Tuple assertion: precondition (documented above) guarantees exactly the
  // shape "YYYY-MM-DD" / "HH:MM" → 3 / 2 finite numbers. Without the cast,
  // `noUncheckedIndexedAccess` widens to `(number | undefined)[]` and the
  // arithmetic below would need redundant guards.
  const [Y, M, D] = ymd.split("-").map(Number) as [number, number, number];
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const guess = Date.UTC(Y, M - 1, D, h, m);
  return new Date(guess - getOffsetMs(new Date(guess), tz));
}

/**
 * Convert a UTC `Date` instant to its wall-clock parts in zone `tz`:
 * calendar date (`ymd`), time-of-day (`hhmm`), and weekday key matching
 * `WeeklyHours` field names.
 *
 * Consumers: the day iterator (needs the wall-clock calendar date for
 * grouping) and `checkSlot` (needs `weekday` to look up
 * `stylist.weeklyHours[weekday]`). DST-aware via the same Intl path as
 * `wallToInstant`.
 *
 * Weekday is computed from the wall-clock calendar date via
 * `Date.UTC(Y, M-1, D).getUTCDay()` — the calendar weekday is a property
 * of the date itself, independent of TZ, so no locale-dependent string
 * mapping is needed (avoids the en-US "Mon"/"Tue" label fragility).
 *
 * @returns `ymd` formatted `"YYYY-MM-DD"`; `hhmm` formatted `"HH:MM"`
 *          (24-hour); `weekday` as a `WeeklyHours` key
 *          (`"monday"` … `"sunday"`).
 *
 * @example
 *   instantToWallParts(new Date("2026-07-15T08:00:00.000Z"), "Europe/Prague")
 *   // → { ymd: "2026-07-15", hhmm: "10:00", weekday: "wednesday" }
 */
export function instantToWallParts(
  instant: Date,
  tz: string,
): { ymd: string; hhmm: string; weekday: keyof WeeklyHours } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(instant).map((x) => [x.type, x.value]),
  );
  const ymd = `${p.year}-${p.month}-${p.day}`;
  const hhmm = `${p.hour}:${p.minute}`;
  // `getUTCDay()` returns 0-6 and the table has exactly 7 entries, so the
  // lookup never undefined — assertion satisfies `noUncheckedIndexedAccess`.
  const weekday = UTC_DAY_TO_WEEKDAY[
    new Date(
      Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)),
    ).getUTCDay()
  ] as keyof WeeklyHours;
  return { ymd, hhmm, weekday };
}

/**
 * Enumerate calendar days touching the window `[from, to)`, expressed as
 * wall-clock `YYYY-MM-DD` strings in zone `tz`.
 *
 * **Why UTC date arithmetic for increment:** UTC has no DST, so
 * `Date.UTC(Y, M-1, D+1)` is always exactly one calendar day forward —
 * the "kolik hodin má den" question never arises (D-018). Wall-clock
 * 23h / 25h days happen on DST edges, but iterating via UTC sidesteps
 * them entirely.
 *
 * A day is included iff its wall-clock `00:00 tz` is before `to`. The
 * first day is the wall-clock date of `from` (its `00:00` may be earlier
 * than `from` itself; per-day slot filtering against `from` happens
 * upstream in the generator, not here).
 *
 * @returns Array of `YYYY-MM-DD` strings, ascending. **Empty** if `from >= to`.
 *
 * @example
 *   iterateDays(
 *     new Date("2026-07-15T08:00:00.000Z"),
 *     new Date("2026-07-17T08:00:00.000Z"),
 *     "Europe/Prague",
 *   )
 *   // → ["2026-07-15", "2026-07-16", "2026-07-17"]
 *   //   (third day included: 2026-07-17T00:00 Prague = 2026-07-16T22:00Z < to)
 */
export function iterateDays(from: Date, to: Date, tz: string): string[] {
  const result: string[] = [];
  if (from >= to) return result;
  let { ymd } = instantToWallParts(from, tz);
  while (true) {
    const dayStart = wallToInstant(ymd, "00:00", tz);
    if (dayStart >= to) break;
    result.push(ymd);
    // Tuple assertion: `ymd` is produced by `instantToWallParts` (well-formed
    // "YYYY-MM-DD") or by the previous loop iteration (same shape), so the
    // split is guaranteed to yield 3 finite numbers — see also `wallToInstant`.
    const [Y, M, D] = ymd.split("-").map(Number) as [number, number, number];
    const next = new Date(Date.UTC(Y, M - 1, D + 1));
    ymd =
      `${next.getUTCFullYear()}-` +
      `${String(next.getUTCMonth() + 1).padStart(2, "0")}-` +
      `${String(next.getUTCDate()).padStart(2, "0")}`;
  }
  return result;
}

// ============================================================
// Private utilities — OCCUPYING_STATUSES + HH:MM ordering
// ============================================================

/**
 * Booking statuses that OCCUPY a slot for conflict purposes. Mirrors
 * `createBooking.ts` ř. 49 (functions/) — duplicated here intentionally
 * because availability.ts lives in `@hsb/shared` and the canonical
 * definition is currently in functions. Future cleanup: lift to a single
 * source in shared and have createBooking re-import. Out-of-scope for
 * D-018 bodies; flagged as drift risk if statuses ever diverge.
 */
const OCCUPYING_STATUSES = new Set<BookingStatus>(["pending", "confirmed"]);

/**
 * Lexicographic max/min for zero-padded `"HH:MM"` strings. Because both
 * fields are fixed-width and zero-padded, string ordering matches
 * chronological ordering (`"08:30" < "10:00"`). Used by `checkSlot` to
 * intersect a stylist's weeklyHours with a salon-level override window
 * (D-018 D2) without converting to instants first — the intersection is
 * a wall-clock concept, not an instant concept.
 */
function maxHHMM(a: string, b: string): string { return a > b ? a : b; }
function minHHMM(a: string, b: string): string { return a < b ? a : b; }

// ============================================================
// Day-window computation (internal) — D-018 D2 intersection
// ============================================================

/**
 * Result of `computeStylistDayWindow` — discriminated union on `kind`:
 *
 * - `salon_closed`        — `override.open === false` for the date (salon-wide).
 * - `closed_for_stylist`  — stylist doesn't work this weekday OR the override
 *                           `hours` don't intersect `stylist.weeklyHours`.
 * - `open`                — stylist's effective window in UTC instants; slot
 *                           must fit `[start, end)` (half-open: last valid
 *                           slot ends EXACTLY at `end`).
 *
 * Caller maps `salon_closed` and `closed_for_stylist` to different
 * `SlotRejectionReason`s (`checkSlot`) or both to "skip day"
 * (`generateSlotsForStylist`). Internal — not exported; tests verify
 * behavior through `checkSlot` / generator outcomes.
 */
type DayWindow =
  | { kind: "open"; start: Date; end: Date }
  | { kind: "salon_closed" }
  | { kind: "closed_for_stylist" };

/**
 * Compute the effective working window of a stylist on a given calendar
 * day, factoring in salon-level business-hours overrides
 * (D-018 D2 intersection).
 *
 * **Single source of truth** for "is this stylist working on this day,
 * and within what wall-clock window?" — called by both `checkSlot`
 * (checks #4 + #5) and `generateSlotsForStylist` (day-level skip + grid
 * window). Extracts the intersection logic that was previously duplicated
 * across both call sites.
 *
 * **`override.open=true` WITHOUT `hours` = "no narrowing"** (D-018 D2
 * sub-case): the open flag alone never expands the stylist's day, but
 * absence of `hours` doesn't shrink it either — falls back to pure
 * `weeklyHours[weekday]`.
 *
 * @param stylist  Stylist with `weeklyHours` per weekday.
 * @param ymd      Calendar date in `"YYYY-MM-DD"` (caller derives from
 *                 slot start or day iterator).
 * @param override Salon-level overrides; sparse, looked up by exact date.
 */
function computeStylistDayWindow(
  stylist: Stylist,
  ymd: string,
  override?: BusinessHoursOverride[],
): DayWindow {
  const dayOverride = override?.find((o) => o.date === ymd);
  if (dayOverride?.open === false) return { kind: "salon_closed" };

  // Weekday from the date itself (TZ-independent calendar property).
  const [Y, M, D] = ymd.split("-").map(Number) as [number, number, number];
  const weekday = UTC_DAY_TO_WEEKDAY[
    new Date(Date.UTC(Y, M - 1, D)).getUTCDay()
  ] as keyof WeeklyHours;

  const stylistHours = stylist.weeklyHours[weekday];
  if (stylistHours === null) return { kind: "closed_for_stylist" };

  const effectiveStart = dayOverride?.hours
    ? maxHHMM(stylistHours.start, dayOverride.hours.start)
    : stylistHours.start;
  const effectiveEnd = dayOverride?.hours
    ? minHHMM(stylistHours.end, dayOverride.hours.end)
    : stylistHours.end;
  if (effectiveStart >= effectiveEnd) return { kind: "closed_for_stylist" };

  return {
    kind: "open",
    start: wallToInstant(ymd, effectiveStart, SALON_TZ),
    end: wallToInstant(ymd, effectiveEnd, SALON_TZ),
  };
}

// ============================================================
// Availability API (D-018)
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
 * @param input  Per-stylist data; caller responsibilities documented on
 *               `StylistAvailabilityInput` (D-018 Caller contract).
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
  const { stylist, absences, bookings } = input;
  const { services, serviceLengths, now, override } = query;
  const minLeadTimeMinutes =
    query.minLeadTimeMinutes ?? DEFAULT_MIN_LEAD_TIME_MINUTES;

  // 1. not_qualified — stylist must perform every requested service.
  const stylistSkills = new Set(stylist.serviceIds);
  for (const s of services) {
    if (!stylistSkills.has(s.id)) {
      return { valid: false, reason: "not_qualified" };
    }
  }

  // 2. in_past
  if (start.getTime() < now.getTime()) {
    return { valid: false, reason: "in_past" };
  }

  // 3. too_soon
  if (start.getTime() < now.getTime() + minLeadTimeMinutes * 60_000) {
    return { valid: false, reason: "too_soon" };
  }

  // Slot end is needed by checks 5 / 6 / 7. Computed once.
  const duration = computeTotalDuration(services, serviceLengths);
  const end = new Date(start.getTime() + duration * 60_000);

  // Wall-clock date of the slot for override + weeklyHours lookup
  // (weekday is derived inside the helper from ymd).
  const { ymd } = instantToWallParts(start, SALON_TZ);

  // 4 + 5: salon_closed + outside_working_hours via shared day-window helper.
  // The helper is the single source of intersection truth (D-018 D2 + sub-case
  // "open without hours = no narrowing"). Closure rejects map to two
  // different SlotRejectionReasons; bounds rejection is the slot fit check.
  const dayWindow = computeStylistDayWindow(stylist, ymd, override);
  if (dayWindow.kind === "salon_closed") {
    return { valid: false, reason: "salon_closed" };
  }
  if (dayWindow.kind === "closed_for_stylist") {
    return { valid: false, reason: "outside_working_hours" };
  }
  // dayWindow.kind === "open"; TS narrows to that branch.
  // Half-open: slot ending EXACTLY at dayWindow.end is the last valid slot.
  if (
    start.getTime() < dayWindow.start.getTime() ||
    end.getTime() > dayWindow.end.getTime()
  ) {
    return { valid: false, reason: "outside_working_hours" };
  }

  // 6. absence — any Absence interval overlapping the slot.
  for (const a of absences) {
    if (overlaps(start, end, a.startAt, a.endAt)) {
      return { valid: false, reason: "absence" };
    }
  }

  // 7. booking_conflict — any OCCUPYING existing booking overlapping the slot.
  // Defensive: caller pre-filters status (D-018 Caller contract), but we
  // re-check internally — a stray cancelled/completed/no_show slipping
  // through caller-side filtering shouldn't trigger a false conflict.
  for (const b of bookings) {
    if (!OCCUPYING_STATUSES.has(b.status)) continue;
    if (overlaps(start, end, b.startAt, b.endAt)) {
      return { valid: false, reason: "booking_conflict" };
    }
  }

  return { valid: true };
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
  const { stylist } = input;
  const { services, serviceLengths, from, to } = query;
  const granularityMin = query.granularityMin ?? DEFAULT_GRANULARITY_MIN;

  // Soft-fail guards consistent with @returns docs (empty if from >= to;
  // services [] is documented as undefined behavior — soft-fail [] keeps
  // the generator pure-non-throwing, strict validation lives at the API
  // boundary in `createBooking.schema.ts`).
  if (services.length === 0) return [];
  if (from >= to) return [];

  // Quick reject: if the stylist isn't qualified for ALL services, no slot
  // will ever pass `checkSlot`'s check #1 (`not_qualified`). Pre-computing
  // once here saves O(days × slots) `checkSlot` invocations — meaningful in
  // anyone-mode fan-out where the caller passes every stylist and we'd
  // otherwise iterate them all uselessly. Drobná duplikace s checkSlot,
  // worth it for the savings (D-018 D3 anyone-mode rationale).
  const stylistSkills = new Set(stylist.serviceIds);
  for (const s of services) {
    if (!stylistSkills.has(s.id)) return [];
  }

  const duration = computeTotalDuration(services, serviceLengths);
  const durationMs = duration * 60_000;
  const granularityMs = granularityMin * 60_000;
  const fromMs = from.getTime();
  const toMs = to.getTime();

  const result: Slot[] = [];

  for (const ymd of iterateDays(from, to, SALON_TZ)) {
    // --- Day-level pre-compute via shared helper (DRY with checkSlot) ---
    // Generator skips the day entirely on ANY closure (salon or stylist);
    // per-slot validation still runs through checkSlot below (single source
    // of slot-validity truth, D-018 architektura — pragmatic hybrid).
    const dayWindow = computeStylistDayWindow(stylist, ymd, query.override);
    if (dayWindow.kind !== "open") continue;
    const windowStartMs = dayWindow.start.getTime();
    const windowEndMs = dayWindow.end.getTime();

    // --- Grid iteration: start at window opening, step by granularity ---
    // Loop condition: candidate slot must fit in the working window
    // (candidate + duration <= windowEnd) AND start before query `to`.
    // Inside-loop guards trim the slot's intersection with the query
    // window [from, to) — necessary because iterateDays may include days
    // that partially fall outside [from, to).
    for (
      let candidateMs = windowStartMs;
      candidateMs + durationMs <= windowEndMs && candidateMs < toMs;
      candidateMs += granularityMs
    ) {
      if (candidateMs < fromMs) continue;          // slot start before from
      if (candidateMs + durationMs > toMs) break;  // slot end past to; later candidates same

      const start = new Date(candidateMs);
      const check = checkSlot(start, input, query);
      if (check.valid) {
        result.push({
          stylistId: stylist.id,
          start,
          end: new Date(candidateMs + durationMs),
        });
      }
    }
  }

  return result;
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
  // Explicit empty case per @returns docs (also a no-op below; readability
  // rather than correctness guard).
  if (inputs.length === 0) return [];

  // Fan-out per stylist + flatten.
  const all: Slot[] = [];
  for (const input of inputs) {
    const slots = generateSlotsForStylist(input, query);
    for (const slot of slots) all.push(slot);
  }

  // Sort: chronological primary, stylistId secondary (D-018 D3 + signatures-
  // phase calibration). Stable secondary key enables both `groupBy(start)`
  // ("v 10:00 volní: Marie, Jana") and `groupBy(stylistId)` (per-stylist
  // columns) UI views without re-sorting client-side. JS `Array.sort` is
  // stable since ES2019 (modern Node 22 + browsers).
  all.sort((a, b) => {
    const dt = a.start.getTime() - b.start.getTime();
    return dt !== 0 ? dt : a.stylistId.localeCompare(b.stylistId);
  });

  return all;
}

// TODO(day-5): unit tests — overlap edge cases (back-to-back, identical,
// contained) AND the D-018 D6 TZ regression anchor (4 dates × 2 patterns
// + 3 day-lengths from the _tz_probe; pre-staged in D-018 D6).
