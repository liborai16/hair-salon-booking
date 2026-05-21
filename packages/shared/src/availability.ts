/**
 * @hsb/shared/availability — time-slot domain logic.
 *
 * Day 2 (prep): just the pure interval-overlap primitive that
 * createBooking's transactional slot re-check needs. Day 3 grows this
 * file into the full slot-availability algorithm — generating bookable
 * slots from stylist `weeklyHours`, `absences`, business-hours overrides
 * and existing bookings — where `overlaps()` becomes the core conflict
 * test. Keeping all time/slot logic in one file gives it a single home
 * (same rationale as pricing.ts; see D-016).
 *
 * Pure: no Firestore, no I/O, no `Date.now()`. Operates on JS `Date`
 * instants (the domain time type — see D-013).
 */

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

// TODO(day-5): unit tests for overlap edge cases (back-to-back, identical, contained)
