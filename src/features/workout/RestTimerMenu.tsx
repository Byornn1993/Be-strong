import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { formatClock } from '@/domain/format';
import { primeAudio } from './alerts';

const CHOICES = [30, 60, 90, 120, 180, 300];

/** Rusttimer handmatig starten (of stoppen) vanuit de kop van het workoutscherm. */
export function RestTimerMenu({ open, running, onClose, onStart, onStop }: { open: boolean; running: boolean; onClose: () => void; onStart: (sec: number) => void; onStop: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Rusttimer">
      <div className="grid grid-cols-3 gap-2 p-4">
        {CHOICES.map((s) => (
          <Button
            key={s}
            size="lg"
            onClick={() => {
              primeAudio();
              onStart(s);
              onClose();
            }}
          >
            {formatClock(s)}
          </Button>
        ))}
        {running && (
          <Button className="col-span-3" variant="danger" onClick={() => (onStop(), onClose())}>
            Timer stoppen
          </Button>
        )}
      </div>
    </Sheet>
  );
}
