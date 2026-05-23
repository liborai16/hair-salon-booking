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

### D-015 — Deploy `@hsb/shared` do Cloud Functions: esbuild bundle (inline) + hard-remove z manifestu

*(Founded Day 2 jako placeholder s D-014; finalizováno Day 3 — 2026-05-22, při
implementaci task #5 BLOK B. Princip „každý decision record jede se svou
implementací", viz L-007.)*

**Kontext:**
`functions/` reálně importují `@hsb/shared` za běhu (`toFirestore`, `pricing`,
`overlaps`, typy). V `functions/package.json` to bylo deklarováno jako
`"@hsb/shared": "*"`. Problém se projeví **až při `firebase deploy`**, ne
lokálně: Firebase zabalí **jen složku `functions/`** + její `package.json`,
nahraje to do Cloud Build a tam spustí `npm install`. Záznam `"@hsb/shared": "*"`
ukazuje na náš **privátní workspace balíček, který na npm registry neexistuje**
→ `npm install` skončí 404 → **deploy spadne**. Lokálně to nikdy nevybuchne,
protože tam `@hsb/shared` rezolvuje přes workspace symlink — který v cloudu není.

**Empirická zjištění (ověřeno před rozhodnutím, ne z paměti):**
1. `node_modules/@hsb/shared` je **symlink → `packages/shared`**, a sedí
   v **root** `node_modules`, ne ve `functions/node_modules`. npm ho vytváří
   kvůli `workspaces` poli v root `package.json`, **nezávisle** na tom, jestli
   ho `functions/package.json` deklaruje jako dependency. → Lze ho z functions
   manifestu odebrat, aniž se rozbije lokální resolution (jde přes hoisting).
2. `packages/shared/package.json`: `main`/`exports` → **`dist/`** (ne `src/`).
   Takže esbuild i `tsc` čtou shared z `packages/shared/dist/` → dist musí být
   postavený **před** functions buildem.
3. `functions/package.json` má `"type": "module"` → bundle musí být **ESM**.

**Alternativy (5 zvážených):**
1. **A — `file:../packages/shared`.** Firebase balí jen `functions/`;
   sourozenecká cesta `../packages/shared` se do balíčku nedostane → cloud
   `npm install` ji nenajde → spadne stejně. Zamítnuto.
2. **B — `npm pack` shared → `.tgz` uvnitř `functions/` + `file:./shared.tgz`.**
   Tarball by se nahrál a fungoval. Ale: ruční verzování, riziko **stale
   tarballu** (zapomenu přebalit po změně shared) a binární artefakt ve verzování.
   Zamítnuto ve prospěch single-step bundle.
3. **C — `bundledDependencies`.** Křehké v kombinaci s workspace symlinky;
   `npm pack` se symlinkovaným workspace dep produkuje nepředvídatelný výstup.
   Zamítnuto.
4. **D — Nechat `@hsb/shared` v manifestu + „strip" v `firebase.json` predeploy
   hooku.** Hook by za běhu deploye **mutoval verzovaný `functions/package.json`**
   (odebral záznam z toho, co se zabalí) a post-deploy ho vrátil. Zamítnuto:
   znamenalo by to, že **stav repa ≠ to, co se reálně nahraje** — přesně ten druh
   skryté divergence, co kousne za měsíc. Navíc mutace tracked souboru during
   deploy = špinavý git tree / race / křehký cleanup. Získali bychom jen
   „dokumentační" přítomnost shared v manifestu, kterou stejně nahradí komentář
   v esbuild configu + tenhle záznam. Imperativní mutace artefaktu prohrává nad
   deklarativním stavem.
5. **E — esbuild bundle (inline shared) + hard-remove z manifestu** (zvolené).
   esbuild „zalije" `@hsb/shared` přímo do výstupního `lib/index.js`; za běhu už
   není potřeba jako balíček. Z `functions/package.json` se `@hsb/shared`
   **úplně odebere**, takže cloud `npm install` ho nikdy nehledá.

**Proč E:**
1. **Jediný self-contained artefakt** + zachované source maps + tree-shaking.
   Žádné externí cesty, žádné tarbally, žádná deploy-time mutace.
2. **Hard-remove je robustní za všech okolností.** Spoléhat na „cloud neinstaluje
   `devDependencies"` by vázalo deploy na chování Cloud Build buildpacku, které
   **lokálně nedokážu ověřit** — a chyba by se projevila až při Day 6 deployi.
   Když záznam v manifestu **není vůbec**, cloud ho nikdy nezkusí, bez ohledu na
   dev/prod install chování. Deklarativní = stav repa je stav deploye.
3. **Nic neztrácíme na DX.** Lokální build (`tsc --noEmit` typecheck i esbuild
   emit) si shared najde přes workspace symlink (empirické zjištění #1).
4. **Bundle je bezpečný k inlinování** — `@hsb/shared` je SDK-agnostický pure kód
   (D-013), žádný `firebase-admin` uvnitř, žádné native závislosti.

**Konkrétní konfigurace bundlu (`functions/esbuild.config.mjs`):**
- **`format: 'esm'`** — protože `functions/package.json` má `"type": "module"`
  (empirické #3). Mismatch formátu vůči runtime resolveru = crash při importu.
- **`platform: 'node'`, `target: 'node22'`** — Gen2 cloud runtime (D-010).
- **`sourcemap: true`** (external `.js.map`, ne inline — menší runtime soubor,
  mapa oddělená). **Caveat (důležitý):** tenhle flag jen zajistí, že `.map`
  **existuje a balí se**. Node aplikuje source map na stack trace **jen
  s `--enable-source-maps`**, což **není default**. Bez něj cloud log ukáže
  pozice v bundlu bez remapování na `shared/src/`. → Aktivace runtime flagu
  (`--enable-source-maps` přes env / `NODE_OPTIONS` na Gen2 funkci) je
  **explicitní Day 6 deploy follow-up** (viz Future work + README §6) — na Day 3
  ji nelze ověřit (žádný deploy neběží), takže ji odkládáme s tvrdým záznamem,
  ne s falešným pocitem hotového. Mapa se balí už teď, takže aktivace na Day 6
  funguje retroaktivně.
- **`external`**: `firebase-admin` (+ `firebase-admin/*`), `firebase-functions`
  (+ `firebase-functions/*`), `zod`. Firebase SDK dodává cloud runtime a má
  native/dynamic require (špatně se bundluje); `zod` je běžný npm balíček, který
  cloud `npm install` doplní z `dependencies`. **Inlinuje se jen `@hsb/shared`.**
- **Resolution shared = `dist`** (empirické #2) → `firebase.json` predeploy staví
  `packages/shared` jako **první krok**, před lint + build functions.

**Build workflow:**
- `functions` build script: **`tsc --noEmit && node esbuild.config.mjs`**.
  `tsc --noEmit` drží typecheck záruku (strict, `noUnusedLocals`, NodeNext
  import correctness) bez emitu; esbuild dělá emit = bundle do `lib/index.js`.
- `firebase.json` predeploy: `[shared build, functions lint, functions build]`.

**Trade-offs:**
- **+** Jeden artefakt, menší deploy, source maps (po Day 6 aktivaci), tree-shaking.
- **−** Přidaná build závislost (esbuild) + dvoukrokový build (typecheck → emit).
- **−** `lib/index.js` je nově **bundle**, ne per-file `tsc` output. `build:watch`
  (`tsc --watch`) pro lokální iteraci dál emituje per-file (resolve přes symlink) —
  rozdílný tvar `lib/` podle posledního skriptu, ale `lib/` je gitignored a
  predeploy vždy přebundluje, takže deploy artefakt je deterministický.

**Důsledek (implementace task #5):**
- `functions/package.json`: `+esbuild` (devDep), **`-@hsb/shared`** (z deps úplně),
  build script → `tsc --noEmit && node esbuild.config.mjs`.
- Nový `functions/esbuild.config.mjs` (viz konfigurace výše, s komentářem proč
  hard-remove + co je external).
- `firebase.json` predeploy: shared build jako první krok.
- **Test bundlu** (povinný, ne „compiles"): postavit a ověřit, že (a) `lib/index.js`
  reálně obsahuje inlinovaný shared kód, (b) nikde v bundlu nezůstal bare import
  `from "@hsb/shared"`, (c) external importy (`firebase-*`, `zod`) v bundlu zůstaly.

**Known risk — `$RESOURCE_DIR` na Windows (deferováno, verify Day 6):**
Predeploy kroky `lint` a `build` functions používají Firebase CLI substituční
proměnnou `$RESOURCE_DIR`. Chování na Windows je k Day 3 **neověřené** (první
deploy je Day 6). Pokud expanze na Windows selže: triviální oprava — nahradit
2× `$RESOURCE_DIR` za `functions`. Verifikace při Day 6 prvním deployi.
Poznámka: krok shared-build schválně používá relativní `packages/shared`
(sémanticky **není** pod functions resource), takže je `$RESOURCE_DIR`-free
a vůči případnému problému imunní. Preempt-fix všech tří kroků teď zamítnut
jako scope creep (D-015 ≠ path refactor) — dokumentace > preempce.

**Future work** (→ README §6 / §8):
- **`--enable-source-maps` v runtime** — Day 6 deploy detail, aby cloud stack
  traces remapovaly na `shared/src/` (viz Caveat výše).
- **Per-handler bundle splitting** — teď bundlujeme jediný `index.js` entry. Při
  růstu počtu funkcí by per-function bundle zmenšil cold-start surface; pro 2
  funkce zbytečné (YAGNI).

---

### D-016 — Overlap utilita v `@hsb/shared` (pure `availability.ts`); příprava slot algoritmu

**Kontext:**
`createBooking` (Cloud Function, **Day 2 BLOK B — právě teď**, ne Day 3) musí
uvnitř Firestore transakce ověřit, že nově vznikající rezervace nekoliduje s žádnou
existující rezervací téhož stylisty (slot re-check, race-condition safe). K tomu
potřebuje primitivum „překrývají se dva časové intervaly?". Totéž primitivum bude
jádrem slot-availability algoritmu na **Day 3** (frontend booking flow), který
generuje volné sloty z `weeklyHours`, `absences`, business-hours override a
existujících rezervací. Otázka: kam ten overlap test umístit?

**Alternativy:**
1. **A — Inline v `createBooking`.** Netestovatelné izolovaně; Day-3 slot algoritmus
   by overlap definoval podruhé → riziko, že server a klient mají jinou představu
   o tom, co znamená „volno" (např. půlotevřené vs uzavřené intervaly).
2. **B — Lokálně ve `functions/src/domain/`.** Web (Day 3) k tomu nemá přístup →
   opět druhá definice, drift (stejný problém jako u pricingu v D-014, alternativa A).
3. **C — Nový pure soubor `packages/shared/src/availability.ts`** (zvolené). Jedna
   definice `overlaps()`, kterou importuje transakce v `createBooking` teď i slot
   algoritmus Day 3.

**Proč C** (stejný vzor jako D-014 pro pricing):
1. **Single source of truth pro sémantiku konfliktu.** `overlaps()` definuje
   půlotevřené intervaly `[start, end)` jednou — serverový re-check i Day-3 generátor
   slotů se shodnou, že back-to-back rezervace (10:00–10:30 + 10:30–11:00) nekolidují.
   Bez sdílení by se ty dvě definice mohly rozejít.
2. **Pure & SDK-agnostické** — navazuje na D-013/D-014: žádný Firestore import,
   operuje na `Date`. Testovatelné bez emulátoru (TODO day-5).
3. **Forward-compat.** Soubor je záměrně `availability.ts`, ne `overlap.ts` — Day 3
   ho rozšíří o slot algoritmus a `overlaps()` zůstane jeho jádrem. Jeden domov pro
   veškerou time/slot logiku.

**Konkrétní use case:** `createBooking` v transakci natáhne existující `bookings`
daného stylisty v daném dni a pro každou zavolá
`overlaps(new.startAt, new.endAt, existing.startAt, existing.endAt)`; první `true`
→ `HttpsError('failed-precondition', 'slot taken')`.

**Trade-off:**
- **Cena:** nový soubor v shared s jedinou funkcí může vypadat předčasně. Ale
  `createBooking` ho potřebuje teď a Day 3 potřebuje tutéž sémantiku — není to
  spekulace (YAGNI neplatí, druhý konzument je jistota).
- **Benefit:** nulový drift sémantiky konfliktu mezi serverovým re-checkem a
  klientským zobrazením volných slotů.

**Future work** (→ README §8 „Co bych v produkci udělal jinak"):
- **Buffer / úklidový čas mezi rezervacemi.** Půlotevřené intervaly teď znamenají
  nulový odstup (back-to-back povoleno). Reálný salon může chtít konfigurovatelný
  buffer (úklid, příprava křesla) — to by byl parametr slot algoritmu na Day 3, ne
  změna `overlaps()`.

---

### D-017 — Magic-link cancel: validace přes query-by-token (bearer capability), ne `timingSafeEqual`

**Kontext:**
`manageBookingByToken` (Cloud Function, **task #4 — implementace ZÍTRA**) má
zrušit rezervaci z magic-linku, který klient dostal v potvrzení. Otázka: jak
ten odkaz vypadá a jak se token validuje? Vyplavalo to v auditu po task #3,
protože tři místa si **odporovala**:

1. **Scope item 12** (CLAUDE.md + handoff): URL je **`/r/:token`** — nese jen token.
2. **`createBooking` zápis** (`notifications.payload.magicLink`): `/r/${cancelToken}`
   — konzistentní se scope, jen token.
3. **`types.ts` JSDoc `cancelToken`** (psáno dopoledne, před finalizací doručení):
   *„Validated … using `crypto.timingSafeEqual` to prevent timing attacks."*

Bod 3 se s body 1–2 **nezkombinuje**: když URL nese jen token (bez `bookingId`),
handler neumí adresně načíst `bookingCustomers/{id}` a constant-time porovnat
uložený token s přijatým — nemá doc ID. Musí token **vyhledat**.

**Alternativy:**
1. **A — `/r/:bookingId/:token` + `timingSafeEqual`.** Handler načte
   `bookingCustomers/{bookingId}` a constant-time porovná. Zachová formulaci z
   `types.ts`, ALE **poruší scope item 12** (URL má být `/r/:token`). Navíc
   `timingSafeEqual` tu řeší neexistující hrozbu (viz níže). Zamítnuto.
2. **B — query-by-token** (zvolené). URL zůstává `/r/:token`. Handler udělá
   `bookingCustomers.where('cancelToken','==',token)` (single-field index,
   Firestore vytváří automaticky → žádný composite). 0 dokumentů → neplatný/
   spotřebovaný token; 1 dokument → token JE oprávnění (bearer capability),
   pokračuj na zrušení.

**Proč B:**
1. **Konzistence se scope.** Body 1 a 2 už spolu ladí; mimo krok je jen JSDoc
   v `types.ts` — to opravíme (viz Důsledek). Nejmenší drift.
2. **`timingSafeEqual` tu nechrání před ničím.** Hrozba, kterou řeší, je
   byte-po-byte timing leak při porovnání **secret↔input v aplikačním kódu** s
   early-exit `===`. U query-by-token žádné takové porovnání v našem kódu není —
   match dělá Firestore index. Časový postranní kanál Firestore lookupu není
   prakticky využitelný a není to náš code path.
3. **Entropie už je obrana.** `cancelToken` = 256 bit (`randomBytes(32)`,
   base64url), bearer capability. Brute-force uhádnutí je infeasible — to je
   skutečná bariéra, ne způsob porovnání.
4. **Jednodušší a kratší URL.** `/r/:token` bez `bookingId` je čistší veřejný
   odkaz; `bookingId` (jinak PUBLIC-READ, ne tajné) v URL nic nepřidává.

**Trade-off:**
- **Cena:** `cancelToken` se stává dotazovatelným polem (Firestore single-field
  index). Triviální; collection je STAFF-ONLY + admin SDK obchází rules.
- **Benefit:** kontrakt sedí napříč scope/kódem/dokumentací; žádná falešná
  bezpečnostní ceremonie (`timingSafeEqual` na místě, kde nedává smysl).

**Důsledek (implementace v task #4, NE v tomto doc commitu):**
- `manageBookingByToken` validuje query-by-token; **`timingSafeEqual`
  neimplementovat** — je obsoletní vůči tomuto designu.
- **Opravit `types.ts` JSDoc `cancelToken`** (řádky o `timingSafeEqual`), ať
  popisuje skutečný mechanismus (bearer-capability indexed lookup). Tahle oprava
  jede **atomicky v task #4 commitu** spolu s implementací — D-017 zůstává
  doc-only rozhodnutí *před* kódem (architecture-first).

**Future work** (→ README §8):
- **Jednorázovost / expirace tokenu.** Teď je token platný do zrušení rezervace.
  Produkce může chtít TTL nebo invalidaci po prvním použití (token rotation).
- **Rate-limit na `/r/:token`** proti hádání (byť 256 bit dělá brute-force
  infeasible) — společně s App Check, viz README §6 limitace.

---

## Day 3 — 2026-05-23

### D-018 — Availability slot generator v `@hsb/shared` — pure, half-open intervaly + capability + absence/override + Intl TZ + minLeadTime

*(Záznam zapsán paralelně s implementací per L-007; obsahuje 6 pod-rozhodnutí
D1–D6 + minLeadTime, která dohromady tvoří jeden generátor a sdílí jednu
sémantiku „je tenhle slot volný?".)*

**Kontext:**
Veřejný booking flow (UI, Day 3) musí klientovi ukázat volné termíny pro
vybrané služby a stylistu (nebo „anyone"). Současně server (`createBooking`,
Cloud Function) musí pro konkrétní žádost validovat, že navrhovaný slot je
legitimní — uvnitř pracovní doby stylisty, mimo absenci, mimo zavřený den,
nekoliduje s existující rezervací. **Stejná sémantika „je tenhle slot volný?"
musí platit na obou stranách** — jinak klient uvidí slot, který server odmítne.

Třetí konzument: `createBooking` má `TODO(day-3)` (`createBooking.ts`
ř. 199-206) přesně na tohle — re-check overlapu v transakci je race-safe,
ale neřeší working-hours / absence / override. Slot generátor tu díru zaceluje
sdílenou pure funkcí, kterou volá klient i server.

**Empirické fakty, na kterých řešení stojí (ověřeno z `types.ts` / `pricing.ts`
v pre-readu — repo je autorita, paměť ne):**

1. `TimeRange` = wall-clock string `"HH:MM"` v Europe/Prague, ale `Booking` /
   `Absence` jsou `Date` instanty (UTC) → nutná TZ konverze, **DST-aware**.
2. `Absence` je half-open `[startAt, endAt)` — **přesně sémantika `overlaps()`**
   (D-016) → reuse beze změny, jeden zdroj.
3. `BusinessHoursOverride` je **salon-level** s komentářem „consults overrides
   BEFORE per-stylist weeklyHours" → definuje precedenci (řeší D2).
4. `pricing.ts` už exportuje `SLOT_GRANULARITY_MIN = 15` a
   `computeTotalDuration(services, lengths)` → reuse, ne redefinice.
5. **Capability storage** — viz D4 (per-service-ID, reuse, žádná nová struktura).
6. **Status filtering pattern už existuje server-side** — `createBooking.ts`
   ř. 49 definuje `OCCUPYING_STATUSES = ["pending","confirmed"]` a in-memory
   filtr v transakci (ř. 276). Caller (UI i server) tedy filtruje cancelled/
   completed/no_show bookings PŘED passing do generátoru. Stejně `absences`
   — caller dodá jen ty pro daného stylistu, protínající okno. Generator
   zůstává **defensivně robustní** (kdyby caller selhal, non-occupying se
   interně ignorují), ale kontrakt = caller filtruje. Viz „Caller contract"
   v Architektuře.

---

#### Architektura — two-layer API se sdíleným jádrem

```
checkSlot(start, StylistAvailabilityInput, SlotQuery): SlotCheck
  ── JÁDRO. Validuje JEDEN (start, duration) v pořadí:
     qualification → in_past → too_soon → salon_closed →
     outside_working_hours → absence → booking_conflict.
     Vrací typovaný SlotRejectionReason. **First-fail single-reason**
     sémantika (cheap-first short-circuit; alternativa array-reasons
     zamítnuta YAGNI — server hlásí klientovi jeden důvod, ne exhaustive list).
  ── Volá createBooking server-side (nahrazuje TODO(day-3)).

generateSlotsForStylist(input, query): Slot[]
  ── Iteruje 15-min grid přes [from, to), pro každý candidate volá checkSlot.
     Single stylista.

generateAvailableSlots(inputs[], query): Slot[]
  ── Anyone-mode fan-out: mapuje generateSlotsForStylist přes všechny
     stylisty, flatten. Každý Slot nese stylistId.
```

`Slot = { stylistId, start, end }`. Vstupy jsou již-deserializovaná doménová
data (`Date`, D-013). **Pure, žádné I/O, `now` injected.** Žádný zod uvnitř
(interní doménová vrstva — zod patří na I/O hranici, ne mezi důvěryhodné
vrstvy).

**Dělba odpovědnosti server ↔ klient:**
- Klient (UI): bulk generation pro horizont (~4 týdny) → renderování.
- Server (`createBooking`): `checkSlot` pro one-shot validaci **před** transakcí
  (statická data: working hours, absence, override). **Overlap re-check zůstává
  ve Firestore transakci** s txn-read bookings — race-safe; tam se `overlaps()`
  z D-016 volá přímo, ne přes `checkSlot`. Tj. `checkSlot` před transakcí chytne
  „mimo pracovní dobu / absence / zavřený den" levně; transakce chytne „právě
  obsazeno". **Jeden zdroj sémantiky (`overlaps()`), dvě místa volání** podle
  race-citlivosti dat.

**Caller contract — co generátor předpokládá na vstupu:**
Caller (UI i server) je odpovědný za:
- **Deserializaci** Firestore Timestamp → `Date` přes `fromFirestore` (D-013).
- **Status filter `bookings`** na occupying jen (`pending` / `confirmed`); cancelled
  / completed / no_show se pre-filtrují. `createBooking.ts` ř. 49 už definuje
  `OCCUPYING_STATUSES` — caller-side filtering je zavedený pattern.
- **Scope filter `absences`** na konkrétního stylistu × protínající `[from, to)`.

Generátor zůstává **defensivně robustní** (interně ignoruje non-occupying status,
kdyby caller selhal — belt-and-suspenders za triviální cenu), ale kontrakt =
caller filtruje. Toto rozdělení drží jádro tenké a respektuje, že caller už
zná správný subset (UI tahá per-stylist okna; server tahá txn-read subset).

**`now: Date` injected jako parametr — čtyři důvody:**
1. **Testability** — testy passují fixed `now`, žádný `vi.useFakeTimers()` overhead.
2. **Determinism** — pure: žádný `Date.now()` uvnitř, žádné side-effecty na
   clock source (D-013 SDK-agnostic přesah).
3. **Caller-controlled** — UI může passovat „virtual now" pro preview budoucího
   horizontu; server passuje skutečný `now`.
4. **Server temporal consistency** — `createBooking` passuje **stejný `now`** do
   `checkSlot` (lead-time check) i do `bookings.createdAt` zápisu (transakce).
   Eliminuje drobný race: kdyby si každá vrstva vzala `Date.now()` zvlášť,
   lead-time check by mohl povolit slot, který by se za pár ms zapsal s
   `createdAt`, kdy už by lead-time neplatil. Triviální v praxi, ale upřímnější
   kontrakt.

**Zvažovaná alternativa: server-side `listAvailableSlots` Cloud Function (zamítnuto):**
Místo shared pure funkce zavolané v UI bychom mohli mít CF endpoint
`listAvailableSlots(query) → Slot[]`, který by UI volala při každém tweaku
výběru. Čtyři důvody zamítnutí:
1. **Latency** — každý UI interaction = network round-trip + Gen2 cold-start
   riziko (region `europe-west3`, ale stále desítky až stovky ms vs. <10 ms
   in-browser compute).
2. **Cost** — 1000 návštěvníků × 5 tweaků = 5000 function invokací; klient-side
   compute = 0 Cloud Functions billing.
3. **Testability** — shared pure se unit-testuje bez emulátoru (Day 5 anchor);
   Cloud Function vyžaduje integration test s Firestore + functions emulator.
4. **Bez čistého přínosu** — shared pure už dává server (`checkSlot` v
   `createBooking`) i klient (UI bulk gen) v jednom kódu. CF vrstva by jen
   přidala latency/cost bez ekvivalentního benefitu. Není to ani „duplikace
   logiky" (CF by byla thin wrapper) — je to **vrstva navíc bez důvodu**.

---

#### Pod-rozhodnutí

**D1 — Slot granularita = fixed 15-min grid.**
Start times alignované na :00 / :15 / :30 / :45 přes `SLOT_GRANULARITY_MIN`
importovaný z `pricing.ts` (jeden zdroj pravdy, ne redefinice). **Délka slotu**
(`computeTotalDuration`) může být off-grid (např. 25-min express barva — viz
`pricing.ts` ř. 106-111). `granularityMin` zůstává optional param pro budoucí
flexibilitu. Zamítnuto: service-driven start (skákavé UI), per-salon
configurable (YAGNI pro MVP).

**D2 — Business override × weeklyHours = intersection.**
`override.open=false` → `salon_closed`, žádné sloty. `override.open=true,
hours` → effective window = `intersection(weeklyHours[weekday], override.hours)`.
Sedí na komentář v `types.ts` „consults overrides BEFORE per-stylist
weeklyHours" — override je **vnější salon-level závorka**, uvnitř které platí
per-stylist vzorec. Zamítnuto: replace (ztrácí per-stylist diferenci — junior
chodí odpoledne i ve „speciální" den), open-flag-only (zahazuje pole `hours`
z modelu).

**D3 — Anyone-mode = fan-out + flatten, slot nese `stylistId`.**
Pro každého kvalifikovaného stylistu nezávisle generovat; výsledek flatten do
jednoho seznamu, kde každý slot ví, **kdo** je v něm volný. Grupování stejných
časů („v 10:00 volní: Marie, Jana") je **UI** odpovědnost, ne generátoru —
generátor vrací fakta, UI je prezentuje. Zamítnuto: round-robin / load-balanced
(PDF chce „přijal bych i kolegyni" = nabídnout, ne rozhodnout za klienta),
merge intervalů bez `stylistId` (UI by neměla koho rezervovat — `createBooking`
vyžaduje konkrétní `stylistId`).

**D4 — Capability = `Stylist.serviceIds` (per-service-ID), reuse.**
**Resolved by empirie, ne otevřený decision.** `types.ts` ř. 155 už nese pole
service IDs, které stylista provádí; `createBooking` ř. 156–165 to kontroluje.
„Junior ≠ složité barvení" = junior nemá `balayage` service-ID v `serviceIds`.
**Žádná nová struktura, žádná capability matrix collection** — model už existuje.

**D5 — Horizont = caller-provided `[from, to)`.**
Generátor nehardcoduje rozsah. UI passuje ~4 týdny (mistrová má klientelu „co
počká i měsíc" — PDF), server passuje 1 slot (`from=start`,
`to=start+granularity`). Tím **jeden generátor obsluhuje oba use-cases** bez
větvení. Zamítnuto: hardcoded N týdnů (křehké, UI/server mají různé potřeby).

**D6 — Timezone konverze = `Intl.DateTimeFormat.formatToParts` + `Date.UTC`
(zero-dep).**
Nejhlubší rozhodnutí. `TimeRange` je wall-clock Europe/Prague, `Date` v doméně
je UTC instant → musí převádět. Zvažovány tři přístupy:

1. **`toLocaleString('en-US')` round-trip** — funguje, ale závisí na
   `new Date(string)` parsingu non-ISO en-US locale stringu, což je v ECMAScript
   specifikaci **host-specific** (V8 zvládá, jiný engine nemusí stejně). Plus
   ztrácí ms, plus `hourCycle` midnight kolísá mezi „24:00" / „12:00 AM".
2. **`luxon` / `date-fns-tz`** — ergonomické, ale první runtime dependency
   v `shared` (porušuje D-012/D-013 čistotu).
3. **`Intl.DateTimeFormat.formatToParts` + `Date.UTC`** (zvolené) — staví
   instant z numerických komponent, žádné string re-parsing, deterministické
   napříč enginy, explicit `hourCycle:'h23'`.

**Empirický důkaz** (ad-hoc probe `_tz_probe.mjs`, smazán po verifikaci;
→ Day 5 regression anchor):

```
wall-clock 10:00 Europe/Prague → UTC instant
  (A = toLocaleString, B = formatToParts):
  2026-01-15  A=09:00Z  B=09:00Z   winter CET  (UTC+1)         ✓
  2026-07-15  A=08:00Z  B=08:00Z   summer CEST (UTC+2)         ✓
  2026-03-29  A=08:00Z  B=08:00Z   spring-forward (DST hrana)  ✓
  2026-10-25  A=09:00Z  B=09:00Z   fall-back     (DST hrana)   ✓

day length přes wall-clock 00:00 boundaries (B):
  03-29 → 03-30 = 23h  (spring-forward)
  10-25 → 10-26 = 25h  (fall-back)
  07-15 → 07-16 = 24h  (normal)
```

**A i B dávají identické správné instanty** pro salon hodiny (8-18, mimo
noční DST přechod). B zvolen **z principu, ne kvůli výsledku** — robustnější
základ (žádné host-spec string parsing) při zero-dep stance. Tyto případy
půjdou do Day 5 unit testů jako regresní kotva.

**Day iteration:** kalendářní `YYYY-MM-DD` stringy (UTC date arithmetic
increment — UTC nemá DST, takže `+1 den` je vždy bezpečný), per-day
`weeklyHours[weekday]` přes `wallToInstant`. Tím **„kolik hodin má den"
nevzniká jako otázka** — neiteruje se přes 24h skoky.

**minLeadTime = 120 min default, tunable přes `SlotQuery`.**
`checkSlot` přidává reason `too_soon`, který filtruje sloty se
`start < now + minLeadTime`. Default 120 min je **oborový standard** pro
day-of online booking u kadeřnictví (Booksy/Reservio default ~2h) — stylistka
dokončí rozdělanou práci, recepční stihne zaregistrovat, klient stihne dojet.
PDF kontext: vytížený salon, mistrová má frontu — „za 5 minut volno" je
nereálné. Tunable: UI/seed/demo může passovat nižší hodnotu. **Dokumentováno
jako README §6 assumption.**

**Per-stylist / per-service variant zamítnut YAGNI;** budoucí pattern by byl
`max(global, stylist.minLeadTime?, service.minLeadTime?)` — reálný salon
může chtít barvení 4h lead (komplexní), mistrová 24h lead (full booking).
Pro MVP globální param stačí.

---

**Trade-offs:**

- **+** Single source of truth pro slot sémantiku napříč třemi konzumenty
  (UI / `createBooking` / Day 5 testy). Žádný drift.
- **+** Pure + Intl zero-dep drží `shared` balíček bez runtime deps
  (konzistentní s D-012/D-013).
- **+** `checkSlot` typovaný `SlotRejectionReason` umožňuje serveru hlásit UI
  konkrétní důvod (lepší UX než generic „nelze rezervovat").
- **−** TZ konverze přidává netriviální helpery (~50 ř.) jen pro Europe/Prague —
  abstrakce vs. konkrétní použití. TZ je ale byznys-fakt salonu, ne
  over-engineering.
- **−** Day iteration přes YMD stringy je textovější než instant arithmetic;
  vyvažuje se eliminací DST nejasností.

**Cross-references — compounding decisions:**

- **D-012 / D-013** — `shared` jako SDK-agnostický core; D-018 to dodržuje
  (žádný `firebase-*` ani `luxon` import).
- **D-014** — `pricing.ts` poskytuje `computeTotalDuration` a
  `SLOT_GRANULARITY_MIN`; D-018 importuje, nestaví znovu.
- **D-016** — `overlaps()` je jádro absence/booking konfliktu; D-018 ho reuse
  bez změny (Absence i Booking jsou half-open už dnes).
- `createBooking.ts` ř. 199-206 (`TODO(day-3)`) — server consumer, který se
  přepojí na `checkSlot`. **Integration footprint:** dnes handler nenačítá
  `absences` ani `salonSettings.businessHoursOverride`; přidají se jako
  **dva nové Firestore reads** v `prepareBooking` před transakcí (statická
  data, nepatří do txn). `prepareBooking` pak passuje `{ stylist, absences,
  bookings: [] }` + `override` do `checkSlot` (`bookings` schválně prázdné —
  race-check zůstává v transakci s `overlaps()` proti txn-read bookings,
  per dělba odpovědnosti výše).

**Known limitations / Future work** (→ README §6 / §8):

- **Lunch break / split shifts** — `WeeklyHours` má jeden `TimeRange`/den,
  žádný split. Pauza by se modelovala jen jako denní `Absence`. Reálný salon
  by potřeboval `TimeRange[]`.
- **Buffer mezi rezervacemi** — D-016 future work; `overlaps()` je teď
  zero-gap. Buffer = budoucí param `checkSlot`, ne změna `overlaps()`.
- **DST přechodové hodiny 2:00-3:00** — inherentně nedefinovaný wall-clock
  (spring-gap / fall-overlap). Salon (8-18) tam nesahá.
- **Multi-stylist booking** — model říká `Booking.stylistId: string` (jeden);
  kombinované služby (PDF: „barva + střih + foukaná") jsou u JEDNOHO stylisty.
  Souběžná práce dvou stylistů na jednom klientovi je out-of-scope.
- **Per-service medium/long délky** (D-014 future work).
- **Configurable granularita per salon** (D1) — konstanta zatím stačí.
- **Pre-computed daily availability cache** — pro MVP scale (5 stylistů × 4
  týdny, výpočet sub-10 ms) bez přínosu. **Scale-driven refactor pro 100+
  stylistů:** cache invalidovaná na new booking / new absence / override change
  / weeklyHours change by snížila per-request CPU. Pro MVP neimplementováno;
  pattern dokumentován pro budoucí scale.

---

*(D-019+ přibudou níže.)*
