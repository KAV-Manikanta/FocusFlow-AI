import React, { useState } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';

export const FocusPage: React.FC = () => {
  const {
    tasks,
    userProfile,
    focusSessions,
    timerMode,
    setTimerMode,
    timerSecondsLeft,
    timerTotalSeconds,
    timerRunning,
    activeFocusTaskId,
    setActiveFocusTaskId,
    startTimer,
    pauseTimer,
    resetTimer,
    completeFocusSessionEarly,
    deleteFocusSession,
    clearFocusSessions,
  } = useFocusFlow();

  const [customMins, setCustomMins] = useState(45);
  const [confirmClear, setConfirmClear] = useState(false);

  const activeTasks = tasks.filter((t) => t.status !== 'Completed' && t.status !== 'Archived');
  const linkedTask = tasks.find((t) => t.id === activeFocusTaskId);

  const mins = Math.floor(timerSecondsLeft / 60);
  const secs = timerSecondsLeft % 60;
  const progressPct =
    timerTotalSeconds > 0
      ? Math.round(((timerTotalSeconds - timerSecondsLeft) / timerTotalSeconds) * 100)
      : 0;

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayFocusMinutes = focusSessions
    .filter((s) => s.completed && s.startedAt.startsWith(todayIso))
    .reduce((acc, s) => acc + s.actualMinutes, 0);

  return (
    <div className="space-y-6">
      <div className="pb-5 border-b border-[#ECEDF5]">
        <h1 className="font-display text-2xl font-bold text-[#14142B]">Focus Mode</h1>
        <p className="text-sm text-[#7A7D96] mt-0.5">
          Distraction-free Pomodoro and deep-work timer linked to your tasks. State persists seamlessly across page navigation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Timer Console */}
        <div className="lg:col-span-7 bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-8 flex flex-col items-center text-center space-y-6">
          {/* Mode Selector Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-[#F4F5FB] border border-[#ECEDF5] rounded-lg">
            {[
              { id: 'pomodoro', label: 'Pomodoro (25m)' },
              { id: 'custom', label: `Deep Work (${customMins}m)` },
              { id: 'short_break', label: 'Short Break (5m)' },
              { id: 'long_break', label: 'Long Break (15m)' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setTimerMode(m.id as any, customMins)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  timerMode === m.id ? 'bg-[#5B3FE0] text-white' : 'text-[#7A7D96] hover:text-[#14142B]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {timerMode === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="custom-focus-mins" className="text-[#7A7D96]">
                Custom Duration (Minutes):
              </label>
              <input
                id="custom-focus-mins"
                type="number"
                min={5}
                max={180}
                step={5}
                value={customMins}
                onChange={(e) => {
                  const v = Number(e.target.value) || 45;
                  setCustomMins(v);
                  setTimerMode('custom', v);
                }}
                className="w-20 px-2.5 py-1 bg-[#F4F5FB] border border-[#E2E4F0] rounded text-[#14142B] font-mono text-center"
              />
            </div>
          )}

          {/* Large Monospace Timer Readout */}
          <div className="py-6">
            <div
              data-testid="focus-timer-display"
              className="font-mono text-6xl sm:text-7xl font-bold text-[#14142B] tabular-nums tracking-tight"
            >
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <p className="text-xs font-mono text-[#7A7D96] mt-2 tabular-nums">
              Session Progress: {progressPct}% · Linked to: {linkedTask?.title || 'General Deep Work'}
            </p>
          </div>

          {/* Linked Task Selector */}
          <div className="w-full max-w-md text-left">
            <label htmlFor="focus-task-select" className="block text-xs text-[#7A7D96] mb-1.5">
              Linked Active Deliverable
            </label>
            <select
              id="focus-task-select"
              value={activeFocusTaskId}
              onChange={(e) => setActiveFocusTaskId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F4F5FB] border border-[#E2E4F0] rounded-lg text-sm text-[#14142B]"
            >
              {activeTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} (Est {t.estimatedMinutes}m)
                </option>
              ))}
            </select>
          </div>

          {/* Primary Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => (timerRunning ? pauseTimer() : startTimer())}
              className="py-3 px-8 rounded-2xl bg-[#5B3FE0] hover:bg-[#4B30C8] text-white text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{timerRunning ? 'Pause Session' : 'Start Focus Session'}</span>
            </button>

            <button
              type="button"
              onClick={resetTimer}
              className="py-3 px-4 rounded-2xl bg-[#F4F5FA] hover:bg-[#E8E9F4] text-[#3B3D58] text-sm font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={completeFocusSessionEarly}
              className="py-3 px-4 rounded-2xl bg-[#22C55E]/15 hover:bg-[#22C55E]/25 text-[#16A34A] text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Log &amp; Complete Session</span>
            </button>
          </div>
        </div>

        {/* Right 5 Cols: Daily Focus Goal & Session History */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-[#14142B]">Daily Focus Goal</h2>
              <Clock className="w-4 h-4 text-[#5B3FE0]" />
            </div>
            <div className="flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-3xl font-bold text-[#14142B]">{todayFocusMinutes}m</span>
              <span className="text-xs text-[#7A7D96]">/ {userProfile.dailyFocusGoalMinutes}m target</span>
            </div>
            <div className="w-full h-2 bg-[#F4F5FB] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#5B3FE0] transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((todayFocusMinutes / Math.max(1, userProfile.dailyFocusGoalMinutes)) * 100))}%`,
                }}
              />
            </div>
          </div>

          <div className="bg-white shadow-card border border-[#ECEDF5] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-[#14142B]">Completed Focus Sessions</h2>
              {focusSessions.length > 0 &&
                (confirmClear ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearFocusSessions();
                        setConfirmClear(false);
                      }}
                      className="py-1 px-2.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-[11px] font-semibold"
                    >
                      Delete all
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="py-1 px-2.5 rounded-lg bg-[#F4F5FA] text-[11px] text-[#5A5C78]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="text-[11px] font-semibold text-[#DC2626] hover:underline"
                  >
                    Clear log
                  </button>
                ))}
            </div>
            {focusSessions.length === 0 && <p className="text-xs text-[#9A9CB3]">No focus sessions logged yet.</p>}
            <div className="divide-y divide-[#ECEDF5]">
              {focusSessions.slice(0, 10).map((session) => (
                <div key={session.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#14142B] truncate">
                      {session.taskTitle || 'Deep Work Session'}
                    </p>
                    <p className="text-xs text-[#7A7D96] font-mono tabular-nums mt-0.5">
                      {session.mode} · {session.startedAt.slice(0, 10)}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#16A34A] tabular-nums shrink-0">
                    +{session.actualMinutes}m
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteFocusSession(session.id)}
                    aria-label={`Delete session ${session.taskTitle || 'Deep Work Session'}`}
                    className="p-1.5 rounded-lg text-[#9A9CB3] hover:text-[#DC2626] hover:bg-[#FEF2F2] shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
