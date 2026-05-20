/**
 * Cloud Functions Gen2 — entry point.
 *
 * Day 1: skeleton with region preset only.
 * Day 2 will add:
 *   - createBooking — Firestore transaction that re-checks slot
 *     availability before commit (race-condition safe).
 *   - manageBookingByToken — magic-link self-cancel, validates
 *     cancelToken with constant-time comparison.
 *
 * Region rationale: europe-west3 (Frankfurt) — lowest latency
 * for CZ clients and salon staff.
 */

import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "europe-west3",
  maxInstances: 10,
});
