/**
 * @hsb/shared — public surface.
 *
 * Barrel re-exports for `web/` and `functions/` consumers. Both
 * workspaces import their domain shapes via `@hsb/shared` to keep
 * the type definitions DRY and prevent drift between client and
 * server views of Firestore documents.
 */

export * from "./types.js";              // Firestore document shapes
export * from "./firestore-helpers.js";  // Timestamp <-> Date converters
