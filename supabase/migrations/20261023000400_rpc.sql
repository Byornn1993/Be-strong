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
