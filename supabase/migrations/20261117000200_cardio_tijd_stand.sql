-- Cardio: nieuw oefeningtype 'duration_level' (Tijd + stand 0–20) en 8 cardio-standaardoefeningen omzetten.
--
-- Wat dit doet:
--  1. De lijst met toegelaten oefeningtypes uitbreiden met 'duration_level' (op exercises en op de
--     snapshot in workout_exercises). Geen nieuwe kolommen: de stand wordt bewaard in workout_sets.reps.
--  2. Deze standaardoefeningen (user_id null) krijgen type 'duration_level':
--       Running (Treadmill)
--       Cycling (Indoor)
--       Walking
--       Running
--       Cycling
--       Walking (Treadmill)
--       Stair Climber (Machine)
--       Elliptical Trainer
--     Rowing (Machine) blijft 'distance_duration' (afstand + tijd).
--
-- Wat dit NIET doet: bestaande workouts en sets blijven ongewijzigd (elke workout bewaart het type van
-- toen als snapshot). Eigen oefeningen worden niet aangeraakt. Veilig om opnieuw uit te voeren.

do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.exercises'::regclass, 'public.workout_exercises'::regclass)
      and pg_get_constraintdef(oid) like '%distance_duration%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end
$$;

alter table public.exercises add constraint exercises_type_check check (type in
  ('weight_reps','bodyweight_reps','weighted_bodyweight','assisted_bodyweight','duration','distance_duration','weight_distance','duration_level'));
alter table public.workout_exercises add constraint workout_exercises_exercise_type_check check (exercise_type in
  ('weight_reps','bodyweight_reps','weighted_bodyweight','assisted_bodyweight','duration','distance_duration','weight_distance','duration_level'));

update public.exercises
set type = 'duration_level'
where user_id is null
  and type <> 'duration_level'
  and id in (
    'c21ce5ec-d88f-5f24-986f-fca542fe3016',
    'a97ace8a-9adb-58f1-832d-92f9af87072d',
    '254eff21-c315-5457-a8e1-2a203beca84a',
    '3a53be51-7a07-562e-ab46-7181f7dd1a70',
    '81afcc18-c21d-511b-81f4-00da02a06ecb',
    '2b304c44-86c3-5c61-9e65-e70d9e05dbc7',
    'a273c0d8-7733-5fb2-aba8-86c74fcb7cb8',
    '725ae8cb-9f8b-5ad5-8167-1775c99003b1'
  );
