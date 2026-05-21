/**
 * @hsb/shared — public surface.
 *
 * Barrel re-exports for `web/` and `functions/` consumers. Both
 * workspaces import their domain shapes via `@hsb/shared` to keep
 * the type definitions DRY and prevent drift between client and
 * server views of Firestore documents.
 */

export * from "./types.js";              // Firestore document shapes (D-012)
export * from "./firestore-helpers.js";  // Timestamp <-> Date converters (D-013)
export * from "./pricing.js";            // pure pricing & duration logic (D-014)
export * from "./availability.js";       // pure time-slot logic (D-016)
