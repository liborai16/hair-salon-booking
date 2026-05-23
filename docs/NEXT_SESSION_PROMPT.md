Jsi Claude Code v nové session na hair-salon-booking projektu. Today is Day 6+ (visual polish phase).

## Read first (priority)
1. `CLAUDE.md` (workflow norms + §5 current state + D1-D5 debt)
2. `docs/SESSION_HANDOFF_2026-05-24-DAY5_FINAL.md` (Day 5 EOD snapshot — deploy + e2e verified, commit chain)
3. `README.md §7` (visual polish items moving from „future work" → done this session)
4. Před writing code: read `web/src/pages/Landing.tsx` + `web/src/booking/steps/*` + `web/src/components/Layout.tsx` + `web/tailwind.config*` + `web/src/index.css` (current theme tokens + class patterns)

## Current state (28 commits shipped, production deployed)
- **Backend complete:** 2 Cloud Functions (createBooking + manageBookingByToken), 9 Firestore collections, claims-based rules, seed.mjs (+ `seed:prod` target).
- **UI complete (functional):** public booking flow Phase 1+2 + admin Phase 3.1-3.4 (login + rozvrh + walk-in + stylists/services CRUD).
- **Live URL:** https://hair-salon-booking-cs-69a08.web.app — e2e verified (public booking + admin login + 3-layer role gating per D-013).
- **Docs:** README 13 sekcí, SMOKE_TEST 8/8 PASS + production smoke, PR_DRAFT, decisions D-001→D-018, lessons L-001→L-010.

## Today's mission (visual polish, ~8h time-boxed, ROI-driven)

Priority order — visual polish items move from README §7 → done:

1. 🎨 **Brand basics** — color palette + typography Tailwind theme extension (`web/tailwind.config*` + `web/src/index.css`). User dodá moodboard / brand direction (colors, fonts, vibe references).
2. 🎯 **Landing hero redesign** — `web/src/pages/Landing.tsx` upgrade z plain CTA na proper marketing surface (hero + value prop + CTA + případně social proof / služby preview).
3. 🃏 **Service picker visual** — `web/src/booking/steps/ServiceStep.tsx` cards místo list; category ikony; price + duration prominent.
4. 📱 **Mobile responsivity audit** — 375px DevTools + real mobile pokud možno. Audit breakpoints, touch targets (44×44 min), viewport math.
5. 💫 **Empty states + loading skeletons** — touch-detail signal: loading spinners → skeleton placeholders; empty pickers → ikona + helpful text.
6. 🚀 **Final commit chain + rebuild + redeploy hosting** — `npm run build` v `web/` → `npx firebase deploy --only hosting`.

## Pre-flight checklist

**User-side (před session start):**
- Screenshoty current pages — desktop + mobile 375px (před/po comparison signal v PR description)
- Brand direction: color palette preference, font preference, vibe references (Pinterest moodboard, reference sites)

**Claude-side (před writing code):**
- Read `web/` UI files per "Read first" §4 — current class patterns, defensive utility usage vs systematic, Tailwind 4 theme structure
- Identify existing component patterns to preserve (`<RequireAuth>`, `<Layout>`, booking shell wizard machinery)
- Audit Tailwind 4 setup (`@import "tailwindcss"` v CSS + `@tailwindcss/vite` plugin per D-003) PŘED přidávání theme tokenů

## Workflow norms (locked from Day 5)
- Czech narrative, English code/identifiers (UI Czech strings)
- Principal Engineer audit pattern: proposal → audit → ship pro netriviální feature
- Shipper mode pro UI polish (méně proposals, více kódu); audit-first pro architectural changes
- Pre-flight discipline (L-010) — read tooling/config PŘED writing code
- Honest commit messages, no overclaim; `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` footer
- Single consolidated paste-ready response per turn (user feedback locked)
- Calibrated rebellion bidirectional — flag mismatches mezi paměť / proposal / empirické verify (Day 5 Java 21+ saga = canonical example)

## Status
- Tree clean, vše pushnuté
- Branch `main`, latest commit = Day 5 EOD chain ending at NEXT_SESSION_PROMPT update
- Live URL operational; case study delivery already submission-ready (visual polish = nadstavba, ne blocker)
- Žádný outstanding work bez user trigger

**Confirm:** read CLAUDE.md + SESSION_HANDOFF_2026-05-24-DAY5_FINAL.md + relevant `web/` files per §4, then tell me current state summary + ready pro visual polish phase. Audit-first pro brand direction (Libor moodboard input drives proposal).
