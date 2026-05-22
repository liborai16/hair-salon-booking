/**
 * Cloud Functions Gen2 — entry point.
 *
 * Global function options (region europe-west3, maxInstances) and Admin SDK
 * init live in ./lib/firebase — the bootstrap module every handler imports
 * before defining its trigger. See that file for the ESM ordering rationale
 * (why setGlobalOptions can't live here). This file only re-exports the
 * deployable functions.
 *
 * Day 2 BLOK B:
 *   - createBooking          — transactional, race-condition-safe booking.
 *   - manageBookingByToken   — magic-link self-cancel (next task).
 */

export { createBooking } from "./handlers/createBooking.js";
export { manageBookingByToken } from "./handlers/manageBookingByToken.js";
