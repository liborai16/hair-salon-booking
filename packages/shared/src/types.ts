/**
 * @hsb/shared/types — Firestore document type definitions.
 *
 * 9 entities representing all collections in the data model:
 *
 *   Public-read (no PII):    Service, Stylist, Absence, Booking,
 *                            SalonSettings (partial — IBAN public for QR)
 *   Staff-only (PII):        BookingCustomer, CustomerProfile,
 *                            User, Notification
 *
 * Timestamp convention (see D-013):
 *   All time-typed fields use JS `Date` in shared types. Conversion
 *   to/from Firestore Timestamp happens at the SDK boundary via
 *   `firestore-helpers.ts`. Domain code never touches Firestore Timestamp.
 *
 * Slug convention:
 *   Enum-like union types (categories, statuses, roles) use ASCII slugs
 *   without diacritics. Human-readable names with diacritics live in a
 *   separate `name` field.
 */

// ============================================================
// Shared utility types
// ============================================================

/**
 * Wall-clock time range in salon timezone (Europe/Prague).
 * Format: HH:MM in 24-hour notation. Example: { start: '08:00', end: '18:30' }
 *
 * Why string and not Date: TimeRange describes a recurring schedule
 * ("every Monday 8–18"), not a specific point in time. A Date would
 * require a sentinel date and would be misleading.
 */
export interface TimeRange {
  start: string;
  end: string;
}

// ============================================================
// Service — services/{id}
// PUBLIC READ, OWNER WRITE
// ============================================================

/** Service category, ASCII slug. Display names with diacritics in Service.name. */
export type ServiceCategory =
  | 'strihani'
  | 'barveni'
  | 'foukana'
  | 'osetreni'
  | 'detsky'
  | 'svatebni';

/** Length-based pricing variants for hair color services. Prices in CZK. */
export interface LengthVariants {
  short: number;
  medium: number;
  long: number;
}

export interface Service {
  /** Firestore document ID */
  id: string;

  /** Display name with Czech diacritics, e.g. "Dámské stříhání" */
  name: string;

  /** ASCII slug for grouping and URL routing */
  category: ServiceCategory;

  /**
   * Default duration in minutes.
   * For 'barveni' with length variants, this is short-hair duration;
   * medium/long are assumed proportional and rounded to 15-min granularity.
   */
  durationMinutes: number;

  /**
   * Base price in CZK.
   * Multiplied by stylist level (junior -20%, standard 0%, senior +30%),
   * unless overridden per-stylist via Stylist.priceOverrides.
   */
  basePrice: number;

  /**
   * Length-based pricing — ONLY present when category === 'barveni'.
   * Other categories ignore this field. When absent for 'barveni',
   * basePrice applies regardless of selected length.
   */
  lengthVariants?: LengthVariants;

  /**
   * Soft-delete flag. Inactive services hidden from public booking
   * but preserved for historical Booking integrity.
   */
  active: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Stylist — stylists/{id}
// PUBLIC READ, OWNER WRITE
// ============================================================

/** Skill level — drives default price multiplier:
 *  junior -20%, standard 0%, senior +30%. */
export type StylistLevel = 'junior' | 'standard' | 'senior';

/**
 * Per-day working hours; `null` means doesn't work that day.
 * Hours interpreted in salon timezone (Europe/Prague).
 */
export interface WeeklyHours {
  monday: TimeRange | null;
  tuesday: TimeRange | null;
  wednesday: TimeRange | null;
  thursday: TimeRange | null;
  friday: TimeRange | null;
  saturday: TimeRange | null;
  sunday: TimeRange | null;
}

/**
 * Per-service price overrides for a stylist.
 *
 * Key is `serviceId`, value is fixed price in CZK.
 * When present for a (stylist, service) pair, takes precedence over
 * the level multiplier.
 *
 * Example: master stylist sets fixed 1500 CZK for 'barveni' because
 * loyal clientele pays premium regardless of formula.
 */
export type PriceOverrides = Record<string, number>;

export interface Stylist {
  id: string;

  /** Display name with diacritics, e.g. "Marie Nováková" */
  name: string;

  level: StylistLevel;

  /** Short bio shown on public stylist profile (optional) */
  bio?: string;

  /** URL of stylist photo — Firebase Storage or external CDN */
  photoUrl?: string;

  /**
   * Service IDs this stylist can perform.
   * Example: junior may not have 'barveni' here; master may not have 'detsky'.
   * Booking flow filters available stylists by this array.
   */
  serviceIds: string[];

  weeklyHours: WeeklyHours;

  /** Optional overrides; precedence over level multiplier */
  priceOverrides?: PriceOverrides;

  active: boolean;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Absence — absences/{id}
// STAFF READ, OWNER WRITE
// ============================================================

export type AbsenceReason = 'dovolena' | 'nemoc' | 'skoleni' | 'jine';

export interface Absence {
  id: string;
  stylistId: string;

  /** Inclusive start instant of absence */
  startAt: Date;

  /** Exclusive end instant of absence */
  endAt: Date;

  reason: AbsenceReason;

  /** Optional free-form note shown in admin UI */
  notes?: string;

  createdAt: Date;
}

// ============================================================
// Booking — bookings/{id}
// PUBLIC READ (no PII), CLOUD FUNCTION WRITE only
// ============================================================

/**
 * Booking lifecycle states.
 *
 * Most bookings created via public flow go directly to 'confirmed'
 * (no staff approval gate). 'pending' is reserved for future deferred
 * confirmation scenarios. Terminal states: 'completed', 'no_show', 'cancelled'.
 */
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'cancelled';

/** Source of booking creation */
export type BookingSource = 'public' | 'admin';

/** Payment method recorded on transition to 'completed' */
export type PaymentMethod = 'cash' | 'card' | 'transfer';

/**
 * Per-service length selection for this booking.
 * Only present when at least one service in the booking has category 'barveni'.
 * Keys are serviceIds from the booking; values are selected length variant.
 */
export type ServiceLengthMap = Record<string, 'short' | 'medium' | 'long'>;

/**
 * Booking — PUBLIC READABLE, no PII.
 *
 * PII (customer name, phone, email, cancelToken) lives in sibling
 * collection `bookingCustomers/{bookingId}` which is STAFF-ONLY.
 * Split enforces zero PII leak through any public Firestore query —
 * critical because anyone can read `bookings/` to see slot availability.
 */
export interface Booking {
  id: string;
  stylistId: string;
  serviceIds: string[];

  serviceLengths?: ServiceLengthMap;

  startAt: Date;

  /**
   * endAt = startAt + sum(service durations applicable to selected lengths).
   * Stored to avoid recomputation on every slot-availability query.
   */
  endAt: Date;

  status: BookingStatus;

  /**
   * Computed and frozen at booking time. CZK.
   * Even if service prices change later, this value does NOT auto-update —
   * preserves historical revenue integrity for reports.
   */
  totalPrice: number;

  source: BookingSource;

  /** Set on transition to 'completed', undefined otherwise */
  paymentMethod?: PaymentMethod;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// BookingCustomer — bookingCustomers/{bookingId}
// STAFF-ONLY (PII)
// CLOUD FUNCTION WRITE only
// ============================================================

/**
 * BookingCustomer — STAFF-ONLY, contains PII.
 *
 * Document ID is the same as the corresponding Booking.id (1:1 relation).
 * Split from Booking to enforce PII isolation via Firestore rules.
 */
export interface BookingCustomer {
  /** Mirrors Booking.id; serves as document key */
  bookingId: string;

  /** Client's full name as entered in booking form */
  name: string;

  /** Phone in E.164 format, e.g. "+420123456789" */
  phone: string;

  /** Email address */
  email: string;

  /**
   * Magic-link cancel token.
   *
   * - URL-safe base64, 32+ chars (>=192 bits entropy).
   * - Generated by `createBooking` Cloud Function via `crypto.randomBytes`.
   * - Validated by `manageBookingByToken` Cloud Function using
   *   `crypto.timingSafeEqual` to prevent timing attacks.
   * - Stored plaintext: the collection is STAFF-ONLY readable, so the
   *   token itself acts as a capability — no extra hashing needed.
   *   Threat model: external clients guessing tokens; entropy (192 bits)
   *   makes brute force infeasible.
   */
  cancelToken: string;
}

// ============================================================
// CustomerProfile — customerProfiles/{phoneHash}
// STAFF-ONLY (aggregated PII)
// ============================================================

/**
 * One entry in CustomerProfile.bookingHistory.
 * Denormalized to bound document size and avoid joins.
 */
export interface BookingHistoryEntry {
  bookingId: string;
  startAt: Date;
  status: BookingStatus;
  stylistId: string;
  totalPrice: number;
}

/**
 * CustomerProfile — STAFF-ONLY, aggregated history per client phone.
 *
 * Document ID is `phoneHash`: SHA-256 of the client's phone in E.164
 * format, truncated to 32 hex chars. This makes admin lookups by phone
 * possible (hash the lookup phone, fetch profile) without exposing PII
 * in the document key — Firestore document IDs are visible in security
 * rule logs and audit trails.
 */
export interface CustomerProfile {
  /** SHA-256(phone E.164) truncated to 32 hex chars; same as doc ID */
  phoneHash: string;

  /** Last 20 bookings, newest first. Older entries dropped to bound size. */
  bookingHistory: BookingHistoryEntry[];

  /**
   * Decay-aware no-show count.
   *
   * Updated when a booking transitions to 'no_show':
   *   newCount = oldCount * exp(-daysSinceLastNoShow / 180) + 1
   *
   * The decay (~125-day half-life) means a single no-show 6 months ago
   * weights ~0.4 of a fresh no-show. Avoids permanent blacklisting and
   * gives clients chance to recover trust.
   *
   * Effective count for flag decision is recomputed on read:
   *   effective = noShowCount * exp(-daysSince(lastNoShowAt) / 180)
   */
  noShowCount: number;

  /** Last no-show timestamp; null if never had one. Drives decay calculation. */
  lastNoShowAt: Date | null;

  /** Timestamp of the most recent completed visit (for "frequent customer" detection) */
  lastVisitAt: Date | null;

  /**
   * Cached flag: `effective > 2.0`.
   * Updated whenever noShowCount changes (in Cloud Function).
   * UI consumes this directly without re-running decay math.
   */
  isFlaggedNoShow: boolean;

  /** Optional free-form admin notes about this client */
  notes?: string;
}

// ============================================================
// User — users/{uid}
// SELF READ, OWNER READ/WRITE
// ============================================================

export type UserRole = 'owner' | 'receptionist' | 'stylist';

/**
 * User — admin/staff user.
 * Document ID matches Firebase Auth UID.
 */
export interface User {
  uid: string;
  email: string;
  role: UserRole;

  /**
   * Required when role === 'stylist'. Links Auth user to a Stylist record
   * so the stylist sees only their own bookings and KPIs.
   * Enforced by Firestore rule `stylistOwnsBooking()`.
   */
  linkedStylistId?: string;

  /** Soft-delete flag. Inactive users keep history but can't log in. */
  active: boolean;

  createdAt: Date;
}

// ============================================================
// SalonSettings — salonSettings/main (singleton)
// PUBLIC READ (for IBAN/QR), OWNER WRITE
// ============================================================

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: 'CZ';
}

/**
 * One-off override for a specific date — holidays, closures, special hours.
 * Slot algorithm consults overrides BEFORE falling back to per-stylist weeklyHours.
 */
export interface BusinessHoursOverride {
  /** Date in YYYY-MM-DD format (salon timezone) */
  date: string;
  /** False = closed for the entire day; true = open with `hours` */
  open: boolean;
  hours?: TimeRange;
  /** Optional reason shown to admins, e.g. "Vánoce" */
  reason?: string;
}

/**
 * SalonSettings — singleton with document ID 'main'.
 * PUBLIC READ for IBAN (needed by client to generate SPAYD QR),
 * OWNER WRITE only.
 */
export interface SalonSettings {
  salonName: string;

  /** IBAN for SPAYD QR generation. Owner edits via /admin/nastaveni. */
  iban: string;

  /** Account holder name as it should appear on bank statement */
  recipientName: string;

  address: Address;

  /** Salon contact phone (E.164) */
  phone: string;

  /** Salon contact email */
  email: string;

  /** Optional date-specific overrides. Sparse array, only populated dates. */
  businessHoursOverride?: BusinessHoursOverride[];
}

// ============================================================
// Notification — notifications/{id}
// STAFF-ONLY read, CLOUD FUNCTION write
// ============================================================

export type NotificationType =
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancellation'
  | 'magic_link_cancel';

/**
 * Where the notification was (or would have been) sent.
 * In MVP, only `console_log` is wired; `email` and `sms` are stubs
 * that log to Firestore without external dispatch.
 */
export type NotificationChannel = 'email' | 'sms' | 'console_log';

export type NotificationStatus = 'sent' | 'failed' | 'queued';

/**
 * Notification — log of outgoing communications.
 * STAFF-ONLY read, Cloud Function-only write.
 *
 * In MVP this is a mock log replacing real email/SMS dispatch.
 * In production, an email/SMS worker (Resend / Twilio) would consume this.
 */
export interface Notification {
  id: string;
  bookingId: string;
  type: NotificationType;
  channel: NotificationChannel;

  /** Template variables and metadata (recipient, magicLink, subject, body) */
  payload: Record<string, unknown>;

  sentAt: Date;
  status: NotificationStatus;

  /** Populated only when status === 'failed' */
  error?: string;
}
