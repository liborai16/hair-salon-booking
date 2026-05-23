/**
 * @hsb/shared/customer-hash — stable identifier for `CustomerProfile` lookups.
 *
 * Single pure utility for converting a customer's phone number into the
 * deterministic 32-hex SHA-256 digest that serves as the `CustomerProfile`
 * Firestore document ID (see `types.ts CustomerProfile.phoneHash`).
 *
 * **Cross-platform via Web Crypto API** (Node 19+ exposes `globalThis.crypto`;
 * modern browsers always had it). Async because `crypto.subtle.digest` is
 * Promise-based by spec — both call sites are already in async context
 * (`createBooking` onCall handler, `seed.mjs`), so the cascade is trivial.
 *
 * **Honors D-013 SDK-agnostic stance:** no `node:crypto` import (would
 * lock out future browser/UI consumers like optimistic customer-recognition
 * before server round-trip). The minimal ambient declarations below keep
 * `@hsb/shared/tsconfig.json` `lib: ["es2022"]` unchanged — adding the
 * `dom` lib would pollute the whole workspace with browser-only types
 * (`Window`, `Document`, `localStorage`) that could mask accidental
 * platform-coupling in other shared modules.
 *
 * **Used by:**
 *  - `functions/createBooking.ts` — to look up / create the profile when a
 *    booking is written.
 *  - `scripts/seed.mjs` — to assign profile IDs aligned with seeded bookings.
 *  - Future client-side (UI customer lookup, optimistic dedup) — same hash
 *    means UI can speculatively find a profile without server round-trip.
 *
 * Lifted from `createBooking.ts` (was duplicated inline) so all three
 * consumers share one definition — see D5 in `CLAUDE.md §5` for the
 * cross-module duplication debt this resolves.
 *
 * Pure: deterministic (same input → same output), no I/O, no side effects.
 */

// Minimal ambient declarations for Web Crypto API + TextEncoder. Both are
// platform-standard (Node 19+, all modern browsers) but TypeScript's
// `es2022` lib doesn't include them; declared here narrowly to avoid
// pulling the full `dom` lib into @hsb/shared. See JSDoc above.
declare const crypto: {
  readonly subtle: {
    digest(algorithm: "SHA-256", data: ArrayBufferView): Promise<ArrayBuffer>;
  };
};
declare class TextEncoder {
  encode(input: string): Uint8Array;
}

/**
 * Compute the `CustomerProfile.phoneHash` for a phone number in E.164 format.
 *
 * **Soft link, not a secret.** The hash is the *public* doc ID of the
 * (STAFF-ONLY-readable) profile collection — not a password or capability.
 * Two reasons it exists at all:
 *  1. Doc IDs appear in audit logs / security rule trace; raw phone in the
 *     ID would leak PII into operational telemetry.
 *  2. Truncation to 32 hex (128 bits) keeps doc IDs short while preserving
 *     collision resistance for any realistic salon clientele.
 *
 * **Deterministic:** same phone → same hash, so both `createBooking` (server,
 * on each new booking) and `seed.mjs` (locally, once) reach the same profile doc.
 *
 * @param phoneE164  Phone number in E.164 format, e.g. `"+420600100200"`.
 *                   Caller is responsible for normalization (no spaces, no
 *                   formatting, leading `+`). No validation here — bad input
 *                   just yields a different hash (and therefore a different
 *                   doc), not a thrown error.
 * @returns Promise of 32 hex characters (lowercase) — the first half of
 *          SHA-256. Async per Web Crypto API spec.
 *
 * @example
 *   const hash = await hashCustomerPhone("+420600100200");
 *   // → "a1b2c3..."  (32 hex chars, deterministic)
 */
export async function hashCustomerPhone(phoneE164: string): Promise<string> {
  const data = new TextEncoder().encode(phoneE164);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
