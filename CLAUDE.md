# Be Strong: werkafspraken voor Claude

Dit bestand wordt bij elke sessie in deze map automatisch gelezen. Houd het actueel.

## Werkmap
- Werk **altijd** in `C:\Users\Gebruiker\OneDrive\Documenten\Be strong` (git, branch `main`).
- Live: https://byornn1993.github.io/Be-strong/ (repo `Byornn1993/Be-strong`, **publiek**).
- Wat er al gebeurd is: [docs/LOGBOEK.md](docs/LOGBOEK.md). Voeg na elke afgeronde wijziging een regel toe.

## Wie en hoe
- Eigenaar: Bjorn (nl-BE, geen programmeur). Antwoord in eenvoudig Nederlands.
- Neem technische beslissingen zelf en bouw door; vraag alleen als je echt vastzit of bij productie-/data-ingrepen.
- Rapporteer eerlijk wat getest is en wat niet (bv. "niet op echte iPhone getest").
- Eén logische wijziging per commit, Nederlandse commitboodschap, eindigend met de Co-Authored-By-regel.

## Harde regels
- **Supabase-secret key, databasewachtwoord en Bjorns wachtwoorden: nooit vragen, nooit invullen.** De publishable key mag publiek.
- **Geen productiemigratie zonder expliciet "ja" van Bjorn.** Schrijf ze apart in `supabase/migrations/`, leg uit wat ze doet, test ze op PGlite. Daarna (met zijn ok) uitvoeren via de SQL Editor in zijn Chrome (Claude in Chrome; tekst zetten met `monaco.editor.getModels()[0].setValue(...)`, resultaat controleren met een `select`).
- **Volgorde bij migraties:**
  - nieuwe tabellen/rijen die de app nodig heeft → eerst migratie, dan app pushen;
  - nieuwe enum-/typewaarden (bv. een oefeningtype) → eerst app pushen, dan migratie (oude app-versies weigeren onbekende waarden).
- Het Supabase-project (`mngqptjikxeihmmnibio`) is **gedeeld** met Boodschappenlijst (`lists_`) en Our Network (`net_`). Raak hun tabellen/functies nooit aan; zie `SUPABASE_SHARED.md`. Bjorn Finance is een ander project: nooit aanraken.
- Persoonlijke bestanden in de projectmap (`strong_workouts.csv`, `bjorn-finance-export*.json`, afbeeldingen, PDF's) en `.env` nooit committen. Geen e-mailadressen in code (repo is publiek).
- Niets schrappen zonder het eerst te vragen. Geen nieuwe dependencies tenzij ze duidelijk iets oplossen.

## Stack en structuur
- Vite + React 18 + TypeScript strict, Tailwind met CSS-variabelen (huisstijl goud/antraciet, licht/donker), PWA (vite-plugin-pwa, prompt-modus).
- Local-first: Dexie (IndexedDB) + outbox + sync (`src/lib/sync`), Supabase is de bron van waarheid.
- `src/domain/*`: pure logica met tests (PR's, volume, opmaak, Strong-import, oefeningen zoeken).
- `src/features/*`: schermen. `src/components/ui/*`: Sheet, Button, NumberInput, Toast, …
- Standaardoefeningen: `scripts/exercise-library.mjs` → `npm run gen:exercises` → `src/data/exercises.json` + migratie 0200. Nieuwe oefening op productie = **aparte** insert-migratie; daarna `npm run gen:setup-sql` en het aantal in `tests/rls/setup-file.test.ts` bijwerken.

## Valkuilen (al eens fout gegaan)
- **Geen IndexedDB-cursors** (`orderBy`, `.first()`, `.reverse()`, `where().delete()`…): iPhone geeft "Unable to open cursor". Gebruik `toArray()` + sorteren in JS.
- Pagina's gebruiken `useWorkoutActions`/`useWorkoutStatus`, niet `useActiveWorkout` (dat herrendert bij elke toetsaanslag).
- Geen `backdrop-blur` op balken/sheets op mobiel (traag op iOS). `--surface` blijft dekkend.
- Recharts nooit rechtstreeks importeren: gebruik `@/components/charts` (lui geladen).
- Sheets: een sheet in een sheet ligt erboven via `DepthContext`; scroll-lock is een teller. Vensters met een zoekveld krijgen `tall` (anders zakt het zoekveld achter het iPhone-toetsenbord).
- Afvinken van een set opent géén toetsenbord (Bjorn wil dat niet). Vegen/slepen bewust minder gevoelig gemaakt.
- Cardio-type `duration_level` (Tijd + Stand 0–20): de stand staat in het veld `reps`; tijd typen = minuten.

## Testen
- `npm run typecheck`, `npm run lint` (0 errors), `npm test` (unit + RLS/migraties op PGlite).
- Browser: `preview_start` met `be-strong-dev` (`.claude/launch.json`). Zet tijdelijk `.env.local` met `VITE_SUPABASE_URL=http://127.0.0.1:54321` en een nep-sessie in `localStorage['bestrong-auth']` (testgebruiker `aaaaaaaa-0000-4000-8000-00000000000a`); **verwijder `.env.local` daarna**. Gsm-formaat via `resize_window` preset mobile.
- Na push: CI en Deploy controleren via PowerShell `Invoke-RestMethod https://api.github.com/repos/Byornn1993/Be-strong/actions/runs?head_sha=<sha>` (`gh` staat niet in Git Bash).
- PowerShell/Git Bash: Node staat in `C:\Program Files\nodejs` (in Bash: `export PATH="$PATH:/c/Program Files/nodejs"`). Geen Python: scripts met node.
- Nieuwe versie zichtbaar op toestel: "Herladen" in de app, of alle vensters sluiten en opnieuw openen.
