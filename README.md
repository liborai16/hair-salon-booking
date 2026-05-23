# hair-salon-booking

Případová studie pro výběrové řízení — webová aplikace pro rezervační systém kadeřnického salonu.

**Stack:** Vite + React 19 + TypeScript + Tailwind 4 (frontend) · Firebase Auth + Firestore + Cloud Functions Gen2 + Hosting (backend, region `europe-west3`)

**URL nasazené aplikace:** *To be filled po Day 5+ deploy* — předpokládaný host `https://hair-salon-booking-cs-69a08.web.app` (Firebase Hosting default doména, project ID z `.firebaserc`).

> Pro detailní obhajobu každého architektonického rozhodnutí: [`docs/decisions.md`](docs/decisions.md) (D-001 → D-018). Pro lekce z vývoje: [`docs/LESSONS_LEARNED.md`](docs/LESSONS_LEARNED.md) (L-001 → L-010). Pro aktuální caveaty a debt: [`CLAUDE.md §5`](CLAUDE.md). Pro runtime validation playbook: [`docs/SMOKE_TEST.md`](docs/SMOKE_TEST.md).

---

## 1. Co to je

Středně velký kadeřnický salon přerůstá papírový diář — nezvednutý telefon, dvojité zápisy, manuální počítání kapacit, neviditelnost volných kolegyň, no-show klienti, žádný real-time přehled tržeb. Řešení je webová aplikace se dvěma rozhraními:

- **Veřejná rezervační stránka** — mobile-first, host bez loginu vybere služby (kombinace povolena), kadeřníka (nebo "kdokoliv" = anyone-mode fan-out přes všechny kvalifikované), termín z 14-denního horizontu, vyplní kontakt a potvrdí. Magic-link `/r/:token` umožňuje samostatné zrušení bez účtu.
- **Interní administrace** — 3 role (`owner` / `receptionist` / `stylist`) s claims-based autorizací. Recepční vidí denní rozvrh, zakládá walk-in rezervace, mění status (proběhlo / no-show / zrušeno). Majitelka navíc spravuje kadeřníky + služby. Stylista má omezený pohled (vlastní rozvrh).

---

## 2. Architektura

**Monorepo (npm workspaces):**

```
hair-salon-booking/
├── packages/shared/    — SDK-agnostic doménová vrstva (types + pricing
│                          + availability + customer-hash + Firestore helpers)
├── functions/          — Cloud Functions Gen2 (createBooking +
│                          manageBookingByToken), esbuild bundle pro deploy
├── web/                — Vite + React 19 SPA (public booking + admin UI)
├── scripts/            — seed.mjs pro emulator + budoucí utility
└── docs/               — decisions.md, LESSONS_LEARNED.md, SMOKE_TEST.md
```

**Klíčová architektonická rozhodnutí (zkráceno; plné rationale v `docs/decisions.md`):**

- **D-012/D-013 `@hsb/shared` jako SDK-agnostický doménový core** — typy + pure logika, ne importy firebase-* uvnitř. Cílem je, aby web (browser) + functions (Node) + scripts/seed sdíleli jeden zdroj domény bez platform-specific deps.
- **D-014 server jako autorita ceny + délky** — `createBooking` Cloud Function přepočítá `totalPrice` + `endAt` z autoritativních Firestore dat uvnitř transakce; klient hodnoty neposílá (zod `strictObject` je odmítne). Stejné `pricing.ts` funkce slouží na webu pro náhled.
- **D-015 esbuild bundle pro deploy** — `@hsb/shared` je workspace package (není na npm registry); esbuild inlinuje do `lib/index.js` při functions deploy. `@hsb/shared` zároveň hard-removed z `functions/package.json` deps (cloud `npm install` ho nikdy nehledá).
- **D-016 + D-018 single source of slot-validity truth** — `checkSlot` v `@hsb/shared` validuje (start, duration) proti working hours / absence / salon override / lead time / overlap. Volá ho UI client-side pro slot picker, i `createBooking` server-side před transakcí. Race-check overlap zůstává inside Firestore transakce (atomic re-check s txn-read bookings).
- **D-018 D6 timezone konverze přes `Intl.DateTimeFormat.formatToParts` + `Date.UTC` (zero-dep)** — `Europe/Prague` wall-clock ↔ UTC instant, DST-aware. Žádný luxon / date-fns-tz dependency v shared (per D-013 čistota). Empiricky ověřeno přes obě DST hrany 2026 (viz Day 5 regression anchor v `availability.test.ts`).
- **D-017 magic-link query-by-token (bearer capability)** — URL `/r/:token` nese jen 256-bit token; `manageBookingByToken` resolvuje přes indexed equality lookup. 256-bit entropie je obrana, ne `timingSafeEqual` (žádné secret-vs-input comparison v aplikačním kódu).
- **PII split (`bookings/{id}` vs `bookingCustomers/{bookingId}`)** — veřejně čitelný `bookings/` má jen anonymní pole (stylistId, serviceIds, startAt, endAt, status, totalPrice), PII (jméno, telefon, e-mail, cancelToken) žije v sourozenecké staff-only `bookingCustomers/` kolekci. Zaručuje, že public Firestore query (slot availability) nemá způsob exposnutí PII.
- **Claims-based Firestore rules** — `request.auth.token.role` + `linkedStylistId` čteno přímo z JWT (žádný `userDoc()` Firestore lookup per rule eval). Custom claims provisioned přes `setCustomUserClaims` v `seed.mjs` při setupu emulator accounts.

**Datový model (Firestore — 9 collections):**

| Collection | PII | Reader | Writer | Note |
|---|---|---|---|---|
| `services/{id}` | — | public | owner | 10 služeb v seedu |
| `stylists/{id}` | — | public | owner | 5 stylistů + capability + weeklyHours |
| `salonSettings/main` | — | public | owner | singleton; IBAN pro SPAYD QR + business-hours overrides |
| `bookings/{id}` | — | public | staff (delete: owner) | Anonymní (D-013 PII split); index `(stylistId, startAt)` pro slot query |
| `bookingCustomers/{bookingId}` | ✓ PII | staff | CF only | Jméno, phone, email, cancelToken |
| `customerProfiles/{phoneHash}` | ✓ PII | staff | CF only | Denormalizovaná historie + no-show counter (decay) |
| `absences/{id}` | — | staff | owner | Stylist dovolená/nemoc/školení; index `(stylistId, endAt)` |
| `users/{uid}` | — | self + owner | owner | uid = Firebase Auth UID (1:1) |
| `notifications/{id}` | (payload) | staff | CF only | Mock log e-mail/SMS dispatchu (`console_log` channel v MVP) |

**Frontend strukturu** (`web/src/`):

```
web/src/
├── App.tsx               — top-level router (BrowserRouter + Routes)
├── lib/firebase.ts       — Firebase init + emulator auto-switch (DEV mode)
├── lib/auth.tsx          — AuthProvider + useAuth hook + claims context
├── components/Layout.tsx — public shell (header + main + footer)
├── components/RequireAuth.tsx — protected-route + role gate
├── pages/Landing.tsx     — / public marketing
├── pages/BookingFlow.tsx — /book wrapper
├── pages/CancelPage.tsx  — /r/:token magic-link cancel
├── pages/admin/          — /admin/* (own AdminLayout)
│   ├── AdminApp.tsx      — nested admin Routes
│   ├── AdminLogin.tsx
│   ├── AdminLayout.tsx   — sidebar + Outlet + role-aware nav
│   ├── DailySchedule.tsx — timeline 8-20h × stylist columns + drawer
│   ├── AdminWalkIn.tsx   — wraps BookingShell with minLeadTime=0
│   ├── StylistsPage.tsx  — owner-only CRUD
│   └── ServicesPage.tsx  — owner-only CRUD
├── booking/              — wizard machinery (used by public + walk-in)
│   ├── BookingShell.tsx  — useReducer state machine, 4 steps + success
│   ├── state.ts          — BookingState + reducer
│   ├── useBookingData.ts — Firestore reads + createBookingCallable
│   └── steps/            — ServiceStep, SlotStep, CustomerStep, ConfirmStep, SuccessStep
└── admin/
    └── useDailyBookings.ts — schedule data + status transitions
```

---

## 3. Jak spustit lokálně

**Prerequisites:**
- Docker Desktop running
- Firebase CLI 15+ (`npm install -g firebase-tools` nebo `npx firebase`)
- Node 22+ (lokálně volitelné na Node 24; `EBADENGINE` warning je očekávaný — viz §9.2)
- Java 17+ (Firestore + Pub/Sub emulátory mají JRE dep)

**Setup sequence (3 paralelní terminály):**

```bash
# Root (jen jednou)
npm install

# T1 — Firebase emulátory
firebase emulators:start    # nebo: npm run emulators
# Wait for: "All emulators ready! It is now safe to connect."

# T2 — Seed dataset (po T1 ready)
npm run seed
# Wait for: "✅ Seed complete." + per-collection counts

# T3 — Vite dev server
cd web && npm run dev
# Open: http://localhost:5173
```

**Plus otevřít:**
- `http://localhost:5173` — aplikace
- `http://localhost:4000` — Firebase Emulator UI

**Verification:** [`docs/SMOKE_TEST.md`](docs/SMOKE_TEST.md) má 8-scénářový checklist (~30-60 min click-through) pro runtime validation full flow.

---

## 4. Nasazení

**Status:** *Production deploy plánován Day 5+. URL doplněno po deploy.*

**Deploy sequence (dokumentován pro budoucí execution):**

```bash
# 1. Composite indexes FIRST (D-018 integration spawned new index;
#    if functions deploy first, queries fail until index builds)
firebase deploy --only firestore:indexes
# Wait for index build complete (Firebase Console → Firestore → Indexes)

# 2. Rules (claims-based, A.2)
firebase deploy --only firestore:rules

# 3. Functions (D-015 esbuild bundle, --enable-source-maps follow-up)
firebase deploy --only functions

# 4. Web build + hosting
cd web && npm run build && cd ..
firebase deploy --only hosting
```

**Deploy follow-upy (CLAUDE.md §5 Day 6 deferred items):**
- `--enable-source-maps` runtime flag pro readable cloud stack traces (sourcemap je generován, ale Node SDK ho neaplikuje bez explicit flag).
- `$RESOURCE_DIR` Windows verify v `firebase.json` predeploy (untested; trivial fix: replace s `functions`).

Žádný staging environment — production deploy je single environment per scope vědomé zjednodušení.

---

## 5. Přihlašovací údaje (seedovaní admini)

Spuštění `npm run seed` (proti Firestore emulátoru) vytvoří 6 účtů + custom claims pro 3 role. **Heslo pro všechny: `Heslo123!`** (demo-only, emulator-isolated; produkční nasazení by vynutilo first-login change).

| E-mail | Role | Linked stylist | Note |
|---|---|---|---|
| `eva@salon.cz` | `owner` | `stl-eva-novakova` | Majitelka, taky stříhá (Mon-Fri 9-17) |
| `marie@salon.cz` | `stylist` | `stl-marie-krasna` | „Mistrová" 15y praxe (Tue-Sat 9-18, omits detsky) |
| `lenka@salon.cz` | `stylist` | `stl-lenka-svobodova` | Mid-level, ranní (Mon-Fri 8-16) |
| `petra@salon.cz` | `stylist` | `stl-petra-dvorakova` | Mid-level, odpolední (Tue-Sat 12-20) |
| `tereza@salon.cz` | `stylist` | `stl-tereza-mala` | Junior, odpoledne (Mon-Fri 13-19, omits complex barveni + svatebni) |
| `hana@salon.cz` | `receptionist` | — | Recepční (žádný stylist link) |

### Role matrix (Firestore rules)

| Collection | Public read | Staff read | Owner write | Staff write | Note |
|---|---|---|---|---|---|
| `services` | ✓ | ✓ | ✓ | — | Booking flow needs service list |
| `stylists` | ✓ | ✓ | ✓ | — | Booking flow displays team |
| `salonSettings/main` | ✓ | ✓ | ✓ | — | IBAN for SPAYD QR; hours public |
| `bookings` | ✓ (no PII per D-013) | ✓ | ✓ delete only | ✓ create/update | Owner-only hard-delete (safety net) |
| `bookingCustomers` | — | ✓ | — | — | PII; CF-only write (via createBooking) |
| `customerProfiles` | — | ✓ | — | — | Aggregated PII; CF-only write |
| `absences` | — | ✓ | ✓ | — | Stylist schedule, owner manages |
| `users` | — | self-read | ✓ | — | Self-read of own profile + owner CRUD |
| `notifications` | — | ✓ | — | — | Mock log, CF-only write |

Custom claims (set by `seedUsersAndAuth` in `scripts/seed.mjs` via Admin SDK): `{ role: 'owner' | 'receptionist' | 'stylist', linkedStylistId?: string }`. Rules read claims directly from JWT (`request.auth.token.role`) — zero Firestore lookups per rule eval. See `firestore.rules` for full helper definitions.

---

## 6. Předpoklady

Zadání bylo úmyslně neúplné. Tady je každý předpoklad, který jsem si musel udělat, s **obhajobou**:

1. **Klient se nepřihlašuje, rezervuje jako host.** Identifikace přes **hashovaný telefon** (`phoneHash`). Důvod: PII split — telefon v plaintextu žije jen v `bookingCustomers/` (STAFF-ONLY), hash v `customerProfiles/{phoneHash}` umožňuje no-show lookup bez expozice PII.

2. **Časová zóna salonu = `Europe/Prague`, hardcoded.** Důvod: salon je v ČR, žádné multi-region. Zjednodušuje slot algoritmus (žádný DST drama mimo CZ). TZ helper však bere `tz` jako parametr — future multi-salon by fungoval bez změny `@hsb/shared`.

3. **Granularita rezervací = 15 minut.** Důvod: standard v kadeřnické branži. Kompromis mezi UX (nepřeplněný picker) a flexibilitou (sloty zapadnou do reálných služeb 20–150 minut). Délka služby ale může být off-grid (25-min „Express barva" v seedu) — grid je pro START times, ne pro durations.

4. **Cenové hladiny `junior` (-20 %) / `standard` (0 %) / `senior` (+30 %) jako multiplikátory; `priceOverrides` per kadeřník má precedenci.** Důvod: ceník v zadání není jednoduchý (mistrová má jiné ceny než junior), ale plná matice cena×služba×kadeřník je overkill. Hladiny pokrývají 95 % případů, override řeší zbytek (např. Marie melir-balayage 2800 Kč flat).

5. **`lengthVariants` (short/medium/long) jen pro `category: 'barveni'`.** Důvod: zadání explicitně říká „barvení se může lišit podle délky vlasů, do systému to nemusí jít" — my to ale **chceme**, protože je to klíčové pro veřejnou cenu. Ostatní kategorie (střih, foukaná, …) na délku necitlivé.

6. **Klient může sám zrušit přes magic-link `/r/:token`** (Cloud Function `manageBookingByToken` validuje query-by-token bearer capability — D-017). E-mail s linkem mockovaný do `notifications/` kolekce, log do konzole. Důvod: zadání povoluje mock; magic-link je standard pro guest cancel flow bez accountu.

7. **Cancellation policy se v MVP NEenforcuje.** Klient může zrušit i 1 minutu před termínem. Důvod: enforcement = political/business decision, ne tech rozhodnutí. Sekce §8 popisuje, jak by se v produkci nasadila (cutoff window, no-show counter increment).

8. **Dovolené / školení / nemoc kadeřníka přes `absences/` kolekci** (`stylistId, startAt, endAt, reason`). Důvod: explicitní entita = jasná auditovatelnost. Slot algoritmus filtruje absences úplně stejně jako bookings (D-018 reuse `overlaps()`).

9. **No-show tracking přes `customerProfiles.noShowCount` (decay-aware threshold) + visual flag v admin UI.** Decay = no-show z roku 2024 váží méně než no-show z minulého měsíce. Důvod: striktní blacklist je nespravedlivý (lidé mění životní okolnosti); decay je férový. V MVP jen vizuální flag (jeden seeded flagged customer), žádný auto-block; decay formula implementace deferred (viz §7).

10. **Buffer mezi rezervacemi = 0 minut, započten v `service.durationMinutes`.** Důvod: zjednodušení slot algoritmu. Kdyby budoucí konfigurace chtěla bufferů, přidá se atribut `bufferMinutes` na `service` nebo `salonSettings` (single source of truth).

11. **3 role v adminu** (`owner`, `receptionist`, `stylist`), vynucené na 3 úrovních: navigation filter (UX), Route guards (`<RequireAuth requireRole="owner">`), Firestore rules (`isOwner()` / `isStaff()`). Důvod: defense in depth — pokud jedna vrstva selže, další to chytnou. Rules jsou autoritativní (admin SDK je obchází, klient ne).

12. **E-mail notifikace MOCKOVANÉ** — log do `notifications/` kolekce + `console.log` v Cloud Function. **V produkci:** Resend.com (developer-friendly, jednoduché API, GDPR-friendly EU hosting). Důvod: zadání povoluje mock; Resend je mainstream v 2026 pro transakční e-mail s EU residency.

13. **SMS notifikace NEDODÁVÁME** (ani v MVP, ani jako fallback). **V produkci:** Twilio nebo SMSbrana.cz. Důvod: scope cut — SMS by zdvojily mockované komunikační vrstvy bez přidané hodnoty pro hodnotitele. §10 popisuje produkční variantu.

14. **Race condition při souběžné rezervaci řešena `createBooking` Cloud Function**, která v jediné Firestore transakci re-checkne dostupnost slotu před commitem. Důvod: bez serverové validace by dva paralelní klienti mohli rezervovat stejný slot — UI logika není zdroj pravdy.

15. **Měna `CZK`, formát času `24h`, formát data `DD.MM.YYYY`.** Důvod: salon je v ČR, single-locale. Zjednodušuje formátovací helpery (jeden Intl locale `cs-CZ`).

16. **SPAYD QR pro platby** s editovatelným IBAN salonu v `salonSettings`. SPAYD generuje lokálně klient (žádné externí API). Důvod: SPAYD je český standard, klienti ho otevřou v bankovní appce a zaplatí jedním klikem. *(IBAN field implementován, SPAYD QR generování ve veřejném success page deferred Day 6 polish.)*

17. **Cloud Functions runtime = Node 22**, lokálně máme Node 24. Firebase Functions Gen2 zatím nepodporuje Node 24, tj. v cloudu funkce poběží na 22. Pro vývoj na Node 24 to vadí jen tehdy, kdyby se používala 24-specific API (nepoužíváme). `EBADENGINE` warning od npm je očekávaný (viz §9.2).

18. **Admin walk-in přeskakuje lead-time gate.** Recepční potřebuje rezervovat „za 5 minut" pro klienta, který právě dorazil. CF `createBooking` detekuje staff caller přes `request.auth.token.role` a nastaví `minLeadTimeMinutes = 0` (autoritativně server-side, klient hodnotu nediktuje). Plus stejné staff-bypass nastaví `Booking.source = 'admin'` pro audit původu.

19. **Time-of-day v slot algoritmu počítaná přes `Intl.DateTimeFormat.formatToParts`** (zero-dep), ne přes `toLocaleString` round-trip ani `luxon`. Důvod (D-018 D6): host-spec parsing risk + GDPR-friendly zero-deps + future browser/UI consumer (D-013 SDK-agnostic stance). Empiricky ověřeno přes obě DST hrany 2026.

---

## 7. Co bych dodělal, kdyby byl víc čas

V přibližném pořadí přínosu:

- **Functions test infrastructure** (vitest emulator integration) — shared workspace má 57 testů, functions test infra je deferred separate setup task. Manual smoke test (§3 → `docs/SMOKE_TEST.md`) zatím kryje funkční validation.
- **Real-time admin rozvrh** — onSnapshot listener místo one-shot reload, aby změny od jiného recepčního propagovaly bez ručního refreshu.
- **Phase 3.5 reports dashboard** — KPI cards (bookings tento týden, tržby per stylist, no-show rate). Vědomě deferováno z MVP — backend data jsou připravená, jen chybí UI agregace.
- **No-show decay formula implementation** — types.ts L341-349 popisuje vzorec `newCount = oldCount * exp(-daysSinceLastNoShow / 180) + 1`. V MVP `customerProfiles.noShowCount` se nepřepočítává automaticky (jen seed hardcoduje demo hodnotu). Cloud Function trigger na `bookings` write s `status: 'no_show'` by formula aplikoval.
- **Customer recognition** (D-018 future) — UI client-side `hashCustomerPhone(phone)` lookup v `customerProfiles/` při výplni booking formu = „už jste u nás byl, rezervovat stejné jako minule?" pattern z PDF zadání.
- **Code-splitting** — current JS bundle ~650kb (Firebase SDK dominantní). Lazy chunks pro admin UI by snížily initial load ~150kb pro veřejný flow.
- **Lunch break / split shifts** v `WeeklyHours` — current model má jeden `TimeRange`/den. Reálný salon má pauzu na oběd. Vyžaduje `TimeRange[]` + slot algoritmus iteruje multiple windows.
- **Buffer mezi rezervacemi** — current `overlaps()` je zero-gap. Buffer (úklid, příprava křesla) by byl parametr `checkSlot`, ne změna `overlaps()`.
- **Configurable slot granularity per salon** — current `SLOT_GRANULARITY_MIN = 15` v pricing.ts konstanta. Salon by mohl chtít 10-min.
- **Pre-computed daily availability cache** — pro MVP scale (5 stylistů × 4 týdny) zbytečné. Scale-driven refactor pro 100+ stylistů: cache invalidovaná na new booking / absence / override change.
- **Multi-stylist booking** — current `Booking.stylistId: string` (jeden). Kombinované služby (PDF: „barva + střih + foukaná") jsou u JEDNOHO stylisty; souběžná práce dvou stylistů out-of-scope.
- **Pravidelní klienti** „rezervovat stejné jako minule, za 6 týdnů" — silný UX candidate z PDF (telefon-based lookup + nabídka poslední rezervace).
- **E2E Playwright tests** — vítané ale zadání nevyžaduje.
- **Audit log** — kdo co kdy v adminu (status změny, CRUD operace).
- **App Check** — anti-bot pro veřejný booking endpoint.
- **Walk-in GDPR checkbox** — current admin flow vyžaduje checkbox (zděděné z public flow); recepční vyplňuje za klienta, kde verbální souhlas po telefonu je real-world authority. UX polish: admin context skipne checkbox + zaznamená „verbal consent".

---

## 8. Co bych v produkci udělal jinak

- **E-mail:** Resend.com místo `console_log` mock (§6 bod 12; §10 detail).
- **SMS:** Twilio nebo SMSbrana.cz (§6 bod 13; §10 detail).
- **Platby:** GoPay (CZ-first, Karta + bankovní převod přes Sazku / KB direct) nebo Stripe (international). Současný stav: jen IBAN + SPAYD QR display (vědomé MVP zjednodušení).
- **Cancellation policy enforcement:** cutoff window (např. ne <2h před termínem bez storno fee) + no-show counter increment trigger.
- **App Check + reCAPTCHA Enterprise** na veřejný `createBooking` callable — anti-spam + anti-bot.
- **Rate limiting** at Cloud Functions level (per IP + per phone hash) — protect against abuse.
- **Sentry error tracking + structured logging** — currently raw `console.warn` v defensive paths (`mapSlotReasonToError` instance v `createBooking.ts`).
- **CI/CD: GitHub Actions** na PR (lint + tsc + 57 unit tests) + auto-deploy preview channels per branch.
- **Staging environment** — dnes pouze production deploy, v reálném produktu by mezistupeň byl povinný.
- **Cloud Functions cold start tuning:** `minInstances: 1` pro `createBooking` (peak hour responsivity, ~$5/měsíc cost).
- **`--enable-source-maps` runtime flag** v Cloud Functions (sourcemap se balí už dnes přes esbuild D-015, jen runtime flag chybí).
- **D1-D5 architectural debt cleanup** (viz CLAUDE.md §5):
  - D1 dvě deserialization paths v functions (`fromFirestore` vs `convertTimestampsToDate`).
  - D2 `bookings: []` coupling konvence mezi createBooking integration a D-018.
  - D3 vestigial `from` / `to` v `SlotQuery` pro atomic `checkSlot`.
  - D4 defensive duplikace `not_qualified` + `in_past` mezi `prepareBooking` a `checkSlot`.
  - D5 `OCCUPYING_STATUSES` cross-module duplication (3 instances: functions + shared + web client).
- **BookingView typ lift** z `functions/src/handlers/manageBookingByToken.ts` → `@hsb/shared/callable-contracts.ts` — current web duplikuje pro typing.

---

## 9. Známé chyby a omezení

### 9.1 `npm audit`: low severity vulnerabilities

Po `npm install -D firebase-tools` hlásí npm několik nízkozávažných zranitelností. Vědomě s nimi žijeme, protože:

- **Všechny jsou transitivní deps Firebase ekosystému** — typicky stará verze `glob`, `uuid` v `firebase-tools` dependency tree.
- **Severity „low"** v praxi obvykle znamená RegExp DoS v parseru nebo prototype pollution v utility funkci, ke které z aplikačního kódu nepřistupujeme.
- **`npm audit fix --force`** by sice odstranilo warningy, ale **rozbilo by `firebase-tools`** (force pulle major bump verzí, které Firebase tým neotestoval).
- Firebase tým updatuje deps každý cyklus — vlastní zranitelnost není v našem kódu, je jen ve verzích, které Google ještě nepowershopnul.

**Akce v produkci:** sledovat `firebase-tools` releases, upgradovat každé 4–6 týdnů.

### 9.2 `EBADENGINE` warning u `functions` workspacu

`functions/package.json` má `"engines": { "node": "22" }` (Firebase Functions Gen2 cloud runtime). Lokálně Node 24 vyhodí warning. Žádná akce — warning je úmyslný (říká „cloud poběží na 22, nepoužívej 24-specific API").

### 9.3 Runtime smoke-test gap

Cloud Functions handlery (`createBooking` + `manageBookingByToken`) i `seed.mjs` + web flow jsou ověřené přes `tsc` + ESLint + 57 unit testů — **kompilační validation**. **Runtime end-to-end** je dokumentován v [`docs/SMOKE_TEST.md`](docs/SMOKE_TEST.md) jako manual playbook (8 scénářů); musí se provést lokálně proti Firebase emulátoru před production deploy. Pre-deploy automation (vitest + functions emulator integration) je deferred.

### 9.4 Architektonický debt D1-D5

Viz [`CLAUDE.md §5`](CLAUDE.md). Žádný blocker — všechno funguje. Cleanup candidates pro produkční verzi (viz §8).

### 9.5 JS bundle 650kb

Build warning „Some chunks are larger than 500kB after minification". Cause: Firebase SDK (~400kb) dominantní. Žádný code-split nakonfigurován. Code-split candidate pro Day 6 polish (viz §7).

### 9.6 Default Vite `<title>` v `web/index.html`

Drobnost — index.html title zůstal `Vite + React + TS` z Day 1 scaffold. Polish item.

### 9.7 Phase 3.5 reports — deferred

Admin sidebar má "Přehledy" link, ale stránka je placeholder. Backend data připravená (bookings + customerProfiles), UI agregace deferred.

---

## 10. Mock služby — co bych použil v produkci

| Mock (současný stav) | Production substitute | Důvod |
|---|---|---|
| **E-mail** (`notifications/{id}` doc + `console_log` channel) | **[Resend.com](https://resend.com)** | Developer-friendly API, EU-hosted (GDPR-compliant), generous free tier (3 000 e-mailů/měsíc), Czech locale support, transactional reputation. *(Pozn.: SendGrid je US-hosted via Twilio acquisition — méně vhodný pro CZ/EU GDPR strictness.)* |
| **SMS** (nedodáváme; production-only mention) | **[Twilio](https://twilio.com)** nebo **[SMSbrana.cz](https://smsbrana.cz)** | Twilio = světový standard, transparentní pricing, programmable response handling. SMSbrana = česká, levnější pro CZ čísla, českou podporu — primary candidate pro single-CZ-market salon. |
| **Platby** (jen IBAN + SPAYD QR display) | **[GoPay](https://gopay.cz)** (CZ-first) nebo **[Stripe](https://stripe.com)** | GoPay: nativní podpora české Karty + bankovní převod (Sazka, Komerční banka direct) + lokální compliance. Stripe: pokud salon plánuje turistickou klientelu / international cards. |

---

## 11. AI disclosure

Tato case study byla vyvíjena s aktivní pomocí Claude (Anthropic). **Architektonická rozhodnutí jsou má** (každé s plnou obhajobou v [`docs/decisions.md`](docs/decisions.md)); **kód byl psán ve dvojici** — proposal-audit cycle pro netriviální features (D-018 slot generator, createBooking handler, Firestore rules), shipper-mode pro mechanical UI work. Commit messages mají `Co-Authored-By: Claude` footer pro plnou disclosure transparency.

[`docs/LESSONS_LEARNED.md`](docs/LESSONS_LEARNED.md) zaznamenává 10 konkrétních incidentů z vývoje (L-001 → L-010) — od Windows path resolution v Git Bash až po empirical-first TZ debugging (L-009) a preflight discipline 7-instance recurring pattern (L-010). Tahle dokumentace je sama o sobě signál: vím, kde Claude pomohl, vím, kde jsem musel calibrated rebellion proti jeho návrhu (např. `userDoc()` lookup pattern v rules — zamítnut ve prospěch claims-based, viz commit `e5ed809`).

Při interview rád projdu kteroukoli část a obhájím, **proč** je tak, jak je.

---

## 12. Feedback PR „kdyby přišel feedback"

Plánovaný refaktor: **lift BookingView + ManageInput callable-contract types z `functions/src/handlers/manageBookingByToken.ts` do `@hsb/shared/callable-contracts.ts`**, plus stejně **OCCUPYING_STATUSES** ze 3 instancí (functions + shared + web) na jeden zdroj v `@hsb/shared`.

Důvod této volby (před ostatními debt-itemy v §8):
1. **Single source of contract** mezi server (functions) a client (web) eliminuje silent drift při budoucích API změnách.
2. **Konzistence s phoneHash D5 lift** (commit `5418ba7`) — stejný pattern (mechanical extraction pod test safety net) prokázal hodnotu single source.
3. **Low risk** — pure type/const motion, žádný behavioral change, ověřitelné přes 57 shared tests + tsc.

Detailní PR popis (kdyby se psal): viz `docs/PR_DRAFT.md` *(TBD — připravím v separate commit Day 5+).*

---

## 13. Audit vs. zadání

Checklist všech požadavků z [`D:\zadani\case-study-hairsalon.pdf`](file:///D:/zadani/case-study-hairsalon.pdf) (mimo repo per `feedback_repo_hygiene`):

| Požadavek | Stav | Odkaz |
|---|---|---|
| Veřejná rezervační stránka — mobile-first, host bez loginu | ✅ | `web/src/pages/BookingFlow.tsx` + booking shell |
| Klient se nepřihlašuje (jméno, telefon, e-mail) | ✅ | `CustomerStep.tsx` + GDPR consent |
| Kombinace služeb jako jedna návštěva | ✅ | multi-select v `ServiceStep`; `computeTotalDuration` sčítá |
| Cena podle kadeřníka (junior / mid / senior + override) | ✅ | D-014 `computeTotalPrice` + Marie melir-balayage priceOverride |
| Cena podle délky vlasů (jen barvení) | ✅ | `lengthVariants` v `Service` + ServiceStep UI selector |
| Pracovní doba per kadeřník | ✅ | `Stylist.weeklyHours` v admin CRUD; slot algoritmus filtruje |
| Dovolené / nemoc / školení | ✅ | `Absence` collection; slot algoritmus filtruje (D-018) |
| Interní administrace (3 role) | ✅ | `owner` / `receptionist` / `stylist` claims-based |
| Recepční vidí denní/týdenní rozvrh | ✅ denní | `DailySchedule.tsx` (week view deferred per §7) |
| Přidat rezervaci za telefonujícího klienta (walk-in) | ✅ | `AdminWalkIn.tsx` + CF staff-bypass lead-time (commit `5f78114`) |
| Upravit / zrušit existující rezervaci | ✅ | BookingDrawer status transitions (`cancelBooking` / `completeBooking` / `markNoShow`) |
| Po skončení návštěvy ji nějak označit | ✅ | „Označit jako proběhlo" + payment method (cash/card/transfer) |
| Majitelka: přehledy | ⚠️ | Sidebar link, page placeholder (Phase 3.5 deferred per §7) |
| Majitelka: správa kadeřníků | ✅ | `StylistsPage.tsx` (owner-only) |
| Majitelka: správa služeb | ✅ | `ServicesPage.tsx` (owner-only) |
| Backend Firebase | ✅ | Auth + Firestore + Functions Gen2 + Hosting (region europe-west3) |
| Frontend libovolný | ✅ | Vite + React 19 + TS + Tailwind 4 |
| Reálný hosting | ⚠️ | Deploy plánován Day 5+ (URL v §3) |
| `docker compose up` lokálně | ✅ | `docker-compose.yml` + Dockerfile.emulator |
| E-mail/SMS mock OK, README zmiňuje produkční volbu | ✅ | §6 bod 12-13 + §10 |
| SSO / OAuth nepovinné, basic e-mail+password OK | ✅ | Firebase Auth email+password |
| Žádná platební brána | ✅ | IBAN + SPAYD plan (§10) |
| README — architektura | ✅ | §2 |
| README — pokyny ke spuštění | ✅ | §3 |
| README — URL nasazení | ⚠️ | placeholder Day 5+ |
| README — předpoklady | ✅ | §6 (19 položek) |
| README — co by se dodělalo | ✅ | §7 |
| README — co jinak v produkci | ✅ | §8 |
| README — známé bugy | ✅ | §9 |
| README — admin credentials | ✅ | §5 |
| README — mock služby produkční varianta | ✅ | §10 |
| PR „feedback" — popis volby refaktoru | ✅ | §12 |

**Legend:** ✅ implementováno · ⚠️ deferred / placeholder s explicit důvodem · ❌ chybí
