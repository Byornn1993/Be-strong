import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Link2, Pause, Play, Plus, RefreshCw, Timer, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button, IconButton } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/States';
import { useExercisePrefs, useProfile, useTemplate, useWorkouts } from '@/lib/db/hooks';
import type { Exercise, RestTimerState, WorkoutExercise } from '@/lib/db/types';
import { findPreviousSets } from '@/domain/previous';
import { hasValues } from '@/domain/exerciseTypes';
import { pause, restRemainingSec, resume, startRest, workoutElapsedSec } from '@/domain/timer';
import { formatClock } from '@/domain/format';
import { formatLongDate } from '@/domain/dates';
import { useNow } from '@/lib/useNow';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { useActiveWorkout } from './WorkoutProvider';
import { ExerciseBlock } from './ExerciseBlock';
import { FloatingRest, useRestAlarm } from './RestTimer';
import { FinishSheet } from './FinishSheet';
import { primeAudio, requestWakeLock, vibrate } from './alerts';
import { setInputId } from './SetRow';
import * as L from './logic';

export function ActiveWorkoutSheet() {
  const { active, sheetOpen, closeSheet, update, discard } = useActiveWorkout();
  const now = useNow(1000, sheetOpen);
  const workouts = useWorkouts();
  const prefs = useExercisePrefs();
  const profile = useProfile();
  const template = useTemplate(active?.templateId ?? undefined);
  const { confirm, dialog } = useConfirm();

  const [picker, setPicker] = useState<null | { mode: 'add' } | { mode: 'replace'; weId: string }>(null);
  const [menuFor, setMenuFor] = useState<WorkoutExercise | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [timerMenu, setTimerMenu] = useState(false);

  // Scherm aan houden tijdens de workout (waar ondersteund).
  useEffect(() => {
    if (!sheetOpen) return;
    let release: (() => void) | null = null;
    let cancelled = false;
    const acquire = () =>
      requestWakeLock().then((r) => {
        if (cancelled) r?.();
        else release = r;
      });
    void acquire();
    const onVis = () => document.visibilityState === 'visible' && void acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      release?.();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [sheetOpen]);

  useRestAlarm(active?.rest ?? null, () => update((w) => ({ ...w, rest: null })));

  const previousByWe = useMemo(() => {
    const m = new Map<string, ReturnType<typeof findPreviousSets>>();
    if (!active || !workouts) return m;
    for (const we of active.exercises) m.set(we.id, findPreviousSets(workouts, we, active.startedAt));
    return m;
  }, [active, workouts]);

  const supersetLabels = useMemo(() => {
    const m = new Map<string, string>();
    if (!active) return m;
    const groups = [...new Set(active.exercises.map((e) => e.supersetGroup).filter(Boolean))] as string[];
    for (const we of active.exercises) if (we.supersetGroup) m.set(we.id, `Superset ${String.fromCharCode(65 + groups.indexOf(we.supersetGroup))}`);
    return m;
  }, [active]);

  if (!active) return null;

  const restSecFor = (we: WorkoutExercise) =>
    we.restSec ?? prefs?.find((p) => p.exerciseId === we.exerciseId)?.restSec ?? profile?.defaultRestSec ?? 120;

  const toggleSet = (we: WorkoutExercise, setId: string) => {
    const s = we.sets.find((x) => x.id === setId);
    if (!s) return;
    if (s.completed) {
      update((w) => L.updateSet(w, we.id, setId, { completed: false, completedAt: null }));
      return;
    }
    let values = { weightKg: s.weightKg, reps: s.reps, durationSec: s.durationSec, distanceM: s.distanceM };
    if (!hasValues(we.exerciseType, values)) {
      // Lege set afvinken = de vorige waarden (placeholder) overnemen, zoals in Strong.
      const idx = we.sets.indexOf(s);
      const prev = previousByWe.get(we.id)?.[idx];
      if (prev) values = { weightKg: prev.weightKg, reps: prev.reps, durationSec: prev.durationSec, distanceM: prev.distanceM };
    }
    if (!hasValues(we.exerciseType, values)) {
      vibrate(40);
      document.getElementById(setInputId(setId))?.focus();
      return;
    }
    primeAudio();
    vibrate(15);
    const idx = active.exercises.findIndex((e) => e.id === we.id);
    const nextInSuperset = we.supersetGroup && active.exercises[idx + 1]?.supersetGroup === we.supersetGroup;
    const t = Date.now();
    let rest: RestTimerState | null = active.rest;
    if (!nextInSuperset) {
      const secs = restSecFor(we);
      rest = secs > 0 ? { ...startRest(secs, t, we.id), afterSetId: setId } : null;
    }
    const next = L.updateSet(active, we.id, setId, { ...values, completed: true, completedAt: new Date(t).toISOString() });
    update(() => ({ ...next, rest }));
    // Focus naar de volgende open set (binnen dezelfde gebruikersactie → toetsenbord opent op iOS).
    const target = nextInSuperset ? (() => {
      const nwe = active.exercises[idx + 1]!;
      const si = we.sets.findIndex((x) => x.id === setId);
      const ns = nwe.sets[si] ?? nwe.sets.find((x) => !x.completed);
      return ns && !ns.completed ? { setId: ns.id } : null;
    })() : L.nextOpenSet(next, we.id, setId);
    if (target) {
      const el = document.getElementById(setInputId(target.setId));
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };

  const addExercises = (list: Exercise[]) =>
    update((w) => ({ ...w, exercises: [...w.exercises, ...list.map((ex) => L.workoutExerciseFrom(ex, 3, null))] }));

  const elapsed = workoutElapsedSec(active, now);
  const restLeft = restRemainingSec(active.rest, now);

  const cancelWorkout = async () => {
    if (await confirm({ title: 'Workout annuleren?', message: 'Alle ingevulde sets van deze workout gaan verloren.', confirmLabel: 'Annuleren', danger: true })) {
      await discard();
    }
  };

  return (
    <Sheet open={sheetOpen} onClose={closeSheet} full>
      <div className="flex min-h-full flex-col">
        {/* Kop */}
        <div className="sticky top-0 z-20 border-b border-border bg-bg/95 px-2 py-2 backdrop-blur">
          <div className="flex items-center gap-1">
            <IconButton label="Minimaliseren" onClick={closeSheet}>
              <ChevronDown size={24} />
            </IconButton>
            <IconButton label="Rusttimer" onClick={() => setTimerMenu(true)} className={restLeft > 0 ? 'text-accent' : ''}>
              <Timer size={22} />
            </IconButton>
            <IconButton
              label={active.pausedAt ? 'Hervatten' : 'Pauzeren'}
              onClick={() => update((w) => (w.pausedAt ? resume(w, Date.now()) : pause(w, new Date().toISOString())))}
              className={active.pausedAt ? 'text-warn' : ''}
            >
              {active.pausedAt ? <Play size={22} /> : <Pause size={22} />}
            </IconButton>
            <div className="flex-1 text-center text-sm font-semibold tabular-nums text-muted">{formatClock(elapsed)}</div>
            <Button variant="primary" onClick={() => setFinishOpen(true)} className="px-5">
              Finish
            </Button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl flex-1 pb-40">
          <div className="px-4 pb-2 pt-4">
            <input
              aria-label="Naam van de workout"
              className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none focus:underline focus:decoration-accent"
              value={active.name}
              onChange={(e) => update((w) => ({ ...w, name: e.target.value }))}
            />
            <p className="mt-0.5 text-sm text-muted">
              {formatLongDate(active.startedAt)}
              {active.pausedAt && <span className="ml-2 text-warn">· gepauzeerd</span>}
            </p>
          </div>

          {active.exercises.length === 0 ? (
            <EmptyState title="Nog geen oefeningen" text="Voeg je eerste oefening toe om sets te loggen." />
          ) : (
            <div className="divide-y divide-border">
              {active.exercises.map((we) => (
                <ExerciseBlock
                  key={we.id}
                  we={we}
                  previous={previousByWe.get(we.id) ?? []}
                  rest={active.rest}
                  now={now}
                  supersetLabel={supersetLabels.get(we.id) ?? null}
                  actions={{
                    onSetChange: (setId, patch) => update((w) => L.updateSet(w, we.id, setId, patch)),
                    onToggle: (setId) => toggleSet(we, setId),
                    onAddSet: () => update((w) => L.addSet(w, we.id)),
                    onRemoveSet: (setId) => update((w) => L.removeSet(w, we.id, setId)),
                    onMenu: () => setMenuFor(we),
                    onRestChange: (r) => update((w) => ({ ...w, rest: r })),
                  }}
                />
              ))}
            </div>
          )}

          <div className="space-y-2 px-4 pt-4">
            <Button variant="primary" size="lg" block icon={<Plus size={20} />} onClick={() => setPicker({ mode: 'add' })}>
              Oefening toevoegen
            </Button>
            <Button variant="danger" block onClick={cancelWorkout}>
              Workout annuleren
            </Button>
          </div>
        </div>

        {/* Zwevende mini-timer (één hand: onderaan) */}
        {active.rest && restLeft > 0 && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
            <FloatingRest rest={active.rest} now={now} onChange={(r) => update((w) => ({ ...w, rest: r }))} />
          </div>
        )}
      </div>

      <ExercisePicker
        open={!!picker}
        multi={picker?.mode !== 'replace'}
        title={picker?.mode === 'replace' ? 'Oefening vervangen' : 'Oefening toevoegen'}
        onClose={() => setPicker(null)}
        onPick={(list) => {
          if (picker?.mode === 'replace' && list[0]) update((w) => L.replaceExercise(w, picker.weId, list[0]!));
          else addExercises(list);
        }}
      />

      <ExerciseMenu
        we={menuFor}
        isLast={!!menuFor && active.exercises.at(-1)?.id === menuFor.id}
        isFirst={!!menuFor && active.exercises[0]?.id === menuFor.id}
        defaultRest={menuFor ? restSecFor(menuFor) : 120}
        onClose={() => setMenuFor(null)}
        onMove={(dir) => menuFor && update((w) => L.moveExercise(w, menuFor.id, dir))}
        onReplace={() => menuFor && setPicker({ mode: 'replace', weId: menuFor.id })}
        onSuperset={() => menuFor && update((w) => ({ ...w, exercises: L.toggleSupersetWithNext(w.exercises, menuFor.id) }))}
        onRemove={() => menuFor && update((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== menuFor.id) }))}
        onNote={(note) => menuFor && update((w) => L.updateExercise(w, menuFor.id, (e) => ({ ...e, note })))}
        onRest={(sec) => menuFor && update((w) => L.updateExercise(w, menuFor.id, (e) => ({ ...e, restSec: sec })))}
      />

      <Sheet open={timerMenu} onClose={() => setTimerMenu(false)} title="Rusttimer">
        <div className="grid grid-cols-3 gap-2 p-4">
          {[30, 60, 90, 120, 180, 300].map((s) => (
            <Button
              key={s}
              size="lg"
              onClick={() => {
                primeAudio();
                update((w) => ({ ...w, rest: startRest(s, Date.now(), null) }));
                setTimerMenu(false);
              }}
            >
              {formatClock(s)}
            </Button>
          ))}
          {active.rest && (
            <Button className="col-span-3" variant="danger" onClick={() => (update((w) => ({ ...w, rest: null })), setTimerMenu(false))}>
              Timer stoppen
            </Button>
          )}
        </div>
      </Sheet>

      {finishOpen && (
        <FinishSheet open={finishOpen} onClose={() => setFinishOpen(false)} active={active} history={workouts ?? []} template={template && !template.deletedAt ? template : null} />
      )}
      {dialog}
    </Sheet>
  );
}

function ExerciseMenu({
  we,
  isFirst,
  isLast,
  defaultRest,
  onClose,
  onMove,
  onReplace,
  onSuperset,
  onRemove,
  onNote,
  onRest,
}: {
  we: WorkoutExercise | null;
  isFirst: boolean;
  isLast: boolean;
  defaultRest: number;
  onClose: () => void;
  onMove: (d: -1 | 1) => void;
  onReplace: () => void;
  onSuperset: () => void;
  onRemove: () => void;
  onNote: (n: string | null) => void;
  onRest: (s: number) => void;
}) {
  return (
    <Sheet open={!!we} onClose={onClose} title={we?.exerciseName}>
      {we && <ExerciseMenuBody key={we.id} {...{ we, isFirst, isLast, defaultRest, onClose, onMove, onReplace, onSuperset, onRemove, onNote, onRest }} />}
    </Sheet>
  );
}

function ExerciseMenuBody({
  we,
  isFirst,
  isLast,
  defaultRest,
  onClose,
  onMove,
  onReplace,
  onSuperset,
  onRemove,
  onNote,
  onRest,
}: Omit<Parameters<typeof ExerciseMenu>[0], 'we'> & { we: WorkoutExercise }) {
  const [note, setNote] = useState(we.note ?? '');
  const [rest, setRest] = useState(String(defaultRest));
  const act = (fn: () => void) => () => (fn(), onClose());
  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-2">
        <Button icon={<ArrowUp size={16} />} disabled={isFirst} onClick={act(() => onMove(-1))}>
          Omhoog
        </Button>
        <Button icon={<ArrowDown size={16} />} disabled={isLast} onClick={act(() => onMove(1))}>
          Omlaag
        </Button>
        <Button icon={<RefreshCw size={16} />} onClick={act(onReplace)}>
          Vervangen
        </Button>
        <Button icon={<Link2 size={16} />} disabled={isLast} onClick={act(onSuperset)}>
          {we.supersetGroup ? 'Superset aan/uit' : 'Superset met volgende'}
        </Button>
      </div>
      <label className="block">
        <span className="label">Rusttijd voor deze oefening (seconden)</span>
        <input className="field mt-1" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="block">
        <span className="label">Notitie bij deze oefening</span>
        <textarea className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button variant="danger" icon={<Trash2 size={16} />} block onClick={act(onRemove)}>
          Verwijderen
        </Button>
        <Button
          variant="primary"
          block
          onClick={act(() => {
            onNote(note.trim() || null);
            const r = Number(rest);
            if (rest !== '' && r !== defaultRest && r >= 0 && r <= 1800) onRest(r);
          })}
        >
          Bewaren
        </Button>
      </div>
    </div>
  );
}
