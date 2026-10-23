import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/domain/import/csv';
import { normalizeExerciseName, parseStrongCsv, parseStrongDuration, StrongFormatError } from '@/domain/import/strong';
import { dayKey } from '@/domain/dates';
import { exByName, library } from './helpers';

const sample = readFileSync('tests/fixtures/strong-sample.csv', 'utf8');
const USER = 'aaaaaaaa-0000-4000-8000-00000000000a';

describe('CSV-parser', () => {
  it('aanhalingstekens, lege velden, CRLF en BOM', () => {
    expect(parseCsv('﻿a,"b ""x"", c",\r\n1,2,3\n')).toEqual([
      ['a', 'b "x", c', ''],
      ['1', '2', '3'],
    ]);
  });
});

describe('Strong-import', () => {
  const r = parseStrongCsv(sample, library, USER);

  it('groepeert per Date + Workout Name en slaat Rest Timer-rijen over', () => {
    expect(r.stats.workouts).toBe(3);
    expect(r.stats.restTimerRows).toBe(1);
    expect(r.stats.sets).toBe(13);
    expect(r.stats.skippedRows).toEqual([]);
  });

  it('lokale tijd: 23:30 blijft op dezelfde dag; duur wordt overgenomen', () => {
    const upper = r.workouts.find((w) => w.name === 'Upper')!;
    expect(dayKey(upper.startedAt)).toBe('2024-03-04');
    expect(upper.startedAt).toBe('2024-03-04T23:30:00.000+01:00');
    expect(upper.durationSec).toBe(3900);
  });

  it('koppelt namen aan de bibliotheek (ook met spaties/afwijkende schrijfwijze)', () => {
    const m = Object.fromEntries(r.mappings.map((x) => [x.csvName, x]));
    expect(m['Chest press Machine ']).toMatchObject({ exerciseId: exByName('Chest Press (Machine)').id, isNew: false });
    expect(m['Sled Push ']).toMatchObject({ exerciseId: exByName('Sled Push').id, isNew: false });
    expect(m['Bicep Puldown']).toMatchObject({ isNew: true, exerciseName: 'Bicep Puldown' });
    expect(r.newExercises).toHaveLength(1);
    expect(r.newExercises[0]!.type).toBe('weight_reps');
  });

  it('neemt waarden over zoals ze zijn (ook 80 kg bij Chin Up); afstand km → m', () => {
    const upper = r.workouts.find((w) => w.name === 'Upper')!;
    const chin = upper.exercises.find((e) => e.exerciseName === 'Chin Up')!;
    expect(chin.sets.map((s) => [s.weightKg, s.reps])).toEqual([[80, 10], [80, 8]]);
    expect(upper.exercises.find((e) => e.exerciseName.startsWith('Triceps'))!.sets[0]!.rpe).toBe(8);
    const leg = r.workouts.find((w) => w.name === 'Leg Day')!;
    const walk = leg.exercises.find((e) => e.exerciseName === 'Walking')!;
    expect(walk.sets[0]).toMatchObject({ distanceM: 1300, durationSec: 16, weightKg: null });
    expect(r.stats.weightOnBodyweight).toBe(1); // Crunch met 80 kg: bewaard
  });

  it('markeert onrealistisch lange workouts zonder ze te wijzigen', () => {
    expect(r.stats.longWorkouts).toHaveLength(1);
    expect(r.stats.longWorkouts[0]!.durationSec).toBe(117 * 3600 + 28 * 60);
  });

  it('is deterministisch: opnieuw parsen geeft exact dezelfde ids (idempotente import)', () => {
    const again = parseStrongCsv(sample, library, USER);
    expect(again.workouts.map((w) => w.id)).toEqual(r.workouts.map((w) => w.id));
    expect(again.workouts[0]!.exercises[0]!.sets[0]!.id).toBe(r.workouts[0]!.exercises[0]!.sets[0]!.id);
    // Andere gebruiker → andere ids
    expect(parseStrongCsv(sample, library, 'bbbbbbbb-0000-4000-8000-00000000000b').workouts[0]!.id).not.toBe(r.workouts[0]!.id);
  });

  it('weigert een bestand dat geen Strong-export is', () => {
    expect(() => parseStrongCsv('a,b\n1,2', library, USER)).toThrow(StrongFormatError);
  });

  it('meldt onleesbare rijen in plaats van te raden', () => {
    const bad = sample.split('\n').slice(0, 2).join('\n') + '\n2024-03-04 23:30:00,"Upper ",1h 5m,"Chin Up",X,80,1,0,0,\n';
    const res = parseStrongCsv(bad, library, USER);
    expect(res.stats.skippedRows).toEqual([{ line: 3, reason: 'Onbekende Set Order "X"' }]);
  });

  it('duur en naamnormalisatie', () => {
    expect(parseStrongDuration('1h 37m')).toBe(5820);
    expect(parseStrongDuration('47s')).toBe(47);
    expect(() => parseStrongDuration('lang')).toThrow();
    expect(normalizeExerciseName('Triceps Pushdown (Cable – Straight Bar)')).toBe(normalizeExerciseName('Triceps Pushdown (Cable - Straight Bar)'));
  });
});
