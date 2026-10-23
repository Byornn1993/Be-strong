-- BE STRONG — volledige database-installatie (GEGENEREERD door scripts/gen-setup-sql.mjs).
-- Gebruik: Supabase › SQL Editor › New query › alles plakken › Run. Eén keer uitvoeren op een leeg project.

-- ════════ 20261023000100_schema.sql ════════
-- Be Strong — basisschema
-- Principes:
--  * UUID-primary keys worden door de client gegenereerd (offline + idempotentie).
--  * Elke tabel met gebruikersdata heeft user_id + RLS op auth.uid().
--  * Top-level entiteiten gebruiken soft delete (deleted_at), zodat verwijderingen meesynchroniseren.
--  * updated_at wordt altijd door de server gezet (trigger); de client gebruikt het voor sync/conflicten.
--  * Historische workouts bewaren een snapshot van oefeningnaam en -type.

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (char_length(avatar_url) <= 500),
  weekly_workout_goal smallint not null default 3 check (weekly_workout_goal between 1 and 14),
  default_rest_sec integer not null default 120 check (default_rest_sec between 0 and 1800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profiel automatisch aanmaken bij een nieuwe gebruiker.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── exercises ─────────────────────────
create table public.exercises (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade, -- null = standaardoefening
  name text not null check (char_length(name) between 1 and 120),
  primary_muscle text not null check (primary_muscle in
    ('chest','back','shoulders','biceps','triceps','legs','glutes','core','calves','full_body')),
  secondary_muscles text[] not null default '{}' check (secondary_muscles <@ array
    ['chest','back','shoulders','biceps','triceps','legs','glutes','core','calves','full_body']::text[]),
  equipment text not null check (equipment in
    ('barbell','dumbbell','cable','machine','bodyweight','kettlebell','plate_loaded','other')),
  type text not null check (type in
    ('weight_reps','bodyweight_reps','weighted_bodyweight','assisted_bodyweight','duration','distance_duration','weight_distance')),
  instructions text check (char_length(instructions) <= 4000),
  image_path text check (char_length(image_path) <= 500),
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index exercises_user_updated_idx on public.exercises (user_id, updated_at);

-- Persoonlijke instellingen per oefening (ook voor standaardoefeningen): notities en rusttijd.
create table public.exercise_prefs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  notes text check (char_length(notes) <= 4000),
  rest_sec integer check (rest_sec between 0 and 1800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, exercise_id)
);
create index exercise_prefs_user_updated_idx on public.exercise_prefs (user_id, updated_at);

-- ───────────────────────── templates ─────────────────────────
create table public.workout_templates (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  folder text check (char_length(folder) <= 80),
  note text check (char_length(note) <= 4000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index workout_templates_user_updated_idx on public.workout_templates (user_id, updated_at);

create table public.template_exercises (
  id uuid primary key,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null check (position >= 0),
  superset_group text check (char_length(superset_group) <= 40),
  rest_sec integer check (rest_sec between 0 and 1800),
  note text check (char_length(note) <= 4000)
);
create index template_exercises_template_idx on public.template_exercises (template_id);
create index template_exercises_user_idx on public.template_exercises (user_id);

create table public.template_sets (
  id uuid primary key,
  template_exercise_id uuid not null references public.template_exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null check (position >= 0),
  set_type text not null default 'normal' check (set_type in ('normal','warmup','drop','failure')),
  reps integer check (reps between 0 and 10000),
  weight_kg numeric(7,2) check (weight_kg between 0 and 10000),
  duration_sec integer check (duration_sec between 0 and 86400),
  distance_m numeric(10,2) check (distance_m between 0 and 1000000)
);
create index template_sets_te_idx on public.template_sets (template_exercise_id);
create index template_sets_user_idx on public.template_sets (user_id);

-- ───────────────────────── workouts ─────────────────────────
create table public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_sec integer not null default 0 check (duration_sec >= 0),
  note text check (char_length(note) <= 4000),
  template_id uuid references public.workout_templates (id) on delete set null,
  source text not null default 'app' check (source in ('app','strong_import')),
  source_key text check (char_length(source_key) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
create index workouts_user_updated_idx on public.workouts (user_id, updated_at);
create unique index workouts_user_source_key_idx on public.workouts (user_id, source_key) where source_key is not null;

create table public.workout_exercises (
  id uuid primary key,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete set null,
  exercise_name text not null check (char_length(exercise_name) between 1 and 120), -- snapshot
  exercise_type text not null check (exercise_type in
    ('weight_reps','bodyweight_reps','weighted_bodyweight','assisted_bodyweight','duration','distance_duration','weight_distance')), -- snapshot
  position integer not null check (position >= 0),
  superset_group text check (char_length(superset_group) <= 40),
  rest_sec integer check (rest_sec between 0 and 1800),
  note text check (char_length(note) <= 4000)
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index workout_exercises_user_exercise_idx on public.workout_exercises (user_id, exercise_id);

create table public.workout_sets (
  id uuid primary key,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position integer not null check (position >= 0),
  set_type text not null default 'normal' check (set_type in ('normal','warmup','drop','failure')),
  weight_kg numeric(7,2) check (weight_kg between 0 and 10000),
  reps integer check (reps between 0 and 10000),
  duration_sec integer check (duration_sec between 0 and 86400),
  distance_m numeric(10,2) check (distance_m between 0 and 1000000),
  rpe numeric(3,1) check (rpe between 1 and 10),
  completed boolean not null default false,
  completed_at timestamptz,
  note text check (char_length(note) <= 4000)
);
create index workout_sets_we_idx on public.workout_sets (workout_exercise_id);
create index workout_sets_user_idx on public.workout_sets (user_id);

-- ───────────────────────── measurements ─────────────────────────
create table public.measurement_types (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade, -- null = standaardtype
  key text not null check (char_length(key) between 1 and 60),
  name text not null check (char_length(name) between 1 and 60),
  unit text not null check (char_length(unit) between 1 and 12),
  kind text not null check (kind in ('mass','percent','length','other')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index measurement_types_user_updated_idx on public.measurement_types (user_id, updated_at);

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type_id uuid not null references public.measurement_types (id) on delete restrict,
  measured_at timestamptz not null,
  value numeric(9,2) not null check (value >= 0 and value < 10000000),
  unit text not null check (char_length(unit) between 1 and 12),
  note text check (char_length(note) <= 2000),
  source text not null default 'manual' check (source in ('manual','device')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index body_measurements_user_measured_idx on public.body_measurements (user_id, measured_at desc);
create index body_measurements_user_updated_idx on public.body_measurements (user_id, updated_at);

-- ───────────────────────── goals & widgets ─────────────────────────
create table public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bodyweight','workouts_per_week','exercise_weight','exercise_reps','streak')),
  title text check (char_length(title) <= 120),
  exercise_id uuid references public.exercises (id) on delete set null,
  start_value numeric(9,2),
  target_value numeric(9,2) not null,
  deadline date,
  completed_at timestamptz,
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (kind not in ('exercise_weight','exercise_reps') or exercise_id is not null)
);
create index goals_user_updated_idx on public.goals (user_id, updated_at);

create table public.dashboard_widgets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('workouts_per_week','volume_per_week','time_this_week',
    'workouts_this_month','last_workout','recent_prs','bodyweight','goals')),
  position integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index dashboard_widgets_user_updated_idx on public.dashboard_widgets (user_id, updated_at);

-- ───────────────────────── updated_at triggers ─────────────────────────
create trigger set_updated_at before insert or update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.exercises for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.exercise_prefs for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.workout_templates for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.workouts for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.measurement_types for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.body_measurements for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.goals for each row execute function public.set_updated_at();
create trigger set_updated_at before insert or update on public.dashboard_widgets for each row execute function public.set_updated_at();


-- ════════ 20261023000200_standard_exercises.sql ════════
-- GEGENEREERD door scripts/gen-exercises.mjs. Niet met de hand aanpassen.
-- Standaardoefeningen (user_id null): leesbaar voor iedereen die is ingelogd, niet wijzigbaar.
insert into public.exercises (id, user_id, name, primary_muscle, secondary_muscles, equipment, type)
values
  ('73078869-1d3e-53af-aa35-e2fd0189e9a6', null, 'Bench Press (Barbell)', 'chest', array['triceps', 'shoulders']::text[], 'barbell', 'weight_reps'),
  ('f54bb386-d62b-574d-b01d-0c53c233a5de', null, 'Bench Press (Dumbbell)', 'chest', array['triceps', 'shoulders']::text[], 'dumbbell', 'weight_reps'),
  ('89bb3d77-5703-55c1-8d14-7dead01acb95', null, 'Incline Bench Press (Barbell)', 'chest', array['shoulders', 'triceps']::text[], 'barbell', 'weight_reps'),
  ('ffc1c75a-565d-5fc9-abf1-3231b9f110a3', null, 'Incline Bench Press (Dumbbell)', 'chest', array['shoulders', 'triceps']::text[], 'dumbbell', 'weight_reps'),
  ('d3f4924d-a202-54cf-bc4d-767ea862cd84', null, 'Close Grip Bench Press (Barbell)', 'triceps', array['chest']::text[], 'barbell', 'weight_reps'),
  ('54f24855-5f6a-5dbc-8ae5-14dedf086cbd', null, 'Chest Press (Machine)', 'chest', array['triceps', 'shoulders']::text[], 'machine', 'weight_reps'),
  ('85a772ec-ccc7-56f7-ab54-f2fe2a8d4236', null, 'Incline Chest Press (Machine)', 'chest', array['shoulders']::text[], 'machine', 'weight_reps'),
  ('c2fe928e-f40f-5810-9550-3b1b2684e965', null, 'Iso-Lateral Chest Press (Machine)', 'chest', array['triceps']::text[], 'machine', 'weight_reps'),
  ('a313302d-6050-510d-bed0-bb591c3e82c3', null, 'Chest Fly (Dumbbell)', 'chest', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('2e487af1-9dc1-58e9-ab5e-881da65fb129', null, 'Chest Fly (Band)', 'chest', '{}'::text[], 'other', 'weight_reps'),
  ('f8c114a9-711f-5a41-996c-ac290b72844c', null, 'Pec Deck (Machine)', 'chest', '{}'::text[], 'machine', 'weight_reps'),
  ('dc6285d4-f8d9-5817-b3b1-1fc5f40c3e58', null, 'Cable Crossover', 'chest', array['shoulders']::text[], 'cable', 'weight_reps'),
  ('cb1adfb5-beae-57e2-99f8-d521af5ba994', null, 'Push Up', 'chest', array['triceps', 'shoulders']::text[], 'bodyweight', 'bodyweight_reps'),
  ('87a6ddd3-5402-563d-bd13-2dc4d77612ee', null, 'Dip', 'triceps', array['chest', 'shoulders']::text[], 'bodyweight', 'weighted_bodyweight'),
  ('7682d0ce-5bd9-56cc-9a14-40ab2b415acf', null, 'Assisted Dip (Machine)', 'triceps', array['chest']::text[], 'machine', 'assisted_bodyweight'),
  ('00a96138-2669-5846-a5f2-b491244b5092', null, 'Chin Up', 'back', array['biceps']::text[], 'bodyweight', 'weighted_bodyweight'),
  ('15ac5eb4-d7d4-5e06-bd5d-a3cc1fcb245d', null, 'Pull Up', 'back', array['biceps']::text[], 'bodyweight', 'weighted_bodyweight'),
  ('68d5f093-ff3e-5114-97e9-38b245bdeed2', null, 'Assisted Chin Up (Machine)', 'back', array['biceps']::text[], 'machine', 'assisted_bodyweight'),
  ('b3678644-624d-5356-bf17-6a847aa57286', null, 'Lat Pulldown (Cable)', 'back', array['biceps']::text[], 'cable', 'weight_reps'),
  ('db2e84d5-b8b2-59dd-a342-3c941a87f099', null, 'Lat Pulldown (Machine)', 'back', array['biceps']::text[], 'machine', 'weight_reps'),
  ('4882b055-986a-5093-84e0-bb61549c0267', null, 'Seated Row (Cable)', 'back', array['biceps']::text[], 'cable', 'weight_reps'),
  ('102ee10b-a480-59eb-a30e-9d92c3a4d7fa', null, 'Seated Row (Machine)', 'back', array['biceps']::text[], 'machine', 'weight_reps'),
  ('791d5b6a-3346-50d8-803c-fb4d17fdfccc', null, 'Bent Over Row (Barbell)', 'back', array['biceps']::text[], 'barbell', 'weight_reps'),
  ('7e739202-c126-5af8-8ad2-6edb584cc156', null, 'Bent Over Row (Dumbbell)', 'back', array['biceps']::text[], 'dumbbell', 'weight_reps'),
  ('1a4fe63a-9a6b-5c91-aed7-01e67b3b6061', null, 'Bent Over Row (Band)', 'back', array['biceps']::text[], 'other', 'weight_reps'),
  ('78f6ad82-49e9-56df-9ebe-cbb5170c22cd', null, 'Iso-Lateral Row (Machine)', 'back', array['biceps']::text[], 'machine', 'weight_reps'),
  ('bccc1313-3745-5e34-9993-2addce67ceb8', null, 'T Bar Row', 'back', array['biceps']::text[], 'plate_loaded', 'weight_reps'),
  ('808adb0e-4f83-50ce-a429-85eadc716d62', null, 'Deadlift (Barbell)', 'back', array['legs', 'glutes']::text[], 'barbell', 'weight_reps'),
  ('72e956b2-fc3f-517f-b0fd-a5ea7efdadba', null, 'Shrug (Barbell)', 'back', array['shoulders']::text[], 'barbell', 'weight_reps'),
  ('155856a4-3baa-5092-8253-6e8b82be72b6', null, 'Shrug (Dumbbell)', 'back', array['shoulders']::text[], 'dumbbell', 'weight_reps'),
  ('32cbfbed-bd9b-5fee-9d38-0816ad10859d', null, 'Shrug (Machine)', 'back', array['shoulders']::text[], 'machine', 'weight_reps'),
  ('c0a3a198-4824-5d9c-a474-368a8a07baaf', null, 'Back Extension', 'back', array['glutes']::text[], 'bodyweight', 'weighted_bodyweight'),
  ('4ec02635-75c3-5cfe-9485-3bc294221724', null, 'Overhead Press (Barbell)', 'shoulders', array['triceps']::text[], 'barbell', 'weight_reps'),
  ('6aad0a81-313a-5e63-91be-6e7e9eaa2f2f', null, 'Strict Military Press (Barbell)', 'shoulders', array['triceps']::text[], 'barbell', 'weight_reps'),
  ('59ab16ad-8f92-5665-81fa-d42d1fc46390', null, 'Shoulder Press (Dumbbell)', 'shoulders', array['triceps']::text[], 'dumbbell', 'weight_reps'),
  ('7d7ea01d-80fa-575d-a333-18749626a83a', null, 'Shoulder Press (Machine)', 'shoulders', array['triceps']::text[], 'machine', 'weight_reps'),
  ('86928f41-d345-5a65-add5-96582fa6e2d1', null, 'Lateral Raise (Dumbbell)', 'shoulders', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('5022047f-6a28-567c-bf9c-c2a3d6ba6c0e', null, 'Lateral Raise (Cable)', 'shoulders', '{}'::text[], 'cable', 'weight_reps'),
  ('36f6bfc3-b36c-5419-a5fc-76b68c2f3d36', null, 'Lateral Raise (Machine)', 'shoulders', '{}'::text[], 'machine', 'weight_reps'),
  ('ef09891c-a029-5397-b4f9-bea46ddae111', null, 'Front Raise (Dumbbell)', 'shoulders', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('110a332b-b393-588e-8555-d3a9b994e357', null, 'Reverse Fly (Cable)', 'shoulders', array['back']::text[], 'cable', 'weight_reps'),
  ('8b2e5c75-f0cc-5602-bffe-247cd32c0881', null, 'Reverse Fly (Dumbbell)', 'shoulders', array['back']::text[], 'dumbbell', 'weight_reps'),
  ('002488d7-7873-5b35-aa9e-0b4cb3c8689f', null, 'Reverse Fly (Machine)', 'shoulders', array['back']::text[], 'machine', 'weight_reps'),
  ('2b79eaf1-4569-5412-a1cb-ccc1db4d1a8f', null, 'Face Pull (Cable)', 'shoulders', array['back']::text[], 'cable', 'weight_reps'),
  ('701c2b73-79fe-567f-bf48-183a0455fcbc', null, 'Upright Row (Barbell)', 'shoulders', array['back']::text[], 'barbell', 'weight_reps'),
  ('d434d09f-c139-5215-9eb7-737c5640f93a', null, 'Upright Row (Cable)', 'shoulders', array['back']::text[], 'cable', 'weight_reps'),
  ('8c623637-6187-5b09-9518-e5e1a238efb2', null, 'Upright Row (Dumbbell)', 'shoulders', array['back']::text[], 'dumbbell', 'weight_reps'),
  ('a6ff275c-d608-5df6-9229-051f60e7e554', null, 'Bicep Curl (Barbell)', 'biceps', '{}'::text[], 'barbell', 'weight_reps'),
  ('3d2e8a55-7a53-5201-a2fe-20afa52bd39a', null, 'Bicep Curl (Dumbbell)', 'biceps', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('cac9120a-87f9-59f9-9ffd-1763dffbe6d6', null, 'Bicep Curl (Cable)', 'biceps', '{}'::text[], 'cable', 'weight_reps'),
  ('7eb65120-3986-5ce5-b4c9-c22a0b97260a', null, 'Bicep Curl (Machine)', 'biceps', '{}'::text[], 'machine', 'weight_reps'),
  ('e7e28e4a-911d-58ba-a20d-8c3bebc4e6bc', null, 'Hammer Curl (Dumbbell)', 'biceps', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('e728842d-f3b8-56c5-8e6c-5a9e49a224bd', null, 'Hammer Curl (Cable)', 'biceps', '{}'::text[], 'cable', 'weight_reps'),
  ('ed751b5f-9fe3-5fe5-8f2b-0ebe35ebe113', null, 'Preacher Curl (Barbell)', 'biceps', '{}'::text[], 'barbell', 'weight_reps'),
  ('dfb5a8f9-cd5f-5b3c-85fc-71dd51a80600', null, 'Preacher Curl (Dumbbell)', 'biceps', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('fce7117a-614d-5cdf-8d65-f8878527b31b', null, 'Preacher Curl (Machine)', 'biceps', '{}'::text[], 'machine', 'weight_reps'),
  ('4c63c97e-938a-5636-a8af-8e4123adb457', null, 'Concentration Curl (Dumbbell)', 'biceps', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('6fa6d925-c52c-5eb7-ba2c-bb635a675042', null, 'Triceps Pushdown (Cable - Straight Bar)', 'triceps', '{}'::text[], 'cable', 'weight_reps'),
  ('3e6d6709-57e9-5afb-a529-7cb3c9dcb17a', null, 'Triceps Pushdown (Cable - Rope)', 'triceps', '{}'::text[], 'cable', 'weight_reps'),
  ('5d55e55d-c0c9-5055-8926-b7a55c8ce6b4', null, 'Triceps Extension', 'triceps', '{}'::text[], 'other', 'weight_reps'),
  ('69a52f3a-eabe-584a-917d-6ec4027790b9', null, 'Triceps Extension (Cable)', 'triceps', '{}'::text[], 'cable', 'weight_reps'),
  ('6ade097f-3af0-54d1-916a-223ad1fa5b2d', null, 'Triceps Extension (Dumbbell)', 'triceps', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('099d13c3-d4b5-5b1f-a4fe-67116d70df38', null, 'Triceps Extension (Machine)', 'triceps', '{}'::text[], 'machine', 'weight_reps'),
  ('5c47ec7c-e8b7-5d37-accd-02ecc1a57e88', null, 'Skullcrusher (Barbell)', 'triceps', '{}'::text[], 'barbell', 'weight_reps'),
  ('5d7d9928-b545-52b5-bf75-f7b042e53daf', null, 'Skullcrusher (Dumbbell)', 'triceps', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('30d663a9-ce35-550e-b70c-2d936dc0ef16', null, 'Squat (Barbell)', 'legs', array['glutes', 'core']::text[], 'barbell', 'weight_reps'),
  ('086983ae-dd31-5dfd-aaa6-bedd39572c87', null, 'Front Squat (Barbell)', 'legs', array['glutes', 'core']::text[], 'barbell', 'weight_reps'),
  ('f4ff0df6-0271-548b-b18c-61896e32afd7', null, 'Goblet Squat (Kettlebell)', 'legs', array['glutes']::text[], 'kettlebell', 'weight_reps'),
  ('d74cf50d-aad7-5f8a-bbc6-0e64744a7a1c', null, 'Goblet Squat (Dumbbell)', 'legs', array['glutes']::text[], 'dumbbell', 'weight_reps'),
  ('0da21881-1172-50d5-8874-479dcda659dd', null, 'Hack Squat', 'legs', array['glutes']::text[], 'machine', 'weight_reps'),
  ('50e2c48f-2bd1-5b4e-845e-9aeb83838525', null, 'Leg Press (Machine)', 'legs', array['glutes']::text[], 'machine', 'weight_reps'),
  ('fc6674d6-ed12-5a06-8dfb-1462ade8710a', null, 'Lunge (Dumbbell)', 'legs', array['glutes']::text[], 'dumbbell', 'weight_reps'),
  ('2b0b3760-2723-5155-b8a9-f9849beb2cdf', null, 'Lunge (Barbell)', 'legs', array['glutes']::text[], 'barbell', 'weight_reps'),
  ('1317b3cb-7d2e-58aa-b722-175027e1ed1d', null, 'Bulgarian Split Squat (Dumbbell)', 'legs', array['glutes']::text[], 'dumbbell', 'weight_reps'),
  ('f2ea8f0b-0d02-5a09-8643-47ed1cc6c686', null, 'Leg Extension (Machine)', 'legs', '{}'::text[], 'machine', 'weight_reps'),
  ('dee02894-1468-5d84-a808-c9178d42e343', null, 'Lying Leg Curl (Machine)', 'legs', '{}'::text[], 'machine', 'weight_reps'),
  ('7dd039a9-566d-5e4d-aec4-17e6b1340ddd', null, 'Seated Leg Curl (Machine)', 'legs', '{}'::text[], 'machine', 'weight_reps'),
  ('a7277c20-aeb1-5117-a405-a0fa4732552e', null, 'Stiff Leg Deadlift (Barbell)', 'legs', array['back', 'glutes']::text[], 'barbell', 'weight_reps'),
  ('5c086be1-521f-57e5-9164-eae42b6ebb7d', null, 'Romanian Deadlift (Barbell)', 'legs', array['back', 'glutes']::text[], 'barbell', 'weight_reps'),
  ('975fadd0-291b-5934-9eb3-2659de6615b8', null, 'Romanian Deadlift (Dumbbell)', 'legs', array['back', 'glutes']::text[], 'dumbbell', 'weight_reps'),
  ('d7556d6d-b394-5ad5-9ba3-0c0d1a1c4e0a', null, 'Trap Bar Deadlift', 'legs', array['back', 'glutes']::text[], 'barbell', 'weight_reps'),
  ('a1dd6eb9-19aa-553c-910c-873c25672dc7', null, 'Hip Adductor (Machine)', 'legs', '{}'::text[], 'machine', 'weight_reps'),
  ('4f1df936-ced0-52d5-8575-22b6d00ee90a', null, 'Sled Push', 'legs', array['full_body']::text[], 'other', 'distance_duration'),
  ('d4caac9d-de94-5b7f-8138-8d4a630c2ad1', null, 'Hip Abductor (Machine)', 'glutes', '{}'::text[], 'machine', 'weight_reps'),
  ('82572f40-4db7-5642-be06-893adc38def2', null, 'Hip Thrust (Barbell)', 'glutes', array['legs']::text[], 'barbell', 'weight_reps'),
  ('11849d12-4baf-5a71-a607-e7d50c927487', null, 'Hip Thrust (Machine)', 'glutes', array['legs']::text[], 'machine', 'weight_reps'),
  ('b8bd9642-f511-549e-9878-ccc1e16d244d', null, 'Glute Kickback (Cable)', 'glutes', '{}'::text[], 'cable', 'weight_reps'),
  ('19a222af-2ce9-5ebb-a57a-01c28675327e', null, 'Standing Calf Raise (Dumbbell)', 'calves', '{}'::text[], 'dumbbell', 'weight_reps'),
  ('d7ce425f-6282-59e1-8e97-744e583cc0bd', null, 'Standing Calf Raise (Machine)', 'calves', '{}'::text[], 'machine', 'weight_reps'),
  ('94539a63-49e3-59b5-8768-fadb8be674f6', null, 'Standing Calf Raise (Barbell)', 'calves', '{}'::text[], 'barbell', 'weight_reps'),
  ('5a0206b7-98df-58c0-8f7d-f558bf80bb0c', null, 'Seated Calf Raise (Plate Loaded)', 'calves', '{}'::text[], 'plate_loaded', 'weight_reps'),
  ('65e5260f-a6d3-58db-aec0-59d131b34d7a', null, 'Seated Calf Raise (Machine)', 'calves', '{}'::text[], 'machine', 'weight_reps'),
  ('bcd3edd1-bb19-5110-ad78-a4854abe3174', null, 'Calf Press (Machine)', 'calves', '{}'::text[], 'machine', 'weight_reps'),
  ('b3871916-9a3c-5b2f-9ab6-03cf43c9b5b4', null, 'Crunch', 'core', '{}'::text[], 'bodyweight', 'bodyweight_reps'),
  ('2f93e070-8289-59d0-ba68-caaa697d8f7f', null, 'Crunch (Machine)', 'core', '{}'::text[], 'machine', 'weight_reps'),
  ('7b90f98a-10bc-5896-8ffc-a391668f1077', null, 'Cable Crunch', 'core', '{}'::text[], 'cable', 'weight_reps'),
  ('54241bc7-96be-5fb3-bd9c-86bbb33cd217', null, 'Cross Body Crunch', 'core', '{}'::text[], 'bodyweight', 'bodyweight_reps'),
  ('789d2100-bda5-561b-a704-63f7e3bd75c8', null, 'Hanging Leg Raise', 'core', '{}'::text[], 'bodyweight', 'bodyweight_reps'),
  ('4fc83c43-999b-5b8b-b7c9-30cf98491343', null, 'Flat Leg Raise', 'core', '{}'::text[], 'bodyweight', 'bodyweight_reps'),
  ('7381438c-c884-58d0-ada3-5d5663bb53c5', null, 'Russian Twist', 'core', '{}'::text[], 'bodyweight', 'bodyweight_reps'),
  ('f698488e-0902-5f7e-8c85-f95944fd5f23', null, 'Ab Wheel', 'core', '{}'::text[], 'other', 'bodyweight_reps'),
  ('2a7156e2-2fd9-5402-a8e8-4b80d4c31db5', null, 'Torso Rotation (Machine)', 'core', '{}'::text[], 'machine', 'weight_reps'),
  ('f0289d09-b391-526f-ba68-61550c902309', null, 'Plank', 'core', '{}'::text[], 'bodyweight', 'duration'),
  ('40e503f4-49a8-56d7-9c07-0560cff918da', null, 'Kettlebell Swing', 'full_body', array['glutes', 'legs']::text[], 'kettlebell', 'weight_reps'),
  ('6011e3a8-75cb-5be1-a645-9fa360eef7ee', null, 'Burpee', 'full_body', '{}'::text[], 'bodyweight', 'bodyweight_reps'),
  ('b265870b-f3eb-5421-a1db-e074636b3851', null, 'Farmers Walk', 'full_body', array['core']::text[], 'dumbbell', 'weight_distance'),
  ('c21ce5ec-d88f-5f24-986f-fca542fe3016', null, 'Running (Treadmill)', 'full_body', array['legs']::text[], 'machine', 'distance_duration'),
  ('a97ace8a-9adb-58f1-832d-92f9af87072d', null, 'Cycling (Indoor)', 'full_body', array['legs']::text[], 'machine', 'distance_duration'),
  ('b7a40928-281e-5d2a-8a36-e0842cdd328b', null, 'Rowing (Machine)', 'full_body', array['back', 'legs']::text[], 'machine', 'distance_duration'),
  ('254eff21-c315-5457-a8e1-2a203beca84a', null, 'Walking', 'full_body', array['legs']::text[], 'other', 'distance_duration'),
  ('54b8969c-f5fe-50b3-836f-6c0591552246', null, 'Jump Rope', 'full_body', array['calves']::text[], 'other', 'duration')
on conflict (id) do update set
  name = excluded.name,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  type = excluded.type;


-- ════════ 20261023000300_rls.sql ════════
-- Row Level Security: elke tabel, expliciete policies per actie.
-- (select auth.uid()) wordt één keer per query geëvalueerd i.p.v. per rij.

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_prefs enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_exercises enable row level security;
alter table public.template_sets enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.measurement_types enable row level security;
alter table public.body_measurements enable row level security;
alter table public.goals enable row level security;
alter table public.dashboard_widgets enable row level security;

-- Is een oefening zichtbaar voor de huidige gebruiker? (standaard of eigen)
create or replace function public.exercise_visible(ex_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.exercises e
    where e.id = ex_id and (e.user_id is null or e.user_id = (select auth.uid()))
  );
$$;

-- ── profiles
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- geen delete-policy: een profiel verdwijnt enkel samen met de auth-gebruiker.

-- ── exercises: standaardoefeningen leesbaar, niet wijzigbaar
create policy exercises_select on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy exercises_insert on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy exercises_update on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy exercises_delete on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── exercise_prefs
create policy exercise_prefs_select on public.exercise_prefs for select to authenticated using (user_id = (select auth.uid()));
create policy exercise_prefs_insert on public.exercise_prefs for insert to authenticated
  with check (user_id = (select auth.uid()) and public.exercise_visible(exercise_id));
create policy exercise_prefs_update on public.exercise_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.exercise_visible(exercise_id));
create policy exercise_prefs_delete on public.exercise_prefs for delete to authenticated using (user_id = (select auth.uid()));

-- ── workout_templates
create policy workout_templates_select on public.workout_templates for select to authenticated using (user_id = (select auth.uid()));
create policy workout_templates_insert on public.workout_templates for insert to authenticated with check (user_id = (select auth.uid()));
create policy workout_templates_update on public.workout_templates for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workout_templates_delete on public.workout_templates for delete to authenticated using (user_id = (select auth.uid()));

-- ── template_exercises: eigenaar + eigenaarscontrole via parent
create policy template_exercises_select on public.template_exercises for select to authenticated
  using (user_id = (select auth.uid()));
create policy template_exercises_insert on public.template_exercises for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))
    and public.exercise_visible(exercise_id)
  );
create policy template_exercises_update on public.template_exercises for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))
    and public.exercise_visible(exercise_id)
  );
create policy template_exercises_delete on public.template_exercises for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── template_sets
create policy template_sets_select on public.template_sets for select to authenticated using (user_id = (select auth.uid()));
create policy template_sets_insert on public.template_sets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.template_exercises te where te.id = template_exercise_id and te.user_id = (select auth.uid()))
  );
create policy template_sets_update on public.template_sets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.template_exercises te where te.id = template_exercise_id and te.user_id = (select auth.uid()))
  );
create policy template_sets_delete on public.template_sets for delete to authenticated using (user_id = (select auth.uid()));

-- ── workouts
create policy workouts_select on public.workouts for select to authenticated using (user_id = (select auth.uid()));
create policy workouts_insert on public.workouts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (template_id is null or exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())))
  );
create policy workouts_update on public.workouts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (template_id is null or exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid())))
  );
create policy workouts_delete on public.workouts for delete to authenticated using (user_id = (select auth.uid()));

-- ── workout_exercises
create policy workout_exercises_select on public.workout_exercises for select to authenticated using (user_id = (select auth.uid()));
create policy workout_exercises_insert on public.workout_exercises for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and (exercise_id is null or public.exercise_visible(exercise_id))
  );
create policy workout_exercises_update on public.workout_exercises for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
    and (exercise_id is null or public.exercise_visible(exercise_id))
  );
create policy workout_exercises_delete on public.workout_exercises for delete to authenticated using (user_id = (select auth.uid()));

-- ── workout_sets
create policy workout_sets_select on public.workout_sets for select to authenticated using (user_id = (select auth.uid()));
create policy workout_sets_insert on public.workout_sets for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_exercises we where we.id = workout_exercise_id and we.user_id = (select auth.uid()))
  );
create policy workout_sets_update on public.workout_sets for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_exercises we where we.id = workout_exercise_id and we.user_id = (select auth.uid()))
  );
create policy workout_sets_delete on public.workout_sets for delete to authenticated using (user_id = (select auth.uid()));

-- ── measurement_types: standaardtypes leesbaar, niet wijzigbaar
create policy measurement_types_select on public.measurement_types for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy measurement_types_insert on public.measurement_types for insert to authenticated with check (user_id = (select auth.uid()));
create policy measurement_types_update on public.measurement_types for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy measurement_types_delete on public.measurement_types for delete to authenticated using (user_id = (select auth.uid()));

-- ── body_measurements
create policy body_measurements_select on public.body_measurements for select to authenticated using (user_id = (select auth.uid()));
create policy body_measurements_insert on public.body_measurements for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.measurement_types mt where mt.id = type_id and (mt.user_id is null or mt.user_id = (select auth.uid())))
  );
create policy body_measurements_update on public.body_measurements for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.measurement_types mt where mt.id = type_id and (mt.user_id is null or mt.user_id = (select auth.uid())))
  );
create policy body_measurements_delete on public.body_measurements for delete to authenticated using (user_id = (select auth.uid()));

-- ── goals
create policy goals_select on public.goals for select to authenticated using (user_id = (select auth.uid()));
create policy goals_insert on public.goals for insert to authenticated
  with check (user_id = (select auth.uid()) and (exercise_id is null or public.exercise_visible(exercise_id)));
create policy goals_update on public.goals for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (exercise_id is null or public.exercise_visible(exercise_id)));
create policy goals_delete on public.goals for delete to authenticated using (user_id = (select auth.uid()));

-- ── dashboard_widgets
create policy dashboard_widgets_select on public.dashboard_widgets for select to authenticated using (user_id = (select auth.uid()));
create policy dashboard_widgets_insert on public.dashboard_widgets for insert to authenticated with check (user_id = (select auth.uid()));
create policy dashboard_widgets_update on public.dashboard_widgets for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy dashboard_widgets_delete on public.dashboard_widgets for delete to authenticated using (user_id = (select auth.uid()));

-- ── grants: anon krijgt niets; alleen ingelogde gebruikers.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.exercise_visible(uuid) to authenticated;


-- ════════ 20261023000400_rpc.sql ════════
-- RPC's voor bewerkingen die uit meerdere stappen bestaan. Elke functie draait in één transactie.
-- security invoker: RLS blijft gelden, dus een gebruiker kan nooit andermans rijen raken.
-- Alle functies zijn idempotent: dezelfde payload opnieuw versturen levert hetzelfde resultaat op.

-- Workout (inclusief oefeningen en sets) opslaan of bijwerken. Wordt gebruikt door Finish,
-- door het bewerken van een historische workout en voor soft delete (deleted_at in payload).
create or replace function public.upsert_workout(p jsonb)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w_id uuid := (p->>'id')::uuid;
  res timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.workouts as w
    (id, user_id, name, started_at, ended_at, duration_sec, note, template_id, source, source_key, deleted_at)
  values (
    w_id, uid, p->>'name', (p->>'started_at')::timestamptz, (p->>'ended_at')::timestamptz,
    coalesce((p->>'duration_sec')::integer, 0), p->>'note', (p->>'template_id')::uuid,
    coalesce(p->>'source', 'app'), p->>'source_key', (p->>'deleted_at')::timestamptz
  )
  on conflict (id) do update set
    name = excluded.name,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    duration_sec = excluded.duration_sec,
    note = excluded.note,
    template_id = excluded.template_id,
    deleted_at = excluded.deleted_at
  where w.user_id = uid
  returning w.updated_at into res;

  if res is null then
    raise exception 'workout % is not yours', w_id using errcode = '42501';
  end if;

  -- Kinderen volledig vervangen (cascade verwijdert ook de sets).
  delete from public.workout_exercises where workout_id = w_id;

  insert into public.workout_exercises
    (id, workout_id, user_id, exercise_id, exercise_name, exercise_type, position, superset_group, rest_sec, note)
  select (e->>'id')::uuid, w_id, uid, (e->>'exercise_id')::uuid, e->>'exercise_name', e->>'exercise_type',
         (e->>'position')::integer, e->>'superset_group', (e->>'rest_sec')::integer, e->>'note'
  from jsonb_array_elements(coalesce(p->'exercises', '[]'::jsonb)) as e;

  insert into public.workout_sets
    (id, workout_exercise_id, user_id, position, set_type, weight_kg, reps, duration_sec, distance_m, rpe, completed, completed_at, note)
  select (s->>'id')::uuid, (e->>'id')::uuid, uid, (s->>'position')::integer, coalesce(s->>'set_type', 'normal'),
         (s->>'weight_kg')::numeric, (s->>'reps')::integer, (s->>'duration_sec')::integer, (s->>'distance_m')::numeric,
         (s->>'rpe')::numeric, coalesce((s->>'completed')::boolean, false), (s->>'completed_at')::timestamptz, s->>'note'
  from jsonb_array_elements(coalesce(p->'exercises', '[]'::jsonb)) as e,
       jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) as s;

  return res;
end;
$$;

-- Template (inclusief oefeningen en sets) opslaan of bijwerken.
create or replace function public.upsert_template(p jsonb)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t_id uuid := (p->>'id')::uuid;
  res timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.workout_templates as t (id, user_id, name, folder, note, sort_order, deleted_at)
  values (t_id, uid, p->>'name', p->>'folder', p->>'note', coalesce((p->>'sort_order')::integer, 0), (p->>'deleted_at')::timestamptz)
  on conflict (id) do update set
    name = excluded.name,
    folder = excluded.folder,
    note = excluded.note,
    sort_order = excluded.sort_order,
    deleted_at = excluded.deleted_at
  where t.user_id = uid
  returning t.updated_at into res;

  if res is null then
    raise exception 'template % is not yours', t_id using errcode = '42501';
  end if;

  delete from public.template_exercises where template_id = t_id;

  insert into public.template_exercises (id, template_id, user_id, exercise_id, position, superset_group, rest_sec, note)
  select (e->>'id')::uuid, t_id, uid, (e->>'exercise_id')::uuid, (e->>'position')::integer,
         e->>'superset_group', (e->>'rest_sec')::integer, e->>'note'
  from jsonb_array_elements(coalesce(p->'exercises', '[]'::jsonb)) as e;

  insert into public.template_sets (id, template_exercise_id, user_id, position, set_type, reps, weight_kg, duration_sec, distance_m)
  select (s->>'id')::uuid, (e->>'id')::uuid, uid, (s->>'position')::integer, coalesce(s->>'set_type', 'normal'),
         (s->>'reps')::integer, (s->>'weight_kg')::numeric, (s->>'duration_sec')::integer, (s->>'distance_m')::numeric
  from jsonb_array_elements(coalesce(p->'exercises', '[]'::jsonb)) as e,
       jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) as s;

  return res;
end;
$$;

-- Import (bv. Strong-CSV): nieuwe eigen oefeningen + workouts. Bestaande ids worden overgeslagen,
-- zodat opnieuw importeren nooit duplicaten oplevert en latere bewerkingen niet overschreven worden.
create or replace function public.import_workouts(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w jsonb;
  inserted_id uuid;
  n_ex integer := 0;
  n_w integer := 0;
  n_skipped integer := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  with ins as (
    insert into public.exercises (id, user_id, name, primary_muscle, secondary_muscles, equipment, type, notes)
    select (x->>'id')::uuid, uid, x->>'name', x->>'primary_muscle',
           coalesce(array(select jsonb_array_elements_text(x->'secondary_muscles')), '{}'),
           x->>'equipment', x->>'type', x->>'notes'
    from jsonb_array_elements(coalesce(p->'exercises', '[]'::jsonb)) as x
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into n_ex from ins;

  for w in select * from jsonb_array_elements(coalesce(p->'workouts', '[]'::jsonb)) loop
    insert into public.workouts (id, user_id, name, started_at, ended_at, duration_sec, note, template_id, source, source_key)
    values ((w->>'id')::uuid, uid, w->>'name', (w->>'started_at')::timestamptz, (w->>'ended_at')::timestamptz,
            coalesce((w->>'duration_sec')::integer, 0), w->>'note', null, coalesce(w->>'source', 'strong_import'), w->>'source_key')
    on conflict do nothing
    returning id into inserted_id;

    if inserted_id is null then
      n_skipped := n_skipped + 1;
      continue;
    end if;
    n_w := n_w + 1;

    insert into public.workout_exercises
      (id, workout_id, user_id, exercise_id, exercise_name, exercise_type, position, superset_group, rest_sec, note)
    select (e->>'id')::uuid, inserted_id, uid, (e->>'exercise_id')::uuid, e->>'exercise_name', e->>'exercise_type',
           (e->>'position')::integer, e->>'superset_group', (e->>'rest_sec')::integer, e->>'note'
    from jsonb_array_elements(coalesce(w->'exercises', '[]'::jsonb)) as e;

    insert into public.workout_sets
      (id, workout_exercise_id, user_id, position, set_type, weight_kg, reps, duration_sec, distance_m, rpe, completed, completed_at, note)
    select (s->>'id')::uuid, (e->>'id')::uuid, uid, (s->>'position')::integer, coalesce(s->>'set_type', 'normal'),
           (s->>'weight_kg')::numeric, (s->>'reps')::integer, (s->>'duration_sec')::integer, (s->>'distance_m')::numeric,
           (s->>'rpe')::numeric, coalesce((s->>'completed')::boolean, true), (s->>'completed_at')::timestamptz, s->>'note'
    from jsonb_array_elements(coalesce(w->'exercises', '[]'::jsonb)) as e,
         jsonb_array_elements(coalesce(e->'sets', '[]'::jsonb)) as s;

    inserted_id := null;
  end loop;

  return jsonb_build_object('exercises_created', n_ex, 'workouts_created', n_w, 'workouts_skipped', n_skipped);
end;
$$;

revoke all on function public.upsert_workout(jsonb) from anon, public;
revoke all on function public.upsert_template(jsonb) from anon, public;
revoke all on function public.import_workouts(jsonb) from anon, public;
grant execute on function public.upsert_workout(jsonb) to authenticated;
grant execute on function public.upsert_template(jsonb) to authenticated;
grant execute on function public.import_workouts(jsonb) to authenticated;


-- ════════ 20261023000500_measurement_types.sql ════════
-- Standaard meettypes (user_id null). Dezelfde ids staan in src/data/measurementTypes.ts.
insert into public.measurement_types (id, user_id, key, name, unit, kind, sort_order) values
  ('6f1c2a10-0000-4000-8000-000000000001', null, 'bodyweight',  'Lichaamsgewicht', 'kg', 'mass',    1),
  ('6f1c2a10-0000-4000-8000-000000000002', null, 'body_fat',    'Vetpercentage',   '%',  'percent', 2),
  ('6f1c2a10-0000-4000-8000-000000000003', null, 'muscle_mass', 'Spiermassa',      'kg', 'mass',    3),
  ('6f1c2a10-0000-4000-8000-000000000004', null, 'waist',       'Taille',          'cm', 'length',  4),
  ('6f1c2a10-0000-4000-8000-000000000005', null, 'chest',       'Borst',           'cm', 'length',  5),
  ('6f1c2a10-0000-4000-8000-000000000006', null, 'arm',         'Arm',             'cm', 'length',  6),
  ('6f1c2a10-0000-4000-8000-000000000007', null, 'thigh',       'Bovenbeen',       'cm', 'length',  7),
  ('6f1c2a10-0000-4000-8000-000000000008', null, 'hip',         'Heup',            'cm', 'length',  8)
on conflict (id) do update set key = excluded.key, name = excluded.name, unit = excluded.unit,
  kind = excluded.kind, sort_order = excluded.sort_order;
