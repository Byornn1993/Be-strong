import { describe, expect, it } from 'vitest';
import { createWriteQueue } from '@/features/workout/writeQueue';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('opslagwachtrij lopende workout', () => {
  it('blijft opslaan na een flush zonder openstaande wijziging (regressie: tweede workout werd niet bewaard)', async () => {
    const saved: number[] = [];
    const q = createWriteQueue<number>(async (v) => {
      saved.push(v);
    });
    await q.flush(); // bv. Finish of Verwijderen terwijl er niets te schrijven is
    q.push(1);
    await q.flush();
    q.clear();
    await q.flush();
    q.push(2);
    await q.flush();
    expect(saved).toEqual([1, 2]);
  });

  it('schrijft altijd de nieuwste versie en slaat tussenversies over', async () => {
    const saved: number[] = [];
    let release!: () => void;
    const q = createWriteQueue<number>(async (v) => {
      saved.push(v);
      if (v === 1) await new Promise<void>((r) => (release = r));
    });
    q.push(1);
    await tick();
    q.push(2);
    q.push(3);
    q.push(4);
    release();
    await q.flush();
    expect(saved).toEqual([1, 4]);
  });

  it('een fout bij opslaan blokkeert latere schrijfacties niet', async () => {
    const saved: number[] = [];
    const errors: unknown[] = [];
    const q = createWriteQueue<number>(
      async (v) => {
        if (v === 1) throw new Error('kapot');
        saved.push(v);
      },
      (e) => errors.push(e),
    );
    q.push(1);
    await q.flush();
    q.push(2);
    await q.flush();
    expect(saved).toEqual([2]);
    expect(errors).toHaveLength(1);
  });
});
