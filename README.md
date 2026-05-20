# hair-salon-booking

Případová studie pro výběrové řízení — webová aplikace pro rezervační systém kadeřnického salonu.

**Stack:** Vite + React 19 + TypeScript + Tailwind 4 (frontend) · Firebase Auth + Firestore + Cloud Functions Gen2 + Hosting (backend, region `europe-west3`)

**URL nasazené aplikace:** *To be filled (Day 6).*

> Tento README sleduje vývoj případové studie. Sekce 6 a 9 jsou plné od Day 1; ostatní se doplňují průběžně. Detailní obhajoba každého rozhodnutí žije v `docs/decisions.md`.

---

## 1. Co to je

*To be filled.*

---

## 2. Architektura

*To be filled.*

---

## 3. Jak spustit lokálně

*To be filled (Day 6, po stabilizaci docker-compose).*

Předběžně:
1. Mít nainstalované: Docker Desktop, Node 22+ (lokálně volitelné, vše běží v kontejneru).
2. `docker compose build` (jednorázově — Dockerfile.emulator).
3. `docker compose up` — spustí Auth/Firestore/Functions/Hosting/UI emulátory + Vite dev server.
4. Web: `http://localhost:5173`
5. Emulator UI: `http://localhost:4000`

---

## 4. Nasazení

*To be filled (Day 6).*

---

## 5. Přihlašovací údaje (seedovaní admini)

*To be filled (Day 2 po seedu).*

Plánujeme 3 role: `owner`, `receptionist`, `stylist`. Každá s vlastním účtem + heslem.

---

## 6. Předpoklady

Zadání bylo úmyslně neúplné. Tady je každý předpoklad, který jsem si musel udělat, s **obhajobou**:

1. **Klient se nepřihlašuje, rezervuje jako host.** Identifikace přes **hashovaný telefon** (`phoneHash`). Důvod: PII split — telefon v plaintextu žije jen v `bookingCustomers/` (STAFF-ONLY), hash v `customerProfiles/{phoneHash}` umožňuje no-show lookup bez expozice PII.

2. **Časová zóna salonu = `Europe/Prague`, hardcoded.** Důvod: salon je v ČR, žádné multi-region. Zjednodušuje slot algoritmus (žádný DST drama mimo CZ).

3. **Granularita rezervací = 15 minut.** Důvod: standard v kadeřnické branži. Kompromis mezi UX (nepřeplněný picker) a flexibilitou (sloty zapadnou do reálných služeb 20–150 minut).

4. **Cenové hladiny `junior` (-20 %) / `standard` (0 %) / `senior` (+30 %) jako multiplikátory; `priceOverrides` per kadeřník má precedenci.** Důvod: ceník v zadání není jednoduchý (mistrová má jiné ceny než junior), ale plná matice cena×služba×kadeřník je overkill. Hladiny pokrývají 95 % případů, override řeší zbytek.

5. **`lengthVariants` (short/medium/long) jen pro `category: 'barveni'`.** Důvod: zadání explicitně říká „barvení se může lišit podle délky vlasů, do systému to nemusí jít" — my to ale **chceme**, protože je to klíčové pro veřejnou cenu. Ostatní kategorie (střih, foukaná, …) na délku necitlivé.

6. **Klient může sám zrušit přes magic-link `/r/:token`** (Cloud Function `manageBookingByToken` validuje constant-time porovnáním). E-mail s linkem mockovaný do `notifications/` kolekce, log do konzole. Důvod: zadání povoluje mock; magic-link je standard pro guest cancel flow bez accountu.

7. **Cancellation policy se v MVP NEenforcuje.** Klient může zrušit i 1 minutu před termínem. Důvod: enforcement = political/business decision, ne tech rozhodnutí. README sekce 8 popisuje, jak by se v produkci nasadila (cutoff window, no-show counter increment).

8. **Dovolené / školení / nemoc kadeřníka přes `absences/` kolekci** (`stylistId, startAt, endAt, reason`). Důvod: explicitní entita = jasná auditovatelnost. Slot algoritmus filtruje absences úplně stejně jako bookings.

9. **No-show tracking přes `customerProfiles.noShowCount` (decay-aware threshold) + visual flag v admin UI.** Decay = no-show z roku 2024 váží méně než no-show z minulého měsíce. Důvod: striktní blacklist je nespravedlivý (lidé mění životní okolnosti); decay je férový. V MVP jen vizuální flag, žádný auto-block.

10. **Buffer mezi rezervacemi = 0 minut, započten v `service.durationMinutes`.** Důvod: zjednodušení slot algoritmu. Kdyby budoucí konfigurace chtěla bufferů, přidá se atribut `bufferMinutes` na `service` nebo `salonSettings` (single source of truth).

11. **3 role v adminu** (`owner`, `receptionist`, `stylist`), vynucené na 3 úrovních: navigation filter, Firestore rules, route guards. Důvod: defense in depth — pokud jedna vrstva selže (např. UI bug ukáže Owner nav i Stylistovi), Firestore rules to chytnou.

12. **E-mail notifikace MOCKOVANÉ** — log do `notifications/` kolekce + `console.log` v Cloud Function. **V produkci:** Resend (developer-friendly, jednoduché API, GDPR-friendly EU hosting). Důvod: zadání povoluje mock; Resend je mainstream v 2026 pro transakční e-mail.

13. **SMS notifikace NEDODÁVÁME** (ani v MVP, ani jako fallback). **V produkci:** Twilio nebo SMSbrana.cz. Důvod: scope cut — SMS by zdvojily mockované komunikační vrstvy bez přidané hodnoty pro hodnotitele. README sekce 8 popisuje produkční variantu.

14. **Race condition při souběžné rezervaci řešena `createBooking` Cloud Function**, která v jediné Firestore transakci re-checkne dostupnost slotu před commitem. Důvod: bez serverové validace by dva paralelní klienti mohli rezervovat stejný slot — UI logika není zdroj pravdy.

15. **Měna `CZK`, formát času `24h`, formát data `DD.MM.YYYY`.** Důvod: salon je v ČR, single-locale. Zjednodušuje formátovací helpery (jeden Intl locale `cs-CZ`).

16. **SPAYD QR pro platby** s editovatelným IBAN salonu v `/admin/nastaveni`. SPAYD generuje lokálně klient (žádné externí API). Důvod: SPAYD je český standard, klienti ho otevřou v bankovní appce a zaplatí jedním klikem. Bonus pro UX, žádný náklad na backend platby.

17. **Cloud Functions runtime = Node 22**, lokálně máme Node 24. Firebase Functions Gen2 zatím nepodporuje Node 24, tj. v cloudu funkce poběží na 22. Pro vývoj na Node 24 to vadí jen tehdy, kdyby se používala 24-specific API (nepoužíváme). `EBADENGINE` warning od npm je očekávaný.

---

## 7. Co bych dodělal, kdyby byl víc čas

*To be filled (průběžně, jakmile něco vědomě vynecháme).*

Předběžně už víme:
- Pravidelní klienti: „rezervovat stejné jako minule, za 6 týdnů" (telefon-based lookup s nabídkou poslední rezervace) — silný UX candidate z PDF zadání.
- E2E Playwright testy (vítané, ale zadání nevyžaduje).
- Audit log (kdo co kdy v adminu).
- App Check (anti-bot pro veřejný booking endpoint).

---

## 8. Co bych v produkci udělal jinak

*To be filled (průběžně).*

Předběžně:
- **E-mail:** Resend místo mock (sekce 6 bod 12).
- **SMS:** Twilio / SMSbrana.cz (sekce 6 bod 13).
- **Cancellation policy:** cutoff window + no-show counter increment.
- **Staging environment:** dnes pouze production deploy, v reálném produktu by mezistupeň byl povinný.
- **Cloud Functions cold start tuning:** `minInstances: 1` pro `createBooking` (peak hour responsivity).
- **App Check + reCAPTCHA Enterprise** na veřejný booking.

---

## 9. Známé chyby a omezení

### 9.1 `npm audit`: 9 low severity vulnerabilities

Po `npm install -D firebase-tools` hlásí npm 9 nízkozávažných zranitelností. Vědomě s nimi žijeme, protože:

- **Všechny jsou transitivní deps Firebase ekosystému** — typicky stará verze `glob`, `uuid` v `firebase-tools` dependency tree.
- **Severity „low"** v praxi obvykle znamená RegExp DoS v parseru nebo prototype pollution v utility funkci, ke které z aplikačního kódu nepřistupujeme.
- **`npm audit fix --force`** by sice odstranilo warningy, ale **rozbilo by `firebase-tools`** (force pulle major bump verzí, které Firebase tým neotestoval).
- Firebase tým updatuje deps každý cyklus — vlastní zranitelnost není v našem kódu, je jen ve verzích, které Google ještě nepowershopnul.

**Akce v produkci:** sledovat `firebase-tools` releases, upgradovat každé 4–6 týdnů.

### 9.2 `EBADENGINE` warning u `functions` workspacu

Viz README sekce 6, bod 17. Očekávané a nevyžaduje akci.

*Další známé issues se doplní průběžně.*

---

## 10. Mock služby — co bych použil v produkci

*To be filled (Day 2 po implementaci notifikací; Day 6 finalizace).*

Předběžný plán:
- **E-mail (mock → produkce):** Resend.com — developer-friendly, jednoduché API, GDPR-friendly EU hosting, generous free tier (3 000 e-mailů/měsíc).
- **SMS (nedodáváme → produkce):** Twilio (světový standard, pricing transparentní) **nebo** SMSbrana.cz (česká, levnější pro CZ čísla, českou podporu).

---

## 11. AI disclosure

*To be filled (Day 6).*

Krátce: tato case study byla vyvíjena s aktivní pomocí Claude (Anthropic). Architektonická rozhodnutí jsou má (viz `docs/decisions.md`); kód byl psán ve dvojici. Při interview ráda projdu kteroukoli část a obhájím, **proč** je tak, jak je.

---

## 12. Feedback PR

*To be filled (Day 6).*

Plánovaná oblast refaktoru: TBD.

---

## 13. Audit vs. zadání

*To be filled (Day 6).*

Plánovaná struktura: checklist všech požadavků z `D:\zadani\case-study-hairsalon.pdf` s ✅ / ⚠️ / ❌ + odkazem na řešení.
