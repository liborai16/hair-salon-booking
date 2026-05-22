/**
 * Input contract for the `manageBookingByToken` callable — zod schema.
 *
 * The magic-link route is /r/:token (scope item 12); the web page calls this
 * callable with the token and the desired action.
 *
 *   'view'   — read-only: returns a PII-minimal summary so the customer can
 *              confirm WHICH booking they are about to cancel. Guards against
 *              an accidental tap on the link in a mobile email client.
 *   'cancel' — transitions the booking to 'cancelled'.
 *
 * Validation is structural only; the token is resolved to a booking by an
 * indexed equality lookup in the handler (D-017 — query-by-token).
 */

import { z } from "zod";

export const manageBookingByTokenInput = z.strictObject({
  // 32+ chars matches the cancelToken floor documented in types.ts; the
  // current generator emits 43 (randomBytes(32) as base64url).
  token: z.string().min(32, "neplatný token"),
  action: z.enum(["view", "cancel"]),
});

export type ManageBookingByTokenInput = z.infer<
  typeof manageBookingByTokenInput
>;
