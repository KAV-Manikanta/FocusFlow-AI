import React, { useEffect, useState } from 'react';
import { FocusFlowProvider, useFocusFlow } from './context/FocusFlowContext';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { PlannerPage } from './pages/PlannerPage';
import { AssistantPage } from './pages/AssistantPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { HabitsPage } from './pages/HabitsPage';
import { FocusPage } from './pages/FocusPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { GeminiKeyGate } from './pages/GeminiKeyGate';
import { SignInGate, LoadingScreen } from './pages/SignInGate';
import { useGeminiKey, syncGeminiKeyWithAccount } from './services/gemini';

const WorkspaceRouter: React.FC = () => {
  const { activePage, setActivePage } = useFocusFlow();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);

  const handleQuickAddTask = () => {
    setActivePage('tasks');
    setShowNewTaskModal(true);
  };

  return (
    <AppShell onQuickAddTask={handleQuickAddTask}>
      {activePage === 'dashboard' && <DashboardPage onOpenNewTaskModal={handleQuickAddTask} />}
      {activePage === 'tasks' && (
        <TasksPage showNewTaskModal={showNewTaskModal} setShowNewTaskModal={setShowNewTaskModal} />
      )}
      {activePage === 'planner' && <PlannerPage />}
      {activePage === 'assistant' && <AssistantPage />}
      {activePage === 'analytics' && <AnalyticsPage />}
      {activePage === 'habits' && <HabitsPage />}
      {activePage === 'focus' && <FocusPage />}
      {activePage === 'notifications' && <NotificationsPage />}
      {activePage === 'settings' && <SettingsPage />}
      {activePage === 'auth' && <AuthPage />}
    </AppShell>
  );
};

const AccessGate: React.FC = () => {
  const { isAuthReady, firebaseUser } = useFocusFlow();
  const geminiKey = useGeminiKey();
  const [syncedUid, setSyncedUid] = useState<string | null>(null);
  const verifiedUid = firebaseUser?.emailVerified ? firebaseUser.uid : null;

  // Pull the Gemini key saved on the account so a new device doesn't ask for it again
  useEffect(() => {
    if (!verifiedUid) {
      setSyncedUid(null);
      return;
    }
    let cancelled = false;
    syncGeminiKeyWithAccount(verifiedUid).finally(() => {
      if (!cancelled) setSyncedUid(verifiedUid);
    });
    return () => {
      cancelled = true;
    };
  }, [verifiedUid]);

  // 1) Google sign-in  2) Gemini API key  3) the workspace
  if (!isAuthReady) return <LoadingScreen />;
  if (!firebaseUser || !firebaseUser.emailVerified) return <SignInGate />;
  if (syncedUid !== firebaseUser.uid) return <LoadingScreen />;
  if (!geminiKey) return <GeminiKeyGate />;
  return <WorkspaceRouter />;
};

export default function App() {
  return (
    <FocusFlowProvider>
      <AccessGate />
    </FocusFlowProvider>
  );
}
