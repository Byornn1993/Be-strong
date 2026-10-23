# Be Strong — Stronger than yesterday

Persoonlijke fitness-PWA voor Bjorn Wevers. React + TypeScript + Vite, Supabase (auth + Postgres),
local-first met IndexedDB, installeerbaar op iPhone.

- **Local-first:** alles wat je doet gaat eerst naar de lokale database (IndexedDB) en een wachtrij
  (outbox). Zodra er verbinding is, wordt de wachtrij met idempotente upserts/RPC's naar Supabase gestuurd.
  Supabase is de bron van waarheid; conflicten worden getoond, nooit stilzwijgend overschreven.
- **Privé:** publieke registratie staat uit, RLS op elke tabel, geen service-role key in de app.
- **Eigen project:** eigen GitHub-repo en eigen Supabase-project, volledig los van Bjorn Finance.

---

## 1. Lokaal starten

Vereist: Node 22+ (getest met Node 24) en npm.

```bash
npm install
cp .env.example .env    # vul URL + publishable key in (zie §2)
npm run dev             # http://localhost:5173
```

Handige scripts:

| Script | Wat |
|---|---|
| `npm run dev` | ontwikkelserver |
| `npm run typecheck` | TypeScript (strict) |
| `npm run lint` | ESLint |
| `npm test` | unit-tests + RLS-tests (Vitest, draait migraties op een embedded Postgres) |
| `npm run build` | production build + SPA-fallback voor GitHub Pages |
| `npm run test:e2e` | Playwright op iPhone-viewport (vereist lokale Supabase, zie §6) |
| `npm run gen:exercises` | standaardoefeningen → `src/data/exercises.json` + migratie |
| `npm run gen:icons` | PWA-iconen uit `public/icon.svg` |

### Met een lokale Supabase (optioneel, vereist Docker Desktop)

```bash
npx supabase start          # start Postgres/Auth/API lokaal en past migraties + seed.sql toe
npx supabase status         # toont API URL en anon/publishable key → zet ze in .env.local
npm run dev
```

Lokaal bestaan twee testgebruikers (alleen lokaal, uit `supabase/seed.sql`):
`test-a@bestrong.test` / `test-password-a` en `test-b@bestrong.test` / `test-password-b`.

---

## 2. Supabase (productie) opzetten

Het project **Be Strong** bestaat al. Gebruik regio Frankfurt (zoals Finance), maar deel niets met Finance.

1. **Sleutels voor de app** — Dashboard › Project Settings › API:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `Publishable key` (of legacy `anon`) → `VITE_SUPABASE_PUBLISHABLE_KEY`

   Deze twee mogen publiek zijn (ze zitten in de gebouwde app). De **secret/service_role key en het
   databasewachtwoord deel je met niemand** en komen nooit in de code of in GitHub.

2. **Auth-instellingen** — Dashboard › Authentication:
   - *Sign In / Providers › Email*: Email aan. **Allow new users to sign up: UIT.**
   - *Confirm email*: mag uit (je maakt je account zelf aan).
   - *URL Configuration*: Site URL = `https://<github-user>.github.io/<repo>/`,
     Redirect URLs = hetzelfde adres + `http://localhost:5173` (voor de magic link).

3. **Migraties toepassen** (doe je zelf; CI doet dit nooit). Kies één manier:

   **A. Supabase CLI (aanbevolen)**
   ```bash
   npx supabase login
   npx supabase link --project-ref <jouw-project-ref>    # vraagt je databasewachtwoord
   npx supabase db push                                   # past supabase/migrations/* toe
   ```

   **B. SQL Editor in het dashboard** — open de bestanden in `supabase/migrations/` **in volgorde**
   (op bestandsnaam) en voer ze één voor één uit:
   `…000100_schema.sql`, `…000200_standard_exercises.sql`, `…000300_rls.sql`, `…000400_rpc.sql`,
   `…000500_measurement_types.sql`.

   Controle: Table Editor toont 13 tabellen met een slotje (RLS aan); `exercises` bevat 111 standaardoefeningen.

4. **Je account aanmaken** — Dashboard › Authentication › Users › **Add user › Create new user**:
   je e-mail + een sterk wachtwoord, *Auto Confirm User* aan. Je profiel wordt automatisch aangemaakt.
   Wachtwoord wijzigen kan later in de app (Instellingen › Wachtwoord wijzigen).
   Vergeten? Dashboard › Authentication › Users › … › Send password recovery.

> **Let op:** een gratis Supabase-project pauzeert na ongeveer een week zonder gebruik. Ga dan naar
> supabase.com en klik in je project op *Restore project*. Je gegevens blijven bewaard; de app blijft
> intussen lokaal werken en synchroniseert zodra het project weer draait.

---

## 3. Deployen (GitHub Pages, zoals Bjorn Finance)

1. Maak een **nieuwe** repository (bv. `be-strong`). Gratis GitHub Pages vraagt een openbare repo;
   er staan geen geheimen in de code (controleer: `.env` staat in `.gitignore`).
2. Push deze map:
   ```bash
   git remote add origin https://github.com/<github-user>/be-strong.git
   git push -u origin main
   ```
3. Repo › Settings › **Pages** › Source: **GitHub Actions**.
4. Repo › Settings › Secrets and variables › Actions › **Variables**:
   `VITE_SUPABASE_URL` en `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Elke push naar `main` draait `.github/workflows/deploy.yml`: typecheck, lint, tests, build, publiceren.
   De app staat dan op `https://<github-user>.github.io/be-strong/`.

Details: de build zet `base` op `/<repo>/`; `404.html` is een kopie van `index.html` (SPA-fallback,
want GitHub Pages kent geen rewrites); `.nojekyll` voorkomt Jekyll-verwerking. De service worker
cachet alleen de app-shell en statische bestanden — nooit API-antwoorden of persoonlijke data.

Na een nieuwe versie toont de app "Er is een nieuwe versie" met een knop *Herladen*. Een lopende
workout gaat daarbij niet verloren.

---

## 4. Installeren op iPhone

1. Open de app-URL in **Safari** (of Chrome) op je iPhone en log in.
2. Tik op **Deel** › **Zet op beginscherm** › *Voeg toe*.
3. Open Be Strong voortaan via het icoon: schermvullend, zonder adresbalk, en het opent ook offline.

---

## 5. Je bestaande data

- **Standaardtemplates:** Instellingen › *Importeer standaardtemplates* (Upper, Only Upper 1/2,
  Lower Dag 1/2, Armdag). Bron: `src/data/seed-templates.json`. Opnieuw uitvoeren maakt geen dubbels
  en overschrijft je aanpassingen niet.
- **Strong-geschiedenis:** Instellingen › *Importeer uit Strong (CSV)*. Je ziet eerst een voorbeeld
  (workouts, sets, onbekende oefeningen, naamkoppelingen). Opnieuw importeren is veilig (vaste ids per
  workout; server en app slaan bestaande workouts over). Formaat en keuzes: zie `src/domain/import/strong.ts`.
  Je echte export (`strong_workouts.csv`) staat bewust **niet** in Git.
- **Back-up:** Instellingen › *Back-up exporteren (JSON)*. Bewaar dat bestand veilig, nooit op GitHub.

---

## 6. Testen

- `npm test` — 57 tests: statistieken, streak, PR's, Previous, rusttimer, sync-wachtrij (incl. conflicten
  en offline), Finish-idempotentie, Strong-CSV-parser, seed-templates en **RLS**.
  De RLS-tests draaien alle migraties op een echte Postgres (PGlite, in-process) met twee gebruikers en
  controleren dat B de data van A niet kan lezen, wijzigen, overschrijven of eraan koppelen — ook niet
  met de juiste UUID.
- `npm run test:e2e` — Playwright, iPhone-viewport, tegen een production build en een **lokale**
  Supabase: login, template maken, workout starten, sets loggen, refresh + herstel, Finish (dubbel tikken),
  History + kalender, meting, offline openen. Vereist Docker + `npx supabase start` en `.env.local` met de
  lokale URL/key. Eerste keer: `npx playwright install chromium`.

---

## 7. Architectuur

```
src/
  domain/          pure functies: datums, stats, PR's, Previous, timer, volume, doelen, Strong-import
  lib/db/          Dexie-schema (IndexedDB), leeshooks, schrijfacties (repo)
  lib/sync/        outbox, sync-engine (pull/push/conflicten), planner, mappers (Zod)
  lib/supabase/    client + RemoteApi-implementatie
  features/        auth, workout, exercises, history, measure, profile, settings
  components/      design system (Button, Card, Sheet, NumberInput, EmptyState …) en layout
supabase/migrations  schema, RLS, RPC's (upsert_workout, upsert_template, import_workouts), standaarddata
```

- **Ids** worden in de client gemaakt (UUID). Finish gebruikt de id die bij de start werd vastgelegd,
  dus dubbel tikken / opnieuw versturen kan nooit twee workouts opleveren.
- **Snapshots:** elke workout-oefening bewaart naam en type van dat moment.
- **Tijdzones:** timestamps met offset; groeperen op lokale dag (een workout om 23:30 blijft op die dag).
- **PR-definities:** zie [docs/PRS.md](docs/PRS.md).
- **TanStack Query** wordt bewust niet gebruikt: de UI leest uit IndexedDB via `dexie-react-hooks`
  (live queries), wat offline werkt en meteen reageert. Een tweede cachelaag zou dubbel werk zijn.

---

## 8. Nog niet gedaan / bekende beperkingen

Zie de lijst onderaan het laatste opleveringsverslag. Kort:
- Oefeningafbeeldingen: nu een nette fallback (initiaal + spiergroep). Plan: `free-exercise-db`
  (Unlicense/public domain) in een eigen Storage-bucket; nog niet geïmplementeerd.
- Voortgangsfoto's (privé bucket + signed URLs): nog niet geïmplementeerd.
- Meldingen op de achtergrond zijn op iOS niet betrouwbaar; geluid/trillen werkt in de app.
