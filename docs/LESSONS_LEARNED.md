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
