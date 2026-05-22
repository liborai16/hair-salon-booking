/**
 * Input contract for the `createBooking` callable — zod schema.
 *
 * Kept separate from the handler so the validation shape is unit-testable in
 * isolation (Day 5, scope item 17) without spinning up Firestore.
 *
 * The schema validates STRUCTURE only. Cross-field and domain rules
 * (serviceLengths keys ⊆ serviceIds, stylist can perform the services,
 * startAt not in the past, slot is free) live in the handler, where the
 * authoritative Firestore data is available.
 */

import { z } from "zod";

/**
 * E.164 phone format: leading '+', first digit 1–9, 2–15 digits total.
 * Example: +420123456789. The handler hashes this (E.164) into the
 * customerProfiles document ID, so a normalized format matters.
 */
const E164_PHONE = /^\+[1-9]\d{1,14}$/;

/**
 * Pragmatic email check: non-empty local part, '@', domain with a dot.
 * Deliberately permissive — full RFC 5322 validation is not worth the
 * false-negatives; real deliverability is verified by the (mock) notification
 * layer, not by regex.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Hair-length selector — mirrors HairLength / LengthVariants in @hsb/shared. */
export const hairLength = z.enum(["short", "medium", "long"]);

/**
 * `createBooking` payload.
 *
 * strictObject: unknown keys are REJECTED. This is a deliberate enforcement of
 * D-014 (the server is the pricing authority) — a client must not be able to
 * smuggle `totalPrice`, `endAt`, `status` or `source` into the request, not
 * even as a "hint". Those are all derived server-side; any extra field fails
 * validation outright.
 */
export const createBookingInput = z.strictObject({
  stylistId: z.string().min(1, "stylistId je povinné"),

  serviceIds: z
    .array(z.string().min(1))
    .min(1, "vyber alespoň jednu službu")
    // max(10): an abuse/DoS guard on payload size, NOT a business rule. The
    // real ceiling is total duration vs the stylist's working hours, enforced
    // by the Day 3 availability algorithm — see TODO(day-3) in the handler.
    .max(10, "příliš mnoho služeb v jedné rezervaci"),

  /**
   * Booking start as an ISO-8601 instant. Accepts a trailing 'Z' or a numeric
   * offset (e.g. +02:00). Stays a string here (schema = shape); the handler
   * converts it to a JS Date and applies domain rules (e.g. not in the past).
   */
  startAt: z.iso.datetime({ offset: true }),

  /**
   * Optional per-service hair length, keyed by serviceId. Only meaningful for
   * 'barveni' services with lengthVariants; entries for other services are
   * ignored by the pricing/duration functions. Keys are checked to be a subset
   * of serviceIds in the handler (cross-field — a domain concern).
   */
  serviceLengths: z.record(z.string(), hairLength).optional(),

  customer: z.strictObject({
    name: z.string().trim().min(1, "jméno je povinné").max(120),
    phone: z
      .string()
      .regex(E164_PHONE, "telefon musí být v mezinárodním formátu, např. +420123456789"),
    email: z.string().regex(EMAIL, "neplatný e-mail"),
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingInput>;
