import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { WorkoutProvider } from '@/features/workout/WorkoutProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/States';
import { UpdatePrompt } from '@/components/layout/UpdatePrompt';

// Lazy loading per route
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const NewPasswordPage = lazy(() => import('@/features/auth/NewPasswordPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const GoalsPage = lazy(() => import('@/features/profile/GoalsPage'));
const HistoryPage = lazy(() => import('@/features/history/HistoryPage'));
const WorkoutDetailPage = lazy(() => import('@/features/history/WorkoutDetailPage'));
const StatsPage = lazy(() => import('@/features/history/StatsPage'));
const StartWorkoutPage = lazy(() => import('@/features/workout/StartWorkoutPage'));
const TemplateEditorPage = lazy(() => import('@/features/workout/TemplateEditorPage'));
const ExercisesPage = lazy(() => import('@/features/exercises/ExercisesPage'));
const ExerciseDetailPage = lazy(() => import('@/features/exercises/ExerciseDetailPage'));
const MeasurePage = lazy(() => import('@/features/measure/MeasurePage'));
const MeasureTypePage = lazy(() => import('@/features/measure/MeasureTypePage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const ImportStrongPage = lazy(() => import('@/features/settings/ImportStrongPage'));
const SyncPage = lazy(() => import('@/features/settings/SyncPage'));

/** Beschermde routes: zonder sessie geen lokale database en geen data. */
function Protected() {
  const { session, loading, ready } = useAuth();
  if (loading) return <Spinner label="Be Strong laden…" />;
  if (!session) return <Navigate to="/login" replace />;
  if (!ready) return <Spinner label="Gegevens openen…" />;
  return (
    <WorkoutProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkoutProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/nieuw-wachtwoord" element={<NewPasswordPage />} />
            <Route element={<Protected />}>
              <Route index element={<Navigate to="/profile" replace />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:id" element={<WorkoutDetailPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/workout" element={<StartWorkoutPage />} />
              <Route path="/templates/new" element={<TemplateEditorPage />} />
              <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
              <Route path="/exercises" element={<ExercisesPage />} />
              <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
              <Route path="/measure" element={<MeasurePage />} />
              <Route path="/measure/:typeId" element={<MeasureTypePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/import" element={<ImportStrongPage />} />
              <Route path="/settings/sync" element={<SyncPage />} />
              <Route path="*" element={<Navigate to="/profile" replace />} />
            </Route>
          </Routes>
        </Suspense>
        <UpdatePrompt />
      </AuthProvider>
    </BrowserRouter>
  );
}
