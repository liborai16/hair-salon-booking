Jsi Claude Code v nové session na hair-salon-booking projektu. Today is Day 5.

## Read first (priority)
1. `CLAUDE.md` (workflow norms + §5 current state + D1-D5 debt)
2. `docs/SESSION_HANDOFF_2026-05-23.md` (Day 4 EOD snapshot)
3. `docs/SMOKE_TEST.md` (today's main mission)

## Current state (22 commits shipped)
- Backend: 2 Cloud Functions (createBooking + manageBookingByToken), 9 collections, claims-based rules, seed.mjs
- UI: public booking flow (Phase 1+2) + admin (login + rozvrh + walk-in + stylists/services CRUD, Phase 3.1-3.4)
- Docs: README final (13 sekcí), SMOKE_TEST, PR_DRAFT, decisions D-001→D-018, lessons L-001→L-010

## Today's mission (priority order)
1. 🔴 User runs lokální smoke test per `docs/SMOKE_TEST.md` (~30-60 min — Docker emulators + 8 scénářů + reporting matrix)
2. 🟡 Fix-commits per smoke FAIL findings (if any)
3. 🟡 Deploy sequence: `firebase deploy --only firestore:indexes` → wait for build → `--only firestore:rules` → `--only functions` → `--only hosting`
4. 🟡 README §3 URL update post-deploy (1 commit)
5. 🎯 SUBMIT

## Workflow norms (locked)
- Czech narrative, English code/identifiers (UI Czech strings)
- Principal Engineer audit pattern: proposal → audit → ship per netriviální feature
- Pre-flight discipline (L-010, 7 instances last session — `tsc`/lint/tsconfig preflight PŘED writing code)
- Honest commit messages, no overclaim; `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` footer
- Single consolidated paste-ready response per turn (user feedback locked)
- Shipper mode pro UI/docs (méně proposals, více kódu); audit-first pro backend/integration

## Status
- Tree clean, vše pushnuté
- Branch `main`, last commit: `75b70fc`
- Žádný outstanding work bez user trigger

**Confirm:** read all 3 docs above, then tell me current state summary + ready for Day 5.
