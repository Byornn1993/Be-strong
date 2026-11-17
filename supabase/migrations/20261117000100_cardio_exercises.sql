-- Extra cardio-standaardoefeningen (buiten lopen/fietsen, wandelen op de loopband, trap, crosstrainer).
-- Voegt alleen NIEUWE rijen toe aan public.exercises (user_id null = standaard, voor iedereen leesbaar).
-- Wijzigt geen schema en raakt geen bestaande gegevens. Veilig om opnieuw uit te voeren (on conflict do nothing).
-- Dezelfde rijen staan ook in 20261023000200_standard_exercises.sql (voor een nieuwe installatie).
insert into public.exercises (id, user_id, name, primary_muscle, secondary_muscles, equipment, type)
values
  ('3a53be51-7a07-562e-ab46-7181f7dd1a70', null, 'Running', 'full_body', array['legs']::text[], 'other', 'distance_duration'),
  ('81afcc18-c21d-511b-81f4-00da02a06ecb', null, 'Cycling', 'full_body', array['legs']::text[], 'other', 'distance_duration'),
  ('2b304c44-86c3-5c61-9e65-e70d9e05dbc7', null, 'Walking (Treadmill)', 'full_body', array['legs']::text[], 'machine', 'distance_duration'),
  ('a273c0d8-7733-5fb2-aba8-86c74fcb7cb8', null, 'Stair Climber (Machine)', 'full_body', array['legs', 'glutes']::text[], 'machine', 'duration'),
  ('725ae8cb-9f8b-5ad5-8167-1775c99003b1', null, 'Elliptical Trainer', 'full_body', array['legs']::text[], 'machine', 'distance_duration')
on conflict (id) do nothing;
