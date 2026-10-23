import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Copy, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, Stat } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/States';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { DurationInput, NumberInput } from '@/components/ui/NumberInput';
import { useWorkout, useWorkouts } from '@/lib/db/hooks';
import { deleteWorkout, saveTemplate, saveWorkout } from '@/lib/db/repo';
import type { Workout } from '@/lib/db/types';
import { dayKey, formatLongDate, formatTime, isoToTimeInput, localInputToIso, toLocalIso } from '@/domain/dates';
import { detectNewPrs, PR_LABELS } from '@/domain/prs';
import { columnsFor, setBadge } from '@/domain/exerciseTypes';
import { completedSetCount, workoutVolume } from '@/domain/volume';
import { formatDuration, formatSet, formatVolume } from '@/domain/format';
import { emptySet, newTemplateFromWorkout } from '@/features/workout/logic';
import { formatPr } from '@/features/workout/FinishSheet';

export default function WorkoutDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const w = useWorkout(id);
  const all = useWorkouts();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<Workout | null>(null);
  const [saving, setSaving] = useState(false);

  const prs = useMemo(() => (w && all ? detectNewPrs(w, all) : []), [w, all]);

  if (w === undefined || !all) return <Spinner />;
  if (!w || w.deletedAt) return <EmptyState title="Workout niet gevonden" action={<Button onClick={() => navigate('/history')}>Naar geschiedenis</Button>} />;

  const remove = async () => {
    if (await confirm({ title: 'Workout verwijderen?', message: `“${w.name}” van ${formatLongDate(w.startedAt)} wordt verwijderd.`, confirmLabel: 'Verwijderen', danger: true })) {
      await deleteWorkout(w.id);
      navigate('/history');
    }
  };

  const asTemplate = async () => {
    const t = newTemplateFromWorkout(w);
    await saveTemplate(t);
    navigate(`/templates/${t.id}/edit`);
  };

  if (draft) return <EditWorkout draft={draft} setDraft={setDraft} saving={saving} onSave={async () => {
    setSaving(true);
    await saveWorkout({ ...draft, name: draft.name.trim() || 'Workout', endedAt: toLocalIso(new Date(Date.parse(draft.startedAt) + draft.durationSec * 1000)) });
    setSaving(false);
    setDraft(null);
  }} />;

  return (
    <div>
      <PageHeader
        title={w.name}
        subtitle={`${formatLongDate(w.startedAt)} · ${formatTime(w.startedAt)}`}
        back="/history"
        actions={
          <>
            <IconButton label="Bewerken" onClick={() => setDraft(structuredClone(w))}>
              <Pencil size={20} />
            </IconButton>
            <IconButton label="Verwijderen" onClick={remove}>
              <Trash2 size={20} />
            </IconButton>
          </>
        }
      />
      <div className="space-y-4 px-4 md:px-0">
        {params.get('finished') && (
          <div className="flex items-center gap-2 rounded-card border border-accent/30 bg-primary-soft p-3 text-sm text-accent">
            <CheckCircle2 size={18} /> Workout opgeslagen. Stronger than yesterday!
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Duur" value={formatDuration(w.durationSec)} />
          <Stat label="Oefeningen" value={w.exercises.length} />
          <Stat label="Sets" value={completedSetCount(w)} />
          <Stat label="Volume" value={formatVolume(workoutVolume(w))} />
        </div>
        {prs.length > 0 && (
          <Card className="p-4">
            <p className="flex items-center gap-2 font-semibold text-accent">
              <Trophy size={18} /> Persoonlijke records
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {prs.map((p, i) => (
                <li key={i}>
                  {p.exerciseName} · <span className="text-muted">{PR_LABELS[p.kind]}:</span> {formatPr(p)}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {w.note && <Card className="whitespace-pre-line p-4 text-sm">{w.note}</Card>}
        <div className="grid gap-3 md:grid-cols-2">
          {w.exercises.map((we) => {
            let n = 0;
            return (
              <Card key={we.id} className="p-4">
                {we.exerciseId ? (
                  <Link to={`/exercises/${we.exerciseId}`} className="font-semibold text-accent hover:underline">
                    {we.exerciseName}
                  </Link>
                ) : (
                  <p className="font-semibold">{we.exerciseName}</p>
                )}
                {we.note && <p className="text-xs text-muted">{we.note}</p>}
                <ol className="mt-2 space-y-1 text-sm">
                  {we.sets.map((s) => (
                    <li key={s.id} className={`flex gap-3 ${s.completed ? '' : 'text-faint line-through'}`}>
                      <span className="w-5 text-faint">{setBadge(s.type, s.type !== 'warmup' ? ++n : n)}</span>
                      <span className="tabular-nums">{formatSet(we.exerciseType, s)}</span>
                      {s.note && <span className="text-xs text-muted">· {s.note}</span>}
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })}
        </div>
        <Button block icon={<Copy size={16} />} onClick={asTemplate}>
          Opslaan als nieuwe template
        </Button>
      </div>
      {dialog}
    </div>
  );
}

function EditWorkout({ draft, setDraft, onSave, saving }: { draft: Workout; setDraft: (w: Workout | null) => void; onSave: () => void; saving: boolean }) {
  const date = dayKey(draft.startedAt);
  const time = isoToTimeInput(draft.startedAt);
  const patchSet = (weId: string, setId: string, p: Partial<Workout['exercises'][number]['sets'][number]>) =>
    setDraft({ ...draft, exercises: draft.exercises.map((we) => (we.id === weId ? { ...we, sets: we.sets.map((s) => (s.id === setId ? { ...s, ...p } : s)) } : we)) });

  return (
    <div>
      <PageHeader
        title="Workout bewerken"
        actions={
          <>
            <IconButton label="Annuleren" onClick={() => setDraft(null)}>
              <X size={20} />
            </IconButton>
            <Button variant="primary" onClick={onSave} loading={saving}>
              Opslaan
            </Button>
          </>
        }
      />
      <div className="space-y-4 px-4 md:px-0">
        <p className="rounded-card border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          Je bewerkt een <strong>historische workout</strong>. Dit verandert alleen deze workout in je geschiedenis, niet de template.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">Naam</span>
            <input className="field mt-1" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Datum</span>
            <input type="date" className="field mt-1" value={date} max={dayKey(new Date())} onChange={(e) => e.target.value && setDraft({ ...draft, startedAt: localInputToIso(e.target.value, time) })} />
          </label>
          <label className="block">
            <span className="label">Starttijd</span>
            <input type="time" className="field mt-1" value={time} onChange={(e) => e.target.value && setDraft({ ...draft, startedAt: localInputToIso(date, e.target.value) })} />
          </label>
          <label className="block">
            <span className="label">Duur (minuten)</span>
            <input
              className="field mt-1"
              inputMode="numeric"
              value={Math.round(draft.durationSec / 60)}
              onChange={(e) => {
                const min = Number(e.target.value.replace(/\D/g, '') || 0);
                setDraft({ ...draft, durationSec: min * 60 });
              }}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Notities</span>
            <textarea className="field mt-1" value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value || null })} />
          </label>
        </div>
        {draft.exercises.map((we) => {
          const cols = columnsFor(we.exerciseType);
          return (
            <Card key={we.id} className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{we.exerciseName}</p>
                <IconButton label="Oefening verwijderen" onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter((x) => x.id !== we.id) })}>
                  <Trash2 size={18} />
                </IconButton>
              </div>
              <div className="space-y-1">
                {we.sets.map((s, i) => (
                  <div key={s.id} className="grid items-center gap-2" style={{ gridTemplateColumns: `28px ${cols.map(() => '1fr').join(' ')} 44px 44px` }}>
                    <span className="text-center text-sm text-faint">{i + 1}</span>
                    {cols.map((c) =>
                      c.field === 'durationSec' ? (
                        <DurationInput key={c.field} aria-label={c.label} value={s.durationSec} onValue={(v) => patchSet(we.id, s.id, { durationSec: v })} />
                      ) : (
                        <NumberInput key={c.field} aria-label={c.label} integer={c.field === 'reps'} value={s[c.field]} placeholder={c.label} onValue={(v) => patchSet(we.id, s.id, { [c.field]: v })} />
                      ),
                    )}
                    <label className="tap flex items-center justify-center" title="Voltooid">
                      <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={s.completed} onChange={(e) => patchSet(we.id, s.id, { completed: e.target.checked })} aria-label="Voltooid" />
                    </label>
                    <IconButton label="Set verwijderen" onClick={() => setDraft({ ...draft, exercises: draft.exercises.map((x) => (x.id === we.id ? { ...x, sets: x.sets.filter((y) => y.id !== s.id) } : x)) })}>
                      <X size={16} />
                    </IconButton>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setDraft({ ...draft, exercises: draft.exercises.map((x) => (x.id === we.id ? { ...x, sets: [...x.sets, { ...emptySet(), completed: true }] } : x)) })}>
                Set toevoegen
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
