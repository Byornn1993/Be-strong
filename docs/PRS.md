# Persoonlijke records (PR's) — definities

Code: [`src/domain/prs.ts`](../src/domain/prs.ts). Tests: `tests/unit/domain.test.ts`.

PR's worden **afgeleid** uit de opgeslagen workouts (niet apart bewaard). De app is local-first,
dus de berekening gebeurt in de app op de lokale kopie. Bij ±150 workouts duurt dat enkele milliseconden.

## Algemene regels

- Alleen **afgewerkte** sets (`completed = true`).
- **Nooit warm-up-sets.**
- Alleen binnen **hetzelfde oefeningtype**: een historische set telt mee als het type-snapshot van
  die workout gelijk is aan het huidige type van de oefening. Verander je het type (bv. Chin Up van
  "gewicht × reps" naar "extra gewicht × reps"), dan beginnen de records opnieuw.
- Verwijderde workouts tellen niet mee.

## Records

| Record | Definitie | Types |
|---|---|---|
| Zwaarste gewicht | hoogste `kg` in één set met ≥ 1 rep | weight_reps, weighted_bodyweight (+kg), weight_distance |
| Meeste reps per gewicht | per gewicht het hoogste aantal reps (bij bodyweight: één waarde) | weight_reps, weighted_bodyweight, bodyweight_reps |
| Geschatte 1RM | **Epley**: `kg × (1 + reps/30)`, enkel sets van 1–12 reps; 1 rep = het gewicht zelf. Altijd gelabeld als *schatting*. | weight_reps |
| Grootste setvolume | hoogste `kg × reps` in één set | weight_reps, weighted_bodyweight |
| Grootste sessievolume | hoogste som `kg × reps` voor die oefening binnen één workout | weight_reps, weighted_bodyweight |
| Langste tijd | hoogste duur in één set | duration, distance_duration |
| Langste afstand | hoogste afstand in één set | distance_duration, weight_distance |

## "Nieuw PR"

Bij Finish en in de geschiedenis is een record **nieuw** als de waarde in deze workout **strikt
hoger** is dan de beste waarde van alle workouts die **vóór** deze workout begonnen, én er al een
eerdere waarde bestond. De allereerste keer dat je een oefening doet is een nulmeting, geen PR.
Voor "meeste reps per gewicht" moet je dat exacte gewicht al eerder gedaan hebben.

## Volume (algemeen)

Volume = `kg × reps` van afgewerkte sets, **inclusief** warm-ups (zoals in Strong), voor
weight_reps en weighted_bodyweight. Assisted-, bodyweight-, tijd- en afstandsoefeningen hebben volume 0.
