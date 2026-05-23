/**
 * @hsb/shared/availability — unit test suite (D-018, Day 5 anchor).
 *
 * Pure-function suite (no Firestore, no emulator). Covers:
 *   1. overlaps()                — D-016 primitive (half-open semantics)
 *   2. Timezone helpers          — D-018 D6 regression anchor
 *                                  (4 dates × wallToInstant + 3 day-lengths)
 *   3. checkSlot                 — 7-reason coverage + happy path + first-fail priority
 *   4. generateSlotsForStylist   — soft-fail guards + grid iteration + edges
 *   5. generateAvailableSlots    — fan-out + sort (start, stylistId)
 *   6. Constants                 — sanity for tunable defaults
 *
 * Test fixtures (make* builders) construct minimal but valid domain objects
 * via spread-overrides — each test mutates only what it asserts on.
 *
 * Layered design: TZ helpers are tested first; later tests USE them in
 * setup (wallToInstant("2026-07-15", "10:00", SALON_TZ)) once the helper
 * suite has proven the conversion. Safe coupling — refactoring the helper
 * later still passes if behavior is preserved.
 */
import { describe, it, expect } from "vitest";
import {
  // Functions
  overlaps,
  wallToInstant,
  instantToWallParts,
  iterateDays,
  checkSlot,
  generateSlotsForStylist,
  generateAvailableSlots,
  // Constants
  SALON_TZ,
  DEFAULT_GRANULARITY_MIN,
  DEFAULT_MIN_LEAD_TIME_MINUTES,
} from "./index.js";
import type {
  Stylist,
  Service,
  Absence,
  Booking,
  StylistAvailabilityInput,
  SlotQuery,
} from "./index.js";

// ============================================================
// Fixture builders — minimal valid domain objects
// ============================================================

function makeStylist(overrides: Partial<Stylist> = {}): Stylist {
  return {
    id: "stylist-1",
    name: "Marie",
    level: "standard",
    serviceIds: ["svc-cut", "svc-color"],
    weeklyHours: {
      monday: { start: "08:00", end: "18:00" },
      tuesday: { start: "08:00", end: "18:00" },
      wednesday: { start: "08:00", end: "18:00" },
      thursday: { start: "08:00", end: "18:00" },
      friday: { start: "08:00", end: "18:00" },
      saturday: { start: "09:00", end: "14:00" },
      sunday: null,
    },
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: "svc-cut",
    name: "Stříhání",
    category: "strihani",
    durationMinutes: 30,
    basePrice: 500,
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeAbsence(overrides: Partial<Absence> = {}): Absence {
  return {
    id: "abs-1",
    stylistId: "stylist-1",
    startAt: new Date("2026-07-15T10:00:00.000Z"),
    endAt: new Date("2026-07-15T12:00:00.000Z"),
    reason: "nemoc",
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    ...overrides,
  };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "bkg-1",
    stylistId: "stylist-1",
    serviceIds: ["svc-cut"],
    startAt: new Date("2026-07-15T10:00:00.000Z"),
    endAt: new Date("2026-07-15T10:30:00.000Z"),
    status: "confirmed",
    totalPrice: 500,
    source: "public",
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    ...overrides,
  };
}

function makeInput(overrides: Partial<StylistAvailabilityInput> = {}): StylistAvailabilityInput {
  return {
    stylist: makeStylist(),
    absences: [],
    bookings: [],
    ...overrides,
  };
}

function makeQuery(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    services: [makeService()],
    // Window: 2026-07-15 (Wed) full salon working day = 08:00–18:00 Prague.
    from: wallToInstant("2026-07-15", "08:00", SALON_TZ),
    to: wallToInstant("2026-07-15", "18:00", SALON_TZ),
    // `now` in the past so in_past / too_soon don't accidentally block tests
    // that aren't specifically about those reasons. Tests for those reasons
    // override `now` and `minLeadTimeMinutes` explicitly.
    now: new Date("2025-01-01T00:00:00.000Z"),
    minLeadTimeMinutes: 0,
    ...overrides,
  };
}

// Common slot start used across checkSlot tests: 2026-07-15 (Wed) 10:00 Prague.
const FUTURE_START = new Date("2026-07-15T08:00:00.000Z");

// ============================================================
// 1. overlaps() — D-016 primitive
// ============================================================

describe("overlaps (D-016)", () => {
  // Compact instant builder for legibility (UTC clock, not Prague — the
  // primitive doesn't care about TZ, only relative ordering).
  const t = (h: number, m: number): Date =>
    new Date(Date.UTC(2026, 6, 15, h, m, 0));

  it("back-to-back intervals do NOT overlap (half-open)", () => {
    expect(overlaps(t(10, 0), t(10, 30), t(10, 30), t(11, 0))).toBe(false);
    expect(overlaps(t(10, 30), t(11, 0), t(10, 0), t(10, 30))).toBe(false);
  });

  it("identical intervals overlap", () => {
    expect(overlaps(t(10, 0), t(10, 30), t(10, 0), t(10, 30))).toBe(true);
  });

  it("contained (a inside b)", () => {
    expect(overlaps(t(10, 15), t(10, 20), t(10, 0), t(11, 0))).toBe(true);
  });

  it("contained (b inside a)", () => {
    expect(overlaps(t(10, 0), t(11, 0), t(10, 15), t(10, 20))).toBe(true);
  });

  it("partial overlap (a starts during b)", () => {
    expect(overlaps(t(10, 15), t(10, 45), t(10, 0), t(10, 30))).toBe(true);
  });

  it("completely disjoint", () => {
    expect(overlaps(t(10, 0), t(10, 30), t(11, 0), t(11, 30))).toBe(false);
  });
});

// ============================================================
// 2. Timezone helpers — D-018 D6 regression anchor
// ============================================================

describe("timezone helpers (D-018 D6 regression anchor)", () => {
  describe("wallToInstant — 4 dates × Europe/Prague (from _tz_probe)", () => {
    it("winter CET: 2026-01-15 10:00 → 09:00 UTC", () => {
      expect(wallToInstant("2026-01-15", "10:00", SALON_TZ).toISOString()).toBe(
        "2026-01-15T09:00:00.000Z",
      );
    });
    it("summer CEST: 2026-07-15 10:00 → 08:00 UTC", () => {
      expect(wallToInstant("2026-07-15", "10:00", SALON_TZ).toISOString()).toBe(
        "2026-07-15T08:00:00.000Z",
      );
    });
    it("spring-forward day: 2026-03-29 10:00 → 08:00 UTC (already in CEST)", () => {
      expect(wallToInstant("2026-03-29", "10:00", SALON_TZ).toISOString()).toBe(
        "2026-03-29T08:00:00.000Z",
      );
    });
    it("fall-back day: 2026-10-25 10:00 → 09:00 UTC (already in CET)", () => {
      expect(wallToInstant("2026-10-25", "10:00", SALON_TZ).toISOString()).toBe(
        "2026-10-25T09:00:00.000Z",
      );
    });
  });

  describe("instantToWallParts", () => {
    it("returns ymd, hhmm, weekday for given instant", () => {
      expect(
        instantToWallParts(new Date("2026-07-15T08:00:00.000Z"), SALON_TZ),
      ).toEqual({ ymd: "2026-07-15", hhmm: "10:00", weekday: "wednesday" });
    });

    it("round-trip wallToInstant ↔ instantToWallParts (non-DST hour)", () => {
      const parts = instantToWallParts(
        wallToInstant("2026-06-10", "14:30", SALON_TZ),
        SALON_TZ,
      );
      expect(parts.ymd).toBe("2026-06-10");
      expect(parts.hhmm).toBe("14:30");
      expect(parts.weekday).toBe("wednesday"); // 2026-06-10 is Wed
    });

    it("weekday matches WeeklyHours keys (Sunday=0..Saturday=6)", () => {
      const expectations: Array<{ ymd: string; weekday: string }> = [
        { ymd: "2026-07-12", weekday: "sunday" },
        { ymd: "2026-07-13", weekday: "monday" },
        { ymd: "2026-07-14", weekday: "tuesday" },
        { ymd: "2026-07-15", weekday: "wednesday" },
        { ymd: "2026-07-16", weekday: "thursday" },
        { ymd: "2026-07-17", weekday: "friday" },
        { ymd: "2026-07-18", weekday: "saturday" },
      ];
      for (const { ymd, weekday } of expectations) {
        const parts = instantToWallParts(
          wallToInstant(ymd, "12:00", SALON_TZ),
          SALON_TZ,
        );
        expect(parts.weekday).toBe(weekday);
      }
    });
  });

  describe("iterateDays — 3 day-lengths via wall-clock boundaries (DST)", () => {
    const HOUR_MS = 3_600_000;

    it("spring-forward day → 23h", () => {
      const start = wallToInstant("2026-03-29", "00:00", SALON_TZ);
      const end = wallToInstant("2026-03-30", "00:00", SALON_TZ);
      expect(end.getTime() - start.getTime()).toBe(23 * HOUR_MS);
    });
    it("fall-back day → 25h", () => {
      const start = wallToInstant("2026-10-25", "00:00", SALON_TZ);
      const end = wallToInstant("2026-10-26", "00:00", SALON_TZ);
      expect(end.getTime() - start.getTime()).toBe(25 * HOUR_MS);
    });
    it("normal day → 24h", () => {
      const start = wallToInstant("2026-07-15", "00:00", SALON_TZ);
      const end = wallToInstant("2026-07-16", "00:00", SALON_TZ);
      expect(end.getTime() - start.getTime()).toBe(24 * HOUR_MS);
    });

    it("enumerates calendar days in window", () => {
      const days = iterateDays(
        new Date("2026-07-15T08:00:00.000Z"),
        new Date("2026-07-17T08:00:00.000Z"),
        SALON_TZ,
      );
      // 2026-07-17 included because its wall-clock 00:00 Prague =
      // 2026-07-16T22:00Z < to (08:00Z 7/17).
      expect(days).toEqual(["2026-07-15", "2026-07-16", "2026-07-17"]);
    });

    it("from === to → []", () => {
      const t = new Date("2026-07-15T10:00:00.000Z");
      expect(iterateDays(t, t, SALON_TZ)).toEqual([]);
    });

    it("from > to → []", () => {
      expect(
        iterateDays(
          new Date("2026-07-16T00:00:00.000Z"),
          new Date("2026-07-15T00:00:00.000Z"),
          SALON_TZ,
        ),
      ).toEqual([]);
    });

    it("spans month boundary", () => {
      const days = iterateDays(
        wallToInstant("2026-07-30", "00:00", SALON_TZ),
        wallToInstant("2026-08-02", "00:00", SALON_TZ),
        SALON_TZ,
      );
      expect(days).toEqual(["2026-07-30", "2026-07-31", "2026-08-01"]);
    });

    it("spans year boundary", () => {
      const days = iterateDays(
        wallToInstant("2026-12-30", "00:00", SALON_TZ),
        wallToInstant("2027-01-02", "00:00", SALON_TZ),
        SALON_TZ,
      );
      expect(days).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
    });
  });
});

// ============================================================
// 3. checkSlot — 7-reason coverage
// ============================================================

describe("checkSlot — 7-reason coverage", () => {
  it("happy path → { valid: true }", () => {
    expect(checkSlot(FUTURE_START, makeInput(), makeQuery())).toEqual({
      valid: true,
    });
  });

  it("not_qualified: stylist lacks the service-ID", () => {
    const input = makeInput({
      stylist: makeStylist({ serviceIds: ["svc-other"] }),
    });
    expect(checkSlot(FUTURE_START, input, makeQuery())).toEqual({
      valid: false,
      reason: "not_qualified",
    });
  });

  it("in_past: start < now", () => {
    const query = makeQuery({
      now: new Date(FUTURE_START.getTime() + 1000),
    });
    expect(checkSlot(FUTURE_START, makeInput(), query)).toEqual({
      valid: false,
      reason: "in_past",
    });
  });

  it("too_soon: start within minLeadTimeMinutes window", () => {
    const query = makeQuery({
      now: new Date(FUTURE_START.getTime() - 60 * 60_000), // 1h before slot
      minLeadTimeMinutes: 120, // 2h required → too_soon
    });
    expect(checkSlot(FUTURE_START, makeInput(), query)).toEqual({
      valid: false,
      reason: "too_soon",
    });
  });

  it("salon_closed: override.open === false for slot's date", () => {
    const query = makeQuery({
      override: [{ date: "2026-07-15", open: false, reason: "Svátek" }],
    });
    expect(checkSlot(FUTURE_START, makeInput(), query)).toEqual({
      valid: false,
      reason: "salon_closed",
    });
  });

  describe("outside_working_hours — 4 sub-cases", () => {
    it("stylist.weeklyHours[weekday] === null (off-day)", () => {
      const input = makeInput({
        stylist: makeStylist({
          weeklyHours: {
            monday: null,
            tuesday: null,
            wednesday: null,
            thursday: null,
            friday: null,
            saturday: null,
            sunday: null,
          },
        }),
      });
      expect(checkSlot(FUTURE_START, input, makeQuery())).toEqual({
        valid: false,
        reason: "outside_working_hours",
      });
    });

    it("degenerate intersection (stylist 8-12, override 14-18)", () => {
      const stylist = makeStylist();
      stylist.weeklyHours.wednesday = { start: "08:00", end: "12:00" };
      const query = makeQuery({
        override: [
          {
            date: "2026-07-15",
            open: true,
            hours: { start: "14:00", end: "18:00" },
          },
        ],
      });
      expect(checkSlot(FUTURE_START, makeInput({ stylist }), query)).toEqual({
        valid: false,
        reason: "outside_working_hours",
      });
    });

    it("start BEFORE window opening (07:00 < 08:00)", () => {
      const earlyStart = wallToInstant("2026-07-15", "07:00", SALON_TZ);
      expect(checkSlot(earlyStart, makeInput(), makeQuery())).toEqual({
        valid: false,
        reason: "outside_working_hours",
      });
    });

    it("end AFTER window closing (17:45 + 30min = 18:15 > 18:00)", () => {
      const lateStart = wallToInstant("2026-07-15", "17:45", SALON_TZ);
      expect(checkSlot(lateStart, makeInput(), makeQuery())).toEqual({
        valid: false,
        reason: "outside_working_hours",
      });
    });

    it("slot ending EXACTLY at closing → valid (half-open boundary)", () => {
      const lastValidStart = wallToInstant("2026-07-15", "17:30", SALON_TZ);
      expect(checkSlot(lastValidStart, makeInput(), makeQuery())).toEqual({
        valid: true,
      });
    });
  });

  it("absence: overlapping Absence interval", () => {
    const input = makeInput({
      absences: [
        makeAbsence({
          startAt: wallToInstant("2026-07-15", "09:30", SALON_TZ),
          endAt: wallToInstant("2026-07-15", "10:30", SALON_TZ),
        }),
      ],
    });
    expect(checkSlot(FUTURE_START, input, makeQuery())).toEqual({
      valid: false,
      reason: "absence",
    });
  });

  describe("booking_conflict + defensive filter", () => {
    it("overlapping OCCUPYING booking (pending)", () => {
      const input = makeInput({
        bookings: [
          makeBooking({
            startAt: wallToInstant("2026-07-15", "09:45", SALON_TZ),
            endAt: wallToInstant("2026-07-15", "10:15", SALON_TZ),
            status: "pending",
          }),
        ],
      });
      expect(checkSlot(FUTURE_START, input, makeQuery())).toEqual({
        valid: false,
        reason: "booking_conflict",
      });
    });

    it("DEFENSIVE: cancelled booking does NOT block (caller pre-filter belt-and-suspenders)", () => {
      const input = makeInput({
        bookings: [
          makeBooking({
            startAt: wallToInstant("2026-07-15", "09:45", SALON_TZ),
            endAt: wallToInstant("2026-07-15", "10:15", SALON_TZ),
            status: "cancelled",
          }),
        ],
      });
      expect(checkSlot(FUTURE_START, input, makeQuery())).toEqual({
        valid: true,
      });
    });

    it("back-to-back: existing [09:30, 10:00), candidate [10:00, 10:30) → valid (half-open)", () => {
      const input = makeInput({
        bookings: [
          makeBooking({
            startAt: wallToInstant("2026-07-15", "09:30", SALON_TZ),
            endAt: wallToInstant("2026-07-15", "10:00", SALON_TZ),
          }),
        ],
      });
      expect(checkSlot(FUTURE_START, input, makeQuery())).toEqual({
        valid: true,
      });
    });
  });

  it("first-fail single-reason priority: in_past wins over outside_working_hours", () => {
    // Slot at 07:00 (before 08:00 window) AND start <= now → both reasons apply.
    // checkSlot returns FIRST failing rule per order: in_past (#2) wins.
    const start = wallToInstant("2026-07-15", "07:00", SALON_TZ);
    const query = makeQuery({ now: new Date(start.getTime() + 1000) });
    expect(checkSlot(start, makeInput(), query)).toEqual({
      valid: false,
      reason: "in_past",
    });
  });
});

// ============================================================
// 4. generateSlotsForStylist
// ============================================================

describe("generateSlotsForStylist", () => {
  it("services empty → []", () => {
    expect(
      generateSlotsForStylist(makeInput(), makeQuery({ services: [] })),
    ).toEqual([]);
  });

  it("from >= to → []", () => {
    const t = new Date("2026-07-15T10:00:00.000Z");
    expect(
      generateSlotsForStylist(makeInput(), makeQuery({ from: t, to: t })),
    ).toEqual([]);
  });

  it("quick-reject: stylist not qualified for ALL services → []", () => {
    const input = makeInput({
      stylist: makeStylist({ serviceIds: ["other"] }),
    });
    expect(generateSlotsForStylist(input, makeQuery())).toEqual([]);
  });

  it("happy path: 30-min service in 10h window (08-18), 15-min grid → 39 slots", () => {
    // Candidates 08:00, 08:15, ..., 17:45 = 40 starts.
    // 17:45 + 30 = 18:15 > 18:00 → dropped. Last valid: 17:30. Total 39.
    const slots = generateSlotsForStylist(makeInput(), makeQuery());
    expect(slots).toHaveLength(39);
    expect(instantToWallParts(slots[0]!.start, SALON_TZ).hhmm).toBe("08:00");
    expect(
      instantToWallParts(slots[slots.length - 1]!.start, SALON_TZ).hhmm,
    ).toBe("17:30");
  });

  it("each slot carries stylistId + valid end = start + duration", () => {
    const slots = generateSlotsForStylist(makeInput(), makeQuery());
    for (const s of slots) {
      expect(s.stylistId).toBe("stylist-1");
      expect(s.end.getTime() - s.start.getTime()).toBe(30 * 60_000);
    }
  });

  it("long service end-of-day: 2.5h svatba, close 18:00 → last valid start 15:30", () => {
    const longService = makeService({
      id: "svc-svatba",
      category: "svatebni",
      durationMinutes: 150,
    });
    const input = makeInput({
      stylist: makeStylist({ serviceIds: ["svc-svatba"] }),
    });
    const slots = generateSlotsForStylist(
      input,
      makeQuery({ services: [longService] }),
    );
    expect(slots.length).toBeGreaterThan(0);
    const lastSlot = slots[slots.length - 1]!;
    expect(instantToWallParts(lastSlot.start, SALON_TZ).hhmm).toBe("15:30");
    expect(instantToWallParts(lastSlot.end, SALON_TZ).hhmm).toBe("18:00");
  });

  it("absence interspersed: drops slots overlapping absence", () => {
    const input = makeInput({
      absences: [
        makeAbsence({
          startAt: wallToInstant("2026-07-15", "10:00", SALON_TZ),
          endAt: wallToInstant("2026-07-15", "12:00", SALON_TZ),
        }),
      ],
    });
    const hhmms = generateSlotsForStylist(input, makeQuery()).map(
      (s) => instantToWallParts(s.start, SALON_TZ).hhmm,
    );
    expect(hhmms).not.toContain("10:00");
    expect(hhmms).not.toContain("11:45"); // 11:45-12:15 overlaps absence
    expect(hhmms).toContain("09:30"); // 09:30-10:00 back-to-back (no overlap)
    expect(hhmms).toContain("12:00"); // 12:00-12:30 back-to-back (no overlap)
  });

  it("booking interspersed: drops slots overlapping occupying booking", () => {
    const input = makeInput({
      bookings: [
        makeBooking({
          startAt: wallToInstant("2026-07-15", "10:00", SALON_TZ),
          endAt: wallToInstant("2026-07-15", "10:30", SALON_TZ),
          status: "confirmed",
        }),
      ],
    });
    const hhmms = generateSlotsForStylist(input, makeQuery()).map(
      (s) => instantToWallParts(s.start, SALON_TZ).hhmm,
    );
    expect(hhmms).not.toContain("10:00");
    expect(hhmms).not.toContain("09:45"); // 09:45-10:15 overlaps
    expect(hhmms).toContain("09:30"); // back-to-back from the left
    expect(hhmms).toContain("10:30"); // back-to-back from the right
  });

  it("multi-day window: respects weeklyHours per weekday (Saturday in, Sunday out)", () => {
    const query = makeQuery({
      from: wallToInstant("2026-07-18", "00:00", SALON_TZ), // Saturday
      to: wallToInstant("2026-07-20", "00:00", SALON_TZ), // Monday 00:00
    });
    const days = new Set(
      generateSlotsForStylist(makeInput(), query).map(
        (s) => instantToWallParts(s.start, SALON_TZ).ymd,
      ),
    );
    expect(days).toEqual(new Set(["2026-07-18"])); // Sat only; Sun is null
  });

  it("override.open=false skips whole day → []", () => {
    const query = makeQuery({
      override: [{ date: "2026-07-15", open: false }],
    });
    expect(generateSlotsForStylist(makeInput(), query)).toHaveLength(0);
  });

  it("override.open=true with hours intersects with weeklyHours", () => {
    const query = makeQuery({
      override: [
        {
          date: "2026-07-15",
          open: true,
          hours: { start: "10:00", end: "14:00" },
        },
      ],
    });
    const hhmms = generateSlotsForStylist(makeInput(), query).map(
      (s) => instantToWallParts(s.start, SALON_TZ).hhmm,
    );
    expect(hhmms[0]).toBe("10:00"); // intersect start = max(08:00, 10:00)
    expect(hhmms[hhmms.length - 1]).toBe("13:30"); // intersect end - 30min
  });

  it("override.open=true WITHOUT hours: no narrowing (D-018 D2 sub-case)", () => {
    const query = makeQuery({
      override: [{ date: "2026-07-15", open: true }], // no `hours`
    });
    // Should produce the full happy-path 39 slots (no narrowing applied).
    expect(generateSlotsForStylist(makeInput(), query)).toHaveLength(39);
  });

  it("custom granularityMin: 30-min grid in 10h window → 20 starts, last drops → 19 slots", () => {
    // 30-min step from 08:00..17:30 = 20 starts; 17:30 + 30 = 18:00 OK,
    // 17:30 is last. Actually 18:00 - 30 = 17:30 is last valid start.
    // 08:00, 08:30, ..., 17:30 = 20 slots.
    const slots = generateSlotsForStylist(
      makeInput(),
      makeQuery({ granularityMin: 30 }),
    );
    expect(slots).toHaveLength(20);
    expect(
      instantToWallParts(slots[slots.length - 1]!.start, SALON_TZ).hhmm,
    ).toBe("17:30");
  });
});

// ============================================================
// 5. generateAvailableSlots — anyone-mode fan-out
// ============================================================

describe("generateAvailableSlots", () => {
  it("inputs: [] → []", () => {
    expect(generateAvailableSlots([], makeQuery())).toEqual([]);
  });

  it("fan-out: 2 stylists same window → flattened result", () => {
    const m = makeInput({ stylist: makeStylist({ id: "marie", name: "Marie" }) });
    const j = makeInput({ stylist: makeStylist({ id: "jana", name: "Jana" }) });
    const slots = generateAvailableSlots([m, j], makeQuery());
    expect(slots).toHaveLength(78); // 39 per stylist × 2
    expect(new Set(slots.map((s) => s.stylistId))).toEqual(
      new Set(["marie", "jana"]),
    );
  });

  it("sort: (start, stylistId) ascending — start primary, stylistId secondary", () => {
    const m = makeInput({ stylist: makeStylist({ id: "marie" }) });
    const j = makeInput({ stylist: makeStylist({ id: "jana" }) }); // 'jana' < 'marie' lex
    const slots = generateAvailableSlots([m, j], makeQuery());

    // First two slots share start 08:00; secondary key orders jana before marie.
    expect(instantToWallParts(slots[0]!.start, SALON_TZ).hhmm).toBe("08:00");
    expect(slots[0]!.stylistId).toBe("jana");
    expect(instantToWallParts(slots[1]!.start, SALON_TZ).hhmm).toBe("08:00");
    expect(slots[1]!.stylistId).toBe("marie");

    // Monotonic non-decreasing start across the whole array.
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]!.start.getTime()).toBeGreaterThanOrEqual(
        slots[i - 1]!.start.getTime(),
      );
    }
  });

  it("3-stylist alphabetic stability (ana < jana < marie within same start)", () => {
    const a = makeInput({ stylist: makeStylist({ id: "ana" }) });
    const j = makeInput({ stylist: makeStylist({ id: "jana" }) });
    const m = makeInput({ stylist: makeStylist({ id: "marie" }) });
    // Intentionally pass in non-alphabetic order to verify the sort, not the input order.
    const slots = generateAvailableSlots([m, a, j], makeQuery());
    expect(slots[0]!.stylistId).toBe("ana");
    expect(slots[1]!.stylistId).toBe("jana");
    expect(slots[2]!.stylistId).toBe("marie");
  });

  it("unqualified stylist contributes 0 slots (quick-reject in per-stylist generator)", () => {
    const qualified = makeInput({ stylist: makeStylist({ id: "qualified" }) });
    const unqualified = makeInput({
      stylist: makeStylist({ id: "unqualified", serviceIds: ["other"] }),
    });
    const slots = generateAvailableSlots([qualified, unqualified], makeQuery());
    expect(new Set(slots.map((s) => s.stylistId))).toEqual(
      new Set(["qualified"]),
    );
  });
});

// ============================================================
// 6. Constants — sanity for tunable defaults
// ============================================================

describe("constants", () => {
  it("SALON_TZ = 'Europe/Prague'", () => {
    expect(SALON_TZ).toBe("Europe/Prague");
  });
  it("DEFAULT_GRANULARITY_MIN = 15", () => {
    expect(DEFAULT_GRANULARITY_MIN).toBe(15);
  });
  it("DEFAULT_MIN_LEAD_TIME_MINUTES = 120", () => {
    expect(DEFAULT_MIN_LEAD_TIME_MINUTES).toBe(120);
  });
});
