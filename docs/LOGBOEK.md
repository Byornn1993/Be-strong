# Logboek Be Strong

Wat er gebouwd en aangepast is, in gewone taal. Nieuwste onderaan. Commitcodes tussen haakjes.

## Oktober 2026: de basis

**23 oktober: app gebouwd en online gezet**
- Projectopzet, eigen Supabase-project met databaseschema, beveiliging (RLS) per tabel en tests daarvoor (12f7ac9).
- Kernlogica: lokale database op het toestel, synchronisatie met conflictmelding, PR's, "Vorige", rusttimer, import van de Strong-export (f07a669).
- Alle schermen: workout, templates, oefeningen, geschiedenis met kalender, metingen, dashboard, doelen, instellingen (a4babe8).
- Bugfixes na browsertest, offline-strook op gsm, end-to-end-tests, CI (e4dac68).
- Eenvoudig stappenplan en één installatiebestand voor Supabase (fa1f6b1). Database geïnstalleerd, registratie uitgezet, 141 workouts uit Strong geïmporteerd, live op GitHub Pages.
- "Wachtwoord vergeten" toegevoegd (347a0ea).
- iPhone laadde geen gegevens ("Unable to open cursor"): opgelost en knop "Lokale kopie opnieuw opbouwen" toegevoegd (57b9d43).

**30 oktober: huisstijl**
- Bjorn huisstijl: goud/antraciet, licht/donker-knop, nieuwe navigatie, donker app-icoon (d625499).
- Kaart "App installeren of icoon vernieuwen" in Instellingen (b8a8cea).

## November 2026

**5–6 november**
- Uitloggen alleen op dit toestel, zodat Boodschappenlijst (zelfde Supabase-project) ingelogd blijft; afspraken voor het gedeelde project in `SUPABASE_SHARED.md` (9cbaf39).
- Achtergrondgloed en doorschijnende kaarten met gouden rand (f0c1e3c).

**10 november: sneller en handiger op gsm**
- App sneller tijdens het typen, "Herladen" sneller; set verwijderen door naar links te vegen; oefeningen verslepen met de vinger (646f4ec).
- Per ongeluk gestarte workout kan je verwijderen (b4f07de).
- Scrollen werkte niet meer na afronden/verwijderen; volgende workout werd niet bewaard: opgelost (4b4868d).

**12 november: Finish-knop en optimalisatieronde**
- Finish werkte niet: opgelost. Vegen en slepen minder gevoelig. Geen toetsenbord meer bij afvinken (e808244).
- Optimalisatie (analyse + 12 stappen, met akkoord van Bjorn):
  - sync-problemen zichtbaar op gsm (271eaaa);
  - duidelijke melding als de opslag op het toestel niet opent (428f83f);
  - grafieken pas laden als ze getoond worden (cfce152);
  - template starten met de gouden ▶-knop: 2 tikken i.p.v. 3 (73fe5a6);
  - "Set toevoegen" en setvelden 44px hoog (cdf197b, 95d01a8);
  - opruimen van ongebruikte code en dubbele code, workoutscherm opgesplitst (562b8bd, 341be84, db0ab00);
  - workoutscherm pas laden als er een workout loopt: opstartcode 182 → 86 kB (a78872e);
  - kleine tekst groter (709ffac);
  - korte "Bewaard ✓"-melding na opslaan (4ea4ded).

**17 november: cardio**
- Filter "Cardio" bij oefeningen, zoeken in het Nederlands (fietsen, roeien, lopen, wandelen, trap, crosstrainer), 5 nieuwe oefeningen: Running, Cycling, Walking (Treadmill), Stair Climber (Machine), Elliptical Trainer (2f91a3f). Migratie `20261117000100` uitgevoerd op productie.
- iPhone: zoekvenster "Oefening toevoegen" zakte achter het toetsenbord: opgelost (7dfaf5a).
- Nieuw oefeningtype **Tijd + stand** (stand 0–20), tijd typen in minuten. Cycling (Indoor), Running (Treadmill), Running, Cycling, Walking, Walking (Treadmill), Stair Climber, Elliptical Trainer gebruiken het; Rowing blijft afstand + tijd (d32e827, 5906be4). Migratie `20261117000200` uitgevoerd op productie.
- Template-editor toont de velden van het oefeningtype (bv. Tijd + Stand), ook in de preview (93e21f6).

**21 november**
- `CLAUDE.md` (werkafspraken voor Claude) en dit logboek toegevoegd.

## Nog niet gedaan / ideeën
- End-to-end-test met een lokale Supabase (vraagt Docker op de laptop).
- Afbeeldingen bij oefeningen (gratis free-exercise-db).
- Bij heel veel workouts: pagina's alleen laden wat ze nodig hebben.
