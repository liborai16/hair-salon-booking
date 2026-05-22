# Session handoff — Day 3 EOD (2026-05-22)

**Branch:** `main` · **Last feat commit:** `a0f7745` · **Stav:** Day 2 BLOK B kompletní; Day 3 Part 2 (availability.ts) ve fázi „proposal accepted, implementace pending".

Tenhle dokument je EOD rescue snapshot (claude.ai usage exhausted). Pro plný kontext viz `CLAUDE.md`; pro předchozí milník (Day 2 BLOK B → Day 3) viz `docs/SESSION_HANDOFF_2026-05-22.md`.

---

## 1. Hotovo

**Day 2 BLOK B = 5/5 ✅** (commit `a0f7745` — task #5 esbuild bundling, D-015 finalized).
- Plné detaily té práce: `docs/decisions.md` D-015.

**Day 3 Part 2 — `availability.ts` slot generator: PROPOSAL kompletní + audit-accepted.**
- Architecture-first proposal projednán a odsouhlasen (sekce A–E + 14 edge cases + 6 decision matrices D1–D6).
- **Žádné open questions** — vše A–E locked, ready pro implementaci.

---

## 2. Locked decisions (čekají na zápis do D-018 při implementaci)

| # | Rozhodnutí | Locked hodnota |
|---|---|---|
| D1 | Slot granularita | Fixed 15-min grid (reuse `SLOT_GRANULARITY_MIN` z `pricing.ts`); `granularityMin` optional param |
| D2 | Business override × weeklyHours | **Intersection** (override = vnější salon-level závorka; `open=false` → `salon_closed`; `open=true,hours` → průnik se stylist weeklyHours) |
| D3 | Anyone-mode | Fan-out + flatten; každý `Slot` nese `stylistId`; grupování stejných časů je UI odpovědnost |
| D4 | Capability storage | `Stylist.serviceIds` (per-service-ID) — reuse, žádná nová struktura (empiricky potvrzeno z types.ts; createBooking to už používá) |
| D5 | Horizont | Caller-provided `[from, to)`; UI ~4 týdny, server 1 slot. Negenerátor nehardcoduje |
| **D6** | **Timezone konverze** | **🔒 LOCKED: variant B — `Intl.DateTimeFormat.formatToParts` + `Date.UTC`** (zero-dep, drží D-012/D-013 čistotu). NE `toLocaleString` round-trip (host-spec string parsing risk, ms loss, hourCycle midnight). NE luxon (první runtime dep v shared). **Empiricky ověřeno** přes obě DST hrany 2026 (viz §3) |
| — | minLeadTime | **🔒 LOCKED: 120 min default**, tunable přes `SlotQuery` param. README §6 documented assumption. Reason: oborový standard (Booksy/Reservio) + PDF kontext (vytížený salon, mistrová má frontu); reason kód `too_soon` |

---

## 3. TZ correctness — empirický důkaz (Day 5 regression anchor)

Ad-hoc probe (`_tz_probe.mjs`, smazán) porovnal variant A (`toLocaleString`) vs B (`formatToParts`) pro `Europe/Prague`. Oba dali identické správné instanty; B zvolen pro robustnější základ. **Tyto případy → Day 5 unit testy:**

```
wall-clock 10:00 Prague → UTC instant:
  2026-01-15 → 09:00Z  (winter CET,  UTC+1)
  2026-07-15 → 08:00Z  (summer CEST, UTC+2)
  2026-03-29 → 08:00Z  (spring-forward day, already CEST)
  2026-10-25 → 09:00Z  (fall-back day, already CET)
day length (wall-clock 00:00 boundaries):
  03-29→03-30 = 23h ;  10-25→10-26 = 25h ;  07-15→07-16 = 24h
```

---

## 4. Architektura (accepted shape, pro signatures příště)

**Tři exportované funkce, sdílené jádro `checkSlot`:**
- `checkSlot(start, StylistAvailabilityInput, SlotQuery): SlotCheck` — JÁDRO. Validuje jeden `(start, duration)`: qualification → future/`too_soon` → salon override → working hours → absence → booking overlap. Typovaný `SlotRejectionReason`. **Volá ho `createBooking` server-side** (nahradí `TODO(day-3)` v `createBooking.ts` ř. 199-206; overlap-race zůstává v Firestore transakci).
- `generateSlotsForStylist(input, query): Slot[]` — iteruje 15-min grid přes `[from,to)`, volá `checkSlot`.
- `generateAvailableSlots(inputs[], query): Slot[]` — anyone-mode fan-out + flatten.

`Slot = { stylistId, start, end }`. Vstupy jsou už-deserializovaná doménová data (`Date`, D-013). Pure, žádné I/O, `now` injected. Žádný zod (interní doménová vrstva).

**Day iteration:** kalendářní `YYYY-MM-DD` stringy (UTC date arithmetic increment), per-day `weeklyHours[weekday]` přes `wallToInstant` — „kolik hodin má den" nevzniká jako otázka.

---

## 5. Framework slim-down (pro D-018 zápis)

- **F (D-NNN record) cut** jako sekce — je to meta proces, ne design.
- **G (trade-offs) smrsknout** na boundary-line (C/D už nesou future work).
- **A↔E keep** — komplementární úhly (tvar dat vs. kdo volá), ne duplikace.

---

## 6. Next session sequence (NEzačato dnes — šetříme budget)

1. **D-018 record draft** (paralelně s implementací, ne po — L-007). Title: „Availability slot generator v `@hsb/shared` — pure, half-open intervaly + capability + absence/override + Intl timezone". Zaznamenat D1–D6 + minLeadTime.
2. **Signatures first** (interface contracts viditelné před těly).
3. **Bodies** druhé.
4. **Unit tests** třetí (pure → bez emulátoru; viz §3 TZ anchor + overlap edge cases z `TODO(day-5)`).
5. Commit + push: `feat(shared): availability slot generator (D-018)`.

---

## 7. Open items / debt (NEztraceno)

- 🔴 **Runtime smoke-test gap** — oba Cloud Functions handlery build+lint zelené, NIKDY neběžely. Gated na seed + emulátor + auth/rules. (`CLAUDE.md` §5)
- 🟡 **Handoff docs debt** — `CLAUDE.md` §5 + hlavní `SESSION_HANDOFF_2026-05-22.md` (pořád říká 4/5) + `LESSONS_LEARNED` L-009 (TZ empirical-testing lesson) — **deferred na end of Day 3** per dohoda. Tento EOD snapshot je nenahrazuje; hodnotitel čte repo, ne paměť.
- 🟢 **D-018 Day-6 / Future work** (z proposalu sekce G): lunch break / split shifts (WeeklyHours má 1 range/den); buffer mezi rezervacemi (D-016 future); DST přechodové hodiny 2-3am (salon tam nesahá); per-service medium/long délky (D-014 future); configurable granularita.
- 🟢 **D-015 Day-6 deploy follow-ups:** `--enable-source-maps` runtime flag; `$RESOURCE_DIR` Windows verify (predeploy lint+build kroky).

---

## 8. Číslování decisions (empiricky ověřeno v decisions.md)

Poslední reálný záznam = **D-017**. Sekvence D-001…D-017 souvislá (D-015 finalized). availability = **D-018**. UI tokens (future) = D-019. Repo je autorita, paměť ne.
