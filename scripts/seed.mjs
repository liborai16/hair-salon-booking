#!/usr/bin/env node
/**
 * scripts/seed.mjs — emulator-only seed for realistic salon data.
 *
 * Populates Firestore + Firebase Auth emulators per A.1 proposal:
 *   - 10 services (varied categories + length variants + off-grid duration)
 *   - 5 stylists (capability + schedule diversity per PDF zadání)
 *   - 6 admin accounts (3 roles + custom claims; uid = User.id, B2)
 *   - 1 salonSettings doc with 2 business-hours overrides
 *   - ~25 bookings + bookingCustomers (PII split per D-013)
 *   - customerProfiles derived from booking history (B3 — my way)
 *   - ~6 absences (skoleni / dovolena / nemoc, future + past)
 *   - 2 mock notifications for completed bookings
 *
 * Idempotent: deterministic IDs + `.set()` overwrites cleanly. Re-run = same state.
 *
 * See README §setup for run instructions. NEVER targets production —
 * emulator env vars are defensively asserted (B1).
 */

// ============================================================
// B1 — Emulator env vars: defensive default + production guard
// ============================================================
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
}
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
}
if (
  process.env.NODE_ENV === "production" ||
  !process.env.FIRESTORE_EMULATOR_HOST.includes("localhost")
) {
  console.error(
    "❌ seed.mjs is emulator-only. Refusing to run against non-localhost target.",
  );
  process.exit(1);
}

import admin from "firebase-admin";
import { randomBytes } from "node:crypto";
import {
  computeTotalDuration,
  computeTotalPrice,
  hashCustomerPhone,
  toFirestore,
} from "@hsb/shared";

admin.initializeApp({ projectId: "hair-salon-booking-cs-69a08" });
const db = admin.firestore();
const auth = admin.auth();

const MS_PER_MINUTE = 60_000;
const SEED_PASSWORD = "Heslo123!"; // README documents demo-only; emulator-isolated
const SEED_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

// ============================================================
// Data: services (10 — varied categories + length variants)
// ============================================================
const services = [
  { id: "svc-damske-strihani", name: "Dámské stříhání", category: "strihani", durationMinutes: 45, basePrice: 600, active: true },
  { id: "svc-panske-strihani", name: "Pánské stříhání", category: "strihani", durationMinutes: 30, basePrice: 400, active: true },
  { id: "svc-detsky-strih", name: "Dětský střih", category: "detsky", durationMinutes: 30, basePrice: 300, active: true },
  { id: "svc-foukana", name: "Foukaná", category: "foukana", durationMinutes: 30, basePrice: 350, active: true },
  {
    id: "svc-barveni-zakladni", name: "Barvení základní", category: "barveni",
    durationMinutes: 90, basePrice: 1200,
    lengthVariants: { short: 1200, medium: 1500, long: 1800 },
    active: true,
  },
  {
    id: "svc-melir-balayage", name: "Melíry / Balayage", category: "barveni",
    durationMinutes: 150, basePrice: 2500,
    lengthVariants: { short: 2500, medium: 3000, long: 3600 },
    active: true,
  },
  // 25 min off-grid duration — demonstrates D-014 "duration not required to be
  // multiple of SLOT_GRANULARITY_MIN" (slot grid for STARTS, not durations).
  { id: "svc-express-barva", name: "Express barva", category: "barveni", durationMinutes: 25, basePrice: 700, active: true },
  { id: "svc-regenerace", name: "Regenerační ošetření", category: "osetreni", durationMinutes: 45, basePrice: 800, active: true },
  { id: "svc-svatebni-styling", name: "Svatební styling", category: "svatebni", durationMinutes: 150, basePrice: 3000, active: true },
];

// ============================================================
// Data: stylists (5 — capability + schedule diversity per PDF zadání)
// ============================================================
const ALL_SERVICE_IDS = services.map((s) => s.id);
const ALL_EXCEPT_DETSKY = ALL_SERVICE_IDS.filter((id) => id !== "svc-detsky-strih");
const JUNIOR_SKILLS = ALL_SERVICE_IDS.filter(
  (id) => id !== "svc-melir-balayage" && id !== "svc-svatebni-styling",
);
const WORKDAY = (start, end) => ({ start, end });

const stylists = [
  {
    // Owner who also cuts. Senior tier. Full skills. Standard hours.
    id: "stl-eva-novakova", name: "Eva Nováková", level: "senior",
    serviceIds: ALL_SERVICE_IDS,
    weeklyHours: {
      monday: WORKDAY("09:00", "17:00"), tuesday: WORKDAY("09:00", "17:00"),
      wednesday: WORKDAY("09:00", "17:00"), thursday: WORKDAY("09:00", "17:00"),
      friday: WORKDAY("09:00", "17:00"), saturday: null, sunday: null,
    },
    active: true,
  },
  {
    // "Mistrová" 15y praxe per PDF; senior tier; omits detsky (per PDF zadání).
    // priceOverride on melir-balayage demonstrates D-014 override precedence.
    id: "stl-marie-krasna", name: "Marie Krásná", level: "senior",
    serviceIds: ALL_EXCEPT_DETSKY,
    weeklyHours: {
      monday: null, tuesday: WORKDAY("09:00", "18:00"),
      wednesday: WORKDAY("09:00", "18:00"), thursday: WORKDAY("09:00", "18:00"),
      friday: WORKDAY("09:00", "18:00"), saturday: WORKDAY("09:00", "18:00"), sunday: null,
    },
    priceOverrides: { "svc-melir-balayage": 2800 },
    active: true,
  },
  {
    // Mid-level, morning shift.
    id: "stl-lenka-svobodova", name: "Lenka Svobodová", level: "standard",
    serviceIds: ALL_SERVICE_IDS,
    weeklyHours: {
      monday: WORKDAY("08:00", "16:00"), tuesday: WORKDAY("08:00", "16:00"),
      wednesday: WORKDAY("08:00", "16:00"), thursday: WORKDAY("08:00", "16:00"),
      friday: WORKDAY("08:00", "16:00"), saturday: null, sunday: null,
    },
    active: true,
  },
  {
    // Mid-level, afternoon/evening shift; Saturday yes, Monday off.
    id: "stl-petra-dvorakova", name: "Petra Dvořáková", level: "standard",
    serviceIds: ALL_SERVICE_IDS,
    weeklyHours: {
      monday: null, tuesday: WORKDAY("12:00", "20:00"),
      wednesday: WORKDAY("12:00", "20:00"), thursday: WORKDAY("12:00", "20:00"),
      friday: WORKDAY("12:00", "20:00"), saturday: WORKDAY("12:00", "20:00"), sunday: null,
    },
    active: true,
  },
  {
    // Junior; afternoon-only learning shift; omits complex barveni + svatebni
    // (per PDF "junior ještě nedělá složitější barvení"). Demonstrates D-018
    // `not_qualified` rejection path for melir/svatba bookings.
    id: "stl-tereza-mala", name: "Tereza Malá", level: "junior",
    serviceIds: JUNIOR_SKILLS,
    weeklyHours: {
      monday: WORKDAY("13:00", "19:00"), tuesday: WORKDAY("13:00", "19:00"),
      wednesday: WORKDAY("13:00", "19:00"), thursday: WORKDAY("13:00", "19:00"),
      friday: WORKDAY("13:00", "19:00"), saturday: null, sunday: null,
    },
    active: true,
  },
];

// ============================================================
// Data: users + auth (B2 — User.id = Auth UID; 6 accounts)
// ============================================================
const users = [
  { uid: "usr-eva", email: "eva@salon.cz", role: "owner", linkedStylistId: "stl-eva-novakova" },
  { uid: "usr-marie", email: "marie@salon.cz", role: "stylist", linkedStylistId: "stl-marie-krasna" },
  { uid: "usr-lenka", email: "lenka@salon.cz", role: "stylist", linkedStylistId: "stl-lenka-svobodova" },
  { uid: "usr-petra", email: "petra@salon.cz", role: "stylist", linkedStylistId: "stl-petra-dvorakova" },
  { uid: "usr-tereza", email: "tereza@salon.cz", role: "stylist", linkedStylistId: "stl-tereza-mala" },
  { uid: "usr-hana", email: "hana@salon.cz", role: "receptionist", linkedStylistId: null },
];

// ============================================================
// Data: salonSettings (singleton "main")
// ============================================================
const salonSettings = {
  salonName: "Salon Krásná",
  iban: "CZ6508000000192000145399",
  recipientName: "Salon Krásná s.r.o.",
  address: { street: "Náměstí Republiky 12", city: "Praha 1", postalCode: "110 00", country: "CZ" },
  phone: "+420221111111",
  email: "info@salonkrasna.cz",
  // Hardcoded calendar dates (Q5 accept). 2026 demo window; eval-later disclaimer in README.
  businessHoursOverride: [
    { date: "2026-10-28", open: false, reason: "Státní svátek (Den vzniku ČSR)" },
    { date: "2026-11-21", open: true, hours: { start: "10:00", end: "14:00" }, reason: "Speciální sobotní otevření" },
  ],
};

// ============================================================
// Data: bookings (~25 — 5 per stylist averaged; mix of confirmed/completed/no_show/cancelled)
// Relative date offsets from today; re-seed = dates refresh, deterministic IDs.
// Each `customer` may repeat → derived CustomerProfile.bookingHistory aggregates.
// ============================================================
const PHONE_FLAGGED = "+420600100300"; // no-show flagged demo customer
const PHONE_REGULAR = "+420600100200"; // regular customer with history

const bookingDefs = [
  // --- Marie (mistrová, senior) — 5 ---
  { stylist: "stl-marie-krasna", services: ["svc-melir-balayage"], lengths: { "svc-melir-balayage": "medium" }, offset: [1, 10, 0], status: "confirmed", customer: { name: "Hana Procházková", phone: PHONE_REGULAR, email: "hana.prochazkova@example.cz" } },
  { stylist: "stl-marie-krasna", services: ["svc-barveni-zakladni", "svc-damske-strihani", "svc-foukana"], lengths: { "svc-barveni-zakladni": "long" }, offset: [2, 14, 0], status: "confirmed", customer: { name: "Pavla Veselá", phone: "+420600100201", email: "pavla.vesela@example.cz" } },
  { stylist: "stl-marie-krasna", services: ["svc-damske-strihani", "svc-foukana"], lengths: null, offset: [5, 9, 0], status: "confirmed", customer: { name: "Hana Procházková", phone: PHONE_REGULAR, email: "hana.prochazkova@example.cz" } },
  { stylist: "stl-marie-krasna", services: ["svc-svatebni-styling"], lengths: null, offset: [8, 9, 0], status: "confirmed", customer: { name: "Klára Bartoňová", phone: "+420600100202", email: "klara.bartonova@example.cz" } },
  { stylist: "stl-marie-krasna", services: ["svc-damske-strihani"], lengths: null, offset: [-30, 14, 0], status: "completed", paymentMethod: "card", customer: { name: "Hana Procházková", phone: PHONE_REGULAR, email: "hana.prochazkova@example.cz" } },

  // --- Lenka (mid, ranní) — 5 ---
  { stylist: "stl-lenka-svobodova", services: ["svc-panske-strihani"], lengths: null, offset: [1, 9, 0], status: "confirmed", customer: { name: "Tomáš Krejčí", phone: "+420600100301", email: "tomas.krejci@example.cz" } },
  { stylist: "stl-lenka-svobodova", services: ["svc-damske-strihani"], lengths: null, offset: [2, 10, 30], status: "confirmed", customer: { name: "Iveta Černá", phone: "+420600100302", email: "iveta.cerna@example.cz" } },
  { stylist: "stl-lenka-svobodova", services: ["svc-detsky-strih"], lengths: null, offset: [3, 11, 0], status: "confirmed", customer: { name: "Jana Tichá (Lukášek)", phone: "+420600100303", email: "jana.ticha@example.cz" } },
  { stylist: "stl-lenka-svobodova", services: ["svc-barveni-zakladni"], lengths: { "svc-barveni-zakladni": "short" }, offset: [4, 8, 0], status: "confirmed", customer: { name: "Eva Novotná", phone: "+420600100304", email: "eva.novotna@example.cz" } },
  { stylist: "stl-lenka-svobodova", services: ["svc-regenerace"], lengths: null, offset: [6, 13, 0], status: "confirmed", customer: { name: "Tomáš Krejčí", phone: "+420600100301", email: "tomas.krejci@example.cz" } },

  // --- Petra (mid, odpolední) — 5 (includes 1 cancelled per D-018 defensive filter demo) ---
  { stylist: "stl-petra-dvorakova", services: ["svc-damske-strihani", "svc-foukana"], lengths: null, offset: [1, 17, 0], status: "confirmed", customer: { name: "Lucie Sýkorová", phone: "+420600100401", email: "lucie.sykorova@example.cz" } },
  { stylist: "stl-petra-dvorakova", services: ["svc-express-barva"], lengths: null, offset: [2, 13, 0], status: "confirmed", customer: { name: "Markéta Beranová", phone: "+420600100402", email: "marketa.beranova@example.cz" } },
  { stylist: "stl-petra-dvorakova", services: ["svc-foukana"], lengths: null, offset: [3, 18, 30], status: "confirmed", customer: { name: "Veronika Horáková", phone: "+420600100403", email: "veronika.horakova@example.cz" } },
  { stylist: "stl-petra-dvorakova", services: ["svc-barveni-zakladni", "svc-foukana"], lengths: { "svc-barveni-zakladni": "medium" }, offset: [7, 14, 0], status: "confirmed", customer: { name: "Lenka Vondráčková", phone: "+420600100404", email: "lenka.vondrackova@example.cz" } },
  { stylist: "stl-petra-dvorakova", services: ["svc-damske-strihani"], lengths: null, offset: [4, 16, 0], status: "cancelled", customer: { name: "Adéla Růžičková", phone: "+420600100405", email: "adela.ruzickova@example.cz" } },

  // --- Tereza (junior) — 4 + 1 past no-show (feeds flagged customer profile) ---
  { stylist: "stl-tereza-mala", services: ["svc-panske-strihani"], lengths: null, offset: [1, 14, 0], status: "confirmed", customer: { name: "Marek Dvořák", phone: "+420600100501", email: "marek.dvorak@example.cz" } },
  { stylist: "stl-tereza-mala", services: ["svc-detsky-strih"], lengths: null, offset: [3, 15, 0], status: "confirmed", customer: { name: "Petra Šimková (Tomášek)", phone: "+420600100502", email: "petra.simkova@example.cz" } },
  { stylist: "stl-tereza-mala", services: ["svc-foukana"], lengths: null, offset: [4, 16, 30], status: "confirmed", customer: { name: "Aneta Pospíšilová", phone: "+420600100503", email: "aneta.pospisilova@example.cz" } },
  { stylist: "stl-tereza-mala", services: ["svc-damske-strihani"], lengths: null, offset: [6, 14, 0], status: "confirmed", customer: { name: "Karolína Marešová", phone: "+420600100504", email: "karolina.maresova@example.cz" } },
  { stylist: "stl-tereza-mala", services: ["svc-panske-strihani"], lengths: null, offset: [-30, 14, 0], status: "no_show", customer: { name: "Robert Procházka", phone: PHONE_FLAGGED, email: "robert.prochazka@example.cz" } },

  // --- Eva (owner) — 4 + 1 past completed ---
  { stylist: "stl-eva-novakova", services: ["svc-damske-strihani", "svc-foukana"], lengths: null, offset: [1, 11, 0], status: "confirmed", customer: { name: "Jiřina Hodková", phone: "+420600100601", email: "jirina.hodkova@example.cz" } },
  { stylist: "stl-eva-novakova", services: ["svc-melir-balayage"], lengths: { "svc-melir-balayage": "long" }, offset: [3, 9, 0], status: "confirmed", customer: { name: "Magdaléna Slavíková", phone: "+420600100602", email: "magdalena.slavikova@example.cz" } },
  { stylist: "stl-eva-novakova", services: ["svc-regenerace", "svc-foukana"], lengths: null, offset: [5, 14, 0], status: "confirmed", customer: { name: "Eva Štěpánková", phone: "+420600100603", email: "eva.stepankova@example.cz" } },
  { stylist: "stl-eva-novakova", services: ["svc-damske-strihani"], lengths: null, offset: [7, 10, 0], status: "confirmed", customer: { name: "Hana Procházková", phone: PHONE_REGULAR, email: "hana.prochazkova@example.cz" } },
  { stylist: "stl-eva-novakova", services: ["svc-damske-strihani", "svc-foukana"], lengths: null, offset: [-7, 11, 0], status: "completed", paymentMethod: "card", customer: { name: "Magdaléna Slavíková", phone: "+420600100602", email: "magdalena.slavikova@example.cz" } },
];

// ============================================================
// Data: absences (~6 — skoleni / dovolena / nemoc, future + past)
// ============================================================
const absenceDefs = [
  { stylist: "stl-tereza-mala", offset: [7, 10, 0], durationHours: 5, reason: "skoleni", notes: "Školení barveni technik" },
  { stylist: "stl-marie-krasna", offset: [10, 0, 0], durationHours: 72, reason: "dovolena", notes: "Třídenní dovolená Po-St" },
  { stylist: "stl-lenka-svobodova", offset: [5, 14, 0], durationHours: 2, reason: "nemoc", notes: "Plánovaná návštěva lékaře" },
  { stylist: "stl-petra-dvorakova", offset: [8, 12, 0], durationHours: 8, reason: "skoleni", notes: "Sobotní školení" },
  { stylist: "stl-eva-novakova", offset: [-14, 9, 0], durationHours: 24, reason: "nemoc", notes: "Minulá chřipka" },
  { stylist: "stl-marie-krasna", offset: [21, 9, 0], durationHours: 24, reason: "dovolena", notes: "Den dovolené" },
];

// ============================================================
// Helpers
// ============================================================

function bookingDate(daysFromNow, hh, mm) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function findService(id) {
  const s = services.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown service ${id}`);
  return s;
}

function findStylist(id) {
  const s = stylists.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown stylist ${id}`);
  return s;
}

// ============================================================
// Seeders (sequential per debuggability + logical dependency order:
// services → stylists → users+auth → settings → bookings+customers
// → derived profiles → absences → notifications)
// ============================================================

async function seedServices() {
  for (const svc of services) {
    await db.collection("services").doc(svc.id).set(
      toFirestore({ ...svc, createdAt: SEED_CREATED_AT, updatedAt: SEED_CREATED_AT }),
    );
  }
  console.log(`✓ Seeded ${services.length} services`);
}

async function seedStylists() {
  for (const st of stylists) {
    await db.collection("stylists").doc(st.id).set(
      toFirestore({ ...st, createdAt: SEED_CREATED_AT, updatedAt: SEED_CREATED_AT }),
    );
  }
  console.log(`✓ Seeded ${stylists.length} stylists`);
}

async function seedUsersAndAuth() {
  for (const u of users) {
    // Idempotency: drop existing auth user if present before recreating with same UID.
    try {
      await auth.deleteUser(u.uid);
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
    }
    await auth.createUser({
      uid: u.uid, email: u.email, password: SEED_PASSWORD, emailVerified: true,
    });
    await auth.setCustomUserClaims(u.uid, {
      role: u.role,
      ...(u.linkedStylistId ? { linkedStylistId: u.linkedStylistId } : {}),
    });

    // Firestore User doc — uid is the key field (no `id` per types.ts), so direct
    // .set() without toFirestore (toFirestore strips `id`, doesn't fit here).
    // Admin SDK auto-converts Date → Timestamp.
    await db.collection("users").doc(u.uid).set({
      uid: u.uid,
      email: u.email,
      role: u.role,
      ...(u.linkedStylistId ? { linkedStylistId: u.linkedStylistId } : {}),
      active: true,
      createdAt: SEED_CREATED_AT,
    });
  }
  console.log(`✓ Seeded ${users.length} users + auth accounts (custom claims provisioned)`);
}

async function seedSalonSettings() {
  // SalonSettings is singleton — no `id` field, direct .set().
  await db.collection("salonSettings").doc("main").set(salonSettings);
  console.log(`✓ Seeded salonSettings/main`);
}

async function seedBookingsAndCustomers() {
  let seq = 0;
  const accumulated = []; // accumulate for derived CustomerProfile aggregation
  for (const def of bookingDefs) {
    seq++;
    const id = `bkg-${String(seq).padStart(3, "0")}`;
    const stylist = findStylist(def.stylist);
    const svcs = def.services.map(findService);
    const lengths = def.lengths ?? undefined;
    const totalPrice = computeTotalPrice(svcs, stylist, lengths);
    const duration = computeTotalDuration(svcs, lengths);
    const startAt = bookingDate(def.offset[0], def.offset[1], def.offset[2]);
    const endAt = new Date(startAt.getTime() + duration * MS_PER_MINUTE);

    const booking = {
      id, stylistId: stylist.id, serviceIds: svcs.map((s) => s.id),
      ...(lengths ? { serviceLengths: lengths } : {}),
      startAt, endAt, status: def.status, totalPrice, source: "public",
      ...(def.paymentMethod ? { paymentMethod: def.paymentMethod } : {}),
      createdAt: new Date(startAt.getTime() - 7 * 24 * 3600 * 1000),
      // I3 corrected: paymentMethod set on completion + updatedAt = endAt for
      // completed/no_show (when status transitioned); confirmed bookings just
      // have createdAt-like updatedAt. No `attendedAt` field in Booking type.
      updatedAt: def.status === "completed" || def.status === "no_show" ? endAt : startAt,
    };
    await db.collection("bookings").doc(id).set(toFirestore(booking));

    // BookingCustomer — bookingId is doc key (no `id` field per types.ts),
    // direct .set() without toFirestore.
    const customer = {
      bookingId: id,
      name: def.customer.name,
      phone: def.customer.phone,
      email: def.customer.email,
      cancelToken: randomBytes(32).toString("base64url"),
    };
    await db.collection("bookingCustomers").doc(id).set(customer);

    accumulated.push({ booking, customer });
  }
  console.log(`✓ Seeded ${accumulated.length} bookings + bookingCustomers (PII split per D-013)`);
  return accumulated;
}

// B3 (my way per accepted rebellion): customerProfiles DERIVED from bookings.
// Profile aggregates booking history per phone (soft link via SHA-256 hash).
async function seedCustomerProfilesFromBookings(bookingsAndCustomers) {
  const byPhone = new Map();
  for (const { booking, customer } of bookingsAndCustomers) {
    const entries = byPhone.get(customer.phone) ?? [];
    entries.push({
      bookingId: booking.id,
      startAt: booking.startAt,
      status: booking.status,
      stylistId: booking.stylistId,
      totalPrice: booking.totalPrice,
    });
    byPhone.set(customer.phone, entries);
  }

  let count = 0;
  for (const [phone, history] of byPhone) {
    // hashCustomerPhone is async (Web Crypto API per shared customer-hash).
    const phoneHash = await hashCustomerPhone(phone);
    // Newest-first per types.ts CustomerProfile.bookingHistory contract.
    history.sort((a, b) => b.startAt.getTime() - a.startAt.getTime());

    const noShowEntries = history.filter((h) => h.status === "no_show");
    const completedEntries = history.filter((h) => h.status === "completed");
    const isFlagged = phone === PHONE_FLAGGED;

    // I4: decay math note — these are DEMO values. Real decay formula per
    // types.ts L341-349 (`newCount = oldCount * exp(-daysSinceLastNoShow/180) + 1`)
    // is deferred per D-018 future work / Day 4-5 admin features. The flagged
    // customer's `noShowCount: 3.2` is hand-tuned to exceed the `>2.0`
    // isFlaggedNoShow threshold (types.ts L362) for UI demo realism.
    const profile = {
      phoneHash,
      bookingHistory: history.slice(0, 20),
      noShowCount: isFlagged ? 3.2 : noShowEntries.length * 1.0,
      lastNoShowAt: noShowEntries.length > 0 ? noShowEntries[0].startAt : null,
      lastVisitAt: completedEntries.length > 0 ? completedEntries[0].startAt : null,
      isFlaggedNoShow: isFlagged,
    };
    // CustomerProfile has phoneHash as key + no `id` field — direct .set().
    await db.collection("customerProfiles").doc(phoneHash).set(profile);
    count++;
  }
  console.log(`✓ Seeded ${count} customerProfiles (derived from booking history; 1 flagged for demo)`);
}

async function seedAbsences() {
  let seq = 0;
  for (const def of absenceDefs) {
    seq++;
    const id = `abs-${String(seq).padStart(3, "0")}`;
    const startAt = bookingDate(def.offset[0], def.offset[1], def.offset[2]);
    const endAt = new Date(startAt.getTime() + def.durationHours * 3600 * 1000);
    await db.collection("absences").doc(id).set(
      toFirestore({
        id, stylistId: def.stylist, startAt, endAt, reason: def.reason,
        ...(def.notes ? { notes: def.notes } : {}),
        createdAt: new Date(startAt.getTime() - 7 * 24 * 3600 * 1000),
      }),
    );
  }
  console.log(`✓ Seeded ${absenceDefs.length} absences`);
}

async function seedNotifications(bookingsAndCustomers) {
  const completed = bookingsAndCustomers
    .filter((bc) => bc.booking.status === "completed")
    .slice(0, 2);
  let seq = 0;
  for (const { booking, customer } of completed) {
    seq++;
    const id = `notif-${String(seq).padStart(3, "0")}`;
    await db.collection("notifications").doc(id).set(
      toFirestore({
        id, bookingId: booking.id,
        type: "booking_confirmation", channel: "console_log",
        payload: {
          recipientName: customer.name,
          recipientEmail: customer.email,
          recipientPhone: customer.phone,
          magicLink: `/r/${customer.cancelToken}`,
          startAt: booking.startAt.toISOString(),
          totalPrice: booking.totalPrice,
        },
        sentAt: booking.createdAt,
        status: "sent",
      }),
    );
  }
  console.log(`✓ Seeded ${seq} notifications (mock console_log channel)`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(
    `🌱 Seeding emulator (firestore: ${process.env.FIRESTORE_EMULATOR_HOST}, ` +
      `auth: ${process.env.FIREBASE_AUTH_EMULATOR_HOST})\n`,
  );

  await seedServices();
  await seedStylists();
  await seedUsersAndAuth();
  await seedSalonSettings();
  const bookingsAndCustomers = await seedBookingsAndCustomers();
  await seedCustomerProfilesFromBookings(bookingsAndCustomers);
  await seedAbsences();
  await seedNotifications(bookingsAndCustomers);

  console.log(`\n📋 Admin credentials (all password: ${SEED_PASSWORD}):`);
  for (const u of users) {
    const link = u.linkedStylistId ? ` (linked: ${u.linkedStylistId})` : "";
    console.log(`   ${u.email.padEnd(20)} → ${u.role}${link}`);
  }

  console.log(`\n✅ Seed complete.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
