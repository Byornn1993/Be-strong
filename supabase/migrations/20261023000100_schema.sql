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
