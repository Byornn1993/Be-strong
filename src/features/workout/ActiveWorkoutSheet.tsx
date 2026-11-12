import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, GripVertical, Pause, Play, Plus, Timer } from 'lucide-react';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Sheet } from '@/components/ui/Sheet';
import { Button, IconButton } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/States';
import { UndoToast, type UndoInfo } from '@/components/ui/UndoToast';
import { useExercisePrefs, useProfile, useTemplate, useWorkouts } from '@/lib/db/hooks';
import type { ActiveWorkout, Exercise, RestTimerState, WorkoutExercise, WorkoutSet } from '@/lib/db/types';
import { findPreviousSets } from '@/domain/previous';
import { hasValues } from '@/domain/exerciseTypes';
import { DEFAULT_REST_SEC, pause, resume, startRest, workoutElapsedSec } from '@/domain/timer';
import { formatClock } from '@/domain/format';
import { formatLongDate } from '@/domain/dates';
import { useNow } from '@/lib/useNow';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { useActiveWorkout } from './WorkoutProvider';
import { ExerciseBlock, type ExerciseActions } from './ExerciseBlock';
import { FloatingRest, useRestAlarm } from './RestTimer';
import { FinishSheet } from './FinishSheet';
import { ExerciseMenu } from './ExerciseMenu';
import { RestTimerMenu } from './RestTimerMenu';
import { primeAudio, useWakeLock, vibrate } from './alerts';
import { setInputId } from './SetRow';
import * as L from './logic';

const EMPTY: WorkoutSet[] = [];

/** Workoutklok in de kop: enkel dit stukje tikt elke seconde. */
function ElapsedClock({ startedAt, pausedAt, pausedMs }: Pick<ActiveWorkout, 'startedAt' | 'pausedAt' | 'pausedMs'>) {
  const now = useNow(1000);
  return <div className="flex-1 text-center text-sm font-semibold tabular-nums text-muted">{formatClock(workoutElapsedSec({ startedAt, pausedAt, pausedMs }, now))}</div>;
}

type BlockProps = Omit<Parameters<typeof ExerciseBlock>[0], 'handle' | 'dragging'>;

/** Oefening die je met de greep (⋮⋮) met je vinger kan verslepen. */
const SortableExercise = memo(function SortableExercise(props: BlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.we.id });
  const handle = (
    <button
      type="button"
      className="tap -ml-2 flex touch-none select-none items-center [-webkit-touch-callout:none] justify-center rounded-lg text-faint hover:text-text active:text-accent"
      aria-label={`${props.we.exerciseName} verslepen`}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={20} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <ExerciseBlock {...props} handle={handle} dragging={isDragging} />
    </div>
  );
});

export function ActiveWorkoutSheet() {
  const { active, sheetOpen, closeSheet, update, discard } = useActiveWorkout();
  const workouts = useWorkouts();
  const prefs = useExercisePrefs();
  const profile = useProfile();
  const template = useTemplate(active?.templateId ?? undefined);
  const { confirm, dialog } = useConfirm();

  const [picker, setPicker] = useState<null | { mode: 'add' } | { mode: 'replace'; weId: string }>(null);
  const [menuFor, setMenuFor] = useState<WorkoutExercise | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [timerMenu, setTimerMenu] = useState(false);
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const closeUndo = useCallback(() => setUndo(null), []);

  // Workoutscherm dicht (na Finish, verwijderen of minimaliseren): alle tussenvensters resetten.
  // Anders bleef "Finish" intern open staan en opende het bij de volgende workout onzichtbaar mee.
  useEffect(() => {
    if (sheetOpen) return;
    setFinishOpen(false);
    setTimerMenu(false);
    setMenuFor(null);
    setPicker(null);
  }, [sheetOpen]);

  // Scherm aan houden zolang het workoutscherm open is (waar ondersteund).
  useWakeLock(sheetOpen);

  useRestAlarm(active?.rest ?? null, () => update((w) => ({ ...w, rest: null })));

  const activeRef = useRef(active);
  activeRef.current = active;

  // "Vorige" hangt alleen af van welke oefeningen er staan, niet van wat je intypt.
  const structureKey = active ? `${active.startedAt}|${active.exercises.map((e) => `${e.id}:${e.exerciseId ?? e.exerciseName}`).join('|')}` : '';
  const supersetKey = active ? active.exercises.map((e) => e.supersetGroup ?? '').join('|') : '';
  const previousByWe = useMemo(() => {
    const m = new Map<string, WorkoutSet[]>();
    const a = activeRef.current;
    if (!a || !workouts) return m;
    for (const we of a.exercises) m.set(we.id, findPreviousSets(workouts, we, a.startedAt));
    return m;
  }, [structureKey, workouts]); // eslint-disable-line react-hooks/exhaustive-deps

  const supersetLabels = useMemo(() => {
    const m = new Map<string, string>();
    const a = activeRef.current;
    if (!a) return m;
    const groups = [...new Set(a.exercises.map((e) => e.supersetGroup).filter(Boolean))] as string[];
    for (const we of a.exercises) if (we.supersetGroup) m.set(we.id, `Superset ${String.fromCharCode(65 + groups.indexOf(we.supersetGroup))}`);
    return m;
  }, [structureKey, supersetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const restSecFor = (we: WorkoutExercise) =>
    we.restSec ?? prefs?.find((p) => p.exerciseId === we.exerciseId)?.restSec ?? profile?.defaultRestSec ?? DEFAULT_REST_SEC;
  const live = useRef({ previousByWe, restSecFor });
  live.current = { previousByWe, restSecFor };

  // Stabiele handlers: lezen altijd de nieuwste stand via refs, zodat gememoïseerde oefeningen kloppen.
  const actions = useMemo<ExerciseActions>(
    () => ({
      onSetChange: (weId, setId, patch) => update((w) => L.updateSet(w, weId, setId, patch)),
      onAddSet: (weId) => update((w) => L.addSet(w, weId)),
      onMenu: (weId) => setMenuFor(activeRef.current?.exercises.find((e) => e.id === weId) ?? null),
      onRestChange: (r) => update((w) => ({ ...w, rest: r })),
      onRemoveSet: (weId, setId) => {
        const we = activeRef.current?.exercises.find((e) => e.id === weId);
        const index = we?.sets.findIndex((s) => s.id === setId) ?? -1;
        if (!we || index < 0) return;
        const removed = we.sets[index]!;
        update((w) => L.removeSet(w, weId, setId));
        setUndo({
          id: Date.now(),
          text: `Set verwijderd uit ${we.exerciseName}`,
          undo: () =>
            update((w) =>
              L.updateExercise(w, weId, (e) => {
                if (e.sets.some((s) => s.id === removed.id)) return e;
                const sets = [...e.sets];
                sets.splice(Math.min(index, sets.length), 0, removed);
                return { ...e, sets };
              }),
            ),
        });
      },
      onToggle: (weId, setId) => {
        const a = activeRef.current;
        const we = a?.exercises.find((e) => e.id === weId);
        const s = we?.sets.find((x) => x.id === setId);
        if (!a || !we || !s) return;
        if (s.completed) {
          update((w) => L.updateSet(w, weId, setId, { completed: false, completedAt: null }));
          return;
        }
        let values = { weightKg: s.weightKg, reps: s.reps, durationSec: s.durationSec, distanceM: s.distanceM };
        if (!hasValues(we.exerciseType, values)) {
          // Lege set afvinken = de vorige waarden (placeholder) overnemen, zoals in Strong.
          const prev = live.current.previousByWe.get(weId)?.[we.sets.indexOf(s)];
          if (prev) values = { weightKg: prev.weightKg, reps: prev.reps, durationSec: prev.durationSec, distanceM: prev.distanceM };
        }
        if (!hasValues(we.exerciseType, values)) {
          vibrate(40);
          // Nog niets ingevuld en geen vorige waarde: kort laten schudden i.p.v. het toetsenbord te openen.
          document.getElementById(setInputId(setId))?.closest('.grid')?.animate(
            [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
            { duration: 260 },
          );
          return;
        }
        primeAudio();
        vibrate(15);
        const idx = a.exercises.findIndex((e) => e.id === weId);
        const nextInSuperset = we.supersetGroup && a.exercises[idx + 1]?.supersetGroup === we.supersetGroup;
        const t = Date.now();
        let rest: RestTimerState | null = a.rest;
        if (!nextInSuperset) {
          const secs = live.current.restSecFor(we);
          rest = secs > 0 ? { ...startRest(secs, t, weId), afterSetId: setId } : null;
        }
        const next = L.updateSet(a, weId, setId, { ...values, completed: true, completedAt: new Date(t).toISOString() });
        update(() => ({ ...next, rest }));
        // Geen toetsenbord openen na afvinken (was hinderlijk): eventueel open toetsenbord sluiten.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      },
    }),
    [update],
  );

  // Verslepen, minder gevoelig: op gsm de greep eerst ±0,3 s vasthouden; met de muis pas na 10 px.
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragStart = (e: DragStartEvent) => {
    setDragId(String(e.active.id));
    vibrate(10);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const over = e.over;
    if (over && e.active.id !== over.id) update((w) => ({ ...w, exercises: L.reorderExercises(w.exercises, String(e.active.id), String(over.id)) }));
  };

  if (!active) return null;

  const addExercises = (list: Exercise[]) =>
    update((w) => ({ ...w, exercises: [...w.exercises, ...list.map((ex) => L.workoutExerciseFrom(ex, 3, null))] }));

  const cancelWorkout = async () => {
    if (await confirm({ title: 'Workout annuleren?', message: 'Alle ingevulde sets van deze workout gaan verloren.', confirmLabel: 'Annuleren', danger: true })) {
      await discard();
    }
  };

  const dragged = dragId ? active.exercises.find((e) => e.id === dragId) : null;

  return (
    <Sheet open={sheetOpen} onClose={closeSheet} full>
      <div className="flex min-h-full flex-col">
        {/* Kop met effen achtergrond: een wazige laag maakt scrollen op iPhone traag */}
        <div className="sticky top-0 z-20 border-b border-border bg-bg px-2 py-2">
          <div className="flex items-center gap-1">
            <IconButton label="Minimaliseren" onClick={closeSheet}>
              <ChevronDown size={24} />
            </IconButton>
            <IconButton label="Rusttimer" onClick={() => setTimerMenu(true)} className={active.rest ? 'text-accent' : ''}>
              <Timer size={22} />
            </IconButton>
            <IconButton
              label={active.pausedAt ? 'Hervatten' : 'Pauzeren'}
              onClick={() => update((w) => (w.pausedAt ? resume(w, Date.now()) : pause(w, new Date().toISOString())))}
              className={active.pausedAt ? 'text-warn' : ''}
            >
              {active.pausedAt ? <Play size={22} /> : <Pause size={22} />}
            </IconButton>
            <ElapsedClock startedAt={active.startedAt} pausedAt={active.pausedAt} pausedMs={active.pausedMs} />
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
            {active.exercises.length > 0 && (
              <p className="mt-1 text-xs text-faint">Tip: veeg een set naar links om ze te verwijderen · sleep ⋮⋮ om een oefening te verplaatsen.</p>
            )}
          </div>

          {active.exercises.length === 0 ? (
            <EmptyState title="Nog geen oefeningen" text="Voeg je eerste oefening toe om sets te loggen." />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
              <SortableContext items={active.exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <div className="divide-y divide-border">
                  {active.exercises.map((we) => (
                    <SortableExercise
                      key={we.id}
                      we={we}
                      previous={previousByWe.get(we.id) ?? EMPTY}
                      rest={active.rest && active.rest.workoutExerciseId === we.id ? active.rest : null}
                      supersetLabel={supersetLabels.get(we.id) ?? null}
                      actions={actions}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {dragged && (
                  <div className="flex items-center gap-2 rounded-card border border-accent bg-surface px-3 py-3 shadow-pop">
                    <GripVertical size={20} className="text-accent" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-accent">{dragged.exerciseName}</span>
                    <span className="text-xs text-muted">{dragged.sets.length} sets</span>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
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
        {active.rest && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
            <FloatingRest rest={active.rest} onChange={actions.onRestChange} />
          </div>
        )}
      </div>

      <UndoToast info={undo} onClose={closeUndo} />

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
        defaultRest={menuFor ? restSecFor(menuFor) : DEFAULT_REST_SEC}
        onClose={() => setMenuFor(null)}
        onMove={(dir) => menuFor && update((w) => L.moveExercise(w, menuFor.id, dir))}
        onReplace={() => menuFor && setPicker({ mode: 'replace', weId: menuFor.id })}
        onSuperset={() => menuFor && update((w) => ({ ...w, exercises: L.toggleSupersetWithNext(w.exercises, menuFor.id) }))}
        onRemove={() => menuFor && update((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== menuFor.id) }))}
        onNote={(note) => menuFor && update((w) => L.updateExercise(w, menuFor.id, (e) => ({ ...e, note })))}
        onRest={(sec) => menuFor && update((w) => L.updateExercise(w, menuFor.id, (e) => ({ ...e, restSec: sec })))}
      />

      <RestTimerMenu
        open={timerMenu}
        running={!!active.rest}
        onClose={() => setTimerMenu(false)}
        onStart={(sec) => update((w) => ({ ...w, rest: startRest(sec, Date.now(), null) }))}
        onStop={() => update((w) => ({ ...w, rest: null }))}
      />

      {finishOpen && (
        <FinishSheet open={finishOpen} onClose={() => setFinishOpen(false)} active={active} history={workouts ?? []} template={template && !template.deletedAt ? template : null} />
      )}
      {dialog}
    </Sheet>
  );
}
