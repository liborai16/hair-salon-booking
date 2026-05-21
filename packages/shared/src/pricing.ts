/**
 * @hsb/shared/pricing — pure pricing & duration domain logic.
 *
 * Single source of truth for "how much does this booking cost and how
 * long does it take", shared by:
 *
 *   - functions/  (createBooking) — AUTHORITATIVE. The price written to
 *     bookings/{id}.totalPrice and the endAt instant are computed here,
 *     server-side, inside the transaction. The client cannot dictate them.
 *
 *   - web/        (booking flow, Day 3) — ESTIMATE ONLY. The same functions
 *     drive the price preview shown while the customer picks services, so
 *     the estimate matches the final price. But the web result is never
 *     trusted on write; the server recomputes (see D-014).
 *
 * Pure: no Firestore, no I/O, no Date.now(). Fully unit-testable in
 * isolation (Day 5 adds the test suite — scope item 17).
 */

import type { Service, Stylist, ServiceLengthMap } from "./types.js";

/**
 * Hair-length selector for length-variant services ('barveni').
 * Mirrors the keys of `LengthVariants` and the values of `ServiceLengthMap`.
 */
export type HairLength = "short" | "medium" | "long";

// ============================================================
// Tunable policy constants (the salon's pricing rules)
// ============================================================

/**
 * Price multiplier by stylist level. Applied to the base amount unless a
 * per-stylist `priceOverride` exists for the service.
 *
 *   junior   -20%   (still learning, lower rate)
 *   standard   0%   (reference price = Service.basePrice)
 *   senior   +30%   (experience premium)
 *
 * Documented in types.ts on Service.basePrice / Stylist.level.
 */
export const LEVEL_MULTIPLIER: Record<Stylist["level"], number> = {
  junior: 0.8,
  standard: 1.0,
  senior: 1.3,
};

/**
 * Duration scaling for length-variant services relative to the short-hair
 * baseline stored in `Service.durationMinutes`.
 *
 *   short  ×1.0   (the stored baseline)
 *   medium ×1.5
 *   long   ×2.0
 *
 * The scaled medium/long results round UP to 15-minute granularity (see
 * `roundToQuarterHour`); the short baseline is returned EXACTLY so a
 * deliberately non-15 duration (e.g. a 25-min express colour) is preserved.
 * This factor table is an explicit simplifying assumption — see README
 * assumptions and D-014; a real salon would likely store medium/long
 * durations per service.
 */
export const LENGTH_DURATION_FACTOR: Record<HairLength, number> = {
  short: 1.0,
  medium: 1.5,
  long: 2.0,
};

/**
 * Slot granularity in minutes. Used by the slot algorithm (Day 3
 * availability.ts) to enforce booking start times on :00 / :15 / :30 / :45
 * boundaries, and by the duration scaler to snap *scaled* medium/long
 * durations after multiplying by LENGTH_DURATION_FACTOR. Raw authored
 * durations (short hair, non-'barveni' services) are NOT rounded.
 */
export const SLOT_GRANULARITY_MIN = 15;

// ============================================================
// Duration
// ============================================================

/** Round minutes UP to the next 15-minute boundary. */
function roundToQuarterHour(minutes: number): number {
  return Math.ceil(minutes / SLOT_GRANULARITY_MIN) * SLOT_GRANULARITY_MIN;
}

/**
 * Duration of a single service in minutes, accounting for hair length.
 *
 * Length scaling applies ONLY to 'barveni' services that define
 * `lengthVariants`; every other service uses `durationMinutes` as-is.
 * When a length is required but not supplied, falls back to 'short'.
 */
export function computeServiceDuration(
  service: Service,
  length?: HairLength,
): number {
  const usesLength =
    service.category === "barveni" && service.lengthVariants !== undefined;
  if (!usesLength) return service.durationMinutes;

  const factor = LENGTH_DURATION_FACTOR[length ?? "short"];

  // Preserve the authored short-hair duration EXACTLY (factor 1.0): a
  // deliberately-set 25-min express colour must stay 25, not inflate to 30.
  // Only the *scaled* medium/long values — arbitrary products like 37.5 —
  // round up to the 15-min grid. The 15-min booking grid itself is enforced
  // by the slot algorithm (Day 3 availability.ts), not by duration here:
  // durations may legitimately be off-grid (non-'barveni' services already
  // return raw durationMinutes), so the slot algorithm must not assume
  // 15-minute multiples.
  if (factor === 1.0) return service.durationMinutes;
  return roundToQuarterHour(service.durationMinutes * factor);
}

/**
 * Total duration of a multi-service booking in minutes.
 *
 * @param services  Service docs in the booking (order irrelevant for sum).
 * @param lengths   Optional per-service length map (keyed by service id).
 */
export function computeTotalDuration(
  services: Service[],
  lengths?: ServiceLengthMap,
): number {
  return services.reduce(
    (sum, s) => sum + computeServiceDuration(s, lengths?.[s.id]),
    0,
  );
}

// ============================================================
// Price
// ============================================================

/**
 * Price of a single service in CZK for a given stylist & hair length.
 *
 * Precedence (highest first):
 *   1. Stylist `priceOverride` for this service — a flat, fixed price.
 *      The level multiplier does NOT apply on top of an override.
 *   2. For 'barveni' with `lengthVariants`: the length-variant base,
 *      then the stylist level multiplier.
 *   3. Otherwise: `basePrice`, then the level multiplier.
 *
 * Result is rounded to whole CZK (Math.round).
 */
export function computeServicePrice(
  service: Service,
  stylist: Stylist,
  length?: HairLength,
): number {
  const override = stylist.priceOverrides?.[service.id];
  if (override !== undefined) return Math.round(override);

  const usesLength =
    service.category === "barveni" && service.lengthVariants !== undefined;
  const base = usesLength
    ? service.lengthVariants![length ?? "short"]
    : service.basePrice;

  return Math.round(base * LEVEL_MULTIPLIER[stylist.level]);
}

/**
 * Total price of a multi-service booking in CZK.
 *
 * Sums per-service prices (each individually rounded), so the total equals
 * the sum of the line items a customer would see — no rounding surprises.
 *
 * @param services  Service docs in the booking.
 * @param stylist   The performing stylist (drives multiplier / overrides).
 * @param lengths   Optional per-service length map (keyed by service id).
 */
export function computeTotalPrice(
  services: Service[],
  stylist: Stylist,
  lengths?: ServiceLengthMap,
): number {
  return services.reduce(
    (sum, s) => sum + computeServicePrice(s, stylist, lengths?.[s.id]),
    0,
  );
}

// TODO(day-5): unit tests for pure functions — see scope item 17 / D-014
