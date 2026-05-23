# Session handoff — Day 5 morning preflight (2026-05-24)

**Branch:** `main` · **Last commit před tímto:** `75b70fc` · **Tree:** clean.

Krátký checkpoint před spuštěním T1 (emulators) per [`docs/SMOKE_TEST.md`](SMOKE_TEST.md). Předchozí: [`SESSION_HANDOFF_2026-05-23.md`](SESSION_HANDOFF_2026-05-23.md) (Day 4 EOD, 22-commit milestone).

---

## Pre-flight check výsledky (2026-05-24 morning)

- ✅ Node v24.14.1, npm 11.11.0
- ✅ Firebase CLI 15.18.0 (via `npx firebase` — global není potřeba)
- ✅ `npm install` OK ve všech 4 workspaces (root, web, functions, packages/shared)
- ✅ `packages/shared/dist/` built (24 souborů: availability, customer-hash, firestore-helpers, index, pricing, types)
- ✅ Emulator porty volné (4000, 5000, 5001, 5173, 8080, 9099)
- ✅ Java JDK 17.0.19 Eclipse Temurin (instalováno přes winget tuto session)
- ❌ Docker Desktop not installed → decision: **Cesta B** (native, bez Dockeru)

## Cesta B vs Cesta A decision

- **Chosen:** Cesta B (native `firebase emulators:start` + Java na hostu)
- **Důvod:** menší install (~180 MB vs ~3 GB), žádný WSL2 friction, jednodušší pro Windows 11
- **Tradeoff:** `docker-compose.yml` v repu zůstává jako alternativa, ale není primary path pro smoke test

## Documentation drift flag (Day 6 fix-commit)

- `docs/SMOKE_TEST.md` §3 Prerequisites říká „Docker Desktop running"
- `README.md` §3 také odkazuje na Docker compose path
- Reality: Cesta B funguje bez Dockeru (potvrzeno pre-flight checkem)
- **Fix po deploy:** přidat „Alternative (recommended): native `firebase emulators:start` + Java JDK 17" sekci do obou dokumentů

## Ready for T1

Příští krok: spustit 3 terminály paralelně per [`docs/SMOKE_TEST.md §3`](SMOKE_TEST.md):

1. **T1:** `npx firebase emulators:start` (čekej na „All emulators ready")
2. **T2:** `npm run seed` (po T1 ready)
3. **T3:** `cd web && npm run dev`

Pak 8 scénářů smoke test per [`docs/SMOKE_TEST.md §4`](SMOKE_TEST.md) (A-H, reporting matrix v §5).
