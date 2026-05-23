# Session handoff — Day 4 EOD (2026-05-23)

**Branch:** `main` · **Last commit:** `c23b7bb` · **Tree:** clean, vše pushnuté.

Rescue snapshot (context window 97 %). Plný kontext: [`CLAUDE.md`](../CLAUDE.md) + [`docs/decisions.md`](decisions.md) + [`docs/LESSONS_LEARNED.md`](LESSONS_LEARNED.md). Předchozí handoffy: [`SESSION_HANDOFF_2026-05-22.md`](SESSION_HANDOFF_2026-05-22.md) (Day 3 close) + [`SESSION_HANDOFF_2026-05-22-EOD.md`](SESSION_HANDOFF_2026-05-22-EOD.md) (Day 3 mid-session).

---

## Stav

- **22 commits shipped** tuto session: backend 11 + UI 8 + docs 3.
- **Core case study deliverable DONE** (architecture + setup + assumptions + future work + production substitutes + audit checklist + PR draft).
- Latest commit: `c23b7bb` (`docs/PR_DRAFT.md`).

## Co bylo dokončeno tuto session

- **D-018 milestone** — slot-validity single source of truth (`checkSlot` v `@hsb/shared` consumed by UI + functions pre-txn).
- **D5 phoneHash lift** — Web Crypto API async, D-013 SDK-agnostic stance honored (commit `5418ba7`).
- **Day 2 pending CLOSED** — `scripts/seed.mjs` (9 services + 5 stylists + 6 admin accounts + ~25 bookings + 6 absences + 2 customer profiles + 2 notifications) + claims-based `firestore.rules` + Firebase Auth via seed.
- **UI Phase 1+2 public** — Vite skeleton → service select → slot picker → customer form → submit → success → magic-link cancel.
- **UI Phase 3.1–3.4 admin** — Firebase Auth + role-aware sidebar → denní rozvrh + booking drawer s status transitions → walk-in (CF staff-bypass lead-time + source) → stylists + services CRUD (owner-only, soft-delete via active toggle).
- **`docs/SMOKE_TEST.md`** — 8-scénářový manual playbook (375 lines).
- **`README.md` final** — 401 lines, 13 sekcí včetně §13 audit checklist (33 rows ✅/⚠️/❌ per PDF requirement).
- **`docs/PR_DRAFT.md`** — refactor description pro callable contracts + OCCUPYING_STATUSES lift.

## Co zbývá (priority order)

1. 🔴 **Lokální smoke test** per `docs/SMOKE_TEST.md` (~30-60 min, user manual; Docker není v session dostupné).
2. 🟡 Fix-commits per smoke FAIL findings (pokud nějaké).
3. 🟡 **Deploy sekvence:** `firebase deploy --only firestore:indexes` → wait for build → `--only firestore:rules` → `--only functions` → `--only hosting`. Indexes first per D-018 integration footprint (CLAUDE.md §5).
4. 🟡 README §3 URL update post-deploy (1 commit, ~5 min).
5. 🟢 Phase 3.5 reports (optional, ~30 min).

## Klíčové soubory pro next session

- [`docs/decisions.md`](decisions.md) — D-001 → D-018 plné rationale.
- [`docs/LESSONS_LEARNED.md`](LESSONS_LEARNED.md) — L-001 → L-010 incident log.
- [`docs/SMOKE_TEST.md`](SMOKE_TEST.md) — runtime validation playbook (8 scénářů + reporting matrix).
- [`docs/PR_DRAFT.md`](PR_DRAFT.md) — refactor description ready to execute.
- [`CLAUDE.md §5`](../CLAUDE.md) — debt D1-D5 + accumulated flags + workflow norms.
- [`README.md`](../README.md) — user-facing, 13 sekcí.

## Známé technické debt (CLAUDE.md §5)

- **D1** — 2 deserialization paths (`fromFirestore` vs `convertTimestampsToDate`).
- **D2** — `bookings: []` coupling konvence mezi createBooking integration a D-018.
- **D3** — vestigial `from` / `to` v `SlotQuery` pro atomic `checkSlot`.
- **D4** — defensive duplikace `not_qualified` + `in_past` mezi `prepareBooking` a `checkSlot`.
- **D5** — `OCCUPYING_STATUSES` 3 instances (functions + shared + web).
- **BookingView typ drift** — web duplikuje functions-internal type (PR_DRAFT řeší).
- **JS bundle 650 kb** — code-split candidate (Firebase SDK dominant).
- **`index.html` default Vite title** — drobnost.
- **Phase 3.5 reports** — placeholder; deferred per shipper mode.

## Workflow norms (pro continuity)

- **Czech narrative, English code/identifiers** (kromě UI Czech strings).
- **Principal Engineer audit pattern** — proposal → audit → ship per netriviální feature; shipper mode pro UI (méně proposals, více kódu).
- **Pre-flight discipline (L-010)** — 7 instances tuto session (`noUncheckedIndexedAccess` tuple destructure / `vitest --passWithNoTests` / `fromFirestore<{id}>` constraint / `node:crypto` v SDK-agnostic shared / unused imports × 3). Pattern: read tooling signature/config PŘED písání kódu.
- **Honest flags** — surface mismatches mezi paměť/proposal/empirické verify; calibrated rebellion welcome opačným směrem.
- **Commit messages** — Conventional commits + `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` footer (AI disclosure transparency).
- **Audit-first per L-007** — žádný silent fix; STOP před apply, ukázat diff/proposal.
