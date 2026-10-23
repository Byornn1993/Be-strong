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
