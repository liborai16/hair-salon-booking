# Resumption prompt — paste do nového Claude Code sezení

> Zkopíruj blok níže (mezi `---`) do nového terminálu/sezení. Naváže okamžitě na task #5 bez doptávání.

---

Pokračuji case study hair-salon-booking, Day 3 start. Mluv **česky**, kód anglicky.

**STAV:** Branch `main`, tree clean, last commit `96051ae`. Day 2 BLOK B = **4/5 hotovo** (#1 pricing D-014, #2 overlap D-016, #3 createBooking, #4 manageBookingByToken). Zbývá **task #5: esbuild bundling `@hsb/shared` do functions deploye + finalizace D-015**.

**NAČTI NEJDŘÍV (primary handover, přes Read, ne z paměti):**
- `docs/SESSION_HANDOFF_2026-05-22.md` — kompletní stav, task #5 spec, open items, architektonické fakty.
- `CLAUDE.md` — profil uživatele, pravidla spolupráce, handoff, decisions log, §5 známé limitace.
- `docs/decisions.md` — D-001 → D-017 (**D-015 = placeholder, finalizuješ teď**; klíčové: D-012 shared workspace, D-013 Timestamp↔Date, D-014 pricing authority, D-016 overlap, D-017 magic-link query-by-token).
- `docs/LESSONS_LEARNED.md` — L-001 → L-008 (L-008 = ESM ordering / side-effect config upstream).

**TASK #5 POSTUP (architecture-first):**
1. **D-015 rozhodnutí PŘED kódem** — esbuild vs alternativy (npm pack / `file:` / bundledDependencies); trade-offy: velikost, source maps, tree-shaking, Gen2 Node22 ESM kompatibilita. Workspace dep `"@hsb/shared": "*"` se z npm registry nenainstaluje → deploy by spadl bez bundle.
2. **Empirický pre-read:** `functions/package.json` (build=`tsc`), `firebase.json` (predeploy lint+build), `packages/shared/package.json` (exports → `dist/`).
3. **Implementace:** esbuild build step + úprava functions build/predeploy + **test bundlu** (importy z `@hsb/shared` po bundlu fungují).
4. **Finalizovat D-015** záznam → commit + push.

**Pozn.:** #5 není na kritické cestě pro lokální dev (emulátor řeší shared přes workspace symlink + `dist/`); je to prod-deploy záležitost (Day 6).

**OPEN ITEMS (neztratit):**
- 🔴 Runtime smoke-test gap — oba handlery build+lint zelené, NIKDY neběžely. Gated na seed + emulátor + auth/rules (CLAUDE.md §5).
- 🟢 4× README §6 limitace (Day 6): PII duplikace, public callable bez App Check/rate-limit, `now=new Date()` vs serverTimestamp, slot query čte cancelled.

**FORWARD:** task #5 → Day 3 UI design phase (veřejný booking flow, `/r/:token` cancel stránka konzumující `BookingView`, landing skeleton, slot-availability generátor v `availability.ts` — viz `TODO(day-3)` v `createBooking.ts`).

**COMMUNICATION NORMS:**
- Mluv **česky**, kód a názvy souborů anglicky.
- **Empirical-first:** ověř soubory přes Read, ne z paměti/summary, než tvrdíš fakta.
- **File-by-file / checkpoint approval:** vysvětli před akcí, ukaž diff, počkej na schválení.
- **Calibrated rebellion (L-007):** když vidíš lepší řešení / edge case / bug, flagni s důkazem + alternativou. Žádný silent fix.
- **Frame přes vizuální/designerské analogie** (uživatel = designer bez webdev praxe).
- **Conventional commits** (`feat:`/`fix:`/`chore:`/`docs:`) s footerem `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`. Commit + push po milestonu.
- **Architecture-first u rozhodnutí:** decision record (D-xxx) PŘED implementací.

---
