# Session handoff — Day 3 close (D-018 milestone complete)

**Datum:** 2026-05-23 EOD · **Branch:** `main` · **Last commit:** `9585409` · **Tree:** clean, vše pushnuté.

> **Note:** Tenhle dokument je **refreshed Day 3 close state**. Předchozí
> verze („Day 2 BLOK B → Day 3", stav 4/5) je v git history (`96051ae`).
> Mid-session snapshot z Day 3 ráno (před D-018 work) je v
> `SESSION_HANDOFF_2026-05-22-EOD.md` (commit `a7861da`).
> Filename schválně beze změny — content date evoluje, filename = creation
> date convention pro stable cross-references z `CLAUDE.md` + EOD handoff.

---

## 1. Stav: BLOK B 5/5 ✅ + D-018 milestone complete

**Day 2 BLOK B (closed Day 3 start):**

| Task | Commit | Note |
|---|---|---|
| #1 `pricing.ts` (D-014) | `18432a4` | computeTotalDuration + computeTotalPrice |
| #2 overlap utility (D-016) | `df91fb5` | half-open intervals |
| #3 `createBooking` | `f1624fa` + `0a50164` | 4-collection write |
| #4 `manageBookingByToken` | `86701e3` | magic-link view/cancel |
| #5 esbuild bundle (D-015) | `a0f7745` | hard-remove @hsb/shared from manifest |

**D-018 milestone (Day 3, 7-commit chain):**

| # | Commit | Layer |
|---|---|---|
| 1 | `610ca48` | D-018 record draft (decisions.md) |
| 2 | `d20e77d` | D-018 revise (consolidated audit findings) |
| 3 | `c3aad93` | Signatures (5 types + 3 fcí + JSDoc deferred items) |
| 4 | `df031e1` | Bodies A+B+C (TZ helpers + checkSlot + generators) |
| 5 | `dd77c85` | Tests 57/57 (D-018 D6 regression anchor) |
| 6 | `885dcc6` | Refactor DRY (`computeStylistDayWindow`) |
| 7 | `9585409` | Integration (createBooking ↔ checkSlot) |

**TODO(day-3) z BLOK B vyřízeno** — `createBooking.ts` ř. 199-206 byl
placeholder pro „shared availability fce zavolaná server-side"; nyní
integrated přes `checkSlot` (D-018 architektonický cíl „single source
of slot-validity truth v real server flow" splněn).

---

## 2. Open items

### 🔴 Day 2 pending — blokuje runtime smoke test (nelze odložit do Day 5+)

Tyhle tasky byly plánované na Day 2 ale unfinished do BLOK B closure. Bez nich
je runtime smoke-test gap nemožné zavřít a UI client-side reads nefungují.

- **`scripts/seed.mjs`** — naplnit stylisty, services, weeklyHours, sample
  bookings + absences + business-hours overrides. Bez seedu handler nemá co
  načíst při smoke testu.
- **`firestore.rules` cleanup** — current = full deny-all `if false` skeleton.
  Admin SDK bypass znamená Cloud Functions fungují, ale UI client reads (např.
  veřejný `/bookings` pro slot availability + `/stylists` pro výběr + `/services`
  pro nabídku) nemůžou. Day 2 helper functions (isAuthenticated / userDoc /
  hasRole / stylistOwnsBooking) jsou zakomentované v `firestore.rules`, čekají
  na aktivaci.
- **Auth setup** — Firebase Auth Email/Password + custom claims pro role
  (`owner` / `receptionist` / `stylist`) per case study spec.

### 🔴 Runtime smoke-test gap (unchanged, broader scope post-D-018)

Detaily v `CLAUDE.md §5`. createBooking + manageBookingByToken pořád
`compiles ≠ runs`. Plus nově D-018 rejection paths neotestované runtime.
Gated na Day 2 pending blockery výše.

### 🟢 Day 6 / Future work

- D-015 deploy follow-ups (`--enable-source-maps`, `$RESOURCE_DIR` Windows verify)
- D-018 future work (lunch break, buffer time, multi-stylist booking, configurable granularity, pre-computed cache pro 100+ stylistů)
- D-018 architectural debt D1–D5 (viz `CLAUDE.md §5`)
- Index deployment sekvence: composite `(absences: stylistId, endAt)` first

### 🟢 Functions test infrastructure

Deferred separate setup task (mirror @hsb/shared vitest setup pattern:
root vitest reuse, scripts, tsconfig exclude).

---

## 3. Reference (kde co je)

- **Rozhodnutí:** `docs/decisions.md` — D-001 → **D-018**. D-018 je composite
  multi-decision record (D1–D6 + minLeadTime) pro slot generator.
- **Lekce:** `docs/LESSONS_LEARNED.md` — L-001 → **L-010** (L-009: TZ
  empirical probe; L-010: preflight discipline — 3-instance evidence
  shared root cause).
- **Aktuální stav/caveaty:** `CLAUDE.md §5`.
- **Datový model:** `packages/shared/src/types.ts` (9 entit, PII split).
- **Availability domain:** `packages/shared/src/availability.ts` (overlaps +
  3 TZ helpers + 4 utility + computeStylistDayWindow + checkSlot + 2 generators;
  ~750 řádků; 57 unit testů v sourozeneckém `.test.ts`).

## 4. Architektonické fakty, které musí nové sezení znát

- **PII split:** `bookings/{id}` = NO PII (PUBLIC READ); `bookingCustomers/{bookingId}` = PII + cancelToken (STAFF-ONLY).
- **D-014 pricing authority:** server přepočítá `totalPrice` + `endAt` z autoritativních dat; klient je neposílá.
- **D-018 single source of slot-validity truth:** `checkSlot` v `@hsb/shared` je consumed by UI (client-side rendering) i `createBooking` (server pre-txn). Overlap re-check zůstává inside Firestore txn (race-safe); ostatní validations (working hours, absence, salon override, lead time) jdou přes `checkSlot`.
- **Handler pattern:** boundary (zod parse → `invalid-argument`) → decision/lookup → persistence (Firestore transakce, **reads-before-writes**).
- **Funkce:** `createBooking` (onCall, 5 reads: stylist+services+absences+settings, pak checkSlot pre-txn, pak 4-collection txn write), `manageBookingByToken` (onCall, view/cancel, idempotent).
- **Indexy:** `(bookings: stylistId ASC, startAt ASC)` (D-016) + nově **`(absences: stylistId ASC, endAt ASC)`** (D-018). cancelToken lookup = single-field auto.

## 5. Forward plan

**Next steps po D-018 milestone (order reflects dependency chain):**

1. **Day 2 pending cleanup** (viz §2 Open items 🔴) — seed + rules + auth.
   Required pro any runtime work (smoke test, integration test, manual UI test).
   **Blocker pro #3, #4, #5.**
2. Functions test infrastructure setup (mirror shared vitest pattern).
   Independent of #1 — pure tooling.
3. UI booking flow start (`web/` workspace, `/r/:token` cancel stránka,
   landing skeleton). Needs #1 (rules) for client-side Firestore reads.
4. Runtime smoke test path (createBooking + manageBookingByToken happy +
   D-018 rejection paths). Needs #1 (seed + emulator + rules + auth).
5. Day 6: production deploy + README dotažený + showcase PDF + user guide.
