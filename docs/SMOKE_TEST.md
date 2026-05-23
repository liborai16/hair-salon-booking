# Smoke test playbook — runtime validation (Day 5)

Manual end-to-end click-through across 8 scénářů. Closes the
`compiles ≠ runs` gap documented in [`CLAUDE.md §5`](../CLAUDE.md). Each
scenario has explicit steps + expected behavior + PASS/FAIL row in §5.

---

## 1. Účel

Runtime validation full case-study deliverable — **public booking flow +
admin UI + auth/role gating + Cloud Functions integration** — before
production deploy.

Why a manual playbook (not automated E2E):
- E2E Playwright je vědomě vynecháno ze scope (README §6 bod „co
  nemusíte dělat", PDF zadání).
- Static verification (tsc, lint, 57 shared unit tests) jen prokazuje
  *kompilační* správnost. Runtime behavior (Firestore reads, custom
  claims propagation, Cloud Functions httpsCallable wire-up) potřebuje
  emulator-based click-through.
- Hodnotitel uvidí v repu jako engineering rigor signal: „kdo nemá E2E,
  má aspoň checklist".

**Exit criteria:** 8/8 PASS v §5 reporting matrix. Pokud ≥1 FAIL → fix-
commit per finding → re-run scénář(e) postižené změnou.

---

## 2. Prerequisites

- **Docker Desktop** running (Firebase emulators běží v kontejneru per
  `docker-compose.yml`).
- **Firebase CLI 15+** — `npm install -g firebase-tools` (nebo přes
  `npx firebase`).
- **Node 22+** (lokálně, EBADENGINE warning na Node 24 je očekávaný —
  viz L-004).
- **Java 17+** — Firestore + Pub/Sub emulátory mají JRE dependency.
- **`npm install`** spuštěné v repo root (hoistne `firebase-admin` +
  `vitest` + ostatní).
- **`packages/shared/dist/` postavené** — `npm run build --workspace=@hsb/shared`
  (nebo automaticky přes `npm run seed`, který předbuilduje).

---

## 3. Setup — 3 terminály paralelně

| # | Terminal | Command | Wait for |
|---|---|---|---|
| T1 | Emulators | `firebase emulators:start` (nebo `npm run emulators` v root) | `All emulators ready! It is now safe to connect.` |
| T2 | Seed | `npm run seed` (po T1 ready) | `✅ Seed complete.` + per-collection counts (10 services, 5 stylists, 6 users + auth, 25 bookings, atd.) |
| T3 | Web dev | `cd web && npm run dev` | `Local: http://localhost:5173/` |

**Plus otevřít:**
- `http://localhost:5173` — aplikace (mobile DevTools F12)
- `http://localhost:4000` — Firebase Emulator UI (Firestore + Auth + Functions tabs)

**Emulator ports** (per `firebase.json`): Auth 9099, Firestore 8080,
Functions 5001, Hosting 5000, UI 4000.

---

## 4. Test scénáře (8)

### A. Public booking — happy path

**Steps:**
1. Otevři `http://localhost:5173` — landing s "Rezervovat termín" CTA.
2. Klik CTA → `/book`.
3. Step 1: Vyber **Dámské stříhání** (strihani, 45 min) + **Foukaná**
   (foukana, 30 min). Bottom bar ukáže `~75 min · ~950 Kč (odhad…)`.
   Klik "Pokračovat".
4. Step 2: Klik **Kdokoliv** (anyone-mode default). Slot list načte za
   ~1-2 s. Vyber slot **3+ hodiny od teď** (lead-time gate 120 min;
   pokud je teď 14:00, vyber ≥ 17:00 ten samý den nebo zítra).
   Klik "Pokračovat".
5. Step 3: Vyplň
   - Jméno: `Testovaci Klient`
   - Telefon: `+420600555111`
   - E-mail: `test@example.cz`
   - ☑ GDPR souhlas
   - Klik "Pokračovat".
6. Step 4: Zkontroluj summary (služby + kadeřník + čas + cena + ty).
   Klik "Rezervovat".
7. Step 5 (success): Vidíš ✓ + booking ID (např. `aBc123…`) + termín +
   cena + "Zpět na úvod" link.

**Expected PASS když:**
- Žádné console errors v DevTools.
- Booking ID je 20-char Firestore auto-ID.
- Emulator UI → Firestore → `bookings/{id}` má nový dokument se
  status `confirmed` + správné `serviceIds` + `totalPrice`.
- Emulator UI → `bookingCustomers/{id}` (same id) má jméno + phone +
  email + cancelToken (~43 chars base64url).
- Emulator UI → `customerProfiles/{phoneHash}` aktualizován
  (bookingHistory přidána nová entry).
- Emulator UI → `notifications/{id}` má payload s magicLink
  `/r/{cancelToken}`.

---

### B. Cancel via magic link

**Steps:**
1. Z předchozího scénáře A — zkopíruj `cancelToken` z Emulator UI →
   `notifications/{id}/payload/magicLink`.
2. Otevři `http://localhost:5173/r/{cancelToken}` v novém tabu.
3. Vidíš booking detail (services + kadeřník + čas + cena + status:
   "Potvrzeno").
4. Klik **"Zrušit rezervaci"** (červené tlačítko).
5. Status se změní na "Zrušeno" (šedá + strikethrough).
6. **Idempotent retry:** refresh stránky. Žádný error. Status stále
   "Zrušeno". Tlačítko zmizí, místo něj message + link na novou
   rezervaci.

**Expected PASS když:**
- Booking view zobrazí správné PII-minimal data (services + stylistName,
  NE jméno/telefon klienta — per D-017 design).
- Cancel transakce: Emulator UI → `bookings/{id}/status` = `cancelled`,
  `updatedAt` aktualizován.
- Idempotent: re-cancel neukáže chybu (handler returns existing booking
  view bez throw — per `manageBookingByToken` contract).

---

### C. Admin login

**Steps:**
1. Otevři `http://localhost:5173/admin` → automatický redirect na
   `/admin/login`.
2. Vyplň `eva@salon.cz` / `Heslo123!`. Klik "Přihlásit".
3. Po ~1 s redirect na `/admin/dashboard`.

**Expected PASS když:**
- Sidebar má 5 položek pro owner: **Rozvrh**, **Nová rezervace**,
  **Kadeřníci**, **Služby**, **Přehledy** (Přehledy → 404 / placeholder,
  Phase 3.5 deferred — accept).
- Footer sidebaru má `eva@salon.cz · Majitelka` + "Odhlásit" link.
- Hlavní oblast: timeline rozvrh (viz scénář D).

---

### D. Denní rozvrh + status transitions

**Steps:**
1. Pokračuj z přihlášené sezení (scénář C). Vidíš timeline 8:00-20:00 ×
   5 sloupců (po jednom per stylist).
2. **Date picker:** zkus "Dnes" + manuálně vyber datum 2 dny vpřed.
   Rozvrh se znovu načte.
3. **Booking blocks:** dnešní rozvrh by měl mít několik seedem
   vygenerovaných bookings (status barvy: čeká=amber, potvrzeno=stone,
   proběhlo=emerald, no-show=red, zrušeno=line-through).
4. **Absence blocks:** Tereza má `skoleni` `+7d` 10:00-15:00 (viz seed).
   Naviguj na ten den — měl by být šedý dashed block.
5. **Drawer + transitions:** klik na confirmed booking → drawer s detail
   (klient PII viditelný — staff-only per rules) + 3 akce:
   - **"Označit jako proběhlo…"** → rozbalí 3 platby (Hotově/Kartou/
     Převodem) → klik → status `completed` + `paymentMethod` set.
     Rozvrh refresh, block zelený.
   - **"Nedostavil(a) se"** → status `no_show`. Block červený.
   - **"Zrušit"** → status `cancelled`. Block strikethrough.

**Expected PASS když:**
- Timeline math correct (blok pro 10:00 booking je v top:120px = 2h od
  8:00 × 60px).
- Mutation persistuje: Emulator UI → `bookings/{id}/status` má novou
  hodnotu, `updatedAt` recent.
- Terminal status (completed/no_show/cancelled) skryje akční tlačítka v
  drawer.
- Customer name + phone + email v drawer (staff-only per rules — `isStaff()`).

---

### E. Walk-in booking (admin)

**Steps:**
1. Z přihlášené sezení → sidebar "Nová rezervace".
2. Booking flow vypadá stejně jako veřejný, ale **slot picker ukáže
   sloty STARTING NOW** (lead-time gate 0).
3. Vyber službu (např. **Pánské stříhání**) + slot **dnes do 2h od teď**
   (něco co by veřejný flow odmítl s `too_soon`).
4. Vyplň customer form + odešli.
5. Success page identická s veřejným flow.
6. Naviguj zpět na **Rozvrh** → vidíš nový booking v timeline.

**Expected PASS když:**
- Slot picker nepustí slot >2h před aktuálním časem (žádný `too_soon`
  v server response).
- Emulator UI → nový `bookings/{id}/source` = `'admin'` (NE `'public'`)
  — server derived from auth role (D-018 Phase 3.3 staff-bypass).
- Booking je viditelný v rozvrhu okamžitě po refresh.

---

### F. Stylists CRUD (owner-only)

**Steps:**
1. Sidebar → **Kadeřníci**. Tabulka 5 stylistů (Eva, Marie, Lenka,
   Petra, Tereza) s tarif + počet služeb + active toggle + "Upravit"
   link.
2. **Create:** klik "+ Přidat kadeřníka" → modal:
   - Jméno: `Test Kadeřnice`
   - Tarif: Junior
   - Služby: check 2-3 (e.g. Dámské + Pánské stříhání)
   - Pracovní doba: po-pá 10:00-14:00, ostatní volno
   - Klik "Vytvořit".
3. Tabulka refresh → nový stylist viditelný, active = true.
4. **Edit existing:** klik "Upravit" na "Tereza Malá" → změň tarif na
   Standard → "Uložit".
5. **Soft delete:** klik active toggle u "Test Kadeřnice" → status
   "Neaktivní".
6. Otevři nový anonymní tab → `http://localhost:5173/book` → vyber
   službu kterou má jen Test Kadeřnice (případně testuj s existujícím
   inactive stylistou). Slot picker ho v anyone-mode neukáže.

**Expected PASS když:**
- Emulator UI → `stylists/{newId}` má kompletní dokument + `active: true`.
- Po toggle: `active: false`, `updatedAt` aktuální (serverTimestamp).
- Veřejný booking flow inactive stylist nenabízí (filter v useStylists
  hook `setStylists(all.filter((s) => s.active))`).

---

### G. Services CRUD (owner-only)

**Steps:**
1. Sidebar → **Služby**. Tabulka 10 services + kategorie + délka + cena
   + active.
2. **Create barveni service s length variants:**
   - Klik "+ Přidat službu" → modal
   - Název: `Test barva`
   - Kategorie: Barvení
   - Délka: 60 min, Cena: 1000 Kč
   - ☑ "Cena podle délky vlasů" → 3 vstupy (Krátké/Střední/Dlouhé) —
     prefill 1000/1000/1000, změň na 1000/1300/1600.
   - "Vytvořit".
3. **Edit:** uprav existující `Express barva` → změň cenu na 800 → uložit.
4. **Soft delete:** active toggle.
5. Veřejný flow ověření: `/book` → step 1 musí inactive service skrýt
   + nová "Test barva" musí být v kategorii Barvení s 3-tier picker.

**Expected PASS když:**
- `services/{newId}/lengthVariants` má `{short:1000, medium:1300, long:1600}`.
- 25-min off-grid duration na `Express barva` zachován (D-014 demo).
- Edit zachová existing fields (form jen overwrite-uje subset).

---

### H. Role-based access enforcement

**Steps:**
1. **Logout** (sidebar bottom).
2. **Login `marie@salon.cz` / `Heslo123!`** (role: stylist).
3. Sidebar má **JEN 2 položky**: Rozvrh + Nová rezervace. Žádní
   Kadeřníci / Služby / Přehledy.
4. **Direct URL test:** ručně do address bar `/admin/stylists`.
   Render: amber warning "Tato stránka vyžaduje roli „owner"".
5. Logout. **Login `hana@salon.cz` / `Heslo123!`** (role: receptionist).
6. Sidebar: Rozvrh + Nová rezervace (stejně jako stylist — owner-only
   skryté).
7. `/admin/stylists` direct URL → stejné amber warning.
8. **Logout test:** klik "Odhlásit" → redirect na… kde? (auth state
   změna → `/admin/dashboard` přes RequireAuth → `/admin/login`).
9. Direct URL `/admin/dashboard` bez login → redirect na
   `/admin/login` s `from` state pro post-login return.

**Expected PASS když:**
- Sidebar filter funguje per role (defense-in-depth UX vrstva).
- `RequireAuth requireRole="owner"` blokne přímý URL access (route-
  level vrstva).
- Firestore rules by 3-tier gate finalizovaly (rules vrstva — netestujeme
  zde, ale je to třetí defense-in-depth vrstva per D-013 architecture).
- Logout flow čistý — auth.status → unauthenticated → redirect.

---

## 5. Reporting matrix

Vyplň po každém scénáři. Pokud FAIL, poznámka → fix-commit per finding
→ re-run.

| Scénář | Status | Poznámka / screenshot |
|---|---|---|
| A. Public booking happy path | ☐ PASS / ☐ FAIL | |
| B. Cancel via magic link | ☐ PASS / ☐ FAIL | |
| C. Admin login | ☐ PASS / ☐ FAIL | |
| D. Denní rozvrh + status transitions | ☐ PASS / ☐ FAIL | |
| E. Walk-in booking | ☐ PASS / ☐ FAIL | |
| F. Stylists CRUD | ☐ PASS / ☐ FAIL | |
| G. Services CRUD | ☐ PASS / ☐ FAIL | |
| H. Role-based access | ☐ PASS / ☐ FAIL | |

**Exit criteria:** 8/8 PASS → ready for deploy + README final + PR draft.

---

## 6. Common failure modes

Známé třídy chyb, který se mohou objevit při prvním spuštění. Většinou
prerequisite issues, ne aplikační bugy.

### Emulator port conflict
Symptom: `firebase emulators:start` selže s `EADDRINUSE: address already in use :8080`.
Cause: jiný Firestore emulator / Postgres / Spring Boot dev server.
Fix: `lsof -i :8080` (Mac/Linux) nebo `netstat -ano | findstr :8080`
(Windows) → kill process, nebo změň port v `firebase.json` emulators
sekci.

### Seed ECONNREFUSED
Symptom: `npm run seed` selže s `connect ECONNREFUSED 127.0.0.1:8080`.
Cause: race condition — emulators ještě nejsou plně ready when seed runs.
Fix: počkej na "All emulators ready" v T1 PŘED spuštěním T2. Pokud
přetrvává, sleep 2s před první Firestore write v seed (jednorázový
workaround).

### Login úspěšný, ale sidebar nemá role-specific items
Symptom: login pass, ale po loginu sidebar ukáže prázdné nav (nebo všechny
items pro všechny role).
Cause: custom claims nepropagovaly do JWT — claims se cache-ují ~1h,
fresh login by měl je mít, ale když je session perzistovaná z PŘED
seed re-runu, claims jsou stale.
Fix: hard logout (sidebar) + clear browser localStorage (DevTools →
Application → Storage → Clear site data) + re-login. Pokud přetrvává,
v Auth emulator UI smaž uživatele a re-run seed.

### Slot picker je prázdný
Symptom: service vybrána, anyone-mode klik, ale "Žádné volné termíny
v nejbližších 14 dnech".
Cause hypotézy:
1. **Žádný kvalifikovaný stylist** — vybrané services nejsou v žádném
   `stylist.serviceIds`. Zkontroluj v Emulator UI Firestore.
2. **Lead-time gate** — všechny slots během default 120 min skryté. Zkus
   `/admin/walk-in` (lead-time 0) pro porovnání.
3. **Composite index chybí** — bookings query `(stylistId, startAt)` nebo
   absences `(stylistId, endAt)`. Production by požadoval `firebase
   deploy --only firestore:indexes` first. V emulátoru indexes nejsou
   striktně vyžadovány, ale pokud build vrátí prázdno zde, je to
   indikátor problému.
4. **Inactive stylisté** — všichni qualified stylisté jsou inactive.
   Restore přes admin Kadeřníci page.

### CORS / Functions emulator not reachable
Symptom: `createBooking` httpsCallable selže s network error.
Cause: Functions emulator není running, nebo `connectFunctionsEmulator`
v `web/src/lib/firebase.ts` má špatný port.
Fix: zkontroluj T1 — Functions emulator se musí v ready list (port 5001).
Pokud chybí, restart `firebase emulators:start --only functions,firestore,auth`.

### Composite index missing (production)
Symptom: V production (po `firebase deploy --only functions`) booking
flow selže s `FAILED_PRECONDITION: The query requires an index`.
Cause: indexes nebyly nasazeny PŘED functions.
Fix: deploy sequence per D-018 integration note v `CLAUDE.md §5`:
```bash
firebase deploy --only firestore:indexes  # WAIT for build complete (~minuty)
firebase deploy --only functions
firebase deploy --only hosting
```

### Bundle 500kb warning at build
Symptom: `npm run build --workspace=web` zobrazí "chunks larger than 500kb".
Cause: Firebase SDK dominantní (~400kb), žádný code-split nakonfigurován.
Status: **known limitation, NE blocker** — viz CLAUDE.md §5 + commit
873aeab. Code-split candidate pro Day 6 polish.

---

## 7. Cross-references

- **Architektura:** [`CLAUDE.md §3`](../CLAUDE.md) + [`docs/decisions.md`](decisions.md) D-001 → D-018
- **Aktuální stav + debt:** [`CLAUDE.md §5`](../CLAUDE.md)
- **Seed dataset spec:** [`scripts/seed.mjs`](../scripts/seed.mjs) header JSDoc
- **Demo credentials:** [`README.md §5`](../README.md) (6 účtů + role matrix)
- **Role matrix:** [`firestore.rules`](../firestore.rules) comment header
- **Lessons learned:** [`docs/LESSONS_LEARNED.md`](LESSONS_LEARNED.md) L-001 → L-010
