import { v5 as uuidv5 } from 'uuid';
import type { Equipment, Exercise, ExerciseType, SetType, Workout, WorkoutExercise, WorkoutSet } from '@/lib/db/types';
import { toLocalIso } from '@/domain/dates';
import { parseCsv } from './csv';

// Parser voor de CSV-export van de Strong-app, gebaseerd op een echt exportbestand (sept. 2023 – aug. 2026):
//
//   Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE
//   2023-09-20 11:02:42,"Morning Workout",7m,"Chin Up",1,80.0,10.0,0,0.0,
//
// Vastgestelde eigenschappen van dat bestand:
//  * Eén rij per set. Een workout = alle rijen met dezelfde Date + Workout Name.
//  * Date is lokale tijd zonder tijdzone → we interpreteren die in de tijdzone van het toestel.
//  * Duration: "47s", "7m", "1h 37m" (soms onrealistisch lang, bv. "117h 28m": vergeten af te sluiten).
//  * Set Order: een nummer, of "Rest Timer" (rusttijd in Seconds; dat is geen set → overgeslagen).
//  * Weight in kg, Distance in km, Seconds = duur van de set. RPE is leeg.
//  * Namen kunnen spaties op het einde hebben ("Sled Push ") of afwijken ("Chest press Machine ").
// Waarden worden overgenomen zoals ze zijn (ook bv. 80 kg bij Chin Up). Enige omzetting:
// afstand km → meter (de app bewaart afstand in meter). Een 0 wordt opgeslagen als "leeg".

export const STRONG_HEADER = ['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Weight', 'Reps', 'Distance', 'Seconds', 'RPE'] as const;

/** Vaste namespace voor deterministische import-ids. NOOIT wijzigen: dat breekt de idempotentie. */
const NS = '4d6f8f3e-2b1a-4c9e-8a7d-1f2e3c4b5a69';

export interface ImportedExerciseDraft {
  id: string;
  name: string;
  type: ExerciseType;
  equipment: Equipment;
}

export interface NameMapping {
  csvName: string;
  exerciseId: string;
  exerciseName: string;
  isNew: boolean;
}

export interface StrongImportResult {
  workouts: Workout[];
  newExercises: ImportedExerciseDraft[];
  mappings: NameMapping[];
  stats: {
    rows: number;
    setRows: number;
    restTimerRows: number;
    skippedRows: { line: number; reason: string }[];
    workouts: number;
    sets: number;
    firstDate: string | null;
    lastDate: string | null;
    longWorkouts: { name: string; startedAt: string; durationSec: number }[];
    weightOnBodyweight: number;
  };
}

export class StrongFormatError extends Error {}

export function normalizeExerciseName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/[()]/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseStrongDuration(s: string): number {
  const str = s.trim();
  if (!str) return 0;
  const re = /(\d+)\s*([hms])/g;
  let total = 0;
  let matched = false;
  for (const m of str.matchAll(re)) {
    matched = true;
    const n = Number(m[1]);
    total += m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : n;
  }
  if (!matched) throw new StrongFormatError(`Onbekende duur: "${s}"`);
  return total;
}

export function parseStrongDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) throw new StrongFormatError(`Onbekende datum: "${s}"`);
  return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!);
}

function parseNum(s: string | undefined): number | null {
  if (s === undefined) return null;
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new StrongFormatError(`Geen getal: "${s}"`);
  return n;
}

const nz = (n: number | null) => (n === null || n === 0 ? null : n);

function parseSetOrder(s: string): SetType | null {
  const t = s.trim().toUpperCase();
  if (/^\d+$/.test(t)) return 'normal';
  if (t === 'W') return 'warmup';
  if (t === 'D') return 'drop';
  if (t === 'F') return 'failure';
  return null;
}

function equipmentFromName(name: string): Equipment {
  const n = name.toLowerCase();
  if (n.includes('barbell')) return 'barbell';
  if (n.includes('dumbbell')) return 'dumbbell';
  if (n.includes('cable')) return 'cable';
  if (n.includes('plate loaded')) return 'plate_loaded';
  if (n.includes('machine')) return 'machine';
  if (n.includes('kettlebell')) return 'kettlebell';
  return 'other';
}

/** Type van een onbekende oefening afleiden uit de data (welke kolommen zijn gevuld). */
export function inferType(sets: { weight: number | null; reps: number | null; distance: number | null; seconds: number | null }[]): ExerciseType {
  const any = (f: (s: (typeof sets)[number]) => number | null) => sets.some((s) => (f(s) ?? 0) > 0);
  const w = any((s) => s.weight);
  const r = any((s) => s.reps);
  const d = any((s) => s.distance);
  const t = any((s) => s.seconds);
  if (d && w) return 'weight_distance';
  if (d) return 'distance_duration';
  if (t && !r) return 'duration';
  if (r && !w) return 'bodyweight_reps';
  return 'weight_reps';
}

interface Row {
  line: number;
  date: string;
  workoutName: string;
  duration: string;
  exercise: string;
  setType: SetType;
  weight: number | null;
  reps: number | null;
  distance: number | null;
  seconds: number | null;
  rpe: number | null;
}

/**
 * Zet een Strong-CSV om naar workouts. Puur: schrijft niets weg.
 * @param library alle oefeningen die de gebruiker kan zien (standaard + eigen)
 * @param userId  wordt gebruikt in de deterministische ids (idempotent per gebruiker)
 */
export function parseStrongCsv(text: string, library: readonly Exercise[], userId: string): StrongImportResult {
  const table = parseCsv(text);
  if (table.length === 0) throw new StrongFormatError('Het bestand is leeg.');
  const header = table[0]!.map((h) => h.trim());
  const idx: Record<string, number> = {};
  for (const col of STRONG_HEADER) {
    const i = header.indexOf(col);
    if (i === -1) throw new StrongFormatError(`Kolom "${col}" ontbreekt. Is dit een Strong-export?`);
    idx[col] = i;
  }

  const skipped: { line: number; reason: string }[] = [];
  const rows: Row[] = [];
  let restTimerRows = 0;

  for (let li = 1; li < table.length; li++) {
    const r = table[li]!;
    const line = li + 1;
    const get = (c: (typeof STRONG_HEADER)[number]) => r[idx[c]!] ?? '';
    const order = get('Set Order').trim();
    if (order.toLowerCase() === 'rest timer') {
      restTimerRows++;
      continue;
    }
    const setType = parseSetOrder(order);
    if (!setType) {
      skipped.push({ line, reason: `Onbekende Set Order "${order}"` });
      continue;
    }
    try {
      parseStrongDate(get('Date'));
      parseStrongDuration(get('Duration'));
      rows.push({
        line,
        date: get('Date').trim(),
        workoutName: get('Workout Name'),
        duration: get('Duration'),
        exercise: get('Exercise Name'),
        setType,
        weight: parseNum(get('Weight')),
        reps: parseNum(get('Reps')),
        distance: parseNum(get('Distance')),
        seconds: parseNum(get('Seconds')),
        rpe: parseNum(get('RPE')),
      });
    } catch (e) {
      skipped.push({ line, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  // Bibliotheek indexeren op genormaliseerde naam (eigen oefeningen winnen niet van standaard; eerste match telt).
  const byNorm = new Map<string, Exercise>();
  for (const ex of library) {
    if (ex.deletedAt) continue;
    const k = normalizeExerciseName(ex.name);
    if (!byNorm.has(k)) byNorm.set(k, ex);
  }

  // Oefeningnamen koppelen
  const mappings = new Map<string, NameMapping>();
  const newExercises = new Map<string, ImportedExerciseDraft>();
  const rowsByCsvName = new Map<string, Row[]>();
  for (const row of rows) {
    const arr = rowsByCsvName.get(row.exercise) ?? [];
    arr.push(row);
    rowsByCsvName.set(row.exercise, arr);
  }
  const typeOf = new Map<string, ExerciseType>();
  for (const [csvName, exRows] of rowsByCsvName) {
    const norm = normalizeExerciseName(csvName);
    const hit = byNorm.get(norm);
    if (hit) {
      mappings.set(csvName, { csvName, exerciseId: hit.id, exerciseName: hit.name, isNew: false });
      typeOf.set(csvName, hit.type);
      continue;
    }
    let draft = newExercises.get(norm);
    if (!draft) {
      draft = {
        id: uuidv5(`strong-exercise:${userId}:${norm}`, NS),
        name: csvName.trim(),
        type: inferType(exRows),
        equipment: equipmentFromName(csvName),
      };
      newExercises.set(norm, draft);
    }
    mappings.set(csvName, { csvName, exerciseId: draft.id, exerciseName: draft.name, isNew: true });
    typeOf.set(csvName, draft.type);
  }

  // Workouts opbouwen
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = `${row.date}|${row.workoutName}`;
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }

  const workouts: Workout[] = [];
  const longWorkouts: StrongImportResult['stats']['longWorkouts'] = [];
  let weightOnBodyweight = 0;
  let setCount = 0;

  for (const [key, wRows] of groups) {
    const first = wRows[0]!;
    const sourceKey = `strong:${key}`;
    const workoutId = uuidv5(`${userId}:${sourceKey}`, NS);
    const start = parseStrongDate(first.date);
    const durationSec = parseStrongDuration(first.duration);
    const startedAt = toLocalIso(start);
    const endedAt = toLocalIso(new Date(start.getTime() + durationSec * 1000));
    const name = first.workoutName.trim() || 'Workout';
    if (durationSec > 6 * 3600) longWorkouts.push({ name, startedAt, durationSec });

    // Oefeningen in volgorde van eerste verschijning; sets in bestandsvolgorde.
    const exOrder: string[] = [];
    const exRows = new Map<string, Row[]>();
    for (const row of wRows) {
      if (!exRows.has(row.exercise)) {
        exOrder.push(row.exercise);
        exRows.set(row.exercise, []);
      }
      exRows.get(row.exercise)!.push(row);
    }

    const exercises: WorkoutExercise[] = exOrder.map((csvName, ei) => {
      const map = mappings.get(csvName)!;
      const type = typeOf.get(csvName)!;
      const weId = uuidv5(`${workoutId}:exercise:${ei}`, NS);
      const sets: WorkoutSet[] = exRows.get(csvName)!.map((row, si) => {
        if ((type === 'bodyweight_reps' || type === 'duration' || type === 'distance_duration') && (row.weight ?? 0) > 0) weightOnBodyweight++;
        return {
          id: uuidv5(`${weId}:set:${si}`, NS),
          type: row.setType,
          weightKg: nz(row.weight),
          reps: nz(row.reps === null ? null : Math.round(row.reps)),
          durationSec: nz(row.seconds === null ? null : Math.round(row.seconds)),
          distanceM: nz(row.distance === null ? null : Math.round(row.distance * 1000 * 100) / 100),
          rpe: row.rpe,
          completed: true,
          completedAt: endedAt,
          note: null,
        };
      });
      setCount += sets.length;
      return {
        id: weId,
        exerciseId: map.exerciseId,
        exerciseName: map.exerciseName,
        exerciseType: type,
        supersetGroup: null,
        restSec: null,
        note: null,
        sets,
      };
    });

    workouts.push({
      id: workoutId,
      name,
      startedAt,
      endedAt,
      durationSec,
      note: null,
      templateId: null,
      source: 'strong_import',
      sourceKey,
      exercises,
      serverUpdatedAt: null,
      deletedAt: null,
    });
  }

  workouts.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return {
    workouts,
    newExercises: [...newExercises.values()],
    mappings: [...mappings.values()].sort((a, b) => a.csvName.localeCompare(b.csvName)),
    stats: {
      rows: table.length - 1,
      setRows: rows.length,
      restTimerRows,
      skippedRows: skipped,
      workouts: workouts.length,
      sets: setCount,
      firstDate: workouts[0]?.startedAt ?? null,
      lastDate: workouts.at(-1)?.startedAt ?? null,
      longWorkouts,
      weightOnBodyweight,
    },
  };
}
