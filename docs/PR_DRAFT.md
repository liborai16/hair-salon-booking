# PR draft: Lift callable-contract types + OCCUPYING_STATUSES do `@hsb/shared`

**Branch:** `refactor/callable-contracts-lift`
**Labels:** `refactor`, `tech-debt`, `no-functional-change`

Tento dokument je popis PR, který bych jako první otevřel, kdyby přišel feedback nebo budget na cleanup. Žádný kód ještě není napsán — viz [README §12](../README.md) pro výběr kontextu.

---

## 1. Motivace — proč právě tento refaktor jako první?

Tři důvody, proč tahle volba před ostatními debt items v [`CLAUDE.md §5`](../CLAUDE.md) (D1-D4):

1. **Highest leverage / lowest risk ratio.** Pure type/const motion, žádný behavioral change. Ověřitelné celé přes 57 shared tests + `tsc --noEmit` na všech 4 workspaces. Mechanical extraction pod test safety net — pokud něco selže, je to import error, ne logic regression.

2. **Eliminuje silent drift mezi server (functions) a client (web).** `BookingView` je dnes definovaný v `functions/src/handlers/manageBookingByToken.ts` a `web/src/pages/CancelPage.tsx` duplikuje strukturu pro typing inbound `httpsCallable` response. Když někdo přidá pole na server straně, web tiše ztratí compile-time safety. Lift do `@hsb/shared` = jeden zdroj kontraktu, **compile error na obou stranách** při jakékoli změně shape.

3. **Konzistence s established pattern.** D5 phoneHash lift z functions do `@hsb/shared` (commit `5418ba7`, Web Crypto async) prokázal hodnotu single-source. Stejný pattern (mechanical extraction pod test safety net) zde aplikujeme znovu pro callable contracts a OCCUPYING_STATUSES — three-instance duplication.

---

## 2. Scope

### 2a. BookingView + ManageInput → `@hsb/shared/callable-contracts.ts`

**Současný stav:**
- `functions/src/handlers/manageBookingByToken.ts` — definuje `BookingView` (view response) + uses `ManageInput` z `schemas/manageBookingByToken.schema.ts`.
- `web/src/pages/CancelPage.tsx` ř. ~10-18 — duplikuje shape `BookingView` lokálně (s komentářem o known drift risk).
- Drift risk: 100 % při budoucí API extension (např. přidat `paymentReceiptUrl` na completed booking view).

**Cíl:**
- Nový soubor: `packages/shared/src/callable-contracts.ts`.
- Export typů: `ManageInput`, `BookingView`, plus pro symmetry `CreateBookingInput`, `CreateBookingResult` (lift z `web/src/booking/useBookingData.ts` + `functions/src/schemas/createBooking.schema.ts`).
- `functions` handlery importují contracts z `@hsb/shared`.
- `web` client importuje **stejné** contracts z `@hsb/shared`.

### 2b. OCCUPYING_STATUSES → `@hsb/shared/booking-states.ts`

**Současný stav (3 instances flagnuté v CLAUDE.md §5 D5-pattern):**
- `functions/src/handlers/createBooking.ts` ř. ~49 — overlap pre-txn query in-memory filter.
- `packages/shared/src/availability.ts` ř. ~424 — `checkSlot` defensive belt-and-suspenders.
- `web/src/booking/useBookingData.ts` ř. ~31 — public flow client-side filter.

**Cíl:**
- Nový soubor: `packages/shared/src/booking-states.ts` (nebo append na `types.ts` pokud preferujeme menší file count).
- Export: `OCCUPYING_STATUSES: ReadonlySet<BookingStatus>`.
- Plus pro symmetry: `TERMINAL_STATUSES` (completed | no_show | cancelled), `ACTIVE_STATUSES` (pending | confirmed).
- Všechny 3 callsity importují z `@hsb/shared`.

---

## 3. Implementation plan

Mechanical sequence (~30 min total execution):

1. **`packages/shared/src/callable-contracts.ts`** create.
   - Move `BookingView` z `functions/src/handlers/manageBookingByToken.ts`.
   - Move `ManageInput` shape z `functions/src/schemas/manageBookingByToken.schema.ts` (zod schema zůstává v functions/ — runtime parsing je server-only; type z něj exportujeme).
   - Add `CreateBookingInput` + `CreateBookingResult` (z `web/src/booking/useBookingData.ts` + matching response shape).
   - Export přes `packages/shared/src/index.ts` (barrel).

2. **`functions/src/handlers/manageBookingByToken.ts`** refactor.
   - Drop local `BookingView` definition.
   - Import `BookingView` + `ManageInput` z `@hsb/shared`.
   - `tsc --noEmit` check — should be clean (same shape, just different source).

3. **`functions/src/handlers/createBooking.ts`** refactor.
   - Drop `CreateBookingInput` local re-export pokud existuje; importovat z `@hsb/shared`.
   - Zod schema v `schemas/createBooking.schema.ts` stays (runtime validation) — jen TS typ exportujeme přes `z.infer<typeof schema>` v shared callable-contracts.

4. **`web/src/pages/CancelPage.tsx`** refactor.
   - Remove duplicated `BookingView` shape definition (řádky ~10-18).
   - Import z `@hsb/shared`.

5. **`web/src/booking/useBookingData.ts`** refactor.
   - Replace inline `CreateBookingInput` + `CreateBookingResult` v `httpsCallable<>()` calls s imports z `@hsb/shared`.

6. **`packages/shared/src/booking-states.ts`** create (nebo augment `types.ts`).
   - Export `OCCUPYING_STATUSES`, `TERMINAL_STATUSES`, `ACTIVE_STATUSES`.
   - Barrel re-export.

7. **3 callsite refactor** for OCCUPYING_STATUSES:
   - `functions/src/handlers/createBooking.ts` — remove local const, import z `@hsb/shared`.
   - `packages/shared/src/availability.ts` — same (internal consumer, just import from its own barrel sibling).
   - `web/src/booking/useBookingData.ts` — same.

8. **Full verification:**
   - `npm run build --workspaces` — all 4 workspaces clean.
   - `npm test --workspace=@hsb/shared` — 57/57 pass.
   - `npm run lint --workspace=functions` — clean.

9. **Single commit:** `refactor(shared): lift callable contracts + OCCUPYING_STATUSES (single source)`.

---

## 4. Testing plan

**Pre-merge gates:**
- ✅ `npm run build --workspaces` clean (all 4 workspaces).
- ✅ `npm test --workspace=@hsb/shared` — 57/57 pass.
- ✅ `npm run lint --workspace=functions` clean.
- ✅ `tsc --noEmit` per-workspace.

**Manual verification (smoke):**
- Re-run [`docs/SMOKE_TEST.md`](SMOKE_TEST.md) scenarios A (public booking), B (cancel via magic link), D (admin status transitions), E (walk-in) — všechny dotčené consumery callable contracts + OCCUPYING_STATUSES.
- Verify no UI/UX change — pure refactor; pokud něco vypadá jinak, je to bug.

**No behavioral change expected** — pure type/const motion. Pokud testy selžou, je to mechanical import error (snadno fixable).

---

## 5. Risk assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Import cycle (shared importing from functions) | Low | Lift goes shared ← functions/web only, never reverse |
| Tsc error on callable signature mismatch | Low | Strict TS na všech workspaces — caught immediately |
| Esbuild bundle change (D-015) | Negligible | `OCCUPYING_STATUSES` const je ~50 bytů; bundle delta < 100 B |
| Future contract evolution breaks consumers | **Mitigated by tento refactor** | Pre-refactor: silent drift. Post-refactor: compile error chytá změnu shape. |

**Overall: Low risk, high leverage.** Tento je canonical "boring refactor" co se vyplatí při dalším API change.

---

## 6. Alternatives considered (a proč ne)

Per [`CLAUDE.md §5`](../CLAUDE.md) Architektonický debt — proč ne ostatní D-items jako first refactor:

| Alternative | Why not (yet) |
|---|---|
| **D1: dvě deserialization paths** (`fromFirestore` vs `convertTimestampsToDate`) | Vyšší risk — touches data layer; vyžaduje careful audit který callsite expects which behavior (SalonSettings singleton vs id-bearing entity). Není mechanical motion. |
| **D2: `bookings: []` coupling** mezi createBooking integration a D-018 | Architectural decision o race-check boundary, ne mechanical refactor. Vyžaduje design discussion (vrátit overlap check do `checkSlot` vs ponechat v transakci). |
| **D3: vestigial `from` / `to` v `SlotQuery`** pro atomic `checkSlot` | Cleanup ale low impact — interface tweak. `CheckSlotQuery` + `GenerateSlotsQuery extends` split je nice-to-have, ne urgent. |
| **D4: defensive duplikace** `not_qualified` + `in_past` mezi `prepareBooking` a `checkSlot` | Defensive duplication je úmyslná belt-and-suspenders (per `mapSlotReasonToError` E3 enhancement) — ne čistý debt. |
| **Code-split frontend** (650kb bundle) | Performance optimization, ne tech debt — separate concern. Pojďme po refactor cleanup. |
| **Real-time admin rozvrh** (`onSnapshot`) | Feature work, ne refactor. Roadmap item, ne debt. |
| **BookingView lift only** (skip OCCUPYING_STATUSES) | Mohl jsem split na 2 PRs ale pattern je identický + scope je malý — combined PR má větší leverage při stejném review effortu. |

---

## 7. Estimated effort

- **Refactor execution:** ~30 min mechanical work (per §3 sequence).
- **PR review** (kdyby přišel feedback): ~10 min — pure import diffs, easy to verify.
- **Manual smoke re-run:** ~15 min (subset 4 scenarios per §4 testing plan).
- **Merge + deploy:** standard pipeline (no new infra).

---

## 8. Long-term context

Tento refactor je krok v "single source of contract" iniciativě, která má jasnou trajectory:

- ✅ **D5 phoneHash lift** (commit `5418ba7`, Web Crypto async) — domain logic single source pro hash deriving.
- ⏳ **Tento PR** — type contracts (BookingView, ManageInput, CreateBookingInput/Result) + const tables (OCCUPYING_STATUSES, TERMINAL_STATUSES, ACTIVE_STATUSES) single source.
- 🔮 **Future:** shared zod schemas — currently zod žije jen v functions; web by mohl validovat input pre-submit s identickou schémou (eliminuje round-trip pro obvious validation failures). Vyžaduje výchozí design discussion o tom, jak zod handle browser bundle size (~25-50kb extra).

Iniciativa směřuje k tomu, aby **change to a contract** byl jedna změna v jednom místě, ne search-and-replace přes 3 workspaces s rizikem mismatchu.

---

## 9. Out of scope tohoto PR

Explicit deferral, aby se review focus držel:
- Žádný behavioral change (status transition flow, slot algorithm, pricing math zůstává identický).
- Žádný file structure rearrangement nad rámec přidání 2 nových shared souborů.
- Žádný build / CI / deploy change (předpokládá same `firebase deploy` pipeline).
- Žádný README / docs update beyond CLAUDE.md §5 D5 status (vyznačit jako RESOLVED post-merge).
