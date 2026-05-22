# CLAUDE.md — Project handoff & decisions log

Tenhle soubor je „čerstvý kontext" pro libovolné nové Claude sezení v tomhle projektu. Obsahuje:
1. **Profil uživatele** (Libor) — jak s ním pracovat
2. **Pravidla spolupráce** — jak komunikovat, co očekávat
3. **Plný handoff** (scope + stack + data model + plán 6 dnů) z 2026-05-20
4. **Decisions log** — denní stručný přehled rozhodnutí (detail v `docs/decisions.md`)

Pro detailní obhajobu každého rozhodnutí a alternativy → `docs/decisions.md`.
Pro incidenty z vývoje a jejich řešení → `docs/LESSONS_LEARNED.md`.

---

## 1. Profil uživatele

- **Libor Sykora**, design background (grafika, branding), **0 zkušeností s kódováním webových aplikací**.
- Nainstalované: Node 24, npm 11, Git 2.54, VS Code, terminal Git Bash na Windows 11.
- GitHub: `liborai16` / `liborai16@gmail.com`.
- Komunikuje **česky**; kód a názvy souborů **anglicky**.

## 2. Pravidla spolupráce

- **Před každým větším krokem** krátce vysvětli, co se chystáš udělat a proč.
- **Po každém kroku** se zeptej, jestli to fungovalo, než pokračuješ.
- **U rozhodnutí** navrhni řešení a stručně obhaj — pomůže to obhájit i v README/prezentaci.
- **Pokud dostaneš rozporuplnou instrukci**, řekni že to neladí a poraď.
- **Frame koncepty** přes vizuální/designerské analogie, ne přes backendové abstrakce.
- **Vědomá zjednodušení** zapisuj do `docs/decisions.md`.
- **Po každém větším milestonu** commit + push, conventional commits (`feat:` / `fix:` / `chore:` / `docs:`).
- **Conventional commits** s `Co-Authored-By: Claude` footerem (AI disclosure transparency).

## 3. Handoff (2026-05-20)

### Kontext

Středně velký kadeřnický salon přerůstá papírový diář. Tým: majitelka, 4 kadeřníci (mistrová s 15 lety praxe, dvě střední, junior), recepční na částečný úvazek. ~10 služeb, délka 20 min až 2,5 h, kombinace služeb jako jedna návštěva. Cena se liší podle kadeřníka. Různé pracovní doby.

**Bolesti:** nezvednutý telefon, dvojité zápisy, manuální počítání kapacit, neviditelnost volných kolegyň, no-show klienti, žádný real-time přehled tržeb.

**Cíl:** webová aplikace se dvěma rozhraními:
1. Veřejná rezervační stránka (mobile-first, host bez loginu)
2. Interní administrace (3 role: `owner` / `receptionist` / `stylist`)

**Stack předepsaný zadáním:** Firebase backend, frontend libovolný.

**Originální PDF zadání:** `D:\zadani\case-study-hairsalon.pdf` (mimo repo).

**Inspirace (architektonické vzory, NE kód):** `https://github.com/radek-zitek-cloud/salon-rezervace`.

### Časový rámec

**6 dní intenzivní práce** (cca 50–60 hodin). Žádné polotovary — co je v repu, je hotové a obhajitelné.

### Stack (finální)

- **Frontend:** Vite + React 19 + TypeScript + Tailwind 4 + react-router-dom v7. Bez shadcn — čistý Tailwind. Mobile-first.
- **Backend:** Firebase Auth + Firestore + Cloud Functions Gen2 + Hosting. Region `europe-west3`.
- **Lokál:** `docker-compose.yml` s Firebase emulators + Vite dev server. Prereq Docker Desktop.
- **Deploy:** Firebase Hosting production. Žádný staging.
- **Monorepo:** npm workspaces. Root `package.json` orchestruje `web/` a `functions/`.

### Datový model (Firestore)

```
services/{id}              — name, category, durationMinutes, basePrice, lengthVariants?
stylists/{id}              — name, level, bio, photoUrl, serviceIds, weeklyHours, priceOverrides?
absences/{id}              — stylistId, startAt, endAt, reason
bookings/{id}              — PUBLIC READ (no PII): stylistId, serviceIds, startAt, endAt, status, totalPrice, ...
bookingCustomers/{id}      — STAFF-ONLY (PII): name, phone, email, cancelToken
customerProfiles/{phoneHash} — STAFF-ONLY: phoneHash, bookingHistory, noShowCount, lastVisitAt, isFlaggedNoShow
users/{uid}                — email, role, linkedStylistId?
salonSettings/main         — PUBLIC READ pro IBAN, OWNER WRITE
notifications/{id}         — STAFF-ONLY: mock log
```

### 3 role (vynucené na 3 úrovních)

- **owner**: vidí všechno
- **receptionist**: rozvrh + rezervace + walk-in + klienti, BEZ přehledů a CRUD personálu/služeb
- **stylist**: jen vlastní rozvrh + rezervace + KPI

Vynucení: (1) navigation filter v `AdminLayout`, (2) Firestore Security Rules (`stylistOwnsBooking()`), (3) Route guards `<OwnerOnly>` / `<StaffOnly>`.

### 17 předpokladů

Viz `README.md` sekce 6.

### Algoritmus volných slotů

Pure function v `web/src/domain/availability.ts`. Detail viz `README.md` sekce 2 (po Day 6) nebo `docs/decisions.md`. Klíčové: anyone-mode = fan-out přes všechny stylisty s plnou kvalifikací.

### Plný scope (22 položek + 3 Day 6 nadstavby)

1. Veřejná rezervace 4 kroky 2. Anyone-mode 3. Admin login 3 role 4. /admin/rozvrh denní 5. /admin/rezervace 6. Walk-in dialog (4 vstupy) 7. /admin/sluzby CRUD (owner) 8. /admin/personal CRUD+hours+absence 9. /admin/prehledy per-role 10. /admin/klienti CRM 11. Customer lookup + „rezervovat znovu" 12. Magic-link /r/:token 13. PII split 14. priceOverrides + lengthVariants 15. SPAYD QR 16. Mock notifications 17. 50+ unit testů 18. Seed 19. docker-compose 20. Production deploy 21. README 13 sekcí 22. Feedback PR.

**Day 6 nadstavby:** marketing landing `/`, showcase PDF (business + IT), `docs/user-guide.md`.

**Vědomě vynecháno:** E2E Playwright, reálné Resend/Twilio, staging, cancellation policy enforcement, audit log, App Check.

### Struktura repa

```
hair-salon-booking/
├── README.md, CLAUDE.md, docker-compose.yml
├── .firebaserc, firebase.json, firestore.rules, firestore.indexes.json
├── Dockerfile.emulator, package.json (npm workspaces)
├── functions/        ← Cloud Functions Gen2 TS
├── web/              ← Vite + React SPA
│   └── src/{domain,features/{landing,booking,admin},components,hooks,lib}
├── scripts/{seed.mjs, build-showcase.mjs}
└── docs/{feedback-pr.md, user-guide.md, showcase-business.md, showcase-it.md, decisions.md, LESSONS_LEARNED.md}
```

### Plán 6 dní

- **Day 1** (2026-05-20, hotovo): scaffold (Vite + Functions + emulators + docker), config, README skeleton.
- **Day 2 (next):**
  1. Třetí workspace `packages/shared/` (rozhodnuto Day 1, **D-012**) s 9 doménovými TypeScript interfaces: `Service`, `Stylist`, `Absence`, `Booking`, `BookingCustomer`, `CustomerProfile`, `User`, `SalonSettings`, `Notification`. Web i functions importují přes alias `@hsb/shared`.
  2. Firestore Timestamp ↔ JS Date helpery v `shared/firestore-helpers.ts` (server vs. client SDK mají subtle rozdíly v Timestamp typu — vyřešit jednou, sdílet všude).
  3. Cloud Functions plné: `createBooking` (transakční slot re-check, race-condition safe) + `manageBookingByToken` (constant-time cancelToken validace pro magic-link cancel).
  4. Firestore rules finální — odkomentovat helper funkce v `firestore.rules`, vyplnit `if false` placeholdery konkrétní auth/role logikou (PII split enforcement na úrovni rules).
  5. Seed plný — `scripts/seed.mjs` naplní 10 služeb, 5 stylistů, 3 ukázkové bookingy, 3 admin uživatele s rolemi.
  6. Auth setup — Firebase Auth Email/Password + custom claims pro role (`owner`/`receptionist`/`stylist`), tak aby Firestore rules mohly číst role bez extra dotazu.
- **Day 3:** veřejný booking flow + magic-link cancel + landing skeleton + pricing.ts s testy.
- **Day 4:** admin login + rozvrh + rezervace + walk-in + customer lookup.
- **Day 5:** owner: služby + personál + absence + přehledy + SPAYD + klienti CRM + landing polish + zbylé testy.
- **Day 6:** production deploy + README dotažený + feedback-pr.md + showcase PDF (2 verze) + user guide + final polish.

---

## 4. Decisions log

Pro plné obhajoby viz `docs/decisions.md`.

### Day 1 (2026-05-20)

- **D-001** Stack frontend = Vite + React 19 + TS + Tailwind 4 (NE Next.js)
- **D-002** Monorepo s npm workspaces (`web` + `functions`)
- **D-003** Tailwind 4 přes `@tailwindcss/vite` + `@import "tailwindcss"` v CSS
- **D-004** Žádný shadcn/ui — čistý Tailwind
- **D-005** Manuální Firebase scaffold místo `firebase init`
- **D-006** Firestore rules = deny-all skeleton se všemi 9 collections viditelnými
- **D-007** `firebase-tools` jako root devDep (NE globální install)
- **D-008** Docker compose s anonymními volumes pro `node_modules`
- **D-009** Pre-cache Firebase emulator JARs do Docker image
- **D-010** Cloud Functions runtime = Node 22, region `europe-west3`, maxInstances 10
- **D-011** ESM v Functions (`"type": "module"` + tsconfig `NodeNext`)

---

## 5. Známé limitace a aktuální stav

Developer-facing caveaty k *aktuálnímu* stavu rozpracovaného repa (ne durable
design rozhodnutí — ta jsou v `docs/decisions.md`; ne dlouhodobé limitace MVP —
ty půjdou do `README §6` na Day 6). Tahle sekce se mění, jak práce postupuje.

### Runtime smoke-test gap (Day 2 BLOK B)

**Stav:** Cloud Function `createBooking` (task #3) je ověřená přes `tsc` build
+ ESLint (oboje EXIT 0), ale **nikdy reálně neběžela**. `compiles ≠ runs`.

**Proč:** runtime smoke-test vyžaduje předpoklady, které jsou samy o sobě další
Day 2 tasky, zatím nehotové:
- **seed data** (`scripts/seed.mjs` — task #5/Day 2) pro `services` + `stylists`,
  bez kterých handler nemá co načíst,
- **Firestore emulator** běžící (přes `docker-compose`),
- **auth + rules** (Day 2 tasky) pro realistický happy/expectation path.

**Plán:** jakmile bude seed + emulátor, provést smoke-test **obou** booking
handlerů (`createBooking` + `manageBookingByToken`) najednou — happy path
(vznik rezervace + zápis 4 collections) i odmítavé cesty (obsazený slot →
`failed-precondition`, neexistující stylista → `not-found`).

**Pravidlo, které z toho plyne:** „build + lint zelené" hlásíme jako *staticky
ověřeno*, ne jako *funguje*. Runtime verifikace je samostatný, explicitně
trackovaný krok — nezaměňovat.
