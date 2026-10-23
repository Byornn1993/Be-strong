import Dexie, { type Table } from 'dexie';
import type {
  ActiveWorkout,
  DashboardWidget,
  Exercise,
  ExercisePref,
  Goal,
  Measurement,
  MeasurementType,
  Profile,
  Template,
  Workout,
} from './types';
import type { Conflict, OutboxOp } from '@/lib/sync/types';
import standardExercises from '@/data/exercises.json';
import { STANDARD_MEASUREMENT_TYPES } from '@/data/measurementTypes';

export interface MetaRow {
  key: string;
  value: unknown;
}

/**
 * Lokale database per gebruiker. Alles wat de UI toont komt hieruit (local-first);
 * Supabase is de bron van waarheid en wordt via de outbox/sync bijgewerkt.
 */
export class BeStrongDb extends Dexie {
  exercises!: Table<Exercise, string>;
  exercisePrefs!: Table<ExercisePref, string>;
  templates!: Table<Template, string>;
  workouts!: Table<Workout, string>;
  measurementTypes!: Table<MeasurementType, string>;
  measurements!: Table<Measurement, string>;
  goals!: Table<Goal, string>;
  widgets!: Table<DashboardWidget, string>;
  profile!: Table<Profile, string>;
  active!: Table<ActiveWorkout & { key: 'current' }, string>;
  outbox!: Table<OutboxOp, number>;
  conflicts!: Table<Conflict, string>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      exercises: 'id, name, userId',
      exercisePrefs: 'id, &exerciseId',
      templates: 'id, sortOrder',
      workouts: 'id, startedAt',
      measurementTypes: 'id, sortOrder',
      measurements: 'id, typeId, measuredAt',
      goals: 'id',
      widgets: 'id, position',
      profile: 'id',
      active: 'key',
      outbox: '++seq, key',
      conflicts: 'key',
      meta: 'key',
    });
    // Standaardoefeningen en meettypes zitten in de app gebundeld: ook de allereerste start
    // werkt offline. De sync overschrijft ze later met de serverversie (zelfde ids).
    this.on('ready', async () => {
      await seedStandardData(this);
    });
  }
}

export async function seedStandardData(db: BeStrongDb): Promise<void> {
  const version = 'std-v1-' + standardExercises.length;
  const done = await db.meta.get('seeded');
  if (done?.value === version) return;
  await db.transaction('rw', db.exercises, db.measurementTypes, db.meta, async () => {
    const existing = new Set(await db.exercises.toCollection().primaryKeys());
    const rows: Exercise[] = standardExercises
      .filter((e) => !existing.has(e.id))
      .map((e) => ({
        id: e.id,
        userId: null,
        name: e.name,
        primaryMuscle: e.primaryMuscle as Exercise['primaryMuscle'],
        secondaryMuscles: e.secondaryMuscles as Exercise['secondaryMuscles'],
        equipment: e.equipment as Exercise['equipment'],
        type: e.type as Exercise['type'],
        instructions: null,
        imagePath: null,
        notes: null,
        serverUpdatedAt: null,
        deletedAt: null,
      }));
    await db.exercises.bulkAdd(rows);
    const existingTypes = new Set(await db.measurementTypes.toCollection().primaryKeys());
    await db.measurementTypes.bulkAdd(STANDARD_MEASUREMENT_TYPES.filter((t) => !existingTypes.has(t.id)));
    await db.meta.put({ key: 'seeded', value: version });
  });
}

let current: BeStrongDb | null = null;

/** Open (of hergebruik) de lokale database van deze gebruiker. */
export function openDb(userId: string): BeStrongDb {
  const name = `bestrong-${userId}`;
  if (current?.name === name) return current;
  current?.close();
  current = new BeStrongDb(name);
  return current;
}

export function getDb(): BeStrongDb {
  if (!current) throw new Error('Lokale database is nog niet geopend (geen sessie).');
  return current;
}

export function closeDb(): void {
  current?.close();
  current = null;
}
