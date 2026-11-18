import React, { useState } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  CheckSquare,
  Calendar,
  Bot,
  Flame,
  Timer,
  Bell,
  Settings,
  Menu,
  X,
  Search,
  Sparkles,
} from 'lucide-react';
import { useFocusFlow, ActivePage } from '../context/FocusFlowContext';

const NAV_ITEMS: { id: ActivePage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'planner', label: 'Smart Planner', icon: Calendar },
  { id: 'assistant', label: 'AI Assistant', icon: Bot },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'habits', label: 'Habits', icon: Flame },
  { id: 'focus', label: 'Focus Mode', icon: Timer },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PAGE_TITLES: Record<ActivePage, string> = {
  dashboard: 'Dashboard',
  tasks: 'My Tasks',
  planner: 'Smart Planner',
  assistant: 'AI Assistant',
  analytics: 'Analytics',
  habits: 'Habits',
  focus: 'Focus Mode',
  insights: 'AI Insights',
  notifications: 'Notifications',
  settings: 'Settings',
  auth: 'Account',
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const initialsOf = (name: string) =>
  (name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'U';

export const AppShell: React.FC<{ children: React.ReactNode; onQuickAddTask: () => void }> = ({
  children,
  onQuickAddTask: _onQuickAddTask,
}) => {
  const {
    activePage,
    setActivePage,
    notifications,
    tasks,
    userProfile,
    timerRunning,
    timerSecondsLeft,
    taskSearch,
    setTaskSearch,
    toasts,
    dismissToast,
  } = useFocusFlow();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const doneCount = tasks.filter((t) => t.status === 'Completed').length;
  const totalCount = tasks.filter((t) => t.status !== 'Archived').length;
  const goalPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const firstName = (userProfile.displayName || 'there').split(' ')[0];
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const formatTimer = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  const NavList: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
    <nav className="flex-1 px-4 space-y-1 overflow-y-auto" aria-label="Module Navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActivePage(item.id);
              onNavigate?.();
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-gradient-to-r from-[#4F3BD9] to-[#7A3FEA] text-white shadow-[0_8px_20px_rgba(91,63,224,0.35)]'
                : 'text-[#5A5C78] hover:text-[#14142B] hover:bg-[#F4F5FA]'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#7A7D96]'}`} />
            <span className="flex-1 text-left truncate">{item.label}</span>
            {item.id === 'notifications' && unreadCount > 0 && (
              <span
                className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                  isActive ? 'bg-white/25 text-white' : 'bg-[#EDE9FE] text-[#5B3FE0]'
                }`}
              >
                {unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const Brand = (
    <button
      type="button"
      onClick={() => setActivePage('dashboard')}
      className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FE0] rounded-lg"
    >
      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F3BD9] to-[#7A3FEA] flex items-center justify-center shadow-[0_6px_16px_rgba(91,63,224,0.35)]">
        <Sparkles className="w-[18px] h-[18px] text-white" />
      </span>
      <span className="font-display text-[17px] font-extrabold tracking-tight text-[#14142B]">
        FocusFlow <span className="text-[#5B3FE0]">AI</span>
      </span>
    </button>
  );

  const DailyGoal = (
    <div className="mx-4 mb-4 p-4 rounded-2xl bg-white border border-[#ECEDF5] shadow-card">
      <p className="text-[11px] font-medium text-[#7A7D96]">Daily goal</p>
      <p className="text-[15px] font-bold text-[#14142B] mt-0.5">
        {doneCount} of {totalCount} tasks
      </p>
      <div className="mt-2.5 h-1.5 rounded-full bg-[#ECEDF5] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#4F3BD9] to-[#7A3FEA] transition-all"
          style={{ width: `${goalPct}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F5FB] text-[#14142B] flex">
      {/* Desktop Sidebar */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className="hidden md:flex flex-col shrink-0 w-[240px] bg-white border-r border-[#ECEDF5] sticky top-0 h-screen"
      >
        <div className="px-6 pt-6 pb-7">{Brand}</div>
        <NavList />
        {DailyGoal}
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-5 lg:px-8 pt-6 pb-2 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="md:hidden mt-0.5 p-2 rounded-xl bg-white border border-[#ECEDF5] text-[#5A5C78]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="min-w-0">
              {activePage === 'dashboard' ? (
                <>
                  <p className="text-xs text-[#7A7D96] font-medium">{formattedDate}</p>
                  <h1 className="font-display text-2xl sm:text-[28px] leading-tight font-extrabold text-[#14142B] mt-0.5 sm:truncate">
                    {greeting()}, {firstName} <span aria-hidden="true">👋</span>
                  </h1>
                </>
              ) : (
                <>
                  <p className="text-xs text-[#7A7D96] font-medium">{formattedDate}</p>
                  <h1 className="font-display text-2xl sm:text-[28px] leading-tight font-extrabold text-[#14142B] mt-0.5 sm:truncate">
                    {PAGE_TITLES[activePage]}
                  </h1>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {timerRunning && activePage !== 'focus' && (
              <button
                type="button"
                onClick={() => setActivePage('focus')}
                className="hidden sm:flex items-center gap-2 h-10 px-3.5 rounded-xl bg-[#EDE9FE] text-[#5B3FE0] text-xs font-bold"
                aria-label="Open running focus timer"
              >
                <Timer className="w-4 h-4" />
                <span className="tabular-nums">{formatTimer(timerSecondsLeft)}</span>
              </button>
            )}
            <label className="hidden sm:flex items-center gap-2 h-10 w-[220px] px-3.5 rounded-xl bg-white border border-[#ECEDF5] shadow-card focus-within:border-[#5B3FE0] transition-colors">
              <Search className="w-4 h-4 text-[#7A7D96] shrink-0" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => {
                  setTaskSearch(e.target.value);
                  if (e.target.value && activePage !== 'tasks') setActivePage('tasks');
                }}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className="w-full bg-transparent outline-none text-xs text-[#14142B] placeholder-[#9A9CB3]"
              />
            </label>
            <button
              type="button"
              onClick={() => setActivePage('notifications')}
              aria-label="Notifications"
              className="relative w-10 h-10 rounded-xl bg-white border border-[#ECEDF5] shadow-card flex items-center justify-center text-[#5A5C78] hover:text-[#14142B] transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#EF4444] ring-2 ring-white" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActivePage('auth')}
              aria-label="Account"
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#C026D3] text-white text-xs font-bold flex items-center justify-center shadow-[0_4px_12px_rgba(192,38,211,0.25)]"
            >
              {initialsOf(userProfile.displayName)}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mx-5 mt-2 py-3 rounded-2xl bg-white border border-[#ECEDF5] shadow-card flex flex-col">
            <NavList onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        )}

        <main className="flex-1 px-5 lg:px-8 pt-5 pb-10 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>

      {/* Toasts */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pointer-events-auto bg-white border border-[#E2E4F0] rounded-2xl p-4 shadow-[0_12px_32px_rgba(20,20,43,0.14)] flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    t.variant === 'success'
                      ? 'text-[#16A34A]'
                      : t.variant === 'warning'
                      ? 'text-[#D97706]'
                      : t.variant === 'danger'
                      ? 'text-[#DC2626]'
                      : 'text-[#14142B]'
                  }`}
                >
                  {t.title}
                </p>
                {t.description && <p className="text-xs text-[#5A5C78] mt-1">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Dismiss notification"
                className="text-[#7A7D96] hover:text-[#14142B] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
