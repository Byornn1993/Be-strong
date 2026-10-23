import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button, IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, Spinner } from '@/components/ui/States';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { ExerciseAvatar } from '@/components/ExerciseAvatar';
import { useExerciseMap, useLastPerformed, useTemplates } from '@/lib/db/hooks';
import { cloneTemplate, deleteTemplate, saveTemplate } from '@/lib/db/repo';
import type { Template } from '@/lib/db/types';
import { formatDate } from '@/domain/dates';
import { MUSCLE_LABELS } from '@/domain/exerciseTypes';
import { useActiveWorkout } from './WorkoutProvider';
import { activeFromTemplate, newActiveWorkout } from './logic';

export default function StartWorkoutPage() {
  const templates = useTemplates();
  const exercises = useExerciseMap();
  const last = useLastPerformed();
  const { active, start, openSheet } = useActiveWorkout();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [preview, setPreview] = useState<Template | null>(null);
  const [menu, setMenu] = useState<Template | null>(null);

  const folders = useMemo(() => {
    const m = new Map<string, Template[]>();
    for (const t of templates ?? []) {
      const k = t.folder?.trim() || 'Mijn templates';
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return [...m.entries()];
  }, [templates]);

  const guardActive = async () => {
    if (!active) return true;
    const ok = await confirm({
      title: 'Er loopt al een workout',
      message: 'Rond eerst je lopende workout af, of hervat hem.',
      confirmLabel: 'Hervatten',
    });
    if (ok) openSheet();
    return false;
  };

  const startEmpty = async () => {
    if (await guardActive()) await start(newActiveWorkout('Workout', new Date()));
  };

  const startTemplate = async (t: Template) => {
    if (!exercises) return;
    setPreview(null);
    if (await guardActive()) await start(activeFromTemplate(t, exercises, new Date()));
  };

  return (
    <div>
      <PageHeader title="Start workout" />
      <div className="space-y-6 px-4 md:px-0">
        <section>
          <p className="label mb-2">Snel starten</p>
          <Button variant="primary" size="lg" block icon={<Zap size={18} />} onClick={startEmpty}>
            Start een lege workout
          </Button>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="label">Templates</p>
            <Button size="sm" variant="ghost" icon={<Plus size={16} />} onClick={() => navigate('/templates/new')}>
              Template
            </Button>
          </div>

          {!templates || !exercises ? (
            <Spinner />
          ) : templates.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<FolderOpen />}
                title="Nog geen templates"
                text="Maak een template, of importeer je standaardtemplates via Instellingen."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="primary" onClick={() => navigate('/templates/new')}>
                      Nieuwe template
                    </Button>
                    <Button onClick={() => navigate('/settings')}>Naar instellingen</Button>
                  </div>
                }
              />
            </div>
          ) : (
            folders.map(([folder, list]) => (
              <div key={folder} className="mb-5">
                {folders.length > 1 && <p className="mb-2 text-sm font-semibold text-muted">{folder}</p>}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((t) => (
                    <div key={t.id} className="card relative transition hover:border-accent/40">
                      <button type="button" className="block w-full p-4 pr-12 text-left" onClick={() => setPreview(t)}>
                        <p className="truncate text-[16px] font-semibold">{t.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">
                          {t.exercises
                            .slice(0, 4)
                            .map((te) => exercises.get(te.exerciseId)?.name ?? '?')
                            .join(', ')}
                          {t.exercises.length > 4 && ` +${t.exercises.length - 4}`}
                        </p>
                        <p className="mt-2 text-xs text-faint">{last?.get(t.id) ? `Laatst gedaan: ${formatDate(last.get(t.id)!)}` : 'Nog niet gedaan'}</p>
                      </button>
                      <IconButton label={`Opties voor ${t.name}`} className="absolute right-1 top-1" onClick={() => setMenu(t)}>
                        <MoreHorizontal size={20} />
                      </IconButton>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {/* Template-preview */}
      <Sheet
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name}
        action={
          preview && (
            <Button size="sm" variant="ghost" onClick={() => navigate(`/templates/${preview.id}/edit`)}>
              Bewerk
            </Button>
          )
        }
        footer={
          preview && (
            <Button variant="primary" size="lg" block onClick={() => startTemplate(preview)}>
              Start workout
            </Button>
          )
        }
      >
        {preview && exercises && (
          <ul className="space-y-1 p-3">
            {preview.exercises.map((te) => {
              const ex = exercises.get(te.exerciseId);
              return (
                <li key={te.id} className="flex items-center gap-3 rounded-xl p-2">
                  <ExerciseAvatar name={ex?.name ?? '?'} muscle={ex?.primaryMuscle} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/exercises/${te.exerciseId}`} className="block truncate font-medium hover:text-accent">
                      {te.sets.length} × {ex?.name ?? 'Onbekende oefening'}
                    </Link>
                    <p className="text-xs text-muted">
                      {ex ? MUSCLE_LABELS[ex.primaryMuscle] : ''}
                      {te.sets[0]?.reps ? ` · ${te.sets[0].reps} reps` : ''}
                      {te.sets[0]?.weightKg ? ` · ${String(te.sets[0].weightKg).replace('.', ',')} kg` : ''}
                      {te.supersetGroup ? ' · superset' : ''}
                    </p>
                  </div>
                </li>
              );
            })}
            {preview.note && <li className="px-2 pt-2 text-sm text-muted">{preview.note}</li>}
          </ul>
        )}
      </Sheet>

      {/* Template-acties */}
      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name}>
        {menu && (
          <div className="grid gap-2 p-4">
            <Button icon={<Pencil size={16} />} onClick={() => navigate(`/templates/${menu.id}/edit`)}>
              Bewerken
            </Button>
            <Button
              icon={<Copy size={16} />}
              onClick={async () => {
                await saveTemplate(cloneTemplate(menu, `${menu.name} (kopie)`));
                setMenu(null);
              }}
            >
              Dupliceren
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={async () => {
                const t = menu;
                setMenu(null);
                if (await confirm({ title: `“${t.name}” verwijderen?`, message: 'Je workoutgeschiedenis blijft bewaard.', confirmLabel: 'Verwijderen', danger: true }))
                  await deleteTemplate(t.id);
              }}
            >
              Verwijderen
            </Button>
          </div>
        )}
      </Sheet>
      {dialog}
    </div>
  );
}
