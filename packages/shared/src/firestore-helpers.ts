/**
 * @hsb/shared/firestore-helpers — boundary conversion between
 * Firestore SDK types and domain shapes (see D-013).
 *
 * Read direction (Firestore -> domain):
 *   `fromFirestore<T>(snapshot)` extracts id and recursively
 *   converts all Firestore Timestamp leaves to JS Date.
 *
 * Write direction (domain -> Firestore):
 *   `toFirestore<T>(obj)` strips `id` (it lives in document key,
 *   not field). Firestore SDK auto-converts Date -> Timestamp.
 *
 * No dependency on firebase-admin or firebase SDK — duck-typing
 * detects Timestamp instances structurally, so this file works
 * unchanged in both web/ (client SDK) and functions/ (admin SDK).
 */

/**
 * Structural type matching both admin-SDK and client-SDK Timestamp.
 * Internal — never exported in public types (use Date in shared types).
 */
interface AnyFirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

/**
 * Type guard for Firestore Timestamp instances.
 *
 * Duck-types: an object with numeric `seconds`, numeric `nanoseconds`,
 * and a `toDate()` method. Matches both admin and client SDK Timestamps
 * without importing either SDK.
 */
export function isFirestoreTimestamp(v: unknown): v is AnyFirestoreTimestamp {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o["seconds"] === "number" &&
    typeof o["nanoseconds"] === "number" &&
    typeof o["toDate"] === "function"
  );
}

/**
 * Convert a single Firestore Timestamp to a JS Date.
 * Caller should narrow input via `isFirestoreTimestamp` first.
 */
export function tsToDate(ts: AnyFirestoreTimestamp): Date {
  return ts.toDate();
}

/**
 * Recursively walk a value, converting Firestore Timestamps to Dates.
 *
 * - Primitive (string, number, boolean, null, undefined): pass through.
 * - Date instance: pass through (defensive; shouldn't happen from Firestore).
 * - Firestore Timestamp (duck-typed): convert via `tsToDate`.
 * - Array: recurse each element.
 * - Plain object: recurse each value (keys preserved).
 *
 * Preserves shape exactly, only converts leaves matching the timestamp guard.
 */
export function convertTimestampsToDate<T = unknown>(value: unknown): T {
  if (value === null || value === undefined) return value as T;
  if (value instanceof Date) return value as T;
  if (isFirestoreTimestamp(value)) return tsToDate(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => convertTimestampsToDate(item)) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = convertTimestampsToDate(v);
    }
    return out as T;
  }
  return value as T;
}

/**
 * Generic Firestore snapshot -> typed domain object converter.
 *
 * Accepts any snapshot-like object with `.id: string` and `.data()` method.
 * Matches both admin SDK and client SDK `DocumentSnapshot` via structural
 * typing — no SDK import needed.
 *
 * Throws if `snapshot.data()` returns undefined (document doesn't exist).
 *
 * Usage:
 *   const booking = fromFirestore<Booking>(snap);
 *   // booking.id === snap.id
 *   // booking.startAt instanceof Date  (converted from Timestamp)
 */
export function fromFirestore<T extends { id: string }>(snapshot: {
  id: string;
  data(): Record<string, unknown> | undefined;
}): T {
  const raw = snapshot.data();
  if (raw === undefined) {
    throw new Error(
      `fromFirestore: snapshot ${snapshot.id} has no data (does the document exist?)`,
    );
  }
  const converted = convertTimestampsToDate<Record<string, unknown>>(raw);
  return { id: snapshot.id, ...converted } as T;
}

/**
 * Domain object -> Firestore-ready payload.
 *
 * - Strips `id` field (lives in document key, not document body).
 * - Does NOT convert Date -> Timestamp; Firestore SDK does that automatically
 *   when receiving a Date in write paths (set, update, add).
 *
 * Usage:
 *   await db.collection("bookings").doc(booking.id).set(toFirestore(booking));
 */
export function toFirestore<T extends { id: string }>(obj: T): Omit<T, "id"> {
  // Discard `id` — it's the Firestore document key, not a stored field.
  // Underscore prefix tells `noUnusedLocals` this is intentionally unused.
  const { id: _id, ...rest } = obj;
  return rest;
}
