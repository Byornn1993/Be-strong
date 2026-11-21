# HANDOVER: Be Strong

Overdrachtsdocument voor een nieuwe Claude-sessie (Claude Cowork) zonder voorkennis. Lees ook [CLAUDE.md](CLAUDE.md) (werkafspraken) en [docs/LOGBOEK.md](docs/LOGBOEK.md) (alles wat er gebeurd is, per datum).

- **Projectmap:** `C:\Users\Gebruiker\OneDrive\Documenten\Persoonlijke apps\Be strong`
- **Live app:** https://byornn1993.github.io/Be-strong/
- **Code:** https://github.com/Byornn1993/Be-strong (publiek, branch `main`)
- **Laatst bijgewerkt:** 21 november 2026

---

## 1. Naam en doel
**Be Strong: "Stronger than yesterday".** Persoonlijke fitness-app van Bjorn, gebouwd als vervanger van de app Strong. Je logt er workouts mee (sets, gewicht, reps, cardio), werkt met templates, ziet "Vorige" waarden, een rusttimer, PR's, geschiedenis met kalender, lichaamsmetingen, doelen en een dashboard. Het is een PWA: geïnstalleerd op zijn iPhone (beginscherm) en op zijn laptop, werkt offline en synchroniseert met Supabase.

## 2. Huidige status
**Werkt (live, dagelijks gebruikt):**
- Inloggen (registratie staat uit), wachtwoord vergeten.
- Workout starten (leeg of uit template, ▶-knop = 2 tikken), sets loggen met "Vorige", afvinken (geen toetsenbord), rusttimer, pauze, supersets, set verwijderen door naar links te vegen, oefeningen verslepen (vasthouden), Finish/opslaan/weggooien.
- Templates maken/bewerken (velden volgen het oefeningtype), mappen, dupliceren.
- Oefeningen: 116 standaardoefeningen + eigen oefeningen, filter op spiergroep of **Cardio**, zoeken ook in het Nederlands.
- Cardio-type **Tijd + Stand** (stand 0–20) en **Afstand + Tijd** (roeien); tijd typen in minuten.
- Geschiedenis, kalender, workoutdetail (bewerken), statistieken, PR's, metingen met grafieken, doelen, dashboard-widgets.
- Strong-import (CSV): 141 workouts van Bjorn zijn geïmporteerd.
- Offline werken + sync met conflictmelding; sync-problemen zichtbaar bovenaan op gsm.
- Licht/donker thema in de Bjorn huisstijl.

**Half af / niet getest:**
- End-to-end-tests (Playwright) bestaan maar zijn nooit gedraaid: dat vraagt een lokale Supabase met Docker.
- De laatste wijzigingen (zoekvenster boven het iPhone-toetsenbord, cardio met tijd + stand, template-velden) zijn getest in de browser op gsm-formaat, maar nog niet bevestigd op Bjorns echte iPhone.
- Bestaande templates met Cycling (Indoor) kunnen nog "10" uit de oude Reps-kolom hebben; dat toont nu als Stand 10.

**Nog te doen (ideeën):** zie §10.

## 3. Mappenstructuur
```
Be strong/
├─ CLAUDE.md               werkafspraken voor Claude (lees eerst)
├─ HANDOVER.md             dit document
├─ README.md               technische uitleg + installatie
├─ STAPPENPLAN.md          eenvoudig stappenplan voor Bjorn (Supabase/GitHub opzetten)
├─ SUPABASE_SHARED.md      afspraken voor het gedeelde Supabase-project (kopie in elke app)
├─ docs/
│  ├─ LOGBOEK.md           wat er gebouwd is, per datum, in gewone taal
│  ├─ PRS.md               hoe PR's berekend worden
│  └─ huisstijl/           Bjorn huisstijl: designprompt + kleurenpalet (voor al zijn apps)
├─ src/
│  ├─ App.tsx              routes (lui geladen per pagina), login-bescherming
│  ├─ main.tsx, index.css  start + huisstijl-tokens (CSS-variabelen, licht/donker)
│  ├─ components/          AppShell (menu/zijbalk), UpdatePrompt, SyncIndicator, charts (lui), SwipeToDelete,
│  │  └─ ui/               Sheet (bottom sheet/modal), Button, NumberInput/DurationInput, Toast, UndoToast, ConfirmDialog
│  ├─ domain/              pure logica met tests: prs, previous, volume, stats, format, dates, timer, goals,
│  │                       exerciseTypes (kolommen per type), exerciseSearch (Cardio + NL-zoekwoorden), import/strong.ts
│  ├─ features/            schermen: auth, workout (ActiveWorkoutSheet, ExerciseBlock, SetRow, FinishSheet,
│  │                       WorkoutProvider, writeQueue, TemplateEditor, StartWorkout), history, exercises,
│  │                       measure, profile (dashboard, doelen), settings (import, sync)
│  ├─ lib/db/              Dexie-database (schema.ts), types.ts, repo.ts (alle schrijfacties), hooks.ts (leesacties)
│  ├─ lib/sync/            outbox, engine (pull/push/conflicten), scheduler, mappers (lokaal ↔ Supabase, zod)
│  ├─ lib/supabase/        client + remote API
│  └─ data/                exercises.json (gegenereerd), seed-templates.json
├─ supabase/
│  ├─ migrations/          alle databasewijzigingen, op volgorde (zie §6)
│  ├─ setup-productie.sql  alle migraties in één bestand (gegenereerd) voor een lege database
│  └─ seed.sql             alleen lokale testgebruikers
├─ scripts/                gen-exercises (oefeningenlijst → json + SQL), gen-setup-sql, gen-icons, spa-fallback
├─ tests/
│  ├─ unit/                Vitest: domein, sync, writeQueue, Strong-CSV, oefeningen zoeken
│  ├─ rls/                 database-tests op PGlite (RLS, setup-bestand, cardio-migratie op oude toestand)
│  └─ e2e/                 Playwright (nog niet gedraaid)
├─ public/                 icoon (icon.svg + png's), manifest-onderdelen
└─ .github/workflows/      ci.yml (tests) en deploy.yml (tests + build + GitHub Pages)
```
Persoonlijke bestanden in de hoofdmap (**nooit committen**, staan in `.gitignore`): `strong_workouts.csv` (Strong-export), `bjorn-finance-export-*.json`, `Bjorn Finance werking en verslag.pdf`, de WhatsApp-afbeeldingen en de presentatie-png (referentie voor het ontwerp), `.env`.

## 4. Technologie
| Onderdeel | Versie |
|---|---|
| TypeScript (strict) | 5.6.3 |
| React / React DOM | 18.3.1 |
| React Router | 6.28.0 |
| Vite | 5.4.11 |
| Tailwind CSS (met CSS-variabelen) | 3.4.15 |
| vite-plugin-pwa (service worker, prompt-modus) | 0.21.0 |
| Dexie + dexie-react-hooks (IndexedDB) | 4.0.10 / 1.1.7 |
| @supabase/supabase-js | 2.46.1 |
| zod (validatie van serverdata) | 3.23.8 |
| @dnd-kit (verslepen) | core 6.1.0, sortable 8.0.0 |
| Recharts (grafieken, lui geladen) | 2.13.3 |
| lucide-react (iconen), Inter (lettertype) | 0.460.0 / 5.1.0 |
| Vitest, PGlite (Postgres in tests), Playwright | 2.1.5 / 0.2.13 / 1.49.0 |
| Node.js (lokaal) | 24 (CI: 22) |

Database: Supabase (PostgreSQL) met Row Level Security, Auth (e-mail + wachtwoord).

## 5. Starten, testen en uitrollen
**Eenmalig:** Node staat in `C:\Program Files\nodejs`. In Git Bash eerst `export PATH="$PATH:/c/Program Files/nodejs"`. Geen Python op deze pc: scripts met node.

**Starten (lokaal):**
1. `npm install`
2. `.env` bestaat al (met de echte Supabase-URL en publishable key). Dan `npm run dev` → http://localhost:5173.
3. Testen zonder echte data: maak tijdelijk `.env.local` met `VITE_SUPABASE_URL=http://127.0.0.1:54321` en een willekeurige key, zet een nep-sessie in `localStorage['bestrong-auth']` (gebruiker `aaaaaaaa-0000-4000-8000-00000000000a`), en **verwijder `.env.local` daarna**.

**Testen:**
1. `npm run typecheck`
2. `npm run lint` (0 errors; er zijn 15 bekende waarschuwingen over fast refresh)
3. `npm test` (66 tests: unit + database-tests op PGlite)
4. Kernflows in de browser op gsm-formaat (375×812) en laptop: workout starten, set invullen/afvinken, Finish, template bewerken.

**Uitrollen:**
1. Commit op `main` en `git push` (de inlog gebeurt via Git Credential Manager).
2. GitHub Actions draait **CI** en **Deploy naar GitHub Pages** (deploy draait ook alle tests). Controleren:
   `Invoke-RestMethod "https://api.github.com/repos/Byornn1993/Be-strong/actions/runs?head_sha=<sha>"` in PowerShell (`gh` is niet geïnstalleerd).
3. Op toestellen verschijnt de nieuwe versie na **Herladen** in de app (of alle vensters sluiten en opnieuw openen).
4. **Databasewijzigingen gaan nooit automatisch mee.** Zie §6 en CLAUDE.md voor de volgorde.

## 6. Data
**Supabase-project** "Be strong", ref `mngqptjikxeihmmnibio`, regio eu-west-1, organisatie Byornn1993. Bron van waarheid. Registratie staat uit; Bjorn heeft één account.

Tabellen (schema `public`, allemaal met RLS: je ziet alleen je eigen rijen; standaardoefeningen en -meettypes hebben `user_id null` en zijn voor iedereen leesbaar):
| Tabel | Inhoud |
|---|---|
| `profiles` | naam, weekdoel, standaard rusttijd (automatisch aangemaakt bij een nieuwe gebruiker) |
| `exercises` | standaard (116) + eigen oefeningen; `type` bepaalt de kolommen |
| `exercise_prefs` | eigen notities/rusttijd per oefening |
| `workout_templates` → `template_exercises` → `template_sets` | templates |
| `workouts` → `workout_exercises` → `workout_sets` | gedane workouts (oefeningnaam en -type als snapshot) |
| `measurement_types`, `body_measurements` | metingen (gewicht, omtrek…) |
| `goals`, `dashboard_widgets` | doelen en dashboard |

Oefeningtypes: `weight_reps`, `bodyweight_reps`, `weighted_bodyweight`, `assisted_bodyweight`, `duration`, `distance_duration`, `weight_distance`, `duration_level` (cardio: tijd + stand; de stand staat in `workout_sets.reps`).

Functies (RPC, met de rechten van de gebruiker): `upsert_workout`, `upsert_template`, `import_workouts`; verder `set_updated_at` (trigger) en `handle_new_user`. Soft deletes via `deleted_at`.

**Migraties** (`supabase/migrations/`, allemaal uitgevoerd op productie):
`20261023000100_schema` · `000200_standard_exercises` · `000300_rls` · `000400_rpc` · `000500_measurement_types` · `20261117000100_cardio_exercises` · `20261117000200_cardio_tijd_stand`.

**Op het toestel:** IndexedDB-database `bestrong-<user-id>` (Dexie): kopie van alle tabellen + `outbox` (wachtrij van wijzigingen) + `conflicts` + `meta` (sync-cursors) + `active` (de lopende workout, bij elke tik bewaard). localStorage: `bestrong-auth` (sessie), `bestrong-theme`.

**Bestanden:** `strong_workouts.csv` in de projectmap (Strong-export, 141 workouts, 2006 sets; al geïmporteerd).

## 7. Instellingen en omgevingsvariabelen (alleen namen)
- `.env` (lokaal, niet in git): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- GitHub → repo-variabelen (Settings › Secrets and variables › Actions › Variables): dezelfde twee namen. De build gebruikt ook `BASE_PATH` (= `/Be-strong/`, staat in deploy.yml).
- Supabase Auth: Site URL en redirect-URL's = de live URL en `http://localhost:5173`; registratie uit; e-mailbevestiging uit.
- De secret/service_role key en het databasewachtwoord worden **nooit** gebruikt of gevraagd.

## 8. Belangrijke beslissingen (en waarom)
- **Eigen Supabase-project, los van Bjorn Finance:** fouten of wijzigingen in de ene app kunnen de andere niet raken. Het gratis plan laat 2 projecten toe, daarom zijn de andere apps gasten in dit project (§11).
- **Local-first (eerst op het toestel, dan synchroniseren):** de app moet werken in de gym zonder bereik en snel aanvoelen. Conflicten worden getoond, nooit stilzwijgend overschreven.
- **GitHub Pages:** gratis, zelfde aanpak als Bjorn Finance.
- **Migraties nooit automatisch op productie:** Bjorn beslist; Claude voert ze uit via de SQL Editor in zijn Chrome, alleen na zijn "ja".
- **Geen IndexedDB-cursors:** de iPhone gaf "Unable to open cursor".
- **Snelheid op gsm:** de workout-context is in drieën gesplitst, geen wazige achtergronden op mobiel, grafieken en het workoutscherm worden lui geladen (opstartcode 182 → 86 kB).
- **Bediening:** set afvinken opent geen toetsenbord; vegen/slepen bewust minder gevoelig; knoppen minstens 44px; de ▶-knop start een template meteen.
- **Cardio:** stand opgeslagen in het bestaande veld `reps` (geen nieuwe kolom nodig); één getal bij cardiotijd = minuten.
- **Oefeningnamen in het Engels** (zoals in Strong, zodat de import klopt), met Nederlandse zoekwoorden.
- **Uitloggen alleen op dit toestel:** zodat Boodschappenlijst (zelfde login) ingelogd blijft.

## 9. Bekende bugs en valkuilen
- **Nieuwe versie niet zichtbaar** op een toestel: de service worker houdt de oude versie vast tot je "Herladen" tikt of alle vensters sluit.
- **Volgorde bij migraties:** nieuwe tabellen/rijen → eerst migratie, dan app; nieuwe type-/enumwaarden → eerst app, dan migratie (oude app-versies weigeren onbekende waarden via zod).
- Nieuwe standaardoefening: aanpassen in `scripts/exercise-library.mjs` → `npm run gen:exercises` → aparte insert-migratie → `npm run gen:setup-sql` → aantal in `tests/rls/setup-file.test.ts` bijwerken.
- `tests/rls/cardioMigration.test.ts` leest oude migraties uit de git-geschiedenis: CI en deploy halen daarom de volledige geschiedenis op (`fetch-depth: 0`).
- Recharts nooit rechtstreeks importeren (altijd `@/components/charts`).
- Vensters met een zoekveld krijgen `tall` op `Sheet`, anders zakt het zoekveld achter het iPhone-toetsenbord.
- Chrome kan het wachtwoord van Bjorn Finance invullen (zelfde domein github.io): dat gaf eerder "wachtwoord klopt niet".
- Het Windows-snelkoppelingsicoon blijft soms oud (icooncache).
- In de Supabase SQL Editor blijft een "Site verlaten?"-melding staan na een query; open een volgende pagina in een nieuw tabblad.

## 10. Volgende stappen
1. Bjorn laten bevestigen op zijn **iPhone** dat het zoekvenster, cardio (tijd + stand) en de template-velden goed werken; zijn bestaande cardio-templates nakijken (Stand 10 → juiste waarde).
2. **Afbeeldingen bij oefeningen** toevoegen (bv. de gratis free-exercise-db), lui geladen.
3. **End-to-end-tests** echt laten draaien (Docker + `npx supabase start`), of de Playwright-tests ombouwen naar de bestaande nep-sessie-aanpak.
4. Eventueel een **PR/record voor cardio** (hoogste stand, langste tijd per stand) en cardio in de statistieken.
5. Bij veel meer workouts: pagina's alleen laden wat ze nodig hebben (nu laadt elke pagina alle workouts).

## 11. Samenhang met de andere apps
Bjorns apps staan in `C:\Users\Gebruiker\OneDrive\Documenten\Persoonlijke apps\` en delen één huisstijl ([docs/huisstijl](docs/huisstijl/)) met gloedachtergrond en doorschijnende kaarten.
| App | Bijnaam | Map | Data |
|---|---|---|---|
| **Be Strong** | B strong | `Be strong` | **eigen** Supabase-project (eigenaar) |
| Boodschappenlijst | B lists | `B lists` | gast in het Be Strong-project, prefix `lists_` |
| Our Network | | `Our Network` | gast in het Be Strong-project, prefix `net_` |
| Bjorn Finance | B finance | `Be finance` | **ander** Supabase-project: nooit aanraken vanuit Be Strong |

- Alle drie de apps in het Be Strong-project gebruiken **hetzelfde Supabase-account** om in te loggen. Een nieuwe gebruiker aanmaken voor een andere app maakt via `handle_new_user` ook een leeg Be Strong-profiel aan.
- Regels voor het gedeelde project: [SUPABASE_SHARED.md](SUPABASE_SHARED.md). Raak nooit `lists_`- of `net_`-tabellen/functies aan, en gebruik nooit een statement op een heel schema.
- Uitloggen gebeurt in elke app alleen lokaal, zodat de andere apps ingelogd blijven.
