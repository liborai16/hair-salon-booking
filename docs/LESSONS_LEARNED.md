# Lessons learned

Konkrétní incidenty z vývoje, kde jsme narazili na něco, co stojí za **zapsání pro budoucnost** (sebe za měsíc, hodnotitele, případného maintainera).

Cíl: nevypadat tak hloupě podruhé.

---

## Day 1 — 2026-05-20

### L-001: Windows + Git Bash + Node CLI → ne-absolutní cesty

**Incident:**
Volali jsme `npm create vite@latest "D:/hair-salon-booking/web" -- --template react-ts`. `create-vite` vyrobil scaffold v `D:\hair-salon-booking\D\hair-salon-booking\web\` (parazitní vnořená cesta) místo cílového `D:\hair-salon-booking\web\`.

**Příčina:**
Drive-letter notace `D:` na Windows v kombinaci s MSYS prostředím Git Bashe se občas dostane do Node nástrojů jako string **bez** disk prefixu. Node path resolver pak interpretuje `D:/foo` jako relativní `D/foo` a přilepí ho k pracovnímu adresáři. POSIX coreutils (`rm`, `ls`, `cat`, `mv`, `git`) si s tím poradí díky MSYS path conversion layer, ale Node-based CLI nástroje (`npm`, `npx`, `create-*`) mají vlastní path resolver, který ten layer obchází.

**Řešení / pravidlo:**
Pro Node CLI nástroje na Windows v Git Bashi používej:
- **První volba:** relativní cesty (pokud `pwd` sedí): `npm create vite@latest web -- ...`
- **Druhá volba:** MSYS-style absolutní cesta s leading slash + malé písmeno disku: `/d/hair-salon-booking/web` (žádná dvojtečka)
- **Nikdy:** `D:/...` ani `D:\...`

**Recovery:** `rm -rf D:/hair-salon-booking/D` (rm si poradí), pak retry s relativním pathem.

---

### L-002: `git clone` do existující složky s `.claude/` selhává

**Incident:**
Spustili jsme `git clone <ssh-url> .` v `D:/hair-salon-booking`. Git odmítl: *"destination path already exists and is not an empty directory."*

**Příčina:**
Claude Code (vývojové prostředí, ve kterém pracujeme s LLM asistencí) si při startu sezení automaticky vytváří skrytou složku `.claude/` v pracovním adresáři (per-project permission cache, hooks, agents config). `git clone` ale vyžaduje **prázdný** cíl, a i tahle jediná skrytá složka mu stačí k odmítnutí.

**Řešení / pravidlo:**
Místo `git clone` použij **rozložený postup**, který umí pracovat s existujícími soubory v cíli:

```bash
git init -b main
git remote add origin <ssh-url>
git pull origin main
git branch --set-upstream-to=origin/main main
```

`.claude/` zůstane netknutá a později ji explicitně přidáš do `.gitignore`.

**Bonus pro učení:** Tenhle „rozložený clone" je didakticky cenný — uvidíš, **co `git clone` reálně dělá pod kapotou** (init + remote add + fetch + checkout). Drives the mental model home.

**Když `.claude/` přijde do `.gitignore`:** Sekce „Project-specific additions" v `.gitignore` v rootu repa.

---

### L-003: `firebase init` je interaktivní → manuální scaffold

**Incident:**
Standardní postup pro setup Firebase projektu je `firebase init functions`, `firebase init firestore`, `firebase init emulators`, `firebase init hosting`. Všechno jsou ale **interaktivní příkazy** s prompty (language, ESLint, install deps, Y/n, atd.).

**Příčina:**
V automatizovaném/non-interaktivním Bashi (CI, Claude Code Bash tool, mnoho dev setupů) se interaktivní prompt zasekne — proces čeká na vstup, který nikdy nepřijde. Po default timeoutu spadne.

**Řešení / pravidlo:**
Pro Firebase setup v non-interaktivním kontextu napiš všechny konfiguráky **ručně**:
- `.firebaserc` — alias projektu
- `firebase.json` — Firestore/Functions/Hosting/Emulators config
- `firestore.rules` — security rules
- `firestore.indexes.json` — composite indexy
- `functions/package.json`, `functions/tsconfig.json`, `functions/eslint.config.js`, `functions/src/index.ts`

Postup dokumentovaný v `docs/decisions.md` (D-005).

**Bonus pro case study:** Hodnotitel vidí v souborech vědomé volby (region, runtime, maxInstances, deny-all rules), ne stock template z `firebase init`.

---

### L-004: `EBADENGINE` warning u `functions@0.0.1` je očekávané

**Incident:**
`npm install -D firebase-tools` vyhodil:
```
npm warn EBADENGINE Unsupported engine {
  package: 'functions@0.0.1',
  required: { node: '22' },
  current: { node: 'v24.14.1', npm: '11.11.0' }
}
```

**Příčina:**
V `functions/package.json` máme `"engines": { "node": "22" }`, protože **Firebase Cloud Functions Gen2 cloud runtime je Node 22** (24 zatím není podporován). Lokálně máme Node 24.

**Řešení / pravidlo:**
**Žádné** — warning je úmyslný. Říká „tvoje funkce v cloudu poběží na Node 22, ne 24, takže nepoužívej Node 24-specific API". Lokální spouštění funkcí v Node 24 funguje (kompatibilní podmnožina).

Zapsáno do `README.md` sekce 6, bod 17.

---

### L-005: Path on Windows v `npm create vite` se „opraví sama", když přepneš na relativní path z čisté cwd

Detail viz L-001. Tady jen poznamenat, že **opětovné spuštění `create-vite` po `rm -rf` jelo bez problému** — Node cache si pamatuje stažený `create-vite` balíček, takže druhý běh byl ~10× rychlejší než první.

---

### L-006: Build outputs v monorepo workspaces — důvěřuj, ale verifikuj

**Incident (reflective non-incident):**
Při commitu BLOK A Day 2 jsme uviděli `packages/shared/dist/` files v recap listingu a vznikla otázka, zda jsou v gitu. Diagnostika ukázala, že **nejsou** — pattern `dist` v root `.gitignore` (bez leading `/`) match anywhere v tree, včetně subworkspaců. Ale ten matching **není intuitivní** z pohledu kohokoli, kdo prochází `.gitignore` od shora dolů a vidí pattern usazený v sekci „Nuxt.js build / generate output" (matoucí název původně od GitHub Node templatu).

**Pravda o gitignore patternech:**
- `dist` (bez slash, bez prefixu) = **match anywhere** v tree, including workspaces ✓
- `/dist` (s leading slash) = match **jen v rootu**, NE v subworkspacích ✗
- `packages/*/dist/` = **explicit workspace coverage** — defensive a recommended pro monorepa, protože dokumentuje záměr

**Pravidlo pro monorepa:**
Generic patterny FUNGUJÍ, ale **explicit workspace patterns lépe dokumentují záměr**. Kdokoli později otevře `.gitignore`, hned vidí „aha, workspaces mají vlastní dist outputy, tady to máme zajištěné" — nemusí debugovat globální regex semantiku. Hodnotitel uvidí workspace-aware thinking.

**Verifikační příkazy do kufřice (monorepo audit):**
- `git ls-files | grep dist` — co je reálně tracked v gitu
- `git check-ignore -v path/to/file` — proč je / není ignored (ukazuje konkrétní řádek .gitignore)
- `git status --ignored` — co je ignored v aktuální složce (visual sanity check)

**Mantra:** Důvěřuj patternům, ale verifikuj před commitem. „Vypadá to, že je to ignored" není totéž jako „git to skutečně ignoruje".

---

## Day 2 — 2026-05-20

### L-007: Triangulace přes dvě sezení — architekt vidí konzistenci, implementer vidí runtime

**Incident (reflective non-incident):**
Před commitem `pricing.ts` (Day 2 BLOK B) jsme rozhodnutí prohnali dvěma Claude
sezeními s odlišným kontextem: **architekt** (Claude.ai — držel plán Day 2,
decisions log, strategický pohled) a **implementer** (Claude Code — viděl
filesystem, `firebase.json`, reálný kód a runtime). Architekt navrhl umístit
pricing do `@hsb/shared`; implementer to měl postavit.

**Co každý pohled odhalil:**
Architekt potvrdil *strategickou konzistenci* — že shared pricing navazuje na
D-012/D-013 (SDK-agnostický core, hexagonální vrstvení). To je nutné, ale nestačí.
Implementer při čtení konkrétního kódu a configu chytil **tři věci, které
strategický pohled strukturálně nevidí**:
1. **Rounding edge case** — `computeServiceDuration` zaokrouhloval i krátké vlasy,
   takže „Express barva 25 min" by se tiše nafoukla na 30. Odhaleno čtením těla
   funkce, ne plánu.
2. **Deploy bundling** — `functions/` neměly mechanismus, jak `@hsb/shared` dostat
   do cloudu (workspace dep se z npm registry nenainstaluje). Odhaleno čtením
   `firebase.json`. Vedlo k samostatnému **D-015**.
3. **Grid placement** — z diskuze o rounding vyplynulo, že 15-min grid patří do
   slot algoritmu (Day 3 `availability.ts`), ne do výpočtu délky. Hranice, kterou
   odhalil až code-close pohled.

**Pravidlo:**
Čistě strategický review by odeslal rounding bug i rozbitý deploy — obojí žije
v runtime/kódu, kam plán nedohlédne. Dva pohledy s **odlišným kontextem** najdou
různé třídy chyb; jeden pohled míjí ty z druhé domény.

**Mechanika pro budoucí použití:**
- Před commitem s netriviální logikou: ~5 min triangulace s druhou AI session.
- Druhá session musí mít **jiný kontext** (jedna strategie/plán, druhá kód/runtime)
  — jinak je to echo chamber.
- Ptej se explicitně na **alternativy a edge-cases**, ne „souhlasíš?".
- Procesní rámec, který jsme u toho přijali (metodika, ne nález triangulace):
  **každý decision record jede se svou implementací** — proto esbuild bundling
  dostal vlastní D-015, ne přílepek k D-014.

**Mantra:** Architekt vidí konzistenci, implementer vidí runtime. Bug se nejčastěji
schovává tam, kde se ty dva pohledy nepřekrývají.
