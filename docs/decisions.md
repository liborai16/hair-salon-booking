# Decisions log

Per-decision motivace pro **každé větší architektonické nebo procesní rozhodnutí** v projektu. Cílem je, aby kdokoli (já za měsíc, hodnotitel, případný maintainer) viděl **proč** — ne jen co.

**Konvence zápisu:**
- Každý záznam má **datum**, **rozhodnutí (krátký název)**, **kontext**, **uvažované alternativy**, **proč jsme zvolili tuhle**, **trade-offs**.
- Když rozhodnutí později měníme, **zapíšeme nový záznam** (s odkazem na původní), nepřepisujeme starý.
- ID formát `D-NNN` v chronologickém pořadí.

---

## Day 1 — 2026-05-20

### D-001 — Stack frontend = Vite + React 19 + TS + Tailwind 4 (NE Next.js)

**Kontext:**
V přípravných sezeních jsme nejprve plánovali **Next.js 14 + App Router**. V průběhu Day 1 jsme po reanalýze finálního scope **pivotovali na Vite SPA**.

**Alternativy:**
1. **Next.js 14** — SSR, file-routing, SEO benefit.
2. **Vite SPA** (zvolené) — pure client-side, žádný SSR, rychlejší dev.
3. Remix — overhead pro náš případ, navíc právě teď v Remix → React Router v7 transici.

**Proč Vite:**
1. **Žádný SSR nepotřebujeme.** Veřejný booking flow je interaktivní (state-heavy: výběr služby → kadeřníka → termínu → kontakt → potvrzení). SSR by jen komplikoval state management.
2. **PII split a magic-link cancel** jsou čistě klientské + serverless toky. Next.js API routes vs. Cloud Functions = dvě cesty na backend, zbytečné kognitivní zatížení.
3. **Marketing landing není SEO-kritický** — case study není reálný byznys, hodnotitel netestuje SEO.
4. **Vite build je rychlejší** a jednodušší pro Firebase Hosting — `npm run build` → `web/dist/` → static deploy bez serverové vrstvy.

**Trade-off:** Ztrácíme SSR benefit pro landing (slower first paint, žádné meta tags na serveru). Pro reálný produkt bych šel do Next.js. Pro case study je SPA dostatečné.

---

### D-002 — Monorepo s npm workspaces (`web/` + `functions/`)

**Kontext:**
Frontend (Vite SPA) a backend (Cloud Functions) jsou dvě separátní deployable units, ale sdílejí lifecycle a v budoucnu (Day 2+) i doménové typy.

**Alternativy:**
1. **Dva separátní repa** — čisté oddělení, ale duplikace lockfilů, deployment proces synchronizace, dvojí PR review.
2. **Monorepo bez workspaces** — společný git, ale dva `node_modules/`, dva lockfily.
3. **Monorepo s npm workspaces** (zvolené) — jediný `node_modules/` v rootu (hoisting), jediný `package-lock.json`.
4. **pnpm workspaces** — efektivnější disk, ale přidává tooling závislost (pnpm CLI).
5. **Turborepo / Nx** — caching/orchestration, ale overhead pro 2 workspaces.

**Proč npm workspaces:**
1. **Jediný `package-lock.json`** = deterministický build pro hodnotitele po `git clone && npm install`.
2. **Hoisting** snižuje disk footprint a urychluje `npm install`.
3. **Shared deps** (TypeScript, ESLint) instalovány jednou, sdílejí stejnou verzi.
4. **Volba pro budoucí `shared/` workspace** — třetí workspace pro doménové typy v Day 2, beze změny tooling.

**Trade-off:** Workspaces mají edge cases (peer deps, version conflicts), ale pro 2 workspaces a explicitní stack riziko minimální.

---

### D-003 — Tailwind 4 přes `@tailwindcss/vite` + `@import "tailwindcss"` (žádný `tailwind.config.js`)

**Kontext:**
Tailwind 4 (release 2025) zásadně přepracovala konfiguraci. Config je teď **v CSS**, ne v JS. Vite plugin (`@tailwindcss/vite`) integruje engine přímo do Vite buildu.

**Alternativy:**
1. **Tailwind 3** — známý, hodně tutoriálů, `tailwind.config.js` v JS.
2. **Tailwind 4 přes PostCSS plugin** — funguje, ale Vite plugin je oficiální cesta.
3. **Tailwind 4 přes `@tailwindcss/vite`** (zvolené) — minimum tooling, žádný JS config.

**Proč Tailwind 4 + Vite plugin:**
1. **Méně souborů, méně kontextu.** Design tokens (barvy, fonty, spacing) půjdou do `@theme { ... }` v CSS, vedle stylů.
2. **Oxide engine v Rust** je výrazně rychlejší než starý JS engine.
3. **DX pro designera:** vše vizuálně v jednom CSS souboru, ne v JSON-like JS objektu.
4. **Future-proof:** Tailwind 4 je směr týmu, nový kód se na ní bude psát.

**Trade-off:** Méně tutoriálů online (TW4 je nový), pár community pluginů ještě nemigrovalo. Pro náš zero-plugin use case OK.

---

### D-004 — Žádný shadcn/ui — čistý Tailwind

**Kontext:**
Standardní volba pro React + Tailwind projekt v 2026 je shadcn/ui (kopíruje high-quality komponenty do projektu, kde je upravuješ).

**Proč ne:**
1. **Uživatel je designér s vlastním vizuálním vkusem.** shadcn diktuje look (neutrální, americký SaaS); my chceme vlastní brand vibe.
2. **Komponenty, které potřebujeme** (Calendar, Dialog, Combobox), jsou jednoduché — vlastní implementace v Tailwind je rychlejší než přijetí shadcn idiomů + customizace.
3. **Hodnotitel pozná** vlastní design vs. „další shadcn projekt". V hireability světě je viditelný styl plus.

**Trade-off:** Víc kódu napsat, ale o tom case study je. Plus accessibility a fokus management musíme řešit sami (shadcn to dělá za nás přes Radix).

---

### D-005 — Manuální Firebase scaffold místo `firebase init`

**Kontext:**
Standardní cesta = `firebase init functions`, `firebase init firestore`, atd. — čtyři interaktivní příkazy.

**Důvody pro manuální cestu:**
1. **Bash automatizace má non-interaktivní omezení** — `firebase init` by se zasekl na první otázce.
2. **Edukačně lepší** — uživatel vidí každou volbu v `firebase.json` s komentářem proč.
3. **Žádné magic boilerplate** — `firebase init` generuje šablony, které pak nikdo nečte (a které neodrážejí naše decisions, např. `region` nebo `maxInstances`).
4. **Flexibilita** — můžeme rovnou nastavit Functions Gen2 + region + maxInstances bez post-init editů.

**Trade-off:** Musíme vědět, co píšeme. Plus risk, že něco zapomeneme (např. `firestore.indexes.json` mít, ale prázdné).

---

### D-006 — Firestore rules = deny-all skeleton se všemi 9 collections viditelnými

**Kontext:**
Day 1 nemá ještě auth flow, takže rules jsou jen placeholder. Otázka byla **co tam dát**.

**Alternativy:**
1. **Default `firebase init` rules:** `match /{document=**} { allow read, write: if false; }` — jeden řádek, nic neříká.
2. **Skeleton se všemi 9 collections** (zvolené) — secure-by-default + viditelný surface.
3. **Permissive Day 1** (`if true`) — rychlé prototyping, ale nikdy nesmí dorazit na produkci.

**Proč skeleton:**
1. **Visibility surface** — hodnotitel hned vidí, jaký data model plánujeme a s jakými právy.
2. **Less chance to forget** — Day 2 přijde, kostra je už tu, jen vyplníme `if false` → konkrétní pravidla.
3. **Komentáře v helper funkcích** (uvnitř souboru, zakomentované) ukazují Day 2 plan předem.

**Trade-off:** Víc kódu v souboru hned. Nikomu to neškodí.

---

### D-007 — `firebase-tools` jako root devDep (NE globální install)

**Kontext:**
Standard tutoriálů: `npm install -g firebase-tools`.

**Proč devDep:**
1. **Reprodukovatelnost.** Verze v `package-lock.json` = hodnotitel získá identickou Firebase CLI po `npm install`.
2. **Žádný globální systémový rošť** na uživatelově stroji.
3. **CI/CD** by stejně lokálně instalovalo, takže konzistence dev = CI.
4. **Žádný conflict** s případnou jinou globální verzí na uživatelově stroji.

**Trade-off:** `npx firebase ...` místo `firebase ...`. Drobnost.

---

### D-008 — Docker compose s anonymními volumes pro `node_modules`

**Kontext:**
Standard Docker compose bind-mountuje celý projekt do kontejneru. Problém: na Windows hostu `npm install` produkuje Windows-specific binárky (`esbuild`, `swc`, případně `sharp`), které v Linux kontejneru selžou.

**Řešení:**
Bind-mount celý repo **kromě** `node_modules` — anonymní volume přebije pro každý workspace:
```yaml
volumes:
  - .:/workspace
  - /workspace/node_modules
  - /workspace/web/node_modules
  - /workspace/functions/node_modules
```

Kontejner si při prvním startu udělá vlastní `npm install` pro Linux/glibc, který přetrvá v anonymous volume mezi `docker compose up/down` (dokud `docker compose down -v`).

**Trade-off:** První start je pomalejší (kontejner si musí udělat `npm install` = ~30–60 s), ale následující rychlé. Workaround standard v Node + Docker světě.

---

### D-009 — Pre-cache Firebase emulator JARs do Docker image

**Kontext:**
`firebase emulators:start` chce stáhnout `firestore-emulator-*.jar` + UI assets při prvním běhu — ~70 MB navíc na cold start (~30 sekund).

**Proč:**
Cold start by zdržoval každé `docker compose up` (pokud volume s cache nemáme, nebo ji uživatel `prune` smazal). Stahnu si JARy během `docker build` v `RUN firebase setup:emulators:firestore` + `firebase setup:emulators:ui`. První `docker compose up` po `docker compose build` startuje za sekundy.

**Trade-off:** Build image trvá déle (~2 min), image je větší (~100 MB extra). Akceptovatelné pro local-only — production nedeployujeme custom image.

---

### D-010 — Cloud Functions runtime = Node 22, region `europe-west3`, maxInstances 10

**Runtime 22:**
Latest LTS, který Firebase Functions Gen2 podporuje (k 2026-05). Node 24 zatím není v Gen2 runtime.

**Region `europe-west3` (Frankfurt):**
Nejnižší latence pro klienty v ČR (Frankfurt → Praha ~40 ms). GDPR-friendly (EU data residency). Salon je v ČR, klienti taky, žádné multi-region overhead.

**maxInstances 10:**
Defenzivní cap proti runaway cost. Reálný salon nemá 10 paralelních rezervací — 10 je dostatečné s rezervou. Pokud někdo zneužije veřejný `createBooking` endpoint a pošle 1 000 req/s, dostane 429 místo Firebase faktury za $300.

---

### D-011 — ESM v Functions (`"type": "module"` + tsconfig `NodeNext`)

**Kontext:**
Cloud Functions historicky byly CommonJS. Gen2 + Node 22 ale nativně podporují ESM.

**Proč ESM:**
1. **Čistší importy** (`import { x } from './y.js'` místo `const { x } = require('./y')`).
2. **Lepší tree-shaking** i v server kontextu (Gen2 build dělá dependency analysis).
3. **Konzistence s `web/`** (Vite je ESM-only).
4. **Future-proof** — Node ekosystém masivně migruje na ESM.

**Trade-off:** Cesty v importech musí mít `.js` extension i pro `.ts` zdroj (NodeNext quirk). Snadno se na to zapomíná; ESLint plugin `eslint-plugin-import` to chytá.

---

### D-012 — Sdílené doménové typy přes třetí workspace `packages/shared/` (NE duplikace, NE path-based)

**Kontext:**
`web/` (Vite SPA) i `functions/` (Cloud Functions) potřebují **stejné TypeScript interfaces** pro Firestore document shapes — celkem **9 entit**: `Service`, `Stylist`, `Absence`, `Booking`, `BookingCustomer`, `CustomerProfile`, `User`, `SalonSettings`, `Notification`. Tohle rozhodnutí padlo na konci Day 1 jako příprava pro Day 2 ráno, kdy budeme typy psát.

**Alternativy:**
1. **A — Třetí npm workspace `packages/shared/`** (zvolené). `packages/shared/src/types.ts` definuje vše, oba workspaces importují přes alias `@hsb/shared`. Single source of truth.
2. **B — Duplicitní soubor** v obou workspacích (`web/src/lib/types.ts` + `functions/src/types.ts`), identický obsah, ruční synchronizace.
3. **C — Path-based import** přes relativní cestu (`functions/src/handlers/x.ts` → `import { Booking } from "../../../web/src/lib/types.js"`). Funkce by znala interní strukturu webu.

**Proč A:**
1. **DRY garantována.** Jediná definice = žádný drift. Změna shape (nové pole na `Booking`) se automaticky propíše. B vyžaduje manuální sync (riziko, že někdo zapomene), C vyžaduje hluboké relativní cesty.
2. **Architektonická čistota.** `shared/` je **vrstva nad** oběma workspacy. Web ani functions o sobě navzájem nevědí, oba znají jen `shared/`. Vztahy typu C porušují modularitu — funkce by neměly vědět, kde web ukládá své knihovny.
3. **Signál pro hodnotitele.** Třetí workspace explicitně ukazuje, že **přemýšlím o ownership a vrstvení**, ne že jsem typy nejdřív duplikoval a pak refaktoroval pod tlakem.
4. **Setup cena malá.** Jeden `packages/shared/package.json`, jeden `tsconfig.json`, jeden řádek v root `workspaces` array. ~5 minut. Vyplatí se při prvním shared importu.
5. **Compose-friendly.** `shared/` nemá runtime deps, jen TypeScript zdrojáky. `npm install` ho hoistne stejně jako jiné dev deps, žádný extra prostor v Docker image. Žádný build step v MVP (TS resolution dělá importující workspace).

**Trade-off:**

1. **Source-only s direct `.ts` import: zvážen, ale zamítnut.** Naivní řešení by bylo nechat `shared/` jako pure TypeScript zdroj (`main: ./src/index.ts`). Vite (web) by to bez problému vyřešil díky internímu TS resolveru. **Ale Cloud Functions runtime nemá TS support** — Firebase deploy by uploadnul `.ts` soubory a Node runtime v cloudu by spadl při prvním `import` (buď `Cannot find module @hsb/shared`, nebo `Unexpected token` z parseru). Projevilo by se to až Day 6 při production deploy, kdy je pozdě cokoli architektonicky předělávat. Lepší přijmout build step v Day 2 než hasit v poslední den.

2. **Zvolené řešení: build step `tsc` → `dist/` + `tsc --watch` v dev módu.** `shared/package.json#exports` ukazuje na `dist/index.js` (runtime) + `dist/index.d.ts` (types). Web (Vite) i functions (tsc) consumeři dostanou hotový JS přes standardní Node resolution.

3. **DX cena: 2 terminály v dev** — jeden s `tsc --watch` v `packages/shared/` (rekompiluje shared při každé změně typů), druhý s `docker compose up` (Vite + Firebase emulátory). Toto je **standardní monorepo workflow** (Lerna, Nx, Turborepo dělají totéž), ne specifická bolest našeho projektu. README sekce 3 to explicitně uvede.

4. **Trojhlavá monorepo struktura** = nenulový cognitive overhead pro nového čtenáře. Mitigace: README sekce 2 (architektura) tu rozdělení popíše.

5. **Mitigace 2 terminálů (volitelná, Day 5/6):** přidat `concurrently` nebo `npm-run-all` jako root devDep a vystavit `npm run dev:all`, který spojí oba procesy do jednoho výstupu. Pro Day 2 zatím odložené — chceme nejdřív base workflow stabilní.

**Implementační kroky (Day 2 ráno):**
1. Scaffold `packages/shared/{package.json, tsconfig.json, src/types.ts, src/firestore-helpers.ts}`.
2. Přidat `"packages/shared"` do root `workspaces` array.
3. Importní alias `@hsb/shared` přes `package.json#name` (preferovaně) — TS resolver to zvládne sám díky NodeNext modulu.
4. Migrovat `functions/src/index.ts` na importy z `@hsb/shared` (až budou existovat handlery).
5. Verifikovat během `npm run build` ve `web/` i ve `functions/`.

---

### D-013 — Firestore `Timestamp` vs JS `Date` v shared typech: `Date` + helpers na boundary

**Kontext:**
`packages/shared/src/types.ts` definuje 9 doménových interfaces, z nichž téměř všechny obsahují časová pole (`startAt`, `endAt`, `createdAt`, `updatedAt`, `lastVisitAt`, `lastNoShowAt`, `sentAt`). Otázka: jaký TypeScript typ pro tyto fields?

Komplikace: Firestore má vlastní `Timestamp` typ, ale **různý mezi server a client SDK** (`firebase-admin/firestore` vs. `firebase/firestore`). Strukturálně podobné, ale TypeScript je nevidí jako kompatibilní třídy.

**Alternativy:**

1. **A — Custom strukturální typ `FirestoreTimestamp`** s `seconds`, `nanoseconds`, `toDate()`, `toMillis()`. Matchne oba SDK díky structural typing. Hack-ish, mate čtenáře, doménový kód musí psát `dt.toDate()` všude.

2. **B — `Date` v shared typech, konverze přes `firestore-helpers.ts` na hranici** (zvolené). Helpers `fromFirestore(snapshot)` a `toFirestore(obj)` mapují `Timestamp ↔ Date` na boundary mezi SDK a doménovou vrstvou.

3. **C — Generic parameter:** `interface Booking<TS = Date> { startAt: TS; ... }`. Flexibilní, ale verbose a každý consumer musí specifikovat typ.

**Proč B:**

1. **SDK-agnostická doménová vrstva.** Kdybychom někdy přesedlali na PostgreSQL, Supabase, Drizzle ORM, doménový kód (`availability.ts`, `pricing.ts`, `reports.ts`) zůstane beze změny — jen `firestore-helpers.ts` se přepíše. Toto je **hexagonální architektura** (Ports & Adapters), kde `shared/` je core a SDK je adapter.

2. **`Date` je JS standard.** `dateA.getTime() - dateB.getTime()`, `new Date(2026, 0, 1)`, `Intl.DateTimeFormat`, `date-fns` — všechno přirozeně pracuje s `Date`. Domain code pak vypadá idiomaticky, ne jako Firestore-specific syntax.

3. **Explicit boundary pattern signaluje seniority.** Hodnotitel uvidí `fromFirestore(snapshot)` v `web/src/lib/firestore.ts` a `toFirestore(booking)` v Cloud Function, pozná pattern okamžitě.

4. **TypeScript chytá kontaminace.** Pokud někdo zapomene konvertovat a předá raw `snapshot.data()` (s Timestamp poli) do funkce očekávající Booking (s Date poli), kompilátor hlásí chybu. Bez B by chyba byla runtime-only.

5. **Vyhneme se `instanceof` trapům.** Když shared type říká `Timestamp` z jednoho SDK, ale runtime to je `Timestamp` z druhého, `instanceof Timestamp` selže. S `Date` je `instanceof Date` univerzální.

**Trade-off:**

- **Cena: vždy konvertuj na hranici.** Nelze předat raw Firestore data do doménového kódu bez `fromFirestore`. **To je plus**, ne minus — odhalí to fakt, že DB readu nelze 100% věřit (data může mít legacy shape, missing fields atd.).
- **`firestore-helpers.ts` přidává soubor k údržbě.** Akceptovatelné — pravděpodobně 50–100 řádků utility kódu, dvě klíčové funkce + type guards.
- **Helpers musí duck-typeem detekovat oba SDK Timestamp typy** (`'seconds' in v && 'nanoseconds' in v`). Drobná implementační složitost, izolovaná v jednom souboru.

**Implementace v Day 2 ráno (po types.ts):**

Plánovaný `firestore-helpers.ts` poskytuje:
1. `fromFirestore<T>(snapshot, deserializer)` — generic helper, vrací typed objekt s `Date`.
2. `toFirestore<T>(obj, serializer)` — opačný směr, vrací plain object s `Timestamp` pro Firestore.
3. `tsToDate(ts)` — utility pro `Timestamp → Date` (handles both server + client SDK).
4. `dateToTs(date)` — utility pro `Date → Timestamp` (uses admin SDK if available, fallback client).
5. Type guards: `isFirestoreTimestamp(v)`, `isDate(v)`.

---

## Day 2 — 2026-05-20

### D-014 — Pricing & duration logika v `@hsb/shared` (pure functions); server je autorita ceny

**Kontext:**
`createBooking` (Cloud Function, Day 2) zapisuje `bookings/{id}.totalPrice` a
`endAt`. Obojí **nesmí přijít od klienta**: kdyby klient posílal cenu, POST-nul by
`totalPrice: 1` a objednal barvení za korunu; kdyby posílal `endAt`, zkrátil by
si dobu a obsadil slot, který reálně přetéká do cizí rezervace. Server proto cenu
i délku **přepočítá sám** z autoritativních dat (`services`, `stylists`) uvnitř
transakce.

Současně web (booking flow, Day 3) potřebuje **týž výpočet** pro živý náhled ceny
a času, než klient potvrdí — jinak by odhad na webu neseděl s finální částkou.

Otázka: kam tu čistou logiku umístit, aby ji functions (autoritativně) i web
(náhled) sdílely bez duplikace?

**Alternativy:**
1. **A — Lokálně ve `functions/src/domain/`.** Web by si Day 3 udělal vlastní kopii.
   Drift: dvě implementace téhož pricingu se časem rozejdou (jeden přidá sezónní
   akci, druhý ne) → odhad na webu začne lhát oproti účtence ze serveru.
2. **B — Inline přímo v `createBooking`.** Nejde testovat izolovaně a web nemá co
   importovat pro náhled — takže by stejně vznikla druhá implementace (= problém A).
3. **C — Pure functions v `@hsb/shared`** (zvolené). Jedna definice, functions i web
   importují přes `@hsb/shared`.

Uvnitř C jsme rozlišili dvě sub-varianty:
- **C1 (zvolené)** — pure functions + explicitní pravidlo „server je autorita".
- **C2 (future work)** — pricing jako *data* v `salonSettings`, majitelka mění ceny
  bez deploye (viz Future work).

**Proč C / C1:**
1. **Žádný drift.** Multiplikátory (`LEVEL_MULTIPLIER`) a faktory délky existují
   na jednom místě; změna se propíše do serveru i náhledu zároveň. A i B mají dvě
   kopie, které se rozejdou.
2. **Navazuje na D-013.** D-013 zavedl `shared/` jako SDK-agnostický core
   (žádný `firebase-admin` ani `firebase` import). `pricing.ts` je pure (žádné I/O,
   žádný `Date.now()`), takže do téhle vrstvy patří — pricing je doménové pravidlo,
   ne infrastruktura.
3. **Testovatelnost.** Pure funkce bez Firestore lze pokrýt unit testy bez emulátoru
   (plánováno Day 5, scope item 17).
4. **Pravidlo autority je součást rozhodnutí, ne detail.** Server vždy přepočítá
   z Firestore; klient cenu nikdy nediktuje. Sdílený kód totiž svádí k úvaze „klient
   spočítal totéž co server, tak jeho ceně věřme" — to je bezpečnostní díra. Kód
   sdílíme proto, aby se *odhad shodoval s realitou* (UX), ne aby se klientův výsledek
   stal závazným. Runtime autorita zůstává na serveru.

**Defensive rounding (vzniklo při review tohoto commitu):**
První verze `computeServiceDuration` zaokrouhlovala na 15 min i krátké vlasy. To
zavádělo skrytý předpoklad „všechny délky v seedu jsou násobky 15". Scénář, který
by ho porušil: salon přidá „Express barvu" s délkou 25 min → výpočet by ji tiše
nafoukl na 30. Oprava: pro `factor === 1.0` (short, fallback) vracíme **původně
zadanou hodnotu beze změny**; zaokrouhlujeme nahoru jen *dopočítané* medium/long. Důsledek
rozhodnutí: vynucování 15-min gridu patří do slot algoritmu (Day 3 `availability.ts`),
ne do výpočtu délky — služba reálně trvá 25 min a slot algoritmus s tím musí umět
pracovat (ne-`barveni` služby vracejí raw délku tak jako tak). Tahle separace je
zaznamenaná přímo v komentáři kódu jako forward reference na Day 3.

**Trade-off:**
- **Cena:** ~20 min předtažení kousku Day 3 (pure pricing) do Day 2. Web na Day 3
  logiku už jen zkonzumuje a obalí UI.
- **Benefit:** nulový drift mezi serverem a náhledem, konzistence vrstvení s D-013.

**Future work** (→ README §8 „Co bych v produkci udělal jinak"):
- **Pricing jako data v `salonSettings`** (varianta C2) — majitelka edituje ceny,
  multiplikátory i akce přes admin UI bez deploye. V MVP je necháváme v kódu,
  protože pravidla jsou zatím stabilní a data-driven varianta přidává validační
  a migrační vrstvu nad rámec case study.
- **Per-service medium/long délky** místo jednotného faktoru `1.0 / 1.5 / 2.0` —
  reálné barvení neškáluje lineárně se stejným poměrem napříč službami.

**Souvislost — deploy:** jakmile `functions/` reálně importují `@hsb/shared` za
běhu (`toFirestore` + nově `pricing`), je třeba shared dostat do balíčku Cloud
Functions při deployi. To je samostatné rozhodnutí → **viz D-015** (esbuild
bundling, Task 4 Bloku B). V tomto commitu se neimplementuje.

---

*(D-015+ přibudou níže.)*
